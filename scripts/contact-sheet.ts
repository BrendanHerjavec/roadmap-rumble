/**
 * Renders the champion roster to a PNG contact sheet.
 *
 *   npm run sheet            # all 16, as they appear in the arena
 *   npm run sheet -- --dims  # one row per encoded dimension, sorted
 *   npm run sheet -- --state # scars, crowns, defeated poses, origin reveal
 *
 * The gallery page is the real bench, but a flat PNG is the fastest way to
 * check silhouette legibility: squint at it and the encoding should still read.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChampionSvg } from "../src/components/champion/ChampionSvg.tsx";
import { championTraits, type ChampionState } from "../src/lib/champion/traits.ts";
import { readRoster } from "../src/lib/roster.ts";
import type { CandidateFeature } from "../src/lib/mining/types.ts";

const OUT = join(process.cwd(), "public", "dev");
const NOW = new Date("2026-08-10T00:00:00Z");

const CELL_W = 210;
const CELL_H = 320;

interface Cell {
  champion: CandidateFeature;
  state?: ChampionState;
  caption: string;
}

function cellSvg(cell: Cell, index: number): string {
  const traits = championTraits(cell.champion, cell.state ?? {}, NOW);
  return renderToStaticMarkup(
    createElement(ChampionSvg, {
      traits,
      uid: `c${index}`,
      title: cell.champion.name,
      // Freeze the rig: a PNG of a mid-breath figure is not a useful reference.
      pose: "still" as const,
    }),
  );
}

function sheet(cells: Cell[], cols: number, title: string): string {
  const rows = Math.ceil(cells.length / cols);
  const W = cols * CELL_W;
  const H = rows * CELL_H + 56;

  const body = cells
    .map((cell, i) => {
      const cx = (i % cols) * CELL_W;
      const cy = Math.floor(i / cols) * CELL_H + 40;
      const inner = cellSvg(cell, i)
        // Inline the child <svg> as a nested element at the cell origin.
        .replace("<svg", `<svg x="${cx}" y="${cy}" width="${CELL_W}" height="${CELL_H - 26}"`);
      return (
        inner +
        `<text x="${cx + CELL_W / 2}" y="${cy + CELL_H - 8}" fill="#cfc9ee" font-size="13" ` +
        `font-family="Segoe UI, sans-serif" text-anchor="middle">${escapeXml(cell.caption)}</text>`
      );
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#07060d"/>
      <stop offset="100%" stop-color="#161231"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="16" y="26" fill="#ffffff" font-size="18" font-weight="bold" font-family="Segoe UI, sans-serif">${escapeXml(title)}</text>
  ${body}
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

function write(name: string, svg: string) {
  const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), png);
  console.log(`  public/dev/${name}`);
}

function main() {
  const roster = readRoster();
  const args = new Set(process.argv.slice(2));
  const all = !args.has("--dims") && !args.has("--state");

  if (all || args.has("--roster")) {
    write(
      "roster.png",
      sheet(
        roster.map((c) => ({
          champion: c,
          caption: `${c.name} · ${c.calls}c ${c.lostDeals}L $${Math.round(c.revenueAtStake / 1000)}k`,
        })),
        4,
        "Roster — as seen in the arena (origin hidden)",
      ),
    );
  }

  if (args.has("--dims")) {
    const byCalls = [...roster].sort((a, b) => a.calls - b.calls);
    const byLost = [...roster].sort((a, b) => a.lostDeals - b.lostDeals);
    const byRev = [...roster].sort((a, b) => a.revenueAtStake - b.revenueAtStake);

    write(
      "dim-calls.png",
      sheet(byCalls.map((c) => ({ champion: c, caption: `${c.calls} calls` })), 8, "Body size <- calls mentioning it"),
    );
    write(
      "dim-lost.png",
      sheet(byLost.map((c) => ({ champion: c, caption: `${c.lostDeals} lost deals` })), 8, "Armour <- closed-lost deals citing it"),
    );
    write(
      "dim-revenue.png",
      sheet(
        byRev.map((c) => ({ champion: c, caption: `$${Math.round(c.revenueAtStake / 1000)}k` })),
        8,
        "Weapon <- revenue at stake",
      ),
    );
  }

  if (args.has("--state")) {
    const subject = roster.find((c) => c.featureKey === "audit-log") ?? roster[0];
    write(
      "state-scars.png",
      sheet(
        [0, 1, 2, 3, 4, 5, 6].map((n) => ({
          champion: subject,
          state: { losses: n },
          caption: `${n} losses`,
        })),
        7,
        "Damage accumulates live as matchups are lost",
      ),
    );
    write(
      "state-rank.png",
      sheet(
        [
          { champion: roster[0], state: { rank: 1 }, caption: "1st" },
          { champion: roster[1], state: { rank: 2 }, caption: "2nd" },
          { champion: roster[2], state: { rank: 3 }, caption: "3rd" },
          { champion: roster[3], state: { rank: 7 }, caption: "unranked" },
          { champion: roster[4], state: { defeated: true, losses: 2 }, caption: "defeated" },
          {
            champion: roster.find((c) => c.origin === "mined")!,
            state: { revealOrigin: true, origin: "mined" },
            caption: "reveal: mined",
          },
          {
            champion: roster.find((c) => c.origin === "human")!,
            state: { revealOrigin: true, origin: "human" },
            caption: "reveal: human",
          },
        ],
        7,
        "Crowns, defeat, and the end-of-session origin reveal",
      ),
    );
  }
}

main();
