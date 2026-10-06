/**
 * Runs the mining step over /data/transcripts/ and writes the result.
 *
 *   npm run mine              # Anthropic if ANTHROPIC_API_KEY is set, else lexicon
 *   npm run mine -- --offline # force the deterministic lexicon backend
 *   npm run mine -- --llm     # force Anthropic, fail loudly if it doesn't work
 *
 * Output: data/candidates.json (mining result) and data/roster.json (the
 * 16 champions the arena actually loads, mined plus human-typed).
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTranscripts } from "../src/lib/mining/transcripts.ts";
import { DEFAULT_THRESHOLD, mine } from "../src/lib/mining/miner.ts";
import { buildRoster } from "../src/lib/mining/roster.ts";

config({ path: ".env.local", quiet: true });

const args = new Set(process.argv.slice(2));
const backend = args.has("--offline")
  ? "lexicon"
  : args.has("--llm")
    ? "anthropic"
    : "auto";

const DATA_DIR = join(process.cwd(), "data");

async function main() {
  const transcripts = loadTranscripts();
  console.log(`Read ${transcripts.length} transcripts.`);

  const result = await mine(transcripts, {
    backend,
    threshold: DEFAULT_THRESHOLD,
    onProgress: (m) => console.log(`  ${m}`),
  });

  const roster = buildRoster(result);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    join(DATA_DIR, "candidates.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  writeFileSync(join(DATA_DIR, "roster.json"), JSON.stringify(roster, null, 2), "utf8");

  console.log(`\nBackend: ${result.method}`);
  console.log(
    `Surfaced ${result.candidates.length} candidates ` +
      `(threshold: ${result.threshold}+ calls), ` +
      `${result.belowThreshold.length} below threshold.\n`,
  );

  console.table(
    roster.map((c) => ({
      champion: c.name,
      origin: c.origin,
      calls: c.calls,
      lostDeals: c.lostDeals,
      revenue: `$${(c.revenueAtStake / 1000).toFixed(0)}k`,
      firstMentioned: c.firstMentioned,
    })),
  );

  if (result.belowThreshold.length) {
    console.log(
      "Below threshold, not surfaced: " +
        result.belowThreshold.map((c) => `${c.name} (${c.calls})`).join(", "),
    );
  }
  console.log(`\nWrote data/candidates.json and data/roster.json (${roster.length} champions).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
