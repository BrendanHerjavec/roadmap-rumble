/**
 * Mining: transcripts in, candidate features with evidence out.
 *
 * Two backends, one output shape:
 *
 *   lexicon   — phrase matching against `LEXICON`. Deterministic, offline,
 *               instant. The default for live demos and the one `verify:seed`
 *               asserts against.
 *   anthropic — Claude extracts requests per call in open text, then clusters
 *               the pooled labels into candidate features and names them. This
 *               is the backend you'd point at a real CRM, where you don't know
 *               the vocabulary in advance.
 *
 * Either way, the *numbers* are computed here in plain code from call metadata,
 * never asked for from a model. Call counts, lost-deal counts, and revenue are
 * facts about the corpus; only the reading of free text is delegated.
 */

import Anthropic from "@anthropic-ai/sdk";
import { LEXICON, LEXICON_BY_KEY, matchClusters } from "./lexicon.ts";
import { narrativeFor } from "./narrative.ts";
import type {
  CandidateFeature,
  MiningResult,
  RawRequest,
  Transcript,
} from "./types.ts";

export const DEFAULT_THRESHOLD = 5;

const MODEL = "claude-sonnet-5";

/* ------------------------------------------------------------------ *
 * Aggregation — shared by both backends
 * ------------------------------------------------------------------ */

interface ClusterMeta {
  key: string;
  name: string;
  description: string;
  problem?: string;
  counterweight?: string;
}

/**
 * Turns per-call cluster assignments into evidence. A call counts once per
 * cluster however many times it comes up; a lost deal counts only when the
 * cluster shows up in that deal's loss reason.
 */
function aggregate(
  clusters: ClusterMeta[],
  /** callId -> cluster keys mentioned anywhere in the call. */
  mentions: Map<string, Set<string>>,
  /** callId -> cluster keys named in the loss reason. */
  citations: Map<string, Set<string>>,
  quotes: Map<string, RawRequest[]>,
  transcripts: Transcript[],
): CandidateFeature[] {
  const byCallId = new Map(transcripts.map((t) => [t.callId, t]));

  return clusters
    .map((cluster) => {
      const mentioningCalls = transcripts.filter((t) =>
        mentions.get(t.callId)?.has(cluster.key),
      );
      const lostCalls = transcripts.filter(
        (t) =>
          t.outcome === "closed_lost" && citations.get(t.callId)?.has(cluster.key),
      );

      const evidence = (quotes.get(cluster.key) ?? [])
        .map((r) => {
          const t = byCallId.get(r.callId);
          return t
            ? { callId: r.callId, company: t.company, date: t.date, quote: r.quote }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

      const narrative = narrativeFor(cluster.key);

      return {
        featureKey: cluster.key,
        name: cluster.name,
        description: cluster.description,
        problem: cluster.problem ?? narrative.problem,
        counterweight: cluster.counterweight ?? narrative.counterweight,
        calls: mentioningCalls.length,
        lostDeals: lostCalls.length,
        revenueAtStake: lostCalls.reduce((s, t) => s + t.dealSizeUsd, 0),
        firstMentioned: mentioningCalls
          .map((t) => t.date)
          .sort()[0] ?? "",
        origin: "mined" as const,
        evidence,
        lostDealCompanies: lostCalls
          .map((t) => ({
            company: t.company,
            dealSizeUsd: t.dealSizeUsd,
            date: t.date,
          }))
          .sort((a, b) => b.dealSizeUsd - a.dealSizeUsd),
      };
    })
    .filter((c) => c.calls > 0)
    .sort((a, b) => b.calls - a.calls || b.lostDeals - a.lostDeals);
}

function split(
  candidates: CandidateFeature[],
  threshold: number,
): Pick<MiningResult, "candidates" | "belowThreshold"> {
  return {
    candidates: candidates.filter((c) => c.calls >= threshold),
    belowThreshold: candidates.filter((c) => c.calls < threshold),
  };
}

/* ------------------------------------------------------------------ *
 * Backend 1 — lexicon
 * ------------------------------------------------------------------ */

export function mineWithLexicon(
  transcripts: Transcript[],
  threshold = DEFAULT_THRESHOLD,
): MiningResult {
  const mentions = new Map<string, Set<string>>();
  const citations = new Map<string, Set<string>>();
  const quotes = new Map<string, RawRequest[]>();

  for (const t of transcripts) {
    const mentioned = new Set<string>();

    for (const turn of t.customerTurns) {
      for (const key of matchClusters(turn)) {
        mentioned.add(key);
        const list = quotes.get(key) ?? [];
        // One entry per call, and never the same sentence twice: a feature
        // mentioned in 24 calls has only so many distinct phrasings, and the
        // drawer must not show two companies saying identical words.
        if (
          !list.some((r) => r.callId === t.callId) &&
          !list.some((r) => r.quote === turn)
        ) {
          list.push({ callId: t.callId, label: key, quote: turn, blocking: false });
          quotes.set(key, list);
        }
      }
    }

    mentions.set(t.callId, mentioned);
    citations.set(
      t.callId,
      new Set(t.outcome === "closed_lost" ? matchClusters(t.lostReason) : []),
    );
  }

  const clusters: ClusterMeta[] = LEXICON.map((e) => ({
    key: e.key,
    name: e.name,
    description: e.description,
  }));

  return {
    generatedAt: new Date().toISOString(),
    method: "lexicon",
    transcriptCount: transcripts.length,
    threshold,
    ...split(aggregate(clusters, mentions, citations, quotes, transcripts), threshold),
  };
}

/* ------------------------------------------------------------------ *
 * Backend 2 — Anthropic
 * ------------------------------------------------------------------ */

const EXTRACT_SYSTEM = `You read B2B sales call transcripts for Northwind, a team project management tool, and pull out product gaps the customer is asking for.

Rules:
- Only extract things the CUSTOMER asks for or complains is missing. Ignore the rep's lines and ignore scene-setting about their current tools.
- One entry per distinct ask. If they circle back to the same ask twice, that is still one entry.
- "label" is a short neutral noun phrase for the ask, 2-5 words, in your own words.
- "quote" is the customer's sentence, verbatim.
- Return [] if the call contains no product asks.`;

const CLUSTER_SYSTEM = `You group product feature requests that came from different sales calls into candidate features, and write the case for each one.

Rules:
- Requests worded differently but asking for the same capability belong in one cluster.
- Do not merge genuinely different capabilities just because they sound adjacent. Permissions and single sign-on are different. Time tracking and capacity planning are different.
- "key" is kebab-case, stable, derived from the capability, e.g. "single-sign-on".
- "name" is a punchy 1-3 word label a product team would put on a card.
- "description" is exactly one sentence describing the capability.
- "problem" is one or two sentences on what actually breaks for the customer, in their terms. Describe the hole, not the feature: "nobody can answer who changed this" rather than "immutable change log".
- "counterweight" is one or two sentences making the argument the raw counts will not capture — and it must be genuinely arguable in EITHER direction. Sometimes that means a rarely-mentioned item matters more than it looks (it is a qualification gate, so it never survives to a second call). Sometimes it means a frequently-mentioned item matters less (everyone asks, nobody buys on it). Do not simply advocate for every feature.
- Never speculate about who inside the vendor proposed an idea, and never say an idea was submitted or suggested by a person. You are reading customer calls only.
- Every input label must appear in exactly one cluster.`;

interface ExtractedItem {
  label: string;
  quote: string;
}

interface ClusterOut {
  key: string;
  name: string;
  description: string;
  problem?: string;
  counterweight?: string;
  labels: string[];
}

async function askJson<T>(
  client: Anthropic,
  system: string,
  user: string,
  schemaHint: string,
): Promise<T> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [
      { role: "user", content: user },
      // Prefilling the opening bracket keeps the reply to bare JSON.
      { role: "assistant", content: schemaHint },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  const raw = schemaHint + text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (start === -1 || end === -1) {
    throw new Error(`Model did not return JSON:\n${raw.slice(0, 400)}`);
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export async function mineWithAnthropic(
  transcripts: Transcript[],
  threshold = DEFAULT_THRESHOLD,
  onProgress?: (msg: string) => void,
): Promise<MiningResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  // Pass 1 — open extraction, one request per call, run in small batches.
  const raw: RawRequest[] = [];
  const BATCH = 6;
  for (let i = 0; i < transcripts.length; i += BATCH) {
    const batch = transcripts.slice(i, i + BATCH);
    onProgress?.(
      `extracting ${i + 1}-${Math.min(i + BATCH, transcripts.length)} of ${transcripts.length}`,
    );

    await Promise.all(
      batch.map(async (t) => {
        const items = await askJson<ExtractedItem[]>(
          client,
          EXTRACT_SYSTEM,
          `Call ${t.callId} — ${t.company} (${t.date})\n\n${t.body}\n\n` +
            `Return a JSON array of {"label","quote"}.`,
          "[",
        );
        for (const item of items) {
          if (!item?.label) continue;
          raw.push({
            callId: t.callId,
            label: item.label.trim(),
            quote: (item.quote ?? "").trim(),
            blocking: false,
          });
        }
      }),
    );
  }

  // Pass 2 — cluster the pooled labels. The model never sees the counts, so it
  // cannot be nudged by how popular something already looks.
  const uniqueLabels = [...new Set(raw.map((r) => r.label))].sort();
  onProgress?.(`clustering ${uniqueLabels.length} distinct requests`);

  const clustersOut = await askJson<ClusterOut[]>(
    client,
    CLUSTER_SYSTEM,
    `Requests extracted from ${transcripts.length} sales calls:\n\n` +
      uniqueLabels.map((l) => `- ${l}`).join("\n") +
      `\n\nReturn a JSON array of ` +
      `{"key","name","description","problem","counterweight","labels"}.`,
    "[",
  );

  const labelToKey = new Map<string, string>();
  for (const c of clustersOut) {
    for (const label of c.labels ?? []) labelToKey.set(label, c.key);
  }

  // Anything the clusterer dropped keeps its own identity rather than vanishing.
  const clusters: ClusterMeta[] = clustersOut.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    problem: c.problem,
    counterweight: c.counterweight,
  }));

  const mentions = new Map<string, Set<string>>();
  const quotes = new Map<string, RawRequest[]>();
  for (const r of raw) {
    const key = labelToKey.get(r.label);
    if (!key) continue;
    const set = mentions.get(r.callId) ?? new Set<string>();
    set.add(key);
    mentions.set(r.callId, set);

    const list = quotes.get(key) ?? [];
    if (!list.some((q) => q.callId === r.callId)) {
      list.push(r);
      quotes.set(key, list);
    }
  }

  // Loss reasons are short and structured enough to match against the cluster
  // vocabulary directly, which keeps the armour count auditable.
  const citations = new Map<string, Set<string>>();
  for (const t of transcripts) {
    if (t.outcome !== "closed_lost" || !t.lostReason) continue;
    const hits = new Set<string>();
    const reason = t.lostReason.toLowerCase();
    for (const c of clustersOut) {
      const terms = [c.name, ...(c.labels ?? [])].map((s) => s.toLowerCase());
      if (terms.some((term) => term.length > 3 && reason.includes(term))) {
        hits.add(c.key);
      }
    }
    // Fall back to the phrase lexicon for anything the vocabulary missed, so a
    // lost deal never silently loses its citation.
    for (const key of matchClusters(t.lostReason)) {
      const mapped = clustersOut.find(
        (c) => c.key === key || c.name === LEXICON_BY_KEY.get(key)?.name,
      );
      if (mapped) hits.add(mapped.key);
    }
    citations.set(t.callId, hits);
  }

  return {
    generatedAt: new Date().toISOString(),
    method: "anthropic",
    transcriptCount: transcripts.length,
    threshold,
    ...split(aggregate(clusters, mentions, citations, quotes, transcripts), threshold),
  };
}

export async function mine(
  transcripts: Transcript[],
  opts: {
    backend?: "auto" | "lexicon" | "anthropic";
    threshold?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<MiningResult> {
  const { backend = "auto", threshold = DEFAULT_THRESHOLD, onProgress } = opts;
  const useAnthropic =
    backend === "anthropic" ||
    (backend === "auto" && Boolean(process.env.ANTHROPIC_API_KEY));

  if (!useAnthropic) return mineWithLexicon(transcripts, threshold);

  try {
    return await mineWithAnthropic(transcripts, threshold, onProgress);
  } catch (err) {
    if (backend === "anthropic") throw err;
    onProgress?.(
      `Anthropic mining failed (${(err as Error).message}); falling back to lexicon.`,
    );
    return mineWithLexicon(transcripts, threshold);
  }
}
