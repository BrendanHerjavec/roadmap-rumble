/**
 * Evidence -> appearance.
 *
 * This is the whole visual thesis in one file: a champion's look is a direct
 * encoding of the data behind the feature, not decoration. Two rules keep it
 * honest:
 *
 *   1. Every encoded trait is an ABSOLUTE function of the evidence, never
 *      relative to whoever else is in the arena. A feature with 9 lost deals
 *      wears the same armour in every session, so champions stay comparable
 *      and reloading the page reproduces the identical character.
 *
 *   2. The deterministic seed derived from `featureKey` only ever drives
 *      *cosmetic* variation — face shape, palette hue, whether there's a cape.
 *      It must never touch an encoded dimension, or the art would start lying.
 *
 * Nothing here knows about SVG. The Blender sprite kit in step 9 consumes the
 * same `ChampionTraits` and picks pre-rendered parts by the same indices.
 */

export interface ChampionEvidence {
  featureKey: string;
  calls: number;
  lostDeals: number;
  revenueAtStake: number;
  firstMentioned: string;
}

/** Live session state that shows up on the character as it plays. */
export interface ChampionState {
  /** Matchups lost this session -> scars and cracked armour. */
  losses?: number;
  /** 1-based leaderboard position, or undefined if unranked. */
  rank?: number;
  /** Loser of the matchup currently on screen -> slumped defeated pose. */
  defeated?: boolean;
  /** Revealed only on the results screen. */
  revealOrigin?: boolean;
  origin?: "mined" | "human";
}

export interface ChampionTraits {
  seed: number;

  /* ---- encoded from evidence ---- */
  /** 0 small and lean .. 4 huge and heavy. Driven by call volume. */
  body: 0 | 1 | 2 | 3 | 4;
  /** 0 unarmoured .. 8 fully plated. Driven by closed-lost deals. */
  armor: number;
  /** 0 bare hands .. 5 large glowing blade. Driven by revenue at stake. */
  weapon: 0 | 1 | 2 | 3 | 4 | 5;
  /** 0 fresh .. 1 ancient. Driven by age in the backlog. */
  wear: number;
  /** 0..6 visible scars, accumulated live as the session runs. */
  scars: number;

  /* ---- session state ---- */
  crown: 0 | 1 | 2 | 3;
  glow: boolean;
  defeated: boolean;

  /**
   * Origin is hidden for the entire session — nobody voting knows whether an
   * idea came out of a transcript cluster or out of the VP of Sales. These two
   * are false until the results screen flips them on.
   */
  revealOriginPattern: boolean;
  originBanner: boolean;

  /* ---- cosmetic, seeded, never encoded ---- */
  /** 0..5 head and face variant. */
  head: number;
  hue: number;
  skin: number;
  cape: boolean;
  /** Small idle offset so a row of champions doesn't look stamped. */
  stance: number;
}

/* ------------------------------------------------------------------ *
 * Deterministic seeding
 * ------------------------------------------------------------------ */

/** FNV-1a. Same feature key, same character, forever. */
export function seedFrom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pulls a stable 0..1 value out of a seed for a named cosmetic slot. */
function slot(seed: number, name: string): number {
  let h = seed ^ seedFrom(name);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ *
 * The scales
 * ------------------------------------------------------------------ */

/**
 * Thresholds are calibrated against the real spread of the Northwind corpus
 * (2 to 24 calls, 0 to 9 lost deals, $0 to $2.6M) so the full range of each
 * visual dimension actually gets used. Sparse data would otherwise render
 * sixteen identical mid-sized champions.
 */

export function bodyFromCalls(calls: number): ChampionTraits["body"] {
  if (calls >= 19) return 4;
  if (calls >= 13) return 3;
  if (calls >= 8) return 2;
  if (calls >= 4) return 1;
  return 0;
}

export function armorFromLostDeals(lostDeals: number): number {
  return Math.max(0, Math.min(8, lostDeals));
}

export function weaponFromRevenue(revenue: number): ChampionTraits["weapon"] {
  if (revenue >= 1_500_000) return 5;
  if (revenue >= 800_000) return 4;
  if (revenue >= 350_000) return 3;
  if (revenue >= 100_000) return 2;
  if (revenue > 0) return 1;
  return 0;
}

/** Months in the backlog, saturating at three years. */
export function wearFromAge(firstMentioned: string, now: Date = new Date()): number {
  const then = new Date(`${firstMentioned}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return 0;
  const months = (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(0, Math.min(1, months / 36));
}

export function crownFromRank(rank?: number): ChampionTraits["crown"] {
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  if (rank === 3) return 1;
  return 0;
}

/* ------------------------------------------------------------------ *
 * Composition
 * ------------------------------------------------------------------ */

export function championTraits(
  evidence: ChampionEvidence,
  state: ChampionState = {},
  now?: Date,
): ChampionTraits {
  const seed = seedFrom(evidence.featureKey);

  return {
    seed,

    body: bodyFromCalls(evidence.calls),
    armor: armorFromLostDeals(evidence.lostDeals),
    weapon: weaponFromRevenue(evidence.revenueAtStake),
    wear: wearFromAge(evidence.firstMentioned, now),
    scars: Math.max(0, Math.min(6, state.losses ?? 0)),

    crown: crownFromRank(state.rank),
    glow: (state.rank ?? 99) <= 3,
    defeated: state.defeated ?? false,

    revealOriginPattern: Boolean(state.revealOrigin && state.origin === "mined"),
    originBanner: Boolean(state.revealOrigin && state.origin === "human"),

    head: Math.floor(slot(seed, "head") * 6),
    hue: Math.floor(slot(seed, "hue") * 360),
    skin: Math.floor(slot(seed, "skin") * 5),
    cape: slot(seed, "cape") > 0.55,
    stance: slot(seed, "stance"),
  };
}

/* ------------------------------------------------------------------ *
 * Plain-language readout — used by the gallery legend and the a11y label
 * ------------------------------------------------------------------ */

export const BODY_LABELS = ["slight", "lean", "solid", "broad", "colossal"];
export const WEAPON_LABELS = [
  "bare hands",
  "a wooden stick",
  "a heavy club",
  "an iron sword",
  "a steel greatsword",
  "a glowing greatblade",
];

export function armorLabel(tier: number): string {
  if (tier === 0) return "no armour";
  if (tier <= 2) return "leather straps";
  if (tier <= 4) return "an iron breastplate";
  if (tier <= 6) return "heavy plate and pauldrons";
  return "full layered warplate";
}

export function wearLabel(wear: number): string {
  if (wear < 0.2) return "new to the backlog";
  if (wear < 0.5) return "worn";
  if (wear < 0.75) return "weathered";
  return "ancient, grey and patched";
}

/** Screen-reader text carrying the same information the picture carries. */
export function describeChampion(
  name: string,
  evidence: ChampionEvidence,
  traits: ChampionTraits,
): string {
  const parts = [
    `${name}: a ${BODY_LABELS[traits.body]} champion`,
    `wearing ${armorLabel(traits.armor)}`,
    `carrying ${WEAPON_LABELS[traits.weapon]}`,
    wearLabel(traits.wear),
  ];
  if (traits.scars > 0) parts.push(`${traits.scars} scars from lost matchups`);
  if (traits.crown === 3) parts.push("wearing the leader's crown");
  return `${parts.join(", ")}. Mentioned in ${evidence.calls} calls, cited in ${
    evidence.lostDeals
  } lost deals, $${Math.round(evidence.revenueAtStake / 1000)}k at stake.`;
}
