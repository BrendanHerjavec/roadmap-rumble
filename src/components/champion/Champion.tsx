/**
 * The composition layer.
 *
 * Nothing above this component knows how a champion is drawn. Today the only
 * asset source is procedural SVG; step 9 adds a `sprite` source that stacks
 * pre-rendered Blender PNGs from /public/champions/ using the same trait
 * indices. Swapping sources is a one-line change here, and callers are
 * unaffected — which is why this seam exists before any art does.
 */

import type { CSSProperties } from "react";
import {
  championTraits,
  describeChampion,
  type ChampionEvidence,
  type ChampionState,
} from "@/lib/champion/traits";
import { ChampionSvg, type Pose } from "./ChampionSvg";

export type AssetSource = "svg" | "sprite";

/** Flip to "sprite" once /public/champions/ is populated. */
export const ASSET_SOURCE: AssetSource = "svg";

export interface ChampionProps {
  evidence: ChampionEvidence;
  name: string;
  state?: ChampionState;
  /** Rendered pixel height of the figure. Ignored when `fit` is set. */
  size?: number;
  /**
   * Fill the parent's height instead, keeping the figure's aspect ratio. Lets a
   * flex layout decide how big a champion is, so the arena can hold itself to
   * one viewport on a short screen rather than pushing the vote bar off it.
   */
  fit?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Distinguishes two renders of the same champion on one page. */
  instance?: string;
  source?: AssetSource;
  /** Freezes wear so snapshots and tests don't drift with the clock. */
  now?: Date;
  /** Rig pose. "still" disables all motion. */
  pose?: Pose;
  /** Freezes the current pose mid-animation — the hitstop at contact. */
  hitstop?: boolean;
}

export function Champion({
  evidence,
  name,
  state,
  size = 260,
  fit = false,
  className,
  style,
  instance = "a",
  source = ASSET_SOURCE,
  now,
  pose = "idle",
  hitstop = false,
}: ChampionProps) {
  const traits = championTraits(evidence, state, now);
  const uid = `ch-${evidence.featureKey}-${instance}`;
  const label = describeChampion(name, evidence, traits);

  const rig = { traits, uid, title: label, pose, hitstop, className: "h-full w-full" };

  const art =
    source === "svg" ? (
      <ChampionSvg {...rig} />
    ) : (
      // Placeholder for the Blender sprite stack. Same traits in, same figure out.
      <ChampionSvg {...rig} />
    );

  return (
    <div
      className={`${fit ? "h-full w-auto aspect-[240/300]" : ""} ${className ?? ""}`}
      style={fit ? style : { height: size, width: (size * 240) / 300, ...style }}
    >
      <div className="relative h-full w-full">
        {traits.originBanner ? <HumanBanner /> : null}
        {art}
      </div>
    </div>
  );
}

/** Shown only on the results screen, for ideas a person typed in. */
function HumanBanner() {
  return (
    <svg
      viewBox="0 0 240 300"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <path
        d="M82 4 h76 v58 l-38 -16 l-38 16 Z"
        fill="hsl(352 74% 48%)"
        stroke="hsl(258 40% 8%)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path d="M82 4 h76 v9 h-76 Z" fill="hsl(45 92% 58%)" opacity="0.9" />
    </svg>
  );
}
