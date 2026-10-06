"use client";

import type { ChampionRow } from "@/lib/supabase/types";

/**
 * The numbers behind a champion.
 *
 * Secondary to the character on purpose — the art is supposed to carry this
 * information, and the panel is the receipt. Each row is colour-matched to the
 * visual dimension it drives, so "more red" and "heavier armour" become the
 * same fact rather than two things to reconcile.
 */
export function EvidencePanel({
  champion,
  align,
  opponent,
}: {
  champion: ChampionRow;
  align: "left" | "right";
  opponent: ChampionRow;
}) {
  const rows = [
    {
      label: "calls",
      value: String(champion.calls),
      hint: "body size",
      colour: "bg-volt-400",
      lead: champion.calls > opponent.calls,
      ratio: ratio(champion.calls, opponent.calls),
    },
    {
      label: "lost deals",
      value: String(champion.lost_deals),
      hint: "armour",
      colour: "bg-blood-400",
      lead: champion.lost_deals > opponent.lost_deals,
      ratio: ratio(champion.lost_deals, opponent.lost_deals),
    },
    {
      label: "at stake",
      value: money(champion.revenue_at_stake),
      hint: "weapon",
      colour: "bg-ember-400",
      lead: champion.revenue_at_stake > opponent.revenue_at_stake,
      ratio: ratio(champion.revenue_at_stake, opponent.revenue_at_stake),
    },
  ];

  const right = align === "right";

  return (
    <div className={`w-full max-w-[300px] ${right ? "text-right" : "text-left"}`}>
      {/* The arena holds itself to one viewport, so on a short screen this panel
          gives up height before the champions do: the figures are the thing
          being compared, and the full prose is a click away in the drawer. */}
      <h2 className="text-2xl font-black uppercase italic leading-none tracking-tight text-white [@media(max-height:900px)]:text-xl">
        {champion.name}
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-white/45 [@media(max-height:900px)]:mt-1 [@media(max-height:900px)]:line-clamp-2">
        {champion.description}
      </p>

      <dl className="mt-4 space-y-2 [@media(max-height:900px)]:mt-2.5 [@media(max-height:900px)]:space-y-1.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div
              className={`flex items-baseline gap-2 ${right ? "flex-row-reverse" : ""}`}
            >
              <dt className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                {r.label}
              </dt>
              <dd
                className={`tabular text-xl font-black ${
                  r.lead ? "text-white" : "text-white/45"
                }`}
              >
                {r.value}
              </dd>
              <span className="text-[10px] uppercase tracking-wider text-white/20">
                {r.hint}
              </span>
            </div>
            <div
              className={`mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07] ${
                right ? "ml-auto" : ""
              }`}
            >
              <div
                className={`h-full rounded-full ${r.colour} transition-[width] duration-700`}
                style={{
                  width: `${r.ratio * 100}%`,
                  marginLeft: right ? "auto" : undefined,
                }}
              />
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11px] text-white/30 [@media(max-height:900px)]:hidden">
        first raised {age(champion.first_mentioned)}
      </p>
    </div>
  );
}

/** Bar length is relative to the opponent, so the panels read as a comparison. */
function ratio(a: number, b: number): number {
  const max = Math.max(a, b);
  if (max <= 0) return 0.04;
  return Math.max(a / max, a > 0 ? 0.08 : 0.03);
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function age(iso: string): string {
  const then = new Date(`${iso}T00:00:00Z`);
  const months = Math.floor(
    (Date.now() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  if (months < 1) return "this month";
  if (months < 12) return `${months} months ago`;
  const years = (months / 12).toFixed(months % 12 === 0 ? 0 : 1);
  return `${years} years ago`;
}
