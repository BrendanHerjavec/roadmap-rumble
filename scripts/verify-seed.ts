/**
 * Closes the loop on the seed data.
 *
 * Generation goes design -> transcripts. Mining goes transcripts -> evidence.
 * This asserts the round trip lands back where it started, and that the two
 * tensions the game depends on are actually present in the numbers rather than
 * just intended. If this passes, the demo's claims are true of the data.
 *
 *   npm run verify:seed
 */

import { loadTranscripts } from "../src/lib/mining/transcripts.ts";
import { mineWithLexicon } from "../src/lib/mining/miner.ts";
import { buildRoster } from "../src/lib/mining/roster.ts";
import {
  DESIGNED_RIVALRY,
  DIMENSION_CLASH,
  FEATURE_DESIGN,
  MINING_CALL_THRESHOLD,
} from "../src/lib/seed/design.ts";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const transcripts = loadTranscripts();
const mining = mineWithLexicon(transcripts, MINING_CALL_THRESHOLD);
const all = [...mining.candidates, ...mining.belowThreshold];
const byKey = new Map(all.map((c) => [c.featureKey, c]));
const roster = buildRoster(mining);

section("Corpus");
check("40 transcripts on disk", transcripts.length === 40, `${transcripts.length}`);
check(
  "16 closed-lost deals",
  transcripts.filter((t) => t.outcome === "closed_lost").length === 16,
);
check("every call has a deal size", transcripts.every((t) => t.dealSizeUsd > 0));
check("every call has a date", transcripts.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date)));

section("Mining rediscovers the designed evidence");
for (const f of FEATURE_DESIGN) {
  const found = byKey.get(f.id);
  if (!found) {
    check(f.id, false, "cluster not found by mining");
    continue;
  }
  const callsOk = found.calls === f.calls;
  const lostOk = found.lostDeals === f.lostDeals;
  const firstOk = found.firstMentioned === f.firstMention;
  check(
    f.id,
    callsOk && lostOk && firstOk,
    `calls ${found.calls}/${f.calls}, lost ${found.lostDeals}/${f.lostDeals}, ` +
      `first ${found.firstMentioned}/${f.firstMention}`,
  );
}

section("Revenue is derived, not asserted");
{
  const mismatched = all.filter((c) => {
    const expected = transcripts
      .filter(
        (t) =>
          t.outcome === "closed_lost" &&
          c.lostDealCompanies.some((l) => l.company === t.company),
      )
      .reduce((s, t) => s + t.dealSizeUsd, 0);
    return c.revenueAtStake !== expected;
  });
  check(
    "revenue at stake equals the summed ARR of the lost deals citing it",
    mismatched.length === 0,
    mismatched.length
      ? mismatched.map((c) => `${c.name}=${c.revenueAtStake}`).join(", ")
      : `checked ${all.length} clusters`,
  );
}

section("Roster");
check("16 champions reach the arena", roster.length === 16, `${roster.length}`);
check(
  "12 mined, 4 human",
  roster.filter((c) => c.origin === "mined").length === 12 &&
    roster.filter((c) => c.origin === "human").length === 4,
  `${roster.filter((c) => c.origin === "mined").length} mined / ` +
    `${roster.filter((c) => c.origin === "human").length} human`,
);
check(
  "every champion carries the full evidence set",
  roster.every(
    (c) =>
      Number.isFinite(c.calls) &&
      Number.isFinite(c.lostDeals) &&
      Number.isFinite(c.revenueAtStake) &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.firstMentioned),
  ),
);
check(
  "feature keys are unique",
  new Set(roster.map((c) => c.featureKey)).size === roster.length,
);
check(
  "threshold actually filters",
  mining.belowThreshold.length > 0,
  `${mining.belowThreshold.map((c) => `${c.name}(${c.calls})`).join(", ")}`,
);

section("Non-negotiable: two evidence dimensions disagree");
{
  const a = byKey.get(DIMENSION_CLASH.a)!;
  const b = byKey.get(DIMENSION_CLASH.b)!;
  check(
    `${a.name} is mentioned in far more calls than ${b.name}`,
    a.calls >= b.calls * 2,
    `${a.calls} vs ${b.calls} calls`,
  );
  check(
    `${b.name} is cited in far more lost deals than ${a.name}`,
    b.lostDeals >= a.lostDeals * 3,
    `${b.lostDeals} vs ${a.lostDeals} lost deals`,
  );
  check(
    `${b.name} carries far more revenue than ${a.name}`,
    b.revenueAtStake >= a.revenueAtStake * 5,
    `$${(b.revenueAtStake / 1000).toFixed(0)}k vs $${(a.revenueAtStake / 1000).toFixed(0)}k`,
  );
}

section("Non-negotiable: a genuinely close matchup exists");
{
  const a = byKey.get(DESIGNED_RIVALRY.a)!;
  const b = byKey.get(DESIGNED_RIVALRY.b)!;
  // Opposite composition is what makes the room split: one champion wins on
  // volume, the other on money and lost deals. Neither dominates on both.
  check(
    `${a.name} leads on calls`,
    a.calls > b.calls,
    `${a.calls} vs ${b.calls}`,
  );
  check(
    `${b.name} leads on lost deals and revenue`,
    b.lostDeals > a.lostDeals && b.revenueAtStake > a.revenueAtStake,
    `${b.lostDeals} vs ${a.lostDeals} lost deals, ` +
      `$${(b.revenueAtStake / 1000).toFixed(0)}k vs $${(a.revenueAtStake / 1000).toFixed(0)}k`,
  );
  check(
    "neither champion dominates every dimension",
    !(a.calls > b.calls && a.lostDeals > b.lostDeals && a.revenueAtStake > b.revenueAtStake),
  );
}

section("Visual encoding has range to work with");
{
  const calls = roster.map((c) => c.calls);
  const lost = roster.map((c) => c.lostDeals);
  const rev = roster.map((c) => c.revenueAtStake);
  check("call counts span a wide range", Math.max(...calls) >= 4 * Math.max(1, Math.min(...calls)), `${Math.min(...calls)}–${Math.max(...calls)}`);
  check("lost-deal counts span 0 to 5+", Math.min(...lost) === 0 && Math.max(...lost) >= 5, `${Math.min(...lost)}–${Math.max(...lost)}`);
  check("revenue spans $0 to $1M+", Math.min(...rev) === 0 && Math.max(...rev) >= 1_000_000, `$0–$${(Math.max(...rev) / 1e6).toFixed(2)}M`);
  const years = roster.map((c) => c.firstMentioned.slice(0, 4));
  check("backlog age spans multiple years", new Set(years).size >= 3, [...new Set(years)].sort().join(", "));
}

console.log(
  failures === 0
    ? "\nAll seed guarantees hold.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
