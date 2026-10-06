"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { serverNow } from "@/lib/session/clock";
import { botChoice, botDelayMs } from "@/lib/game/bots";
import { resultHoldMs } from "@/lib/game/pace";
import type {
  ChampionRow,
  MatchupRow,
  ParticipantRow,
  SessionRow,
} from "@/lib/supabase/types";

/**
 * The host's tab drives the clock.
 *
 * Somebody has to cast the bots' ballots and close voting when the timer runs
 * out, and with no server process that somebody is the host client. This is a
 * deliberate proof-of-concept tradeoff: if the host closes their laptop, the
 * round stalls. What it is *not* is a trust hole — the host can only call the
 * same RPCs as everyone else, and the database decides what a vote counts for.
 *
 * Both effects are written to be safely re-runnable rather than run-once:
 *
 *   - Each owns exactly the timers it created and cancels them on cleanup. An
 *     earlier version shared one timer list and wiped it from a separate
 *     unmount effect, which cancelled live timers that were never rescheduled.
 *   - Deps are primitives (ids, timestamps), not the row objects. Realtime
 *     hands us a fresh `matchups` array on every event, so depending on object
 *     identity would tear down and rebuild the timers constantly — and the
 *     vote-close countdown would restart every time a ballot landed.
 *   - Re-running is harmless because the RPCs are idempotent: `rr_votes` has a
 *     unique constraint per (matchup, participant), and `rr_resolve_matchup`
 *     no-ops once a matchup is resolved.
 */
export function useHostOrchestrator({
  enabled,
  session,
  participants,
  champions,
  matchups,
  onAdvance,
}: {
  enabled: boolean;
  session: SessionRow | null;
  participants: ParticipantRow[];
  champions: ChampionRow[];
  matchups: MatchupRow[];
  /** Called when a decided matchup has been on screen long enough. */
  onAdvance?: () => void;
}) {
  const open = matchups.find((m) => m.status === "open") ?? null;

  const matchupId = open?.id ?? null;
  const openedAt = open?.opened_at ?? null;
  const championAId = open?.champion_a ?? null;
  const championBId = open?.champion_b ?? null;
  const voteSeconds = session?.vote_seconds ?? 20;

  // Stable, primitive description of the bot line-up.
  const botSpec = participants
    .filter((p) => p.is_bot && p.bot_bias)
    .map((p) => `${p.id}:${p.bot_bias}`)
    .sort()
    .join(",");

  // --- bot ballots -------------------------------------------------------
  useEffect(() => {
    if (!enabled || !matchupId || !botSpec) return;

    const a = champions.find((c) => c.id === championAId);
    const b = champions.find((c) => c.id === championBId);
    if (!a || !b) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const entry of botSpec.split(",")) {
      const [botId, bias] = entry.split(":") as [string, "revenue" | "recency" | "underdog"];
      const choice = botChoice(bias, a, b);
      const delay = botDelayMs(botId, matchupId, voteSeconds);

      timers.push(
        setTimeout(() => {
          void supabase()
            .rpc("rr_cast_vote", {
              p_matchup_id: matchupId,
              p_participant_id: botId,
              p_choice: choice,
            })
            .then(({ error }) => {
              if (error) console.error("bot vote failed", error.message);
            });
        }, delay),
      );
    }

    return () => timers.forEach(clearTimeout);
    // `champions` is intentionally read but not a dep: ratings change on every
    // resolve, and a bot's pick for the *current* matchup is fixed once opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, matchupId, championAId, championBId, botSpec, voteSeconds]);

  // --- close voting when the window elapses ------------------------------
  useEffect(() => {
    if (!enabled || !matchupId || !openedAt) return;

    const endsAt = new Date(openedAt).getTime() + voteSeconds * 1000;
    // A beat of slack so a ballot cast on the final second still lands.
    const wait = Math.max(0, endsAt - serverNow()) + 600;

    const t = setTimeout(() => {
      void supabase()
        .rpc("rr_resolve_matchup", { p_matchup_id: matchupId })
        .then(({ error }) => {
          if (error) console.error("resolve failed", error.message);
        });
    }, wait);

    return () => clearTimeout(t);
  }, [enabled, matchupId, openedAt, voteSeconds]);

  // --- move on once a decided result has been read ------------------------
  //
  // The brief: a lopsided vote shows its result and advances after 5 seconds.
  // A contested one does the opposite — it stops the session, which is the
  // entire product, so it never auto-advances and waits for the host.
  // Look at the LATEST resolved matchup, contested or not, and only then decide
  // whether to advance. Filtering contested ones out of the candidate list
  // instead made a contested result fall back to an older decided matchup whose
  // hold had long expired — so the session skipped straight past the one moment
  // it is supposed to stop for.
  const latestResolved = matchups
    .filter((m) => m.status === "resolved" && m.resolved_at)
    .sort((x, y) => (x.resolved_at! < y.resolved_at! ? 1 : -1))[0];

  const stillOpen = matchups.some((m) => m.status === "open");
  const canAdvance =
    !stillOpen && Boolean(latestResolved) && !latestResolved!.contested;

  const decidedId = canAdvance ? latestResolved!.id : null;
  const decidedAt = canAdvance ? latestResolved!.resolved_at : null;

  useEffect(() => {
    if (!enabled || !decidedId || !decidedAt || !onAdvance) return;

    const hold = resultHoldMs(voteSeconds);
    const wait = Math.max(0, new Date(decidedAt).getTime() + hold - serverNow());

    const t = setTimeout(onAdvance, wait);
    return () => clearTimeout(t);
    // `onAdvance` is intentionally excluded: it is redefined on every render of
    // the room, and including it would restart this timer continuously so the
    // session would never actually advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, decidedId, decidedAt, voteSeconds]);
}
