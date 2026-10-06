"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { observeCommit, syncServerClock } from "@/lib/session/clock";
import type {
  ChampionRow,
  MatchupRow,
  ParticipantRow,
  SessionRow,
} from "@/lib/supabase/types";

/**
 * Live session state.
 *
 * Two channels of truth, deliberately:
 *
 *   Postgres  — who is *in* the session, the champions, the matchups, the
 *               tallies. Authoritative. Bots live here too, because a bot has
 *               to be able to vote whether or not anyone has a tab open.
 *   Presence  — who is *connected right now*. Cosmetic only; a dropped
 *               connection must never remove someone's vote or change the
 *               denominator a matchup resolves against.
 *
 * Everything mutating goes through an RPC. This hook only ever reads.
 */

export interface SessionState {
  session: SessionRow | null;
  participants: ParticipantRow[];
  champions: ChampionRow[];
  matchups: MatchupRow[];
  /** Participant ids currently holding a websocket. */
  online: Set<string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSession(code: string, participantId?: string): SessionState {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [champions, setChampions] = useState<ChampionRow[]>([]);
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const db = supabase();

    const { data: s, error: sErr } = await db
      .from("rr_sessions")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (sErr) {
      setError(sErr.message);
      setLoading(false);
      return;
    }
    if (!s) {
      setError(`No session with code ${code.toUpperCase()}.`);
      setLoading(false);
      return;
    }

    const row = s as SessionRow;
    sessionIdRef.current = row.id;
    setSession(row);

    const [p, c, m] = await Promise.all([
      db.from("rr_participants").select("*").eq("session_id", row.id).order("joined_at"),
      db.from("rr_champions").select("*").eq("session_id", row.id).order("created_at"),
      db
        .from("rr_matchups")
        .select("*")
        .eq("session_id", row.id)
        .order("round")
        .order("order_in_round"),
    ]);

    if (p.data) setParticipants(p.data as ParticipantRow[]);
    if (c.data) setChampions(c.data as ChampionRow[]);
    if (m.data) setMatchups(m.data as MatchupRow[]);

    setError(null);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    // Timers compare against server timestamps; calibrate before the first read.
    void syncServerClock().then(load);
  }, [load]);

  // Realtime. Row changes are applied in place where possible so the UI can
  // animate a diff (a leaderboard reshuffle, a tally appearing) rather than
  // blinking through a full refetch.
  useEffect(() => {
    const sessionId = session?.id;
    if (!sessionId) return;

    const db = supabase();
    let channel: RealtimeChannel | null = null;

    /**
     * Merge, never replace.
     *
     * A Realtime change payload is not guaranteed to carry every column, and in
     * practice the `rr_champions` UPDATEs fired on each resolve arrived without
     * the jsonb evidence fields. Replacing the row wholesale therefore wiped the
     * quotes and lost-deal companies off any champion that had actually fought —
     * so the evidence drawer emptied out precisely when someone opened it during
     * a contested discussion, and the CSV export lost the same data.
     *
     * Merging keeps whatever the initial read established and lets the payload
     * update only the fields it actually carries.
     */
    const upsert = <T extends { id: string }>(rows: T[], row: T): T[] => {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i === -1) return [...rows, row];
      const next = rows.slice();
      next[i] = { ...next[i], ...row };
      return next;
    };

    channel = db
      .channel(`rr:${sessionId}`, { config: { presence: { key: participantId ?? "anon" } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rr_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          observeCommit(payload.commit_timestamp);
          if (payload.eventType === "DELETE") return;
          setSession(payload.new as SessionRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rr_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          observeCommit(payload.commit_timestamp);
          if (payload.eventType === "DELETE") {
            const gone = payload.old as { id: string };
            setParticipants((rows) => rows.filter((r) => r.id !== gone.id));
          } else {
            setParticipants((rows) => upsert(rows, payload.new as ParticipantRow));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rr_champions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          observeCommit(payload.commit_timestamp);
          if (payload.eventType === "DELETE") {
            const gone = payload.old as { id: string };
            setChampions((rows) => rows.filter((r) => r.id !== gone.id));
          } else {
            setChampions((rows) => upsert(rows, payload.new as ChampionRow));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rr_matchups",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          observeCommit(payload.commit_timestamp);
          if (payload.eventType === "DELETE") {
            const gone = payload.old as { id: string };
            setMatchups((rows) => rows.filter((r) => r.id !== gone.id));
          } else {
            setMatchups((rows) => upsert(rows, payload.new as MatchupRow));
          }
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel!.presenceState<{ participantId: string }>();
        const ids = new Set<string>();
        for (const entries of Object.values(state)) {
          for (const e of entries) if (e.participantId) ids.add(e.participantId);
        }
        setOnline(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          if (participantId) await channel!.track({ participantId });
          // Realtime can miss changes that landed between the initial read and
          // the subscription going live. One catch-up read closes that window.
          await load();
        }
      });

    return () => {
      void db.removeChannel(channel!);
    };
    // `load` is stable per code; re-subscribing on every render would thrash.
  }, [session?.id, participantId, load]);

  return useMemo(
    () => ({
      session,
      participants,
      champions,
      matchups,
      online,
      loading,
      error,
      refresh: load,
    }),
    [session, participants, champions, matchups, online, loading, error, load],
  );
}
