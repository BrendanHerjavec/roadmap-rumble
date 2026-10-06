/**
 * Swiss pairing.
 *
 * Not a knockout bracket, deliberately. A bracket reliably identifies the
 * winner and throws away everything else, and the output we want here is a
 * *ranked backlog* — every champion needs several opponents so its rating means
 * something. Nothing is ever eliminated.
 *
 * Round 1 pairs strongest against weakest on evidence weight, which puts the
 * lopsided matchups first and gets the room warmed up on easy calls. Later
 * rounds pair on current rating, so champions converge on opponents of their
 * own strength — that's where the genuinely close votes live.
 *
 * Rematches are avoided while any unplayed pairing remains.
 */

import type { ChampionRow, MatchupRow } from "@/lib/supabase/types";

export interface Pair {
  a: string;
  b: string;
}

/** Total matchups per round: one per two champions, odd champion sits out. */
export function pairsPerRound(championCount: number): number {
  return Math.floor(championCount / 2);
}

/**
 * How many rounds it takes for everyone to have a meaningful record.
 * Swiss convention is ceil(log2(n)); we add one because ratings need a couple
 * of results before the pairings get interesting.
 */
export function suggestedRounds(championCount: number): number {
  if (championCount < 2) return 0;
  return Math.min(8, Math.ceil(Math.log2(championCount)) + 1);
}

/**
 * A single scalar for "how strong does the evidence look", used only to seed
 * round 1. Deliberately crude — the room's votes are what actually rank things.
 */
function evidenceWeight(c: ChampionRow): number {
  return (
    c.calls * 1.0 +
    c.lost_deals * 4.0 +
    Math.min(c.revenue_at_stake / 100_000, 30)
  );
}

function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** Every pairing already played (or scheduled) this session. */
export function playedPairs(matchups: MatchupRow[]): Set<string> {
  return new Set(matchups.map((m) => pairKey(m.champion_a, m.champion_b)));
}

export function nextRoundPairs(
  champions: ChampionRow[],
  matchups: MatchupRow[],
  round: number,
): Pair[] {
  if (champions.length < 2) return [];

  const seen = playedPairs(matchups);

  // Round 1 has no ratings to work with, so order by evidence and fold the list
  // in half: the biggest champion meets the smallest. Those are quick, lopsided
  // votes that teach the room to read the art before anything subtle shows up.
  if (round <= 1) {
    const sorted = [...champions].sort(
      (a, b) =>
        evidenceWeight(b) - evidenceWeight(a) ||
        a.feature_key.localeCompare(b.feature_key),
    );
    const pairs: Pair[] = [];
    const half = Math.floor(sorted.length / 2);
    for (let i = 0; i < half; i++) {
      pairs.push({ a: sorted[i].feature_key, b: sorted[sorted.length - 1 - i].feature_key });
    }
    return pairs;
  }

  // Later rounds: sort by rating, then greedily pair each champion with the
  // nearest-rated opponent it hasn't met.
  const pool = [...champions].sort(
    (a, b) => b.rating - a.rating || a.feature_key.localeCompare(b.feature_key),
  );

  const used = new Set<string>();
  const pairs: Pair[] = [];

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (used.has(a.id)) continue;

    let partner: ChampionRow | null = null;
    let fallback: ChampionRow | null = null;

    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j];
      if (used.has(b.id)) continue;
      if (!fallback) fallback = b;
      if (!seen.has(pairKey(a.id, b.id))) {
        partner = b;
        break;
      }
    }

    // Everyone left has already faced this champion — a rematch beats a bye.
    const chosen = partner ?? fallback;
    if (!chosen) break;

    used.add(a.id);
    used.add(chosen.id);
    pairs.push({ a: a.feature_key, b: chosen.feature_key });
  }

  return pairs;
}

/**
 * Final standings. Rating orders the table; the rest are tiebreaks that favour
 * champions who won more of what they played.
 */
export function standings(champions: ChampionRow[]): ChampionRow[] {
  return [...champions].sort(
    (a, b) =>
      b.rating - a.rating ||
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.calls - a.calls ||
      a.feature_key.localeCompare(b.feature_key),
  );
}

/** 1-based leaderboard position per champion id. Drives crowns and glow. */
export function rankMap(champions: ChampionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  standings(champions).forEach((c, i) => map.set(c.id, i + 1));
  return map;
}
