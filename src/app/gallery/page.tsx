import Link from "next/link";
import { Champion } from "@/components/champion/Champion";
import { readRoster } from "@/lib/roster";
import {
  armorLabel,
  BODY_LABELS,
  championTraits,
  WEAPON_LABELS,
  wearLabel,
} from "@/lib/champion/traits";
import type { CandidateFeature } from "@/lib/mining/types";

export const metadata = { title: "Champion gallery — Roadmap Rumble" };

/**
 * The legibility bench.
 *
 * Every champion the arena can produce, sorted so the encoded dimensions run in
 * a readable gradient. The point is to check the visual claim before any
 * multiplayer exists: can you tell which champion is cited in more lost deals
 * without reading the numbers? The evidence bars underneath are the answer key,
 * not the interface.
 */
export default function GalleryPage() {
  const roster = readRoster();
  // Freeze "now" per render so wear is stable within the page.
  const now = new Date();

  const maxCalls = Math.max(...roster.map((c) => c.calls));
  const maxLost = Math.max(...roster.map((c) => c.lostDeals));
  const maxRev = Math.max(...roster.map((c) => c.revenueAtStake));

  return (
    <main className="stage-bg grain relative min-h-screen pb-24">
      <div className="mx-auto max-w-[1500px] px-8 pt-10">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 hover:text-white/70"
            >
              ← Roadmap Rumble
            </Link>
            <h1 className="mt-2 text-5xl font-black uppercase italic tracking-tight text-white">
              Champion gallery
            </h1>
            <p className="mt-2 max-w-2xl text-white/55">
              {roster.length} candidate features from the Northwind backlog, drawn
              from their evidence. Origin is deliberately not shown — that is
              hidden until the results screen.
            </p>
          </div>
          <Legend />
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {roster.map((c, i) => (
            <GalleryCard
              key={c.featureKey}
              champion={c}
              rank={i + 1}
              maxCalls={maxCalls}
              maxLost={maxLost}
              maxRev={maxRev}
              now={now}
            />
          ))}
        </div>

        <ScaleStrip roster={roster} now={now} />
      </div>
    </main>
  );
}

function Legend() {
  const rows = [
    ["Body size", "calls mentioning it"],
    ["Armour + pauldrons", "closed-lost deals citing it"],
    ["Weapon", "revenue at stake"],
    ["Grey, patches, faded", "age in the backlog"],
    ["Scars", "matchups lost this session"],
    ["Crown + glow", "top three on the leaderboard"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-white/85">{k}</dt>
          <dd className="text-white/45">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function GalleryCard({
  champion,
  rank,
  maxCalls,
  maxLost,
  maxRev,
  now,
}: {
  champion: CandidateFeature;
  rank: number;
  maxCalls: number;
  maxLost: number;
  maxRev: number;
  now: Date;
}) {
  const traits = championTraits(champion, {}, now);

  return (
    <article className="group flex flex-col">
      <div className="relative flex h-[300px] items-end justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent">
        {/* lit stage floor */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{
            background:
              "radial-gradient(ellipse 62% 100% at 50% 100%, rgba(255,160,60,0.20), transparent 72%)",
          }}
        />
        <Champion
          evidence={champion}
          name={champion.name}
          size={276}
          instance={`gallery-${rank}`}
          now={now}
          className="relative z-10 mb-1"
        />
      </div>

      <h2 className="mt-3 text-lg font-bold leading-tight text-white">
        {champion.name}
      </h2>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/45">
        {champion.description}
      </p>

      <div className="mt-3 space-y-1.5">
        <Bar
          label="calls"
          value={champion.calls}
          max={maxCalls}
          display={String(champion.calls)}
          colour="bg-volt-400"
        />
        <Bar
          label="lost deals"
          value={champion.lostDeals}
          max={maxLost}
          display={String(champion.lostDeals)}
          colour="bg-blood-400"
        />
        <Bar
          label="at stake"
          value={champion.revenueAtStake}
          max={maxRev}
          display={
            champion.revenueAtStake >= 1_000_000
              ? `$${(champion.revenueAtStake / 1e6).toFixed(2)}M`
              : `$${Math.round(champion.revenueAtStake / 1000)}k`
          }
          colour="bg-ember-400"
        />
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-white/30">
        {BODY_LABELS[traits.body]} · {armorLabel(traits.armor)} ·{" "}
        {WEAPON_LABELS[traits.weapon]} · {wearLabel(traits.wear)}
      </p>
    </article>
  );
}

function Bar({
  label,
  value,
  max,
  display,
  colour,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  colour: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-white/35">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${colour}`}
          style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
        />
      </span>
      <span className="tabular w-14 shrink-0 text-right font-semibold text-white/70">
        {display}
      </span>
    </div>
  );
}

/**
 * Isolates each encoded dimension so it can be checked on its own: hold two of
 * the three constant and the third should still be obvious.
 */
function ScaleStrip({
  roster,
  now,
}: {
  roster: CandidateFeature[];
  now: Date;
}) {
  const byCalls = [...roster].sort((a, b) => a.calls - b.calls);
  const byLost = [...roster].sort((a, b) => a.lostDeals - b.lostDeals);
  const byRevenue = [...roster].sort((a, b) => a.revenueAtStake - b.revenueAtStake);

  const strips: [string, string, CandidateFeature[]][] = [
    ["Body size ← calls", "2 → 24 calls", byCalls],
    ["Armour ← lost deals", "0 → 9 lost deals", byLost],
    ["Weapon ← revenue", "$0 → $2.6M at stake", byRevenue],
  ];

  return (
    <section className="mt-20 space-y-10">
      <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
        One dimension at a time
      </h2>
      {strips.map(([title, sub, list], si) => (
        <div key={title}>
          <div className="mb-1 flex items-baseline gap-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/70">
              {title}
            </h3>
            <span className="text-xs text-white/35">{sub}</span>
          </div>
          <div className="flex items-end gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 pb-2 pt-6">
            {list.map((c, i) => (
              <div key={c.featureKey} className="flex shrink-0 flex-col items-center">
                <Champion
                  evidence={c}
                  name={c.name}
                  size={150}
                  instance={`strip-${si}-${i}`}
                  now={now}
                />
                <span className="tabular mt-1 text-[10px] font-semibold text-white/45">
                  {si === 0 ? c.calls : si === 1 ? c.lostDeals : `$${Math.round(c.revenueAtStake / 1000)}k`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
