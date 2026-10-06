"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Champion } from "@/components/champion/Champion";
import { BracketBoard } from "./BracketBoard";
import { Button } from "@/components/ui/Button";
import { standings } from "@/lib/game/pairing";
import {
  disagreementLogCsv,
  downloadCsv,
  rankedBacklogCsv,
} from "@/lib/game/export";
import type { ChampionRow, MatchupRow, SessionRow } from "@/lib/supabase/types";

/**
 * The payoff screen.
 *
 * Two things happen here that cannot happen anywhere else in the session.
 *
 * First, **origins are revealed**. For the whole game nobody knew whether they
 * were judging a cluster mined out of forty sales calls or the VP of Sales'
 * pet idea. Now the mined champions carry a circuit pattern, the typed-in ones
 * fly a banner with the name of whoever submitted them, and the room finds out
 * what it actually voted for. If a human idea beat the data, that is worth
 * knowing. If the CRO's idea came last, that is worth knowing too.
 *
 * Second, the disagreement log. The ranking is the obvious artefact; the log of
 * where the room split, and what each side argued, is the one you couldn't have
 * produced without playing.
 */
export function Results({
  session,
  champions,
  matchups,
}: {
  session: SessionRow;
  champions: ChampionRow[];
  matchups: MatchupRow[];
}) {
  const [revealed, setRevealed] = useState(false);
  const [view, setView] = useState<"standings" | "bracket">("standings");
  const table = standings(champions);

  const contested = matchups.filter((m) => m.status === "resolved" && m.contested);
  const played = matchups.filter((m) => m.status === "resolved").length;
  const humanWins = table.filter((c) => c.origin === "human");
  const bestHuman = humanWins.length ? table.indexOf(humanWins[0]) + 1 : null;

  return (
    <main className="stage-bg grain relative min-h-screen pb-24">
      <div className="mx-auto max-w-6xl px-8 pt-10">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-ember-400">
              Final ranking · room {session.code}
            </p>
            <h1 className="mt-1 text-5xl font-black uppercase italic tracking-tight text-white">
              The backlog, settled
            </h1>
            <p className="mt-2 max-w-xl text-white/55">
              {played} matchups, {contested.length} of them contested.{" "}
              {contested.length > 0
                ? "The contested ones are the reason this was worth a meeting."
                : "The room agreed on everything — worth asking whether the field was too easy."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!revealed ? (
              <Button onClick={() => setRevealed(true)} className="px-7">
                Reveal origins
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() =>
                downloadCsv(
                  `roadmap-rumble-${session.code}-backlog.csv`,
                  rankedBacklogCsv(champions),
                )
              }
            >
              Ranked backlog CSV
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                downloadCsv(
                  `roadmap-rumble-${session.code}-disagreements.csv`,
                  disagreementLogCsv(champions, matchups),
                )
              }
            >
              Disagreement log CSV
            </Button>
          </div>
        </header>

        {revealed ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm text-white/70"
          >
            <span className="font-bold text-white">Origins revealed.</span>{" "}
            {table.filter((c) => c.origin === "mined").length} champions were mined
            from 40 sales calls; {humanWins.length} were typed in by a person before
            the session.{" "}
            {bestHuman
              ? `The best-placed typed-in idea finished ${bestHuman}${ordinal(bestHuman)}.`
              : ""}
          </motion.div>
        ) : null}

        <div className="mt-8 flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {(["standings", "bracket"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition ${
                view === v
                  ? "bg-white/[0.08] text-white"
                  : "text-white/35 hover:text-white/70"
              }`}
            >
              {v === "standings" ? "Final ranking" : "The bracket"}
            </button>
          ))}
        </div>

        {view === "bracket" ? (
          <div className="mt-5">
            <BracketBoard champions={champions} matchups={matchups} />
          </div>
        ) : (
          <ol className="mt-5 space-y-2">
            {table.map((c, i) => (
              <Row key={c.id} champion={c} rank={i + 1} revealed={revealed} />
            ))}
          </ol>
        )}

        {contested.length ? (
          <section className="mt-14">
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
              Where the room split
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Every contested matchup, its split, and what each side argued.
            </p>

            <div className="mt-4 space-y-3">
              {contested.map((m) => {
                const a = champions.find((c) => c.id === m.champion_a);
                const b = champions.find((c) => c.id === m.champion_b);
                if (!a || !b) return null;
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-blood-500/25 bg-blood-500/[0.05] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-white">
                        {a.name} <span className="text-white/35">vs</span> {b.name}
                      </span>
                      <span className="tabular text-sm font-black text-blood-400">
                        {m.votes_a}–{m.votes_b}
                        {m.revote_of ? (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-white/35">
                            re-vote
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Argument accent="volt" name={a.name} text={m.argument_a} />
                      <Argument accent="arc" name={b.name} text={m.argument_b} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Row({
  champion,
  rank,
  revealed,
}: {
  champion: ChampionRow;
  rank: number;
  revealed: boolean;
}) {
  const top = rank <= 3;

  return (
    <motion.li
      layout
      className={`flex items-center gap-4 rounded-2xl border px-4 py-2.5 ${
        top
          ? "border-ember-400/25 bg-ember-500/[0.07]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <span
        className={`tabular w-8 shrink-0 text-right text-2xl font-black ${
          rank === 1 ? "text-ember-300" : top ? "text-white/80" : "text-white/25"
        }`}
      >
        {rank}
      </span>

      <Champion
        evidence={{
          featureKey: champion.feature_key,
          calls: champion.calls,
          lostDeals: champion.lost_deals,
          revenueAtStake: champion.revenue_at_stake,
          firstMentioned: champion.first_mentioned,
        }}
        name={champion.name}
        state={{
          losses: champion.losses,
          rank,
          revealOrigin: revealed,
          origin: champion.origin,
        }}
        size={74}
        instance="results"
        pose="idle"
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-white">{champion.name}</span>
          {revealed ? (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                champion.origin === "mined"
                  ? "bg-volt-500/20 text-volt-300"
                  : "bg-blood-500/25 text-blood-400"
              }`}
            >
              {champion.origin === "mined" ? "mined" : "typed in"}
            </span>
          ) : null}
          {revealed && champion.submitted_by ? (
            <span className="text-[11px] text-white/40">{champion.submitted_by}</span>
          ) : null}
        </div>
        <p className="truncate text-[12px] text-white/40">{champion.problem}</p>
      </div>

      <div className="tabular hidden shrink-0 gap-5 text-right text-[11px] sm:flex">
        <Stat label="calls" value={champion.calls} />
        <Stat label="lost" value={champion.lost_deals} />
        <Stat
          label="at stake"
          value={
            champion.revenue_at_stake >= 1_000_000
              ? `$${(champion.revenue_at_stake / 1e6).toFixed(2)}M`
              : `$${Math.round(champion.revenue_at_stake / 1000)}k`
          }
        />
        <Stat label="record" value={`${champion.wins}–${champion.losses}`} />
      </div>
    </motion.li>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="block w-[62px]">
      <span className="block font-bold text-white/80">{value}</span>
      <span className="block text-[9px] uppercase tracking-wider text-white/30">
        {label}
      </span>
    </span>
  );
}

function Argument({
  accent,
  name,
  text,
}: {
  accent: "volt" | "arc";
  name: string;
  text: string | null;
}) {
  return (
    <div>
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
          accent === "volt" ? "text-volt-400" : "text-arc-300"
        }`}
      >
        For {name}
      </span>
      <p className="mt-0.5 text-[13px] leading-snug text-white/70">
        {text || <span className="text-white/25">nothing captured</span>}
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
