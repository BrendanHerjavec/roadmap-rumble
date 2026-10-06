/**
 * Replays the scripted demo run against the real roster and the real bot logic.
 *
 *   npm run simulate:demo
 *
 * The point is to make "guaranteed beats" an assertion rather than a hope. Bots
 * are deterministic, so for each scripted matchup we can compute exactly how
 * they vote — and because the host's ballot is the only free variable, we can
 * check *both* possible outcomes.
 *
 * A matchup is guaranteed contested only if it lands under the lopsided
 * threshold whichever way the host votes. Anything the script labels a "split"
 * has to clear that bar, or the demo is relying on the presenter voting a
 * particular way on camera.
 */

import { readRoster } from "../src/lib/roster.ts";
import { botChoice } from "../src/lib/game/bots.ts";
import { DEMO_BOT_BIASES, DEMO_SCRIPT } from "../src/lib/game/demo-script.ts";
import type { BotBias, ChampionRow } from "../src/lib/supabase/types.ts";
import type { CandidateFeature } from "../src/lib/mining/types.ts";

const LOPSIDED = 0.7;
const NOW = Date.now();

/** Roster entries as champion rows, at their session-start ratings. */
function asChampion(c: CandidateFeature): ChampionRow {
  return {
    id: c.featureKey,
    session_id: "sim",
    feature_key: c.featureKey,
    name: c.name,
    description: c.description,
    calls: c.calls,
    lost_deals: c.lostDeals,
    revenue_at_stake: c.revenueAtStake,
    first_mentioned: c.firstMentioned,
    origin: c.origin,
    submitted_by: c.submittedBy ?? null,
    problem: c.problem,
    counterweight: c.counterweight,
    evidence: c.evidence,
    lost_deal_companies: c.lostDealCompanies,
    rating: 1500,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    created_at: "",
  };
}

const roster = readRoster().map(asChampion);
const byKey = new Map(roster.map((c) => [c.feature_key, c]));

let failures = 0;
const rows: Record<string, string>[] = [];

console.log(
  `\nScripted run — ${DEMO_BOT_BIASES.length} bots + 1 host, ` +
    `lopsided at ${LOPSIDED * 100}%\n`,
);

for (const [i, m] of DEMO_SCRIPT.entries()) {
  const a = byKey.get(m.a);
  const b = byKey.get(m.b);
  if (!a || !b) {
    console.error(`  FAIL  #${i + 1} ${m.a} v ${m.b} — champion missing from roster`);
    failures++;
    continue;
  }

  // Bots are deterministic and every rating is 1500 at the start of a session.
  let botsA = 0;
  const picks: string[] = [];
  for (const bias of DEMO_BOT_BIASES) {
    const choice = botChoice(bias as BotBias, a, b, NOW);
    if (choice === a.id) botsA++;
    picks.push(`${bias}:${choice === a.id ? "A" : "B"}`);
  }
  const botsB = DEMO_BOT_BIASES.length - botsA;

  // The host is the only free variable. Check both ways they could vote.
  const outcomes = [
    { a: botsA + 1, b: botsB },
    { a: botsA, b: botsB + 1 },
  ].map(({ a: va, b: vb }) => {
    const share = Math.max(va, vb) / (va + vb);
    return { va, vb, share, contested: share < LOPSIDED };
  });

  const alwaysContested = outcomes.every((o) => o.contested);
  const neverContested = outcomes.every((o) => !o.contested);

  let verdict: string;
  let ok = true;

  if (m.kind === "split") {
    ok = alwaysContested;
    verdict = ok ? "contested either way" : "NOT guaranteed contested";
  } else if (m.kind === "teach") {
    ok = neverContested;
    verdict = ok ? "clear either way" : "can go contested";
  } else {
    verdict = alwaysContested
      ? "contested either way"
      : neverContested
        ? "clear either way"
        : "depends on host";
  }

  if (!ok) failures++;

  rows.push({
    "#": String(i + 1),
    kind: m.kind,
    matchup: `${a.name} v ${b.name}`,
    bots: `${botsA}-${botsB}`,
    "host→A": `${outcomes[0].va}-${outcomes[0].vb} (${Math.round(outcomes[0].share * 100)}%)`,
    "host→B": `${outcomes[1].va}-${outcomes[1].vb} (${Math.round(outcomes[1].share * 100)}%)`,
    result: `${ok ? "ok  " : "FAIL"} ${verdict}`,
  });

  if (process.env.VERBOSE) console.log(`    #${i + 1} ${picks.join(" ")}`);
}

console.table(rows);

// Every champion should appear exactly once — otherwise it isn't a valid round.
const seen = DEMO_SCRIPT.flatMap((m) => [m.a, m.b]);
const dupes = seen.filter((k, i) => seen.indexOf(k) !== i);
const missing = roster.map((c) => c.feature_key).filter((k) => !seen.includes(k));

if (dupes.length) {
  console.error(`  FAIL  champion appears twice in round 1: ${dupes.join(", ")}`);
  failures++;
}
if (missing.length) {
  console.error(`  FAIL  champion never paired in round 1: ${missing.join(", ")}`);
  failures++;
}

const splits = DEMO_SCRIPT.filter((m) => m.kind === "split").length;
if (splits < 1) {
  console.error("  FAIL  the script has no designed split");
  failures++;
}

console.log(
  failures === 0
    ? `\nAll beats hold. ${splits} guaranteed contested matchup(s), ` +
        `${DEMO_SCRIPT.length} matchups, every champion paired once.\n`
    : `\n${failures} beat(s) failed.\n`,
);

process.exit(failures === 0 ? 0 : 1);
