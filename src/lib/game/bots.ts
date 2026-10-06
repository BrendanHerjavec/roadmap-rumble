/**
 * AI voters.
 *
 * The demo gets recorded by one person, so the room has to be able to fill
 * itself. Each bot reads the same evidence through a different lens, and that
 * disagreement is what makes a matchup contested.
 *
 * ## Why they are not single-issue voters
 *
 * The first version had each bot compare exactly one dimension. That produced
 * nonsense: two of three bots systematically backed whichever champion was
 * smaller and newer, so Single Sign-On (9 calls, 9 lost deals, $2.63M) tied 2-2
 * with AI Standup Digest (2 calls, 0 lost deals, $0) and got flagged contested.
 * If the room splits on the easy calls, "contested" stops meaning anything and
 * the discussion timer — the actual product — fires constantly.
 *
 * So a bot now scores both champions on the *whole* evidence base and then
 * applies its bias on top. A champion that is stronger on everything wins even
 * from a hostile voter; disagreement only appears where the dimensions genuinely
 * conflict. That is the behaviour the game is about.
 */

import type { BotBias, ChampionRow } from "@/lib/supabase/types";

export interface BotPersona {
  bias: BotBias;
  name: string;
  /** One line, shown in the lobby so the room knows what it just invited. */
  blurb: string;
  accent: string;
}

/**
 * Five viewpoints, deliberately spread across the evidence. `demand` and `risk`
 * exist because the two dimensions the seed data makes disagree — call volume
 * versus lost deals — deserve an advocate each. That is what turns a close vote
 * into an argument the room can actually have.
 */
export const BOT_PERSONAS: BotPersona[] = [
  {
    bias: "revenue",
    name: "The CFO",
    blurb: "Weighs revenue at stake above everything else.",
    accent: "text-ember-400",
  },
  {
    bias: "risk",
    name: "The Sales Lead",
    blurb: "Remembers every lost deal. Votes for whatever is costing them.",
    accent: "text-blood-400",
  },
  {
    bias: "demand",
    name: "The PM",
    blurb: "Counts how many customers actually asked for it.",
    accent: "text-volt-400",
  },
  {
    bias: "recency",
    name: "The New Hire",
    blurb: "Backs the newer idea. Assumes anything old is old for a reason.",
    accent: "text-arc-300",
  },
  {
    bias: "underdog",
    name: "The Contrarian",
    blurb: "Backs whoever is currently losing the session. Hates a coronation.",
    accent: "text-white/70",
  },
];

export const BOT_BY_BIAS = new Map(BOT_PERSONAS.map((p) => [p.bias, p]));

/** How much of a bot's decision is its bias rather than the shared evidence. */
const BIAS_WEIGHT = 0.45;

/** Head-to-head share. 0.5 when neither champion has any of this. */
function share(a: number, b: number): number {
  const total = a + b;
  return total <= 0 ? 0.5 : a / total;
}

function ageMonths(iso: string, now: number): number {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * What every voter can see, regardless of bias: demand, deals lost, money.
 * Weighted so that losing deals counts for more than being asked about a lot,
 * which is the product's own opinion and the reason the game is worth playing.
 */
function baseScore(x: ChampionRow, y: ChampionRow): number {
  return (
    0.45 * share(x.calls, y.calls) +
    0.35 * share(x.lost_deals, y.lost_deals) +
    0.2 * share(x.revenue_at_stake, y.revenue_at_stake)
  );
}

function biasScore(
  bias: BotBias,
  x: ChampionRow,
  y: ChampionRow,
  now: number,
): number {
  switch (bias) {
    case "revenue":
      return share(x.revenue_at_stake, y.revenue_at_stake);
    case "risk":
      return share(x.lost_deals, y.lost_deals);
    case "demand":
      return share(x.calls, y.calls);
    case "recency": {
      // Younger wins, so the *opponent's* age is this champion's score.
      const ax = ageMonths(x.first_mentioned, now);
      const ay = ageMonths(y.first_mentioned, now);
      return share(ay, ax);
    }
    case "underdog": {
      // Lower current rating wins. At the start of a session every rating is
      // equal, so this lands on 0.5 and the shared evidence decides — which is
      // correct: there is no coronation to object to yet.
      const lo = Math.min(x.rating, y.rating);
      return share(y.rating - lo, x.rating - lo);
    }
  }
}

export function botScore(
  bias: BotBias,
  x: ChampionRow,
  y: ChampionRow,
  now = Date.now(),
): number {
  return (
    (1 - BIAS_WEIGHT) * baseScore(x, y) + BIAS_WEIGHT * biasScore(bias, x, y, now)
  );
}

/**
 * Which champion a bot picks. Returns the chosen champion's id.
 * Deterministic — a bot never flips its own mind between renders, and the
 * tiebreak is stable rather than a coin flip.
 */
export function botChoice(
  bias: BotBias,
  a: ChampionRow,
  b: ChampionRow,
  now = Date.now(),
): string {
  const sa = botScore(bias, a, b, now);
  const sb = botScore(bias, b, a, now);
  if (Math.abs(sa - sb) > 1e-9) return sa > sb ? a.id : b.id;
  return a.feature_key < b.feature_key ? a.id : b.id;
}

/**
 * How long a bot waits before its ballot lands, in ms.
 *
 * Spread across most of the voting window so the counter ticks up like a real
 * room rather than snapping to full the instant the matchup opens. Seeded by
 * participant and matchup so a re-render doesn't reroll the delay.
 */
export function botDelayMs(
  participantId: string,
  matchupId: string,
  voteSeconds: number,
): number {
  let h = 2166136261;
  const s = `${participantId}:${matchupId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 1000) / 1000;
  const window = voteSeconds * 1000;
  // 15%–75% of the window: never instant, always before the clock runs out.
  return Math.round(window * (0.15 + unit * 0.6));
}
