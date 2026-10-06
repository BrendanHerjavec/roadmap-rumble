"use client";

import { motion } from "motion/react";
import type { ChampionRow } from "@/lib/supabase/types";

/**
 * The split.
 *
 * Before the reveal this shows only how many ballots are in — never which way
 * they lean. That isn't a UI nicety: the tallies genuinely do not exist on the
 * client until `rr_resolve_matchup` writes them to the matchup row, because the
 * `rr_votes` table is unreadable to the anon key.
 *
 * After the reveal the two halves race out from the centre. Where they meet is
 * the whole story of the matchup, so it is the biggest thing on the screen.
 */
export function VoteBar({
  a,
  b,
  votesA,
  votesB,
  revealed,
  ballotsIn,
  voters,
  contested,
  threshold,
}: {
  a: ChampionRow;
  b: ChampionRow;
  votesA: number | null;
  votesB: number | null;
  revealed: boolean;
  ballotsIn: number;
  voters: number;
  contested: boolean;
  threshold: number;
}) {
  const total = (votesA ?? 0) + (votesB ?? 0);
  const pctA = revealed && total > 0 ? ((votesA ?? 0) / total) * 100 : 50;
  const pctB = 100 - pctA;

  return (
    <div className="w-full">
      <div className="relative h-16 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {revealed ? (
          <>
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-volt-500 to-volt-400"
              initial={{ width: "50%" }}
              animate={{ width: `${pctA}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.15 }}
            />
            <motion.div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-arc-500 to-arc-400"
              initial={{ width: "50%" }}
              animate={{ width: `${pctB}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.15 }}
            />

            <motion.div
              className="absolute inset-0 flex items-center justify-between px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <span className="tabular text-3xl font-black text-pit-950 drop-shadow-sm">
                {votesA ?? 0}
              </span>
              <span className="tabular text-3xl font-black text-pit-950 drop-shadow-sm">
                {votesB ?? 0}
              </span>
            </motion.div>

            {/* Where a lopsided vote would have had to land. */}
            <div
              className="absolute inset-y-0 w-px bg-white/25"
              style={{ left: `${threshold * 100}%` }}
              title={`${Math.round(threshold * 100)}% — lopsided threshold`}
            />
            <div
              className="absolute inset-y-0 w-px bg-white/25"
              style={{ left: `${(1 - threshold) * 100}%` }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-4">
            <div className="flex gap-1.5">
              {Array.from({ length: Math.max(voters, 1) }).map((_, i) => (
                <motion.span
                  key={i}
                  className={`h-3 w-3 rounded-full ${
                    i < ballotsIn ? "bg-ember-400" : "bg-white/12"
                  }`}
                  animate={i < ballotsIn ? { scale: [1, 1.45, 1] } : {}}
                  transition={{ duration: 0.35 }}
                />
              ))}
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              {ballotsIn} of {voters} in
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em]">
        <span className="text-volt-400">{a.name}</span>
        {revealed ? (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className={contested ? "text-blood-400" : "text-white/35"}
          >
            {contested
              ? "Room is split"
              : `${Math.round(Math.max(pctA, pctB))}% — clear`}
          </motion.span>
        ) : (
          <span className="text-white/25">votes hidden until everyone is in</span>
        )}
        <span className="text-arc-300">{b.name}</span>
      </div>
    </div>
  );
}
