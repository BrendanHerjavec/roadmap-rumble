export type Origin = "mined" | "human";

/** A parsed call from `/data/transcripts/`. */
export interface Transcript {
  callId: string;
  company: string;
  industry: string;
  segment: string;
  date: string;
  rep: string;
  contact: string;
  contactTitle: string;
  stage: string;
  outcome: "closed_won" | "closed_lost" | "open";
  dealSizeUsd: number;
  /** Prose loss reason. Empty unless the deal was lost. */
  lostReason: string;
  body: string;
  /** Just the customer's turns — the rep's lines aren't feature requests. */
  customerTurns: string[];
  sourceFile: string;
}

/** One extracted request, before clustering. */
export interface RawRequest {
  callId: string;
  /** Short label in the extractor's own words. */
  label: string;
  /** The sentence it came from, kept for the evidence drawer. */
  quote: string;
  /** True when this showed up in the deal's loss reason, not just the chat. */
  blocking: boolean;
}

/** A clustered candidate feature with its evidence. This is what a champion is built from. */
export interface CandidateFeature {
  /** Stable id. Seeds the deterministic character art. */
  featureKey: string;
  name: string;
  description: string;
  /** Distinct calls that mentioned it. */
  calls: number;
  /** Distinct closed-lost deals that cited it as a blocker. */
  lostDeals: number;
  /** Sum of ARR across those lost deals, in whole dollars. */
  revenueAtStake: number;
  /** Date of the earliest call mentioning it. Drives backlog age. */
  firstMentioned: string;
  origin: Origin;
  submittedBy?: string;
  /** What actually breaks, in the customer's terms. */
  problem: string;
  /** The argument the headline numbers don't capture, in either direction. */
  counterweight: string;
  /** Verbatim lines, for the "show me the evidence" panel. */
  evidence: { callId: string; company: string; date: string; quote: string }[];
  /** Companies whose lost deal cited this. */
  lostDealCompanies: { company: string; dealSizeUsd: number; date: string }[];
}

export interface MiningResult {
  generatedAt: string;
  method: "anthropic" | "lexicon";
  transcriptCount: number;
  /** Clusters that cleared the call threshold. */
  candidates: CandidateFeature[];
  /** Clusters that did not. Useful colour for the demo, and for the reveal. */
  belowThreshold: CandidateFeature[];
  threshold: number;
}
