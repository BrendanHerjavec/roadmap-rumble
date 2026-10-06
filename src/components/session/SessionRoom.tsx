"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session/useSession";
import { useHostOrchestrator } from "@/lib/session/useHostOrchestrator";
import { getIdentity, setIdentity, type Identity } from "@/lib/session/identity";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Lobby } from "@/components/lobby/Lobby";
import { Arena } from "@/components/arena/Arena";
import { Results } from "@/components/results/Results";
import { Button } from "@/components/ui/Button";

/**
 * The room. One URL for the whole session — what it renders follows
 * `session.status`, so every client moves together off Realtime rather than
 * anyone navigating anywhere.
 */
export function SessionRoom({ code }: { code: string }) {
  const [identity, setLocalIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    setLocalIdentity(getIdentity(code));
    setReady(true);
  }, [code]);

  const { session, participants, champions, matchups, online, loading, error } =
    useSession(code, identity?.participantId);

  const me = participants.find((p) => p.id === identity?.participantId);
  const isHost = me?.is_host ?? identity?.isHost ?? false;

  const advance = async () => {
    setAdvancing(true);
    try {
      await fetch(`/api/session/${code}/advance`, { method: "POST" });
    } finally {
      setAdvancing(false);
    }
  };

  const fastForward = async () => {
    setAdvancing(true);
    try {
      await fetch(`/api/session/${code}/fast-forward`, { method: "POST" });
    } finally {
      setAdvancing(false);
    }
  };

  const finish = async () => {
    if (!session) return;
    await supabase().rpc("rr_finish_session", { p_session_id: session.id });
  };

  const revote = async (matchupId: string) => {
    setAdvancing(true);
    try {
      await fetch(`/api/session/${code}/revote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchupId }),
      });
    } finally {
      setAdvancing(false);
    }
  };

  // The host's tab casts the bots' ballots, closes voting on the clock, and
  // moves a decided matchup on once it has been read.
  useHostOrchestrator({
    enabled: isHost && session?.status === "running",
    session,
    participants,
    champions,
    matchups,
    onAdvance: advance,
  });

  if (!isSupabaseConfigured()) return <Notice title="Supabase isn't configured" body="Add your project URL and anon key to .env.local, then restart the dev server." />;
  if (!ready || loading) return <Notice title="Joining…" body={`Room ${code}`} />;
  if (error) return <Notice title="Can't find that room" body={error} />;
  if (!session) return <Notice title="Can't find that room" body={`No session with code ${code}.`} />;

  // Arrived by link without joining first — the roster has to know you exist
  // before you can vote, so ask for a name.
  if (!identity) {
    return (
      <LateJoin
        code={code}
        onJoined={(id) => {
          setIdentity(code, id);
          setLocalIdentity(id);
        }}
      />
    );
  }

  if (session.status === "lobby") {
    return (
      <Lobby
        session={session}
        participants={participants}
        champions={champions}
        online={online}
        isHost={isHost}
        meId={identity.participantId}
      />
    );
  }

  // The current matchup is whichever is open, falling back to the most recently
  // resolved one so the room keeps looking at a result instead of a blank stage.
  const current =
    matchups.find((m) => m.id === session.current_matchup_id) ??
    matchups.find((m) => m.status === "open") ??
    [...matchups].reverse().find((m) => m.status === "resolved");

  if (session.status === "running" && current) {
    return (
      <Arena
        session={session}
        matchup={current}
        champions={champions}
        participants={participants}
        meId={identity.participantId}
        isHost={isHost}
        onAdvance={advance}
        onRevote={() => revote(current.id)}
        onFinish={finish}
        onFastForward={fastForward}
        advancing={advancing}
      />
    );
  }

  if (session.status === "finished") {
    return <Results session={session} champions={champions} matchups={matchups} />;
  }

  return (
    <Notice
      title="Session running"
      body={`Round ${session.round} · ${champions.length} champions · ${participants.length} voters. Waiting for the next matchup.`}
    />
  );
}

function LateJoin({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (id: Identity) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase().rpc("rr_join_session", {
        p_code: code,
        p_name: name || "Guest",
      });
      if (error) throw error;
      const row = (data as { session_id: string; participant_id: string }[])[0];
      onJoined({
        sessionId: row.session_id,
        participantId: row.participant_id,
        name: name || "Guest",
        isHost: false,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="stage-bg grain flex min-h-screen items-center justify-center px-8">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ember-400">
          Room {code}
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase italic text-white">
          Take a seat
        </h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Your name"
          maxLength={24}
          autoFocus
          className="mt-6 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-center text-white outline-none placeholder:text-white/25 focus:border-ember-400/60"
        />
        <Button onClick={join} disabled={busy} className="mt-3 w-full">
          {busy ? "Joining…" : "Join"}
        </Button>
        {error ? <p className="mt-3 text-sm text-blood-400">{error}</p> : null}
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="stage-bg grain flex min-h-screen items-center justify-center px-8">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-black uppercase italic text-white">{title}</h1>
        <p className="mt-3 text-white/55">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs font-semibold uppercase tracking-[0.3em] text-white/35 hover:text-white/70"
        >
          ← Back
        </Link>
      </div>
    </main>
  );
}
