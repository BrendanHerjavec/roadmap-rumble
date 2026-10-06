"use client";

import { AnimatePresence, motion } from "motion/react";
import { Champion } from "@/components/champion/Champion";
import { standings } from "@/lib/game/pairing";
import type { ChampionRow } from "@/lib/supabase/types";

/**
 * Live standings.
 *
 * The brief asks for champions to physically move positions when the table
 * reshuffles, so every row is a `layout` motion element: React reorders the
 * list and motion tweens each row from where it used to be to where it now is.
 * Nothing here computes positions — that would fight the layout engine and
 * desync the moment a row changes height.
 *
 * It slides in on its own whenever a matchup resolves, holds while the result
 * is read, and gets out of the way. The matchup is the screen; this is a beat
 * inside it.
 */
export function Leaderboard({
  champions,
  open,
  highlight,
  onToggle,
}: {
  champions: ChampionRow[];
  open: boolean;
  /** Champion ids in the matchup that just resolved. */
  highlight: string[];
  onToggle: () => void;
}) {
  const table = standings(champions);

  return (
    <>
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-xl border border-r-0 border-white/12 bg-pit-900/90 px-2 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 backdrop-blur transition hover:text-white/90"
        style={{ writingMode: "vertical-rl" }}
        aria-expanded={open}
      >
        {open ? "Hide" : "Standings"}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="absolute right-9 top-1/2 z-20 max-h-[82vh] w-[268px] -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-pit-900/85 p-3 backdrop-blur-md"
          >
            <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              Standings
            </h2>

            <ol className="space-y-1">
              {table.map((c, i) => (
                <motion.li
                  key={c.id}
                  layout
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    highlight.includes(c.id)
                      ? "bg-ember-500/15 ring-1 ring-ember-400/40"
                      : i < 3
                        ? "bg-white/[0.05]"
                        : ""
                  }`}
                >
                  <span
                    className={`tabular w-5 shrink-0 text-right text-xs font-black ${
                      i === 0
                        ? "text-ember-300"
                        : i < 3
                          ? "text-white/70"
                          : "text-white/30"
                    }`}
                  >
                    {i + 1}
                  </span>

                  <Champion
                    evidence={{
                      featureKey: c.feature_key,
                      calls: c.calls,
                      lostDeals: c.lost_deals,
                      revenueAtStake: c.revenue_at_stake,
                      firstMentioned: c.first_mentioned,
                    }}
                    name={c.name}
                    state={{ losses: c.losses, rank: i + 1 }}
                    size={38}
                    instance="board"
                    pose="still"
                    className="shrink-0"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold leading-tight text-white/85">
                      {c.name}
                    </span>
                    <span className="block text-[10px] leading-tight text-white/35">
                      {c.played === 0
                        ? "not fought yet"
                        : `${c.wins}W ${c.losses}L${c.draws ? ` ${c.draws}D` : ""}`}
                    </span>
                  </span>

                  <span className="tabular shrink-0 text-[11px] font-bold text-white/55">
                    {Math.round(c.rating)}
                  </span>
                </motion.li>
              ))}
            </ol>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
