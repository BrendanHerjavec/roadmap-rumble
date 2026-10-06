/** Row shapes for the `rr_*` tables. Hand-written; the schema is small and stable. */

export type SessionStatus = "lobby" | "running" | "finished";
export type MatchupStatus = "pending" | "open" | "resolved";
export type BotBias = "revenue" | "recency" | "underdog" | "demand" | "risk";

export interface SessionRow {
  id: string;
  code: string;
  status: SessionStatus;
  current_matchup_id: string | null;
  round: number;
  total_rounds: number;
  vote_seconds: number;
  discussion_seconds: number;
  lopsided_threshold: number;
  created_at: string;
  finished_at: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  is_host: boolean;
  is_bot: boolean;
  bot_bias: BotBias | null;
  joined_at: string;
}

export interface ChampionRow {
  id: string;
  session_id: string;
  feature_key: string;
  name: string;
  description: string;
  calls: number;
  lost_deals: number;
  revenue_at_stake: number;
  first_mentioned: string;
  /** Never rendered before the results screen. */
  origin: "mined" | "human";
  submitted_by: string | null;
  /** What actually breaks, in the customer's terms. */
  problem: string;
  /** The argument the headline numbers don't capture, either way. */
  counterweight: string;
  evidence: EvidenceQuote[];
  lost_deal_companies: LostDeal[];
  rating: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
}

export interface MatchupRow {
  id: string;
  session_id: string;
  round: number;
  order_in_round: number;
  champion_a: string;
  champion_b: string;
  status: MatchupStatus;
  /** Ballots received. Deliberately does not reveal the split. */
  votes_cast: number;
  /** Null until the matchup resolves — this is the simultaneous reveal. */
  votes_a: number | null;
  votes_b: number | null;
  winner: string | null;
  contested: boolean;
  argument_a: string | null;
  argument_b: string | null;
  commentary: string | null;
  revote_of: string | null;
  opened_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** What `rr_cast_vote` hands back. Says nothing about how anyone voted. */
export interface CastVoteResult {
  accepted: boolean;
  votes_cast: number;
  voters: number;
  resolved: boolean;
  reason:
    | "recorded"
    | "resolved"
    | "already_voted"
    | "matchup_not_open"
    | "not_in_session"
    | "choice_not_in_matchup"
    | "no_such_matchup";
}

/** Champion payload accepted by `rr_seed_champions`. */
export interface EvidenceQuote {
  callId: string;
  company: string;
  date: string;
  quote: string;
}

export interface LostDeal {
  company: string;
  dealSizeUsd: number;
  date: string;
}

export interface ChampionSeed {
  featureKey: string;
  name: string;
  description: string;
  calls: number;
  lostDeals: number;
  revenueAtStake: number;
  firstMentioned: string;
  origin: "mined" | "human";
  submittedBy?: string;
  problem: string;
  counterweight: string;
  evidence: EvidenceQuote[];
  lostDealCompanies: LostDeal[];
}
