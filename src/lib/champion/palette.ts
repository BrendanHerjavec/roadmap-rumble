/**
 * Colour for a champion.
 *
 * Two jobs. Encoded: armour and weapon materials escalate with the evidence
 * (leather to iron to steel to gold-trimmed warplate; a stick to a glowing
 * blade), and backlog age drains the whole figure. Cosmetic: the cloth palette
 * is seeded per feature so a row of champions doesn't read as one repeated
 * character.
 *
 * Cloth is picked from a curated set rather than a random hue. Free-running HSL
 * produced muddy olives and sickly limes about a third of the time — a palette
 * that is right 70% of the time reads as an accident, not a style. Every entry
 * here is chosen to sit on a near-black stage with real saturation.
 *
 * Shading is three flat tones, not a gradient ramp. Hard terminators read as
 * drawn; soft ramps read as generic vector art.
 */

import type { ChampionTraits } from "./traits.ts";

export interface Shade {
  base: string;
  shadow: string;
  light: string;
}

export interface ChampionPalette {
  skin: Shade;
  cloth: Shade;
  trouser: Shade;
  armor: Shade;
  armorTrim: string;
  weapon: Shade;
  weaponGlow: string | null;
  hair: string;
  leather: Shade;
  /** Internal linework. Dark, used between parts. */
  outline: string;
  /**
   * The outer silhouette stroke.
   *
   * Deliberately LIGHT. The first version used near-black, which is invisible
   * against a near-black stage — the figures had no edge at all. A pale sticker
   * outline is what separates a champion from the backdrop here, and it reads as
   * a deliberate style rather than a missing one.
   */
  ink: string;
  rim: string;
  scar: string;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(
    Math.max(0, Math.min(100, s)),
  )}% ${Math.round(Math.max(0, Math.min(100, l)))}%)`;
}

/** base / shadow / light as three deliberate steps, not a ramp. */
function shade(h: number, s: number, l: number): Shade {
  return {
    base: hsl(h, s, l),
    shadow: hsl(h + 8, Math.min(100, s * 1.05), l * 0.6),
    light: hsl(h - 8, s * 0.8, Math.min(94, l * 1.3)),
  };
}

/** Curated cloth colours: hue, saturation, lightness. */
const CLOTH: [number, number, number][] = [
  [348, 58, 44], // crimson
  [268, 42, 46], // royal purple
  [204, 52, 42], // steel blue
  [158, 44, 36], // forest
  [24, 62, 46], // burnt orange
  [228, 46, 46], // indigo
  [336, 38, 40], // wine
  [188, 46, 38], // teal
  [42, 58, 44], // ochre
  [280, 34, 42], // plum
];

const SKIN: [number, number, number][] = [
  [26, 46, 76],
  [24, 44, 62],
  [22, 42, 48],
  [20, 38, 35],
  [18, 32, 26],
];

/**
 * Armour material by tier. The jump from leather to metal happens at 3, which
 * is where a feature has started costing real deals — the point where a viewer
 * should see "this one is armoured" without counting anything.
 */
function armorShade(tier: number, wear: number): { shade: Shade; trim: string } {
  const drain = 1 - wear * 0.4;
  if (tier === 0) return { shade: shade(30, 16 * drain, 44), trim: hsl(30, 14, 36) };
  if (tier <= 2)
    return { shade: shade(26, 44 * drain, 42), trim: hsl(36, 48 * drain, 54) };
  if (tier <= 4)
    return { shade: shade(218, 10 * drain, 60), trim: hsl(220, 12 * drain, 42) };
  if (tier <= 6)
    return { shade: shade(212, 18 * drain, 66), trim: hsl(44, 68 * drain, 58) };
  return { shade: shade(208, 22 * drain, 72), trim: hsl(46, 86 * drain, 62) };
}

/** Weapon material by tier, ending in something that emits light. */
function weaponShade(tier: number, wear: number): { shade: Shade; glow: string | null } {
  const drain = 1 - wear * 0.35;
  switch (tier) {
    case 0:
      return { shade: shade(28, 30 * drain, 44), glow: null };
    case 1:
      return { shade: shade(30, 40 * drain, 44), glow: null };
    case 2:
      return { shade: shade(26, 34 * drain, 38), glow: null };
    case 3:
      return { shade: shade(215, 12 * drain, 62), glow: null };
    case 4:
      return { shade: shade(205, 20 * drain, 74), glow: null };
    default:
      return { shade: shade(172, 72, 74), glow: "hsl(166 92% 64%)" };
  }
}

export function championPalette(traits: ChampionTraits): ChampionPalette {
  const { wear, skin, armor, weapon, seed } = traits;

  const [ch, cs, cl] = CLOTH[seed % CLOTH.length];
  // Age drains saturation and pulls everything toward grey.
  const drain = 1 - wear * 0.55;
  const cloth = shade(ch, cs * drain, cl - wear * 6);
  // Clearly darker than the tunic: at 0.72 the legs merged into the skirt.
  const trouser = shade(ch + 14, cs * drain * 0.55, (cl - wear * 6) * 0.5);

  const [sh, ss, sl] = SKIN[skin % SKIN.length];
  const armorPick = armorShade(armor, wear);
  const weaponPick = weaponShade(weapon, wear);

  // Hair greys with backlog age. This is the "how long has this been sitting
  // there" signal that still reads at board size.
  const hair =
    wear > 0.7
      ? hsl(ch, 5, 80)
      : wear > 0.42
        ? hsl(ch, 12, 56)
        : hsl(ch + 12, 30, 26);

  return {
    skin: shade(sh, ss, sl),
    cloth,
    trouser,
    armor: armorPick.shade,
    armorTrim: armorPick.trim,
    weapon: weaponPick.shade,
    weaponGlow: weaponPick.glow,
    hair,
    leather: shade(26, 36 - wear * 16, 34),
    outline: "#0a0714",
    // Cools and dims slightly with age, so old champions sit further back.
    ink: wear > 0.6 ? "hsl(240 18% 62%)" : "hsl(38 44% 86%)",
    rim: `hsla(40, 100%, 84%, ${0.55 + 0.2 * (1 - wear)})`,
    scar: "hsl(352 82% 60%)",
  };
}
