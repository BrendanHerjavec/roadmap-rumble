/**
 * Generates /data/transcripts/*.md from the design table + call corpus.
 *
 * The allocator is the interesting part. Each feature has a target number of
 * calls and a target number of closed-lost citations, and every mention has to
 * land in a call dated on or after that feature's first-mention anchor. It
 * assigns anchors first, then lost-deal citations (tightest constraint), then
 * spreads the remaining mentions across the least-loaded eligible calls so no
 * single transcript turns into a shopping list.
 *
 * Deterministic: same input, same 40 files, byte for byte.
 *
 *   npm run seed:transcripts
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_DESIGN, type FeatureDesign } from "../src/lib/seed/design.ts";
import {
  BRIDGES,
  CALLS,
  CLOSINGS,
  CONTACT_ASIDES,
  CURRENT_STATE_LEADS,
  FIRST_BRIDGES,
  OPENERS,
  REP_RESPONSES,
  type CallSeed,
} from "../src/lib/seed/corpus.ts";

const OUT_DIR = join(process.cwd(), "data", "transcripts");

/* ------------------------------------------------------------------ *
 * Deterministic randomness
 * ------------------------------------------------------------------ */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(arr: readonly T[], rnd: () => number): T =>
  arr[Math.floor(rnd() * arr.length) % arr.length];

/* ------------------------------------------------------------------ *
 * Allocation
 * ------------------------------------------------------------------ */

interface Allocation {
  /** call index -> feature ids mentioned, in the order they come up. */
  mentions: Map<number, string[]>;
  /** call index -> feature ids cited as blockers on a lost deal. */
  citations: Map<number, string[]>;
}

function allocate(): Allocation {
  const mentions = new Map<number, string[]>();
  const citations = new Map<number, string[]>();
  CALLS.forEach((_, i) => {
    mentions.set(i, []);
    citations.set(i, []);
  });

  const mentionsOf = (i: number) => mentions.get(i)!;
  const citationsOf = (i: number) => citations.get(i)!;
  const load = (i: number) => mentionsOf(i).length;

  const eligible = (f: FeatureDesign) =>
    CALLS.map((c, i) => ({ c, i })).filter(({ c }) => c.date >= f.firstMention);

  // 1. Anchors. The first-mention date must be a real fact about the corpus,
  //    so the anchor call is forced to mention the feature.
  for (const f of FEATURE_DESIGN) {
    const anchor = CALLS.findIndex((c) => c.date === f.firstMention);
    if (anchor === -1) {
      throw new Error(
        `No call dated ${f.firstMention} to anchor "${f.id}". Add one to CALLS.`,
      );
    }
    mentionsOf(anchor).push(f.id);
    if (f.lostDeals > 0 && CALLS[anchor].outcome === "closed_lost") {
      citationsOf(anchor).push(f.id);
    }
  }

  // 2. Lost-deal citations, tightest first. A citation implies a mention.
  const byCitationPressure = [...FEATURE_DESIGN].sort(
    (a, b) => b.lostDeals - a.lostDeals,
  );
  for (const f of byCitationPressure) {
    const need = f.lostDeals - citationsOf_count(citations, f.id);
    if (need <= 0) continue;

    const pool = eligible(f)
      .filter(({ c, i }) => c.outcome === "closed_lost" && !citationsOf(i).includes(f.id))
      .sort((x, y) => {
        // Prefer deals whose size matches where this gap actually bites, then
        // spread across the least-cited calls so no post-mortem reads as a rant.
        const affinity = (c: CallSeed) => (c.segment === f.dealAffinity ? 0 : 1);
        return (
          affinity(x.c) - affinity(y.c) ||
          citationsOf(x.i).length - citationsOf(y.i).length ||
          load(x.i) - load(y.i) ||
          x.i - y.i
        );
      });

    if (pool.length < need) {
      throw new Error(
        `"${f.id}" needs ${need} more lost-deal citations but only ${pool.length} ` +
          `closed-lost calls exist on or after ${f.firstMention}.`,
      );
    }

    for (const { i } of pool.slice(0, need)) {
      citationsOf(i).push(f.id);
      if (!mentionsOf(i).includes(f.id)) mentionsOf(i).push(f.id);
    }
  }

  // 3. Remaining mentions. Scarcest features (most calls needed relative to the
  //    eligible pool) pick first, then spread onto the least-loaded calls.
  const byScarcity = [...FEATURE_DESIGN].sort(
    (a, b) => b.calls / eligible(b).length - a.calls / eligible(a).length,
  );
  for (const f of byScarcity) {
    const have = CALLS.filter((_, i) => mentionsOf(i).includes(f.id)).length;
    const need = f.calls - have;
    if (need < 0) {
      throw new Error(
        `"${f.id}" is already in ${have} calls but targets ${f.calls}. ` +
          `lostDeals (${f.lostDeals}) cannot exceed calls (${f.calls}).`,
      );
    }
    if (need === 0) continue;

    const pool = eligible(f)
      .filter(({ i }) => !mentionsOf(i).includes(f.id))
      .sort((x, y) => load(x.i) - load(y.i) || x.i - y.i);

    if (pool.length < need) {
      throw new Error(
        `"${f.id}" needs ${need} more mentions but only ${pool.length} eligible ` +
          `calls remain on or after ${f.firstMention}.`,
      );
    }

    for (const { i } of pool.slice(0, need)) mentionsOf(i).push(f.id);
  }

  // Order each call's mentions by how the conversation would naturally flow:
  // whatever they are blocked on first, then the rest by how loudly it is asked for.
  const weight = new Map(FEATURE_DESIGN.map((f) => [f.id, f.calls]));
  for (const [i, ids] of mentions) {
    const cited = new Set(citationsOf(i));
    ids.sort(
      (a, b) =>
        Number(cited.has(b)) - Number(cited.has(a)) ||
        weight.get(b)! - weight.get(a)! ||
        a.localeCompare(b),
    );
  }

  return { mentions, citations };
}

function citationsOf_count(citations: Map<number, string[]>, id: string): number {
  let n = 0;
  for (const ids of citations.values()) if (ids.includes(id)) n++;
  return n;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

const byId = new Map(FEATURE_DESIGN.map((f) => [f.id, f]));

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Quotes already spent, per feature, across the whole corpus.
 *
 * Two companies saying the same sentence word for word reads as fabricated the
 * moment those lines sit next to each other in the evidence drawer — which they
 * do. Each feature's pool is drawn down globally before it wraps.
 */
const spentQuotes = new Map<string, Set<string>>();

function takeQuote(f: FeatureDesign, rnd: () => number): string {
  const spent = spentQuotes.get(f.id) ?? new Set<string>();
  spentQuotes.set(f.id, spent);

  const fresh = f.quotes.filter((q) => !spent.has(q));
  // Pool exhausted: reset and start reusing, which only happens when a feature
  // is mentioned in more calls than it has distinct phrasings.
  const pool = fresh.length ? fresh : f.quotes;
  if (!fresh.length) spent.clear();

  const quote = pool[Math.floor(rnd() * pool.length) % pool.length];
  spent.add(quote);
  return quote;
}

function renderCall(
  call: CallSeed,
  index: number,
  mentionIds: string[],
  citationIds: string[],
): { filename: string; content: string } {
  const rnd = mulberry32(hashString(`${call.date}|${call.company}`));
  const callId = `NW-${String(index + 1).padStart(3, "0")}`;
  const speakerC = `${call.contact} (${call.company})`;
  const speakerR = `${call.rep} (Northwind)`;

  const lines: string[] = [];
  const say = (who: string, what: string) => lines.push(`**${who}:** ${what}`, "");

  say(speakerR, pick(OPENERS, rnd));
  say(speakerC, pick(CURRENT_STATE_LEADS, rnd).replace("{state}", call.currentState));
  say(speakerR, pick(FIRST_BRIDGES, rnd));

  // Each mention: the customer says it in their own words, the rep responds.
  // Phrasings are drawn from a corpus-wide pool so mining has to cluster
  // genuinely different wordings, and so the evidence drawer never shows two
  // companies saying the same sentence.
  mentionIds.forEach((id, n) => {
    const f = byId.get(id)!;
    say(speakerC, takeQuote(f, rnd));
    if (rnd() < 0.18) say(speakerC, pick(CONTACT_ASIDES, rnd));
    say(speakerR, pick(REP_RESPONSES, rnd));
    if (n < mentionIds.length - 1 && rnd() < 0.45) say(speakerR, pick(BRIDGES, rnd));
  });

  // Lost deals get an explicit post-mortem turn. This is the moment a CRM would
  // capture as the loss reason, and it's what mining reads for the armour count.
  if (call.outcome === "closed_lost" && citationIds.length > 0) {
    const gaps = citationIds.map((id) => byId.get(id)!.lostReasonPhrase);
    say(
      speakerR,
      "Let me ask the uncomfortable question. If you go another direction, what's the reason?",
    );
    say(
      speakerC,
      `It comes down to ${listPhrase(gaps)}. Everything else we could have lived with.`,
    );
  }

  say(speakerR, pick(CLOSINGS[call.outcome], rnd));

  const lostReason =
    call.outcome === "closed_lost"
      ? citationIds.length > 0
        ? `Selected an alternative. Gaps cited by the customer: ${listPhrase(
            citationIds.map((id) => byId.get(id)!.lostReasonPhrase),
          )}.`
        : "Selected an alternative. No single gap cited; budget was reallocated."
      : "";

  const frontmatter = [
    "---",
    `call_id: ${callId}`,
    `company: ${call.company}`,
    `industry: ${call.industry}`,
    `segment: ${call.segment}`,
    `date: ${call.date}`,
    `rep: ${call.rep}`,
    `contact: ${call.contact}`,
    `contact_title: ${call.contactTitle}`,
    `stage: ${call.stage}`,
    `deal_outcome: ${call.outcome}`,
    `deal_size_usd: ${call.dealSizeUsd}`,
    ...(lostReason ? [`lost_reason: ${JSON.stringify(lostReason)}`] : []),
    "---",
    "",
  ].join("\n");

  const header = `# ${call.company} — ${call.stage} (${call.date})\n\n`;

  return {
    filename: `${callId}-${slug(call.company)}.md`,
    content: frontmatter + header + lines.join("\n").trimEnd() + "\n",
  };
}

function listPhrase(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join("; ")}; and ${items[items.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main() {
  const { mentions, citations } = allocate();

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  CALLS.forEach((call, i) => {
    const { filename, content } = renderCall(
      call,
      i,
      mentions.get(i)!,
      citations.get(i)!,
    );
    writeFileSync(join(OUT_DIR, filename), content, "utf8");
  });

  // Report what we actually produced, so a mismatch with the design is obvious
  // before mining ever runs.
  const stats = FEATURE_DESIGN.map((f) => {
    const calls = CALLS.filter((_, i) => mentions.get(i)!.includes(f.id));
    const lost = CALLS.filter((_, i) => citations.get(i)!.includes(f.id));
    return {
      id: f.id,
      calls: calls.length,
      target: f.calls,
      lost: lost.length,
      lostTarget: f.lostDeals,
      revenue: lost.reduce((s, c) => s + c.dealSizeUsd, 0),
      first: calls.reduce((m, c) => (c.date < m ? c.date : m), "9999-99-99"),
    };
  });

  const bad = stats.filter(
    (s) => s.calls !== s.target || s.lost !== s.lostTarget,
  );

  console.log(`Wrote ${CALLS.length} transcripts to data/transcripts/`);
  console.table(
    stats.map((s) => ({
      feature: s.id,
      calls: `${s.calls}/${s.target}`,
      lostDeals: `${s.lost}/${s.lostTarget}`,
      revenue: `$${(s.revenue / 1000).toFixed(0)}k`,
      firstMention: s.first,
    })),
  );

  const perCall = CALLS.map((c, i) => mentions.get(i)!.length);
  console.log(
    `Mentions per call: min ${Math.min(...perCall)}, max ${Math.max(...perCall)}, ` +
      `total ${perCall.reduce((a, b) => a + b, 0)}`,
  );

  if (bad.length) {
    console.error("\nAllocation did not hit design targets:", bad);
    process.exit(1);
  }
}

main();
