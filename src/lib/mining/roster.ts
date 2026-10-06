import { narrativeFor } from "./narrative.ts";
import type { CandidateFeature, MiningResult } from "./types.ts";

/**
 * Ideas people typed in before the session.
 *
 * These are not mined — they exist because someone in the building believes in
 * them. Three of the four do appear in the corpus, but under the surfacing
 * threshold, so mining alone would never have raised them. Which of those two
 * routes an idea came in by is hidden for the whole session and revealed only
 * on the results screen: that reveal is the point.
 */
export interface HumanIdea {
  name: string;
  description: string;
  submittedBy: string;
  /** Optional overrides when a typed-in idea has no cluster to borrow from. */
  problem?: string;
  counterweight?: string;
  /**
   * Cluster this idea corresponds to, if mining found weak support for it.
   * Omit and the champion carries genuine zeros — a small, unarmoured, twig-
   * wielding character, which is exactly the honest picture.
   */
  clusterKey?: string;
}

export const HUMAN_IDEAS: HumanIdea[] = [
  {
    name: "Template Market",
    description:
      "Shared library of project templates teams can publish internally and pull from.",
    submittedBy: "Marcus Ellery, VP Product",
    clusterKey: "template-marketplace",
  },
  {
    name: "Uptime SLA",
    description:
      "Contractual uptime guarantee with a public status page and incident history.",
    submittedBy: "Priya Raman, Head of Customer Success",
    clusterKey: "sla-uptime",
  },
  {
    name: "Dark Mode",
    description: "A dark theme across the whole product, respecting the system setting.",
    submittedBy: "Jules Nakamura, Design Lead",
    clusterKey: "dark-mode",
  },
  {
    name: "AI Standup Digest",
    description:
      "Generated daily summary of what moved, what stalled, and what needs a decision.",
    submittedBy: "Dana Whitfield, CRO",
    clusterKey: "ai-standup",
  },
];

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Looks up whatever evidence the corpus holds for a typed-in idea. Matches the
 * declared cluster first, then falls back to a name match, then to zeros.
 */
export function resolveHumanIdea(
  idea: HumanIdea,
  mining: MiningResult,
): CandidateFeature {
  const pool = [...mining.candidates, ...mining.belowThreshold];
  const found =
    (idea.clusterKey && pool.find((c) => c.featureKey === idea.clusterKey)) ||
    pool.find((c) => c.name.toLowerCase() === idea.name.toLowerCase());

  if (found) {
    return {
      ...found,
      name: idea.name,
      description: idea.description,
      origin: "human",
      submittedBy: idea.submittedBy,
    };
  }

  const narrative = narrativeFor(idea.clusterKey ?? "");

  return {
    featureKey: `human-${slug(idea.name)}`,
    name: idea.name,
    description: idea.description,
    calls: 0,
    lostDeals: 0,
    revenueAtStake: 0,
    firstMentioned: new Date().toISOString().slice(0, 10),
    origin: "human",
    submittedBy: idea.submittedBy,
    problem: idea.problem ?? narrative.problem,
    counterweight: idea.counterweight ?? narrative.counterweight,
    evidence: [],
    lostDealCompanies: [],
  };
}

/**
 * The full arena roster: everything mining surfaced, plus everything a human
 * typed in, shuffled into one list with origin carried but not displayed.
 */
export function buildRoster(
  mining: MiningResult,
  ideas: HumanIdea[] = HUMAN_IDEAS,
): CandidateFeature[] {
  const humans = ideas.map((i) => resolveHumanIdea(i, mining));
  const humanKeys = new Set(humans.map((h) => h.featureKey));
  const mined = mining.candidates.filter((c) => !humanKeys.has(c.featureKey));

  // Ordered by call volume so the roster reads sensibly in the lobby. Matchup
  // order comes from Swiss pairing, not from this.
  return [...mined, ...humans].sort(
    (a, b) => b.calls - a.calls || b.lostDeals - a.lostDeals,
  );
}
