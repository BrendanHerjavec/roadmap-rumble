/**
 * Procedural SVG champion — chunky mascot build, rigged for animation.
 *
 * One of two interchangeable asset sources behind `<Champion />`. Both read the
 * identical `ChampionTraits`, so swapping sources changes nothing above here.
 *
 * ## What makes it read as drawn rather than generated
 *
 *   Proportions   ~3.5 heads tall. Big head, short thick legs, oversized boots
 *                 and gauntlets. Exaggeration reads as a decision.
 *   Silhouette    One `feMorphology` dilate over the whole figure gives a single
 *                 uniform outer outline. Per-part strokes stay thin, so the
 *                 outside reads bold and the inside reads detailed — the single
 *                 biggest quality lever available in flat vector art.
 *   Shading       Three flat tones with hard terminators, clipped per mass.
 *                 Gradient ramps read as generic vector; hard edges read as cel.
 *   Palette       Curated cloth colours, not a free-running hue.
 *
 * ## Rig
 *
 * Parts are grouped with explicit pivots so they can be posed: `rr-head`,
 * `rr-torso`, `rr-arm-front` (shoulder), `rr-weapon` (grip), `rr-cape`. CSS in
 * globals.css drives idle breathing and the fight poses off `data-pose` on the
 * root group, so animation costs nothing per frame in React.
 *
 * ## Encoding — unchanged, and the reason for every size decision
 *
 *   calls       -> overall scale AND torso/limb width
 *   lostDeals   -> plate coverage and pauldron span (the silhouette cue)
 *   revenue     -> weapon length and material
 *   age         -> grey hair, cloth patches, grime, drained saturation
 *   losses      -> scars and cracks, added live
 *   rank        -> crown and glow
 */

import type { ChampionTraits } from "@/lib/champion/traits";
import { championPalette } from "@/lib/champion/palette";

const CX = 120;
const GROUND = 272;

export type Pose = "idle" | "strike" | "hit" | "victory" | "defeat" | "still";

interface Props {
  traits: ChampionTraits;
  /** Must be unique per rendered instance — namespaces gradient and filter ids. */
  uid: string;
  className?: string;
  title?: string;
  /** Drives the CSS rig. "still" disables all motion (contact sheets, print). */
  pose?: Pose;
  /**
   * Freezes the current pose mid-animation. Held for a few frames at the moment
   * of contact so a blow reads as landing on something. Orthogonal to `pose` —
   * any pose can be frozen, and resuming picks up exactly where it paused.
   */
  hitstop?: boolean;
}

export function ChampionSvg({
  traits,
  uid,
  className,
  title,
  pose = "idle",
  hitstop = false,
}: Props) {
  const p = championPalette(traits);
  const { body, armor, weapon, wear, scars, crown, glow, defeated } = traits;

  /* ---- proportions: chunky mascot, ~3.5 heads tall ---- */
  const scale = 0.78 + body * 0.085;
  const shoulderHalf = 30 + body * 6.5;
  const waistHalf = 24 + body * 5;
  const hipHalf = 27 + body * 4.6;
  const legW = 19 + body * 3.6;
  const armW = 15 + body * 3;
  const headRx = 26 + body * 1.4;
  const headRy = headRx * 1.06;

  const headY = 74;
  const shoulderY = 118;
  const waistY = 172;
  const hipY = 196;
  const footY = 268;
  const handY = 186;

  const handLx = CX - shoulderHalf - 12;
  const handRx2 = CX + shoulderHalf + 12;

  /* ---- armour geometry ---- */
  const hasPlate = armor >= 2;
  const pauldronR = armor >= 1 ? 9 + armor * 2.7 : 0;
  const hasBelt = armor >= 3;
  const hasFaulds = armor >= 4;
  const hasGorget = armor >= 5;
  const hasHelm = armor >= 6;
  const hasSpikes = armor >= 7;
  const hasOverplate = armor >= 8;

  const patches = Math.round(wear * 3);
  const grime = wear > 0.35;
  const activePose: Pose = defeated ? "defeat" : pose;

  // Seeded so two champions on screen never breathe in lockstep.
  const beat = -((traits.seed % 900) / 1000).toFixed(2);

  return (
    <svg
      viewBox="0 0 240 300"
      className={className}
      role="img"
      aria-label={title}
      overflow="visible"
    >
      {title ? <title>{title}</title> : null}

      <defs>
        {/* One uniform outer outline around the whole composed figure. */}
        <filter id={`${uid}-ink`} x="-25%" y="-25%" width="150%" height="150%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.8" result="d" />
          <feFlood floodColor={p.ink} result="c" />
          <feComposite in="c" in2="d" operator="in" result="o" />
          <feMerge>
            <feMergeNode in="o" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id={`${uid}-halo`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="hsl(42 100% 70%)" stopOpacity="0.5" />
          <stop offset="58%" stopColor="hsl(30 100% 55%)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(30 100% 55%)" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {p.weaponGlow ? (
          <filter id={`${uid}-glow`} x="-80%" y="-50%" width="260%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}

        {/* Hard-edged shadow terminator: everything right of this line is shaded. */}
        <clipPath id={`${uid}-dark`}>
          <path d={`M ${CX + 20} -40 L 300 -40 L 300 340 L ${CX - 10} 340 Z`} />
        </clipPath>

        <pattern id={`${uid}-circuit`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M2 7h4v-5h6M6 7v5h6M12 12h2"
            fill="none"
            stroke={p.rim}
            strokeWidth="1"
            opacity="0.75"
          />
          <circle cx="12" cy="2" r="1.4" fill={p.rim} opacity="0.85" />
        </pattern>
      </defs>

      <ellipse
        cx={CX}
        cy={GROUND + 4}
        rx={hipHalf * 2.2 * scale}
        ry={(10 + body * 2.2) * scale}
        fill={`url(#${uid}-shadow)`}
        className="rr-contact-shadow"
      />

      {glow ? (
        <ellipse cx={CX} cy={GROUND - 78} rx="104" ry="122" fill={`url(#${uid}-halo)`} />
      ) : null}

      {/* Size lives on an outer group. The pose animations set `transform` on
          .rr-figure, and a CSS transform replaces the presentation attribute
          outright — sharing one group made champions snap to full size on every
          strike. */}
      <g
        transform={`translate(${CX} ${GROUND}) scale(${scale}) translate(${-CX} ${-GROUND})`}
        filter={`url(#${uid}-ink)`}
      >
      <g
        className="rr-figure"
        data-pose={activePose}
        data-hitstop={hitstop ? "true" : undefined}
        style={{ ["--rr-beat" as string]: `${beat}s` }}
      >
        {traits.cape ? (
          <g className="rr-cape" style={{ transformOrigin: `${CX}px ${shoulderY}px` }}>
            <path
              d={`M ${CX - shoulderHalf + 6} ${shoulderY - 6}
                  C ${CX - shoulderHalf - 26} ${hipY} ${CX - shoulderHalf - 18} ${footY - 28} ${CX - shoulderHalf - 10} ${footY - 12}
                  L ${CX + shoulderHalf + 10} ${footY - 12}
                  C ${CX + shoulderHalf + 18} ${footY - 28} ${CX + shoulderHalf + 26} ${hipY} ${CX + shoulderHalf - 6} ${shoulderY - 6} Z`}
              fill={p.cloth.shadow}
            />
          </g>
        ) : null}

        <Legs
          hipHalf={hipHalf}
          legW={legW}
          hipY={hipY}
          footY={footY}
          trouser={p.trouser}
          leather={p.leather}
          uid={uid}
          knees={hasOverplate}
          plate={p.armor}
        />

        {/* back arm */}
        <g
          className="rr-arm-back"
          style={{ transformOrigin: `${CX + shoulderHalf - 2}px ${shoulderY + 8}px` }}
        >
          <Arm
            side={1}
            shoulderX={CX + shoulderHalf - 2}
            shoulderY={shoulderY + 8}
            handX={handRx2}
            handY={handY}
            w={armW}
            colour={armor >= 4 ? p.armor.shadow : p.skin.base}
          />
          <circle cx={handRx2} cy={handY} r={armW * 0.62} fill={p.skin.shadow} />
        </g>

        <g className="rr-torso" style={{ transformOrigin: `${CX}px ${hipY}px` }}>
          {/* tunic skirt separates torso from legs */}
          <path
            d={`M ${CX - waistHalf} ${waistY - 6}
                L ${CX + waistHalf} ${waistY - 6}
                L ${CX + hipHalf + 5} ${hipY + 8}
                Q ${CX} ${hipY + 18} ${CX - hipHalf - 5} ${hipY + 8} Z`}
            fill={p.cloth.shadow}
          />

          <path d={torsoPath(shoulderHalf, waistHalf, hipHalf, shoulderY, waistY, hipY)} fill={p.cloth.base} />
          <g clipPath={`url(#${uid}-dark)`}>
            <path d={torsoPath(shoulderHalf, waistHalf, hipHalf, shoulderY, waistY, hipY)} fill={p.cloth.shadow} />
          </g>

          {/* age: patched, restitched cloth and ground-in grime */}
          {Array.from({ length: patches }).map((_, i) => (
            <g key={i} opacity="0.85">
              <rect
                x={CX - waistHalf + 6 + i * 16}
                y={waistY - 48 + (i % 2) * 26}
                width="18"
                height="16"
                rx="2"
                fill={p.leather.base}
              />
              <path
                d={`M ${CX - waistHalf + 6 + i * 16} ${waistY - 40 + (i % 2) * 26} h18`}
                stroke={p.cloth.light}
                strokeWidth="1.4"
                strokeDasharray="2.5 2.5"
                opacity="0.75"
              />
            </g>
          ))}
          {grime
            ? [
                [-0.6, -34],
                [0.45, -14],
                [-0.2, 6],
              ].map(([fx, dy], i) => (
                <ellipse
                  key={i}
                  cx={CX + fx * waistHalf}
                  cy={waistY + dy}
                  rx={7 + i}
                  ry={4.5}
                  fill="#1a1330"
                  opacity={0.12 + wear * 0.22}
                />
              ))
            : null}

          {traits.revealOriginPattern ? (
            <path
              d={torsoPath(shoulderHalf, waistHalf, hipHalf, shoulderY, waistY, hipY)}
              fill={`url(#${uid}-circuit)`}
              opacity="0.55"
            />
          ) : null}

          {hasPlate ? (
            <Plate
              uid={uid}
              armor={armor}
              shoulderHalf={shoulderHalf}
              waistHalf={waistHalf}
              shoulderY={shoulderY}
              waistY={waistY}
              plate={p.armor}
              trim={p.armorTrim}
            />
          ) : null}

          {hasBelt ? (
            <>
              <rect
                x={CX - waistHalf - 4}
                y={waistY - 6}
                width={waistHalf * 2 + 8}
                height="14"
                rx="4"
                fill={p.leather.base}
              />
              <rect x={CX - 8} y={waistY - 7} width="16" height="16" rx="3" fill={p.armorTrim} />
            </>
          ) : null}

          {hasFaulds
            ? [-1, 0, 1].map((i) => (
                <g key={i}>
                  <path
                    d={`M ${CX + i * 22 - 11} ${waistY + 8} h22 l-3 19 h-16 Z`}
                    fill={p.armor.base}
                  />
                  <g clipPath={`url(#${uid}-dark)`}>
                    <path
                      d={`M ${CX + i * 22 - 11} ${waistY + 8} h22 l-3 19 h-16 Z`}
                      fill={p.armor.shadow}
                    />
                  </g>
                </g>
              ))
            : null}

          <Scars count={scars} waistHalf={waistHalf} waistY={waistY} colour={p.scar} armored={hasPlate} />

          {/* rim light down the lit edge */}
          <path
            d={`M ${CX - shoulderHalf + 4} ${shoulderY + 8}
                Q ${CX - waistHalf - 6} ${waistY - 28} ${CX - waistHalf} ${waistY - 4}`}
            fill="none"
            stroke={p.rim}
            strokeWidth="3.4"
            strokeLinecap="round"
            opacity="0.5"
          />
        </g>

        {/* pauldrons ride on the torso, capping both arms */}
        {pauldronR > 0 ? (
          <g className="rr-pauldrons" style={{ transformOrigin: `${CX}px ${shoulderY}px` }}>
            <Pauldron cx={CX - shoulderHalf} cy={shoulderY + 4} r={pauldronR} flip={-1} uid={uid} plate={p.armor} trim={p.armorTrim} spikes={hasSpikes} overplate={hasOverplate} />
            <Pauldron cx={CX + shoulderHalf} cy={shoulderY + 4} r={pauldronR} flip={1} uid={uid} plate={p.armor} trim={p.armorTrim} spikes={hasSpikes} overplate={hasOverplate} />
          </g>
        ) : null}

        <g className="rr-head" style={{ transformOrigin: `${CX}px ${shoulderY}px` }}>
          <rect
            x={CX - headRx * 0.3}
            y={headY + headRy - 10}
            width={headRx * 0.6}
            height="26"
            fill={p.skin.shadow}
          />

          {hasGorget ? (
            <path
              d={`M ${CX - headRx * 0.9} ${shoulderY - 2} q ${headRx * 0.9} -17 ${headRx * 1.8} 0 q ${-headRx * 0.9} 12 ${-headRx * 1.8} 0 Z`}
              fill={p.armor.base}
            />
          ) : null}

          <Head
            cx={CX}
            cy={headY}
            rx={headRx}
            ry={headRy}
            uid={uid}
            variant={traits.head}
            skin={p.skin}
            hair={p.hair}
            helm={hasHelm}
            plate={p.armor}
            trim={p.armorTrim}
            rim={p.rim}
            defeated={activePose === "defeat"}
          />

          {crown > 0 ? (
            <Crown cx={CX} cy={headY - headRy - (hasHelm ? 14 : 7)} tier={crown} />
          ) : null}
        </g>

        {/* front arm holds the weapon — this is the one that swings */}
        <g
          className="rr-arm-front"
          style={{ transformOrigin: `${CX - shoulderHalf + 2}px ${shoulderY + 8}px` }}
        >
          <Arm
            side={-1}
            shoulderX={CX - shoulderHalf + 2}
            shoulderY={shoulderY + 8}
            handX={handLx}
            handY={handY}
            w={armW}
            colour={armor >= 4 ? p.armor.shadow : p.skin.base}
          />
          <circle cx={handLx} cy={handY} r={armW * 0.62} fill={p.skin.base} />

          <g className="rr-weapon" style={{ transformOrigin: `${handLx}px ${handY}px` }}>
            <Weapon
              uid={uid}
              tier={weapon}
              x={handLx}
              y={handY}
              shade={p.weapon}
              glow={p.weaponGlow}
              trim={p.armorTrim}
            />
          </g>
        </g>
      </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Parts
 * ------------------------------------------------------------------ */

function torsoPath(
  sh: number,
  wa: number,
  hip: number,
  shoulderY: number,
  waistY: number,
  hipY: number,
): string {
  return `M ${CX - sh} ${shoulderY}
    Q ${CX - sh - 4} ${(shoulderY + waistY) / 2} ${CX - wa} ${waistY}
    L ${CX - hip + 3} ${hipY - 8}
    Q ${CX} ${hipY + 2} ${CX + hip - 3} ${hipY - 8}
    L ${CX + wa} ${waistY}
    Q ${CX + sh + 4} ${(shoulderY + waistY) / 2} ${CX + sh} ${shoulderY}
    Q ${CX} ${shoulderY - 20} ${CX - sh} ${shoulderY} Z`;
}

function Legs({
  hipHalf,
  legW,
  hipY,
  footY,
  trouser,
  leather,
  uid,
  knees,
  plate,
}: {
  hipHalf: number;
  legW: number;
  hipY: number;
  footY: number;
  trouser: { base: string; shadow: string; light: string };
  leather: { base: string; shadow: string; light: string };
  uid: string;
  knees: boolean;
  plate: { base: string; shadow: string; light: string };
}) {
  const offset = hipHalf * 0.5;
  return (
    <g className="rr-legs">
      {[-1, 1].map((s) => {
        const x = CX + s * offset;
        return (
          <g key={s}>
            <path
              d={`M ${x} ${hipY - 12} L ${x} ${footY - 16}`}
              stroke={s > 0 ? trouser.shadow : trouser.base}
              strokeWidth={legW}
              strokeLinecap="round"
            />
            {knees ? (
              <ellipse cx={x} cy={hipY + (footY - hipY) * 0.4} rx={legW * 0.62} ry={legW * 0.5} fill={plate.base} />
            ) : null}
            {/* oversized boot — a mascot silhouette lives in the feet.
                Built from two primitives rather than one clever path: the
                earlier conditional path produced a malformed blob. */}
            <rect
              x={x - legW * 0.72}
              y={footY - 22}
              width={legW * 1.44}
              height="22"
              rx="7"
              fill={leather.base}
            />
            <ellipse
              cx={x + s * legW * 0.5}
              cy={footY - 4}
              rx={legW * 0.86}
              ry="8.5"
              fill={leather.base}
            />
            <ellipse
              cx={x + s * legW * 0.5}
              cy={footY - 1}
              rx={legW * 0.86}
              ry="4"
              fill={leather.shadow}
            />
          </g>
        );
      })}
    </g>
  );
}

function Arm({
  side,
  shoulderX,
  shoulderY,
  handX,
  handY,
  w,
  colour,
}: {
  side: number;
  shoulderX: number;
  shoulderY: number;
  handX: number;
  handY: number;
  w: number;
  colour: string;
}) {
  const cx = shoulderX + side * (w * 0.4 + 14);
  const cy = (shoulderY + handY) / 2;
  return (
    <path
      d={`M ${shoulderX} ${shoulderY} Q ${cx} ${cy} ${handX} ${handY}`}
      stroke={colour}
      strokeWidth={w}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Plate({
  uid,
  armor,
  shoulderHalf,
  waistHalf,
  shoulderY,
  waistY,
  plate,
  trim,
}: {
  uid: string;
  armor: number;
  shoulderHalf: number;
  waistHalf: number;
  shoulderY: number;
  waistY: number;
  plate: { base: string; shadow: string; light: string };
  trim: string;
}) {
  const coverage = Math.min(1, (armor - 1) / 6);
  const top = shoulderY + 6;
  const bottom = top + (waistY - top) * (0.52 + coverage * 0.48);
  const halfTop = shoulderHalf * (0.76 + coverage * 0.2);
  const halfBottom = waistHalf * (0.9 + coverage * 0.14);

  const d = `M ${CX - halfTop} ${top}
      Q ${CX} ${top - 14} ${CX + halfTop} ${top}
      L ${CX + halfBottom} ${bottom}
      Q ${CX} ${bottom + 12} ${CX - halfBottom} ${bottom} Z`;

  return (
    <g>
      <path d={d} fill={plate.base} />
      <g clipPath={`url(#${uid}-dark)`}>
        <path d={d} fill={plate.shadow} />
      </g>
      <path d={`M ${CX} ${top + 4} L ${CX} ${bottom - 4}`} stroke={trim} strokeWidth="2.6" opacity="0.9" />
      {/* rivets — small detail, large perceived-quality return */}
      {armor >= 4
        ? [-1, 1].map((s) =>
            [0.28, 0.62].map((t) => (
              <circle
                key={`${s}-${t}`}
                cx={CX + s * halfTop * 0.72}
                cy={top + (bottom - top) * t}
                r="2.4"
                fill={trim}
                opacity="0.9"
              />
            )),
          )
        : null}
      {armor >= 5
        ? [0.36, 0.66].map((t) => (
            <path
              key={t}
              d={`M ${CX - halfTop * (1 - t * 0.18)} ${top + (bottom - top) * t}
                  Q ${CX} ${top + (bottom - top) * t + 9} ${CX + halfTop * (1 - t * 0.18)} ${top + (bottom - top) * t}`}
              fill="none"
              stroke="#0a0714"
              strokeWidth="2"
              opacity="0.45"
            />
          ))
        : null}
    </g>
  );
}

function Pauldron({
  cx,
  cy,
  r,
  flip,
  uid,
  plate,
  trim,
  spikes,
  overplate,
}: {
  cx: number;
  cy: number;
  r: number;
  flip: number;
  uid: string;
  plate: { base: string; shadow: string; light: string };
  trim: string;
  spikes: boolean;
  overplate: boolean;
}) {
  const d = `M ${cx - r} ${cy}
      Q ${cx} ${cy - r * 1.4} ${cx + r} ${cy}
      Q ${cx + r * flip * 0.62} ${cy + r * 1.1} ${cx - r * flip * 0.62} ${cy + r * 0.92} Z`;
  return (
    <g>
      <path d={d} fill={plate.base} />
      <g clipPath={`url(#${uid}-dark)`}>
        <path d={d} fill={plate.shadow} />
      </g>
      {overplate ? (
        <path
          d={`M ${cx - r * 0.8} ${cy + r * 0.55} Q ${cx} ${cy + r * 1.35} ${cx + r * 0.8} ${cy + r * 0.55}`}
          fill={plate.base}
        />
      ) : null}
      <path
        d={`M ${cx - r * 0.75} ${cy - r * 0.16} Q ${cx} ${cy - r * 1.0} ${cx + r * 0.75} ${cy - r * 0.16}`}
        fill="none"
        stroke={trim}
        strokeWidth="2.6"
        opacity="0.95"
      />
      {spikes
        ? [-0.55, 0.05, 0.65].map((t) => (
            <path
              key={t}
              d={`M ${cx + r * t - 3.6} ${cy - r * 0.66} l 3.6 -13 l 3.6 13 Z`}
              fill={trim}
            />
          ))
        : null}
    </g>
  );
}

function Head({
  cx,
  cy,
  rx,
  ry,
  uid,
  variant,
  skin,
  hair,
  helm,
  plate,
  trim,
  rim,
  defeated,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  uid: string;
  variant: number;
  skin: { base: string; shadow: string; light: string };
  hair: string;
  helm: boolean;
  plate: { base: string; shadow: string; light: string };
  trim: string;
  rim: string;
  defeated: boolean;
}) {
  const bald = variant === 3;
  const beard = variant === 1 || variant === 4 || variant === 5;
  const brow = [-7, -3, 0, 3, -9, -1][variant % 6];
  const eyeY = cy + ry * 0.1;
  const eyeDx = rx * 0.38;

  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={skin.base} />
      <g clipPath={`url(#${uid}-dark)`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={skin.shadow} />
      </g>

      {beard ? (
        <path
          d={`M ${cx - rx * 0.86} ${cy + ry * 0.18}
              Q ${cx} ${cy + ry * 1.6} ${cx + rx * 0.86} ${cy + ry * 0.18}
              Q ${cx} ${cy + ry * 0.76} ${cx - rx * 0.86} ${cy + ry * 0.18} Z`}
          fill={hair}
        />
      ) : null}

      {!bald && !helm ? (
        // Sits above the brow with a swept fringe. An earlier version wrapped
        // the whole skull down to eye level and read as a swim cap.
        <path
          d={`M ${cx - rx * 0.98} ${cy - ry * 0.44}
              Q ${cx - rx * 0.94} ${cy - ry * 1.32} ${cx} ${cy - ry * 1.14}
              Q ${cx + rx * 0.94} ${cy - ry * 1.32} ${cx + rx * 0.98} ${cy - ry * 0.44}
              Q ${cx + rx * 0.72} ${cy - ry * 0.86} ${cx + rx * 0.18} ${cy - ry * 0.76}
              Q ${cx - rx * 0.34} ${cy - ry * 0.6} ${cx - rx * 0.98} ${cy - ry * 0.44} Z`}
          fill={hair}
        />
      ) : null}

      {helm ? (
        <>
          <path
            d={`M ${cx - rx - 3} ${cy - ry * 0.06}
                Q ${cx} ${cy - ry * 1.72} ${cx + rx + 3} ${cy - ry * 0.06}
                L ${cx + rx + 3} ${cy - ry * 0.36}
                Q ${cx} ${cy - ry * 0.66} ${cx - rx - 3} ${cy - ry * 0.36} Z`}
            fill={plate.base}
          />
          <g clipPath={`url(#${uid}-dark)`}>
            <path
              d={`M ${cx - rx - 3} ${cy - ry * 0.06}
                  Q ${cx} ${cy - ry * 1.72} ${cx + rx + 3} ${cy - ry * 0.06}
                  L ${cx + rx + 3} ${cy - ry * 0.36}
                  Q ${cx} ${cy - ry * 0.66} ${cx - rx - 3} ${cy - ry * 0.36} Z`}
              fill={plate.shadow}
            />
          </g>
          <rect x={cx - 3.2} y={cy - ry * 0.56} width="6.4" height={ry * 1.1} rx="2.5" fill={plate.base} />
          <path d={`M ${cx - rx * 0.55} ${cy - ry * 1.1} h ${rx * 1.1}`} stroke={trim} strokeWidth="3" />
        </>
      ) : null}

      {defeated ? (
        <>
          <path d={`M ${cx - eyeDx - 6} ${eyeY} q 6 5 12 0`} fill="none" stroke="#0a0714" strokeWidth="3" strokeLinecap="round" />
          <path d={`M ${cx + eyeDx - 6} ${eyeY} q 6 5 12 0`} fill="none" stroke="#0a0714" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx={cx - eyeDx} cy={eyeY} rx="4.6" ry="5.6" fill="#0a0714" />
          <ellipse cx={cx + eyeDx} cy={eyeY} rx="4.6" ry="5.6" fill="#0a0714" />
          {/* catchlights — cheap, and the difference between alive and dead eyes */}
          <circle cx={cx - eyeDx - 1.6} cy={eyeY - 2} r="1.6" fill="#fff" opacity="0.9" />
          <circle cx={cx + eyeDx - 1.6} cy={eyeY - 2} r="1.6" fill="#fff" opacity="0.9" />
          <path d={`M ${cx - eyeDx - 8} ${eyeY - 11 + brow * 0.3} l 15 ${brow * 0.28}`} stroke="#0a0714" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M ${cx + eyeDx + 8} ${eyeY - 11 + brow * 0.3} l -15 ${brow * 0.28}`} stroke="#0a0714" strokeWidth="3.6" strokeLinecap="round" />
        </>
      )}

      {!beard ? (
        <path
          d={
            defeated
              ? `M ${cx - 7} ${cy + ry * 0.58} q 7 -5 14 0`
              : `M ${cx - 7} ${cy + ry * 0.54} q 7 5 14 0`
          }
          fill="none"
          stroke="#0a0714"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ) : null}

      <path
        d={`M ${cx - rx * 0.92} ${cy - ry * 0.3} Q ${cx - rx * 1.02} ${cy + ry * 0.3} ${cx - rx * 0.7} ${cy + ry * 0.72}`}
        fill="none"
        stroke={rim}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );
}

const SCAR_SLOTS: [number, number, number][] = [
  [-0.55, -26, 26],
  [0.5, -8, -34],
  [-0.2, 16, 18],
  [0.62, -36, 40],
  [-0.7, 2, -22],
  [0.15, 30, 30],
];

function Scars({
  count,
  waistHalf,
  waistY,
  colour,
  armored,
}: {
  count: number;
  waistHalf: number;
  waistY: number;
  colour: string;
  armored: boolean;
}) {
  return (
    <g className="rr-scars">
      {SCAR_SLOTS.slice(0, count).map(([fx, dy, angle], i) => {
        const x = CX + fx * waistHalf;
        const y = waistY - 46 + dy;
        return (
          <g key={i} transform={`rotate(${angle} ${x} ${y})`}>
            {armored ? (
              <path d={`M ${x - 13} ${y} l 9 -5 l 7 6 l 9 -4`} fill="none" stroke="#0a0714" strokeWidth="3.4" strokeLinecap="round" opacity="0.9" />
            ) : null}
            <path d={`M ${x - 12} ${y} l 24 2`} stroke={colour} strokeWidth="3.6" strokeLinecap="round" />
            <path d={`M ${x - 12} ${y} l 24 2`} stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          </g>
        );
      })}
    </g>
  );
}

function Weapon({
  uid,
  tier,
  x,
  y,
  shade,
  glow,
  trim,
}: {
  uid: string;
  tier: number;
  x: number;
  y: number;
  shade: { base: string; shadow: string; light: string };
  glow: string | null;
  trim: string;
}) {
  if (tier === 0) return null;

  const wrap = (children: React.ReactNode) => (
    <g transform={`translate(${x} ${y}) rotate(-9)`} filter={glow ? `url(#${uid}-glow)` : undefined}>
      {children}
    </g>
  );

  const blade = (d: string) => (
    <>
      <path d={d} fill={shade.base} />
      <g clipPath={`url(#${uid}-dark)`}>
        <path d={d} fill={shade.shadow} />
      </g>
    </>
  );

  if (tier === 1) {
    return wrap(
      <>
        {blade("M -3.5 14 L -5 -62 L 5 -64 L 3.5 14 Z")}
        <path d="M -4.5 -32 l 10 -2" stroke={shade.shadow} strokeWidth="2.4" />
        <path d="M 3.5 -50 l 8 -7" stroke={shade.base} strokeWidth="4" strokeLinecap="round" />
      </>,
    );
  }

  if (tier === 2) {
    return wrap(
      <>
        {blade("M -4.5 14 L -7 -52 L -13 -86 L 13 -86 L 7 -52 L 4.5 14 Z")}
        <circle cx="-4" cy="-66" r="3.6" fill={shade.shadow} />
        <circle cx="5" cy="-77" r="2.8" fill={shade.shadow} />
        <path d="M -9 -55 h 18" stroke={shade.shadow} strokeWidth="2.4" />
      </>,
    );
  }

  if (tier === 3) {
    return wrap(
      <>
        <rect x="-4" y="-2" width="8" height="20" rx="3" fill="#2a1d16" />
        <rect x="-17" y="-10" width="34" height="8" rx="3" fill={trim} />
        {blade("M -6.5 -10 L -6.5 -92 L 0 -108 L 6.5 -92 L 6.5 -10 Z")}
        <path d="M 0 -14 L 0 -96" stroke={shade.light} strokeWidth="2" opacity="0.6" />
        <circle cx="0" cy="20" r="5" fill={trim} />
      </>,
    );
  }

  if (tier === 4) {
    return wrap(
      <>
        <rect x="-5" y="-4" width="10" height="26" rx="3.5" fill="#2a1d16" />
        <rect x="-23" y="-14" width="46" height="10" rx="4" fill={trim} />
        {blade("M -10 -14 L -10 -110 L 0 -132 L 10 -110 L 10 -14 Z")}
        <path d="M 0 -18 L 0 -118" stroke={shade.light} strokeWidth="2.6" opacity="0.75" />
        <circle cx="0" cy="24" r="6.5" fill={trim} />
      </>,
    );
  }

  return wrap(
    <>
      <rect x="-6" y="-6" width="12" height="30" rx="4" fill="#2a1d16" />
      <path d="M -29 -16 q 29 -12 58 0 q -29 10 -58 0 Z" fill={trim} />
      {blade("M -14 -16 L -14 -124 L 0 -154 L 14 -124 L 14 -16 Z")}
      <path d="M 0 -20 L 0 -140" stroke={glow ?? shade.light} strokeWidth="3.6" opacity="0.95" />
      <path d="M -14 -70 L 14 -70" stroke={glow ?? shade.light} strokeWidth="2.4" opacity="0.55" />
      <circle cx="0" cy="28" r="7" fill={trim} />
    </>,
  );
}

function Crown({ cx, cy, tier }: { cx: number; cy: number; tier: number }) {
  const metal = tier === 3 ? "hsl(45 95% 60%)" : tier === 2 ? "hsl(220 8% 80%)" : "hsl(28 55% 54%)";
  const w = tier === 3 ? 42 : 33;
  const h = tier === 3 ? 21 : 14;

  return (
    <g className="rr-crown">
      {tier === 3 ? <ellipse cx={cx} cy={cy - 2} rx="40" ry="16" fill="hsl(45 100% 65%)" opacity="0.25" /> : null}
      <path
        d={`M ${cx - w / 2} ${cy} L ${cx - w / 2} ${cy - h * 0.55}
            L ${cx - w / 4} ${cy - h * 0.15} L ${cx} ${cy - h}
            L ${cx + w / 4} ${cy - h * 0.15} L ${cx + w / 2} ${cy - h * 0.55}
            L ${cx + w / 2} ${cy} Z`}
        fill={metal}
      />
      <rect x={cx - w / 2} y={cy} width={w} height="5.5" rx="2.5" fill={metal} />
      {tier === 3 ? <circle cx={cx} cy={cy - h * 0.6} r="3.6" fill="hsl(352 85% 60%)" /> : null}
    </g>
  );
}
