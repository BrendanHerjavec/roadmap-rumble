/**
 * The two artefacts a session is actually for.
 *
 *   1. A ranked backlog, with the evidence that produced the ranking.
 *   2. A disagreement log — every contested matchup, its split, and what each
 *      side argued.
 *
 * The second one is the unusual output and the reason the game exists. A
 * ranking with no record of where the room divided is the same thing you'd get
 * from a spreadsheet and one loud person; the log is what you take back to the
 * people who weren't there.
 */

import { standings } from "./pairing";
import type { ChampionRow, MatchupRow } from "@/lib/supabase/types";

/** RFC 4180: quote everything, double any embedded quotes. */
function cell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
        ? String(value)
        : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: unknown[][]): string {
  // A BOM so Excel opens UTF-8 without mangling the em dashes and pound signs.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function rankedBacklogCsv(champions: ChampionRow[]): string {
  const table = standings(champions);

  const rows: unknown[][] = [
    [
      "rank",
      "feature",
      "description",
      "problem",
      "what the numbers don't say",
      "origin",
      "submitted by",
      "rating",
      "played",
      "won",
      "lost",
      "drawn",
      "calls mentioning",
      "lost deals citing",
      "revenue at stake (USD)",
      "first mentioned",
      "lost deal companies",
      "representative quote",
    ],
  ];

  table.forEach((c, i) => {
    rows.push([
      i + 1,
      c.name,
      c.description,
      c.problem,
      c.counterweight,
      c.origin,
      c.submitted_by ?? "",
      Math.round(c.rating),
      c.played,
      c.wins,
      c.losses,
      c.draws,
      c.calls,
      c.lost_deals,
      c.revenue_at_stake,
      c.first_mentioned,
      (c.lost_deal_companies ?? [])
        .map((d) => `${d.company} ($${Math.round(d.dealSizeUsd / 1000)}k)`)
        .join("; "),
      (c.evidence ?? [])[0]?.quote ?? "",
    ]);
  });

  return toCsv(rows);
}

export function disagreementLogCsv(
  champions: ChampionRow[],
  matchups: MatchupRow[],
): string {
  const byId = new Map(champions.map((c) => [c.id, c]));

  const contested = matchups
    .filter((m) => m.status === "resolved" && m.contested)
    .sort((x, y) => x.round - y.round || x.order_in_round - y.order_in_round);

  const rows: unknown[][] = [
    [
      "round",
      "matchup",
      "champion A",
      "champion B",
      "votes A",
      "votes B",
      "split",
      "outcome",
      "the case for A",
      "the case for B",
      "was a re-vote",
      "A: calls / lost deals / revenue",
      "B: calls / lost deals / revenue",
    ],
  ];

  for (const m of contested) {
    const a = byId.get(m.champion_a);
    const b = byId.get(m.champion_b);
    const va = m.votes_a ?? 0;
    const vb = m.votes_b ?? 0;
    const total = va + vb;
    const split = total ? `${Math.round((Math.max(va, vb) / total) * 100)}%` : "—";

    rows.push([
      m.round,
      m.order_in_round + 1,
      a?.name ?? "?",
      b?.name ?? "?",
      va,
      vb,
      split,
      m.winner ? (byId.get(m.winner)?.name ?? "?") : "dead heat",
      m.argument_a ?? "",
      m.argument_b ?? "",
      m.revote_of ? "yes" : "no",
      a ? `${a.calls} / ${a.lost_deals} / $${a.revenue_at_stake}` : "",
      b ? `${b.calls} / ${b.lost_deals} / $${b.revenue_at_stake}` : "",
    ]);
  }

  if (contested.length === 0) {
    rows.push(["—", "", "", "", "", "", "", "The room never split.", "", "", "", "", ""]);
  }

  return toCsv(rows);
}

/** Browser-side download. No server round trip; the data is already here. */
export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
