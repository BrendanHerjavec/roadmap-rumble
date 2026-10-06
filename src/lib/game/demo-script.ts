/**
 * The scripted demo run.
 *
 * A live Swiss round is correct for a real meeting and useless for a video: the
 * pairings depend on ratings, so the interesting matchups land wherever they
 * land and a re-shoot is a different session. This pins round 1 to a fixed
 * order so the same beats hit at the same time in every take.
 *
 * It scripts the *pairings*, never the votes. Bots still decide for themselves
 * and the host still votes for real — `npm run simulate:demo` proves the beats
 * hold by replaying the bots against the actual roster, rather than us
 * asserting they will.
 *
 * Rounds 2+ fall back to normal Swiss pairing, because by then the ratings are
 * genuine and the point has been made.
 */

export type BeatKind = "teach" | "clash" | "split" | "filler";

export interface ScriptedMatchup {
  a: string;
  b: string;
  kind: BeatKind;
  /** What this matchup is doing in the video. */
  note: string;
}

/**
 * Every champion appears exactly once, so this is still a valid Swiss round —
 * only the order and the specific opponents are chosen rather than derived.
 */
export const DEMO_SCRIPT: ScriptedMatchup[] = [
  {
    a: "granular-permissions",
    b: "dark-mode",
    kind: "teach",
    note:
      "Teaches the visual language before anything subtle happens. Plate armour, " +
      "helm and a steel greatsword against a small unarmoured figure holding " +
      "nothing. Should be near-unanimous.",
  },
  {
    a: "bulk-edit",
    b: "saml-sso",
    kind: "clash",
    note:
      "The dimension clash. Bulk Task Surgery is the biggest champion on the " +
      "board (24 calls) and carries a twig; Single Sign-On is half its size, " +
      "fully armoured, holding a glowing greatblade (9 lost deals, $2.63M). " +
      "The crowd favourite loses to the deal-killer.",
  },
  {
    a: "guest-access",
    b: "audit-log",
    kind: "split",
    note:
      "The contested vote. Guest Passes leads on demand (22 calls v 11), Audit " +
      "Trail leads on lost deals and money (7 v 5, $2.17M v $553k). Bots split " +
      "3-2, so the room lands 4-2 or 3-3 — contested either way. This is where " +
      "the discussion timer goes up.",
  },
  { a: "capacity-planning", b: "ai-standup", kind: "filler", note: "Clear result, keeps pace." },
  { a: "timeline-view", b: "api-rate-limits", kind: "filler", note: "Clear result." },
  { a: "custom-fields", b: "sla-uptime", kind: "filler", note: "Small champion, real armour." },
  {
    a: "slack-sync",
    b: "portfolio-rollup",
    kind: "filler",
    note:
      "Reads like a clash — 13 calls against 7 — but every bot takes Portfolio " +
      "Roll-Up on the strength of $1.34M and four lost deals. Unanimous.",
  },
  {
    a: "time-tracking",
    b: "template-marketplace",
    kind: "filler",
    note:
      "Closes the round cleanly. Deliberately not close: one contested vote per " +
      "round is the pacing budget, since each one costs a 3-minute discussion.",
  },
];

/** The cast the script is tuned against. Order matters only for the lobby list. */
export const DEMO_BOT_BIASES = [
  "revenue",
  "risk",
  "demand",
  "recency",
  "underdog",
] as const;

/**
 * Pairs in script order, filtered to champions actually present. A host who
 * typed in extra ideas or reloaded a different roster still gets a valid round:
 * anything the script doesn't cover is appended as ordinary Swiss pairings.
 */
export function scriptedPairs(
  featureKeys: string[],
): { a: string; b: string }[] {
  const available = new Set(featureKeys);
  const used = new Set<string>();
  const pairs: { a: string; b: string }[] = [];

  for (const m of DEMO_SCRIPT) {
    if (!available.has(m.a) || !available.has(m.b)) continue;
    if (used.has(m.a) || used.has(m.b)) continue;
    used.add(m.a);
    used.add(m.b);
    pairs.push({ a: m.a, b: m.b });
  }

  const leftovers = featureKeys.filter((k) => !used.has(k));
  for (let i = 0; i + 1 < leftovers.length; i += 2) {
    pairs.push({ a: leftovers[i], b: leftovers[i + 1] });
  }

  return pairs;
}
