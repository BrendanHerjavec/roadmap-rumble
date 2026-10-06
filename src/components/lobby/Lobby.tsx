"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { BOT_PERSONAS } from "@/lib/game/bots";
import { DEMO_BOT_BIASES } from "@/lib/game/demo-script";
import { PACES } from "@/lib/game/pace";
import type {
  BotBias,
  ChampionRow,
  ChampionSeed,
  ParticipantRow,
  SessionRow,
} from "@/lib/supabase/types";
import { Champion } from "@/components/champion/Champion";
import { Button } from "@/components/ui/Button";

interface Props {
  session: SessionRow;
  participants: ParticipantRow[];
  champions: ChampionRow[];
  online: Set<string>;
  isHost: boolean;
  meId: string | null;
}

export function Lobby({
  session,
  participants,
  champions,
  online,
  isHost,
  meId,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const humans = participants.filter((p) => !p.is_bot);
  const bots = participants.filter((p) => p.is_bot);
  const usedBiases = new Set(bots.map((b) => b.bot_bias));

  const call = useCallback(
    // The Supabase query builder is thenable but not a Promise, hence PromiseLike.
    async (label: string, fn: () => PromiseLike<{ error: unknown }>) => {
      setBusy(label);
      setError(null);
      try {
        const { error } = await fn();
        if (error) throw error;
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  return (
    <main className="stage-bg grain relative min-h-screen pb-24">
      <div className="mx-auto max-w-6xl px-8 pt-10">
        <RoomHeader code={session.code} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-8">
            <Roster
              humans={humans}
              bots={bots}
              online={online}
              meId={meId}
              isHost={isHost}
              busy={busy}
              onRemove={(id) =>
                call(`remove-${id}`, () =>
                  supabase().rpc("rr_remove_participant", { p_participant_id: id }),
                )
              }
            />

            {isHost ? (
              <BotPicker
                used={usedBiases}
                busy={busy}
                onAdd={(bias, name) =>
                  call(`bot-${bias}`, () =>
                    supabase().rpc("rr_add_bot", {
                      p_session_id: session.id,
                      p_name: name,
                      p_bias: bias,
                    }),
                  )
                }
              />
            ) : null}
          </div>

          <div className="space-y-8">
            {isHost ? (
              <ChampionSetup
                sessionId={session.id}
                champions={champions}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            ) : null}

            <ChampionPreview champions={champions} />
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-8 text-sm text-blood-400">
            {error}
          </p>
        ) : null}

        {isHost ? (
          <StartBar
            session={session}
            champions={champions}
            participants={participants}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onAddCast={async (missing) => {
              for (const bias of missing) {
                const persona = BOT_PERSONAS.find((p) => p.bias === bias);
                if (!persona) continue;
                await supabase().rpc("rr_add_bot", {
                  p_session_id: session.id,
                  p_name: persona.name,
                  p_bias: bias,
                });
              }
            }}
          />
        ) : (
          <p className="mt-12 text-center text-sm uppercase tracking-[0.3em] text-white/35">
            Waiting for the host to start…
          </p>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function RoomHeader({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ember-400">
          Lobby
        </p>
        <h1 className="mt-1 text-5xl font-black uppercase italic tracking-tight text-white">
          Roadmap Rumble
        </h1>
      </div>

      <button
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="group rounded-2xl border border-white/12 bg-white/[0.04] px-7 py-3 text-left transition hover:border-ember-400/50"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
          {copied ? "Copied" : "Room code — click to copy"}
        </span>
        <span className="tabular block text-4xl font-black tracking-[0.35em] text-white">
          {code}
        </span>
      </button>
    </header>
  );
}

function Roster({
  humans,
  bots,
  online,
  meId,
  isHost,
  busy,
  onRemove,
}: {
  humans: ParticipantRow[];
  bots: ParticipantRow[];
  online: Set<string>;
  meId: string | null;
  isHost: boolean;
  busy: string | null;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <SectionTitle>
        In the room
        <span className="ml-2 text-white/35">{humans.length + bots.length}</span>
      </SectionTitle>

      <ul className="mt-3 space-y-1.5">
        {[...humans, ...bots].map((p) => (
          <li
            key={p.id}
            className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                p.is_bot
                  ? "bg-arc-400"
                  : online.has(p.id)
                    ? "bg-volt-400"
                    : "bg-white/20"
              }`}
              title={p.is_bot ? "AI voter" : online.has(p.id) ? "Connected" : "Away"}
            />
            <span className="flex-1 truncate text-sm font-semibold text-white/90">
              {p.name}
              {p.id === meId ? <span className="text-white/35"> (you)</span> : null}
            </span>
            {p.is_host ? <Tag>Host</Tag> : null}
            {p.is_bot ? <Tag tone="arc">{p.bot_bias}</Tag> : null}
            {isHost && !p.is_host ? (
              <button
                onClick={() => onRemove(p.id)}
                disabled={busy === `remove-${p.id}`}
                className="text-xs text-white/0 transition group-hover:text-white/40 hover:!text-blood-400"
                aria-label={`Remove ${p.name}`}
              >
                remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BotPicker({
  used,
  busy,
  onAdd,
}: {
  used: Set<string | null>;
  busy: string | null;
  onAdd: (bias: string, name: string) => void;
}) {
  return (
    <section>
      <SectionTitle>Add AI voters</SectionTitle>
      <p className="mt-1 text-xs leading-relaxed text-white/40">
        They read the same evidence differently, so they will not agree with each
        other. That disagreement is what makes a matchup contested.
      </p>

      <div className="mt-3 space-y-2">
        {BOT_PERSONAS.map((persona) => {
          const added = used.has(persona.bias);
          return (
            <button
              key={persona.bias}
              onClick={() => onAdd(persona.bias, persona.name)}
              disabled={added || busy === `bot-${persona.bias}`}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition enabled:hover:border-arc-400/50 enabled:hover:bg-white/[0.06] disabled:opacity-40"
            >
              <span className="flex items-center justify-between">
                <span className={`text-sm font-bold ${persona.accent}`}>
                  {persona.name}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                  {added ? "in the room" : "add"}
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-white/45">
                {persona.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChampionSetup({
  sessionId,
  champions,
  busy,
  setBusy,
  setError,
}: {
  sessionId: string;
  champions: ChampionRow[];
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const [mined, setMined] = useState<ChampionSeed[] | null>(null);
  const [extra, setExtra] = useState<ChampionSeed[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [by, setBy] = useState("");

  useEffect(() => {
    fetch("/api/roster")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMined(d.champions as ChampionSeed[]);
      })
      .catch((e) => setError((e as Error).message));
  }, [setError]);

  const total = (mined?.length ?? 0) + extra.length;

  async function seed(list: ChampionSeed[]) {
    setBusy("seed");
    setError(null);
    try {
      const { error } = await supabase().rpc("rr_seed_champions", {
        p_session_id: sessionId,
        p_champions: list,
      });
      if (error) throw error;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function addIdea() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const idea: ChampionSeed = {
      featureKey: `human-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name: trimmed,
      description: desc.trim() || "Typed in before the session.",
      calls: 0,
      lostDeals: 0,
      revenueAtStake: 0,
      firstMentioned: new Date().toISOString().slice(0, 10),
      origin: "human",
      submittedBy: by.trim() || undefined,
      // A typed-in idea has no corpus behind it. Saying so plainly is the point:
      // the results screen reveals it was somebody's conviction, not evidence.
      problem: desc.trim() || "Typed in before the session. No problem statement captured.",
      counterweight:
        "Nothing in the call corpus supports or contradicts this. Judge it on the argument in the room.",
      evidence: [],
      lostDealCompanies: [],
    };
    setExtra((xs) => [...xs, idea]);
    setName("");
    setDesc("");
  }

  return (
    <section>
      <SectionTitle>Champions</SectionTitle>
      <p className="mt-1 text-xs leading-relaxed text-white/40">
        {mined
          ? `${mined.length} candidates from 40 sales calls. Origin stays hidden until the results screen.`
          : "Loading the mined backlog…"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => mined && seed([...mined, ...extra])}
          disabled={!mined || busy === "seed"}
        >
          {busy === "seed"
            ? "Loading…"
            : champions.length
              ? `Reload ${total} champions`
              : `Load ${total} champions`}
        </Button>
        {champions.length ? (
          <span className="text-sm text-volt-400">
            {champions.length} in the arena
          </span>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">
          Add your own idea
        </h3>
        <p className="mt-1 text-xs text-white/35">
          Goes into the same arena as the mined ones. Nobody voting will know
          which is which.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Feature name"
            className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-ember-400/60"
          />
          <input
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder="Submitted by (revealed at the end)"
            className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-ember-400/60"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            placeholder="One sentence describing it"
            className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-ember-400/60 sm:col-span-2"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="ghost" onClick={addIdea} disabled={!name.trim()} className="px-4 py-2">
            Add
          </Button>
          {extra.length ? (
            <span className="text-xs text-white/45">
              {extra.length} typed in —{" "}
              <span className="text-white/70">{extra.map((e) => e.name).join(", ")}</span>
              . Load champions to commit.
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ChampionPreview({ champions }: { champions: ChampionRow[] }) {
  if (!champions.length) return null;

  return (
    <section>
      <SectionTitle>The field</SectionTitle>
      <div className="mt-3 flex flex-wrap gap-1">
        {champions.map((c) => (
          <div key={c.id} className="flex w-[92px] flex-col items-center">
            <Champion
              evidence={{
                featureKey: c.feature_key,
                calls: c.calls,
                lostDeals: c.lost_deals,
                revenueAtStake: c.revenue_at_stake,
                firstMentioned: c.first_mentioned,
              }}
              name={c.name}
              size={110}
              instance="lobby"
            />
            <span className="mt-0.5 line-clamp-2 text-center text-[10px] leading-tight text-white/45">
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StartBar({
  session,
  champions,
  participants,
  busy,
  setBusy,
  setError,
  onAddCast,
}: {
  session: SessionRow;
  champions: ChampionRow[];
  participants: ParticipantRow[];
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
  onAddCast: (missing: BotBias[]) => Promise<void>;
}) {
  const [scripted, setScripted] = useState(false);
  const voters = participants.length;

  const present = new Set(participants.filter((p) => p.is_bot).map((p) => p.bot_bias));
  const missingCast = DEMO_BOT_BIASES.filter((b) => !present.has(b)) as BotBias[];

  const blocked =
    champions.length < 4
      ? "Load at least 4 champions to start."
      : voters < 2
        ? "Add at least one more voter — a bot counts."
        : null;

  async function start() {
    setBusy("start");
    setError(null);
    try {
      const res = await fetch(`/api/session/${session.code}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scripted }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start the session.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-14 flex flex-col items-center gap-4">
      <div className="w-full max-w-xl">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
          Pace
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PACES.map((p) => {
            const active = session.vote_seconds === p.voteSeconds;
            return (
              <button
                key={p.key}
                onClick={async () => {
                  setBusy(`pace-${p.key}`);
                  setError(null);
                  try {
                    const { error } = await supabase().rpc("rr_set_pace", {
                      p_session_id: session.id,
                      p_vote_seconds: p.voteSeconds,
                      p_discussion_seconds: p.discussionSeconds,
                    });
                    if (error) throw error;
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy === `pace-${p.key}`}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-ember-400/60 bg-ember-500/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span
                  className={`block text-sm font-bold ${active ? "text-ember-300" : "text-white/80"}`}
                >
                  {p.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-white/40">
                  {p.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-3.5 text-left transition hover:border-white/15">
        <input
          type="checkbox"
          checked={scripted}
          onChange={(e) => setScripted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ember-500)]"
        />
        <span>
          <span className="block text-sm font-bold text-white/90">
            Scripted demo run
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
            Pins round 1 to a fixed running order so the same beats land in every
            take: the visual language first, the calls-versus-lost-deals clash
            second, the contested vote third. Only the pairings are scripted —
            everyone still votes for real. Later rounds go back to Swiss.
          </span>
        </span>
      </label>

      {scripted && missingCast.length ? (
        <div className="flex max-w-xl flex-col items-center gap-2 text-center">
          <p className="text-xs leading-relaxed text-ember-300">
            The script is tuned against all five AI voters. Without{" "}
            {missingCast.join(", ")} the contested vote isn&apos;t guaranteed.
          </p>
          <Button
            variant="ghost"
            className="px-4 py-2 text-xs"
            disabled={busy === "cast"}
            onClick={async () => {
              setBusy("cast");
              try {
                await onAddCast(missingCast);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "cast" ? "Adding…" : `Add the missing ${missingCast.length}`}
          </Button>
        </div>
      ) : null}

      <Button
        onClick={start}
        disabled={Boolean(blocked) || busy === "start"}
        className="px-12 py-4 text-base"
      >
        {busy === "start"
          ? "Pairing the field…"
          : scripted
            ? "Start the scripted run"
            : "Start the rumble"}
      </Button>
      <p className="text-xs uppercase tracking-[0.25em] text-white/30">
        {blocked ?? `${champions.length} champions · ${voters} voters`}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white/55">
      {children}
    </h2>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "arc";
}) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        tone === "arc"
          ? "bg-arc-500/20 text-arc-300"
          : "bg-ember-500/20 text-ember-300"
      }`}
    >
      {children}
    </span>
  );
}
