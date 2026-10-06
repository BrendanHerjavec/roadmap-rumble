import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CandidateFeature } from "./mining/types";

/**
 * Reads the mined roster from disk. Server-side only — `npm run mine` writes
 * this file, so the app never has to hit the Anthropic API just to boot.
 */
export function readRoster(): CandidateFeature[] {
  const path = join(process.cwd(), "data", "roster.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CandidateFeature[];
  } catch {
    throw new Error(
      "data/roster.json is missing. Run `npm run seed:transcripts` then `npm run mine`.",
    );
  }
}
