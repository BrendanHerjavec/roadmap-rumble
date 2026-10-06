/**
 * The argument behind the numbers.
 *
 * The champion art encodes the *quantitative* evidence — body size, armour,
 * weapon. That comparison is fast and honest, and it is also not the whole
 * story. A feature with $19k of lost deals can matter more than one with $2M,
 * and a room needs somewhere to say so out loud.
 *
 * So each cluster carries two pieces of prose:
 *
 *   problem       — what actually breaks, in the customer's terms. Not the
 *                   feature, the hole it fills. "Nobody can answer who changed
 *                   this" rather than "immutable change log".
 *   counterweight — the argument the headline numbers don't capture, in either
 *                   direction. Sometimes it argues the feature is underrated
 *                   (Template Market's $19k hides an onboarding-time lever);
 *                   sometimes it argues the opposite (Permission Grid's revenue
 *                   is partly double-counted against Single Sign-On).
 *
 * Written to be arguable rather than persuasive. If every counterweight said
 * "actually this one is great", the drawer would be decoration.
 *
 * One hard rule: **nothing here may reveal a champion's origin.** Whether an
 * idea was mined or typed in by a person stays hidden until the results screen,
 * so no line may say "someone asked for this" or name a submitter.
 *
 * The Anthropic mining backend writes these from the transcripts directly; this
 * table is what the offline backend uses, and what keeps a live demo stable.
 */

export interface Narrative {
  problem: string;
  counterweight: string;
}

export const NARRATIVE: Record<string, Narrative> = {
  "audit-log": {
    problem:
      "Nobody can answer “who changed this, and when”. A due date moves with no author attached, and an auditor asking for a change log gets an activity feed nobody can archive.",
    counterweight:
      "Seven lost deals, but every one died at security review — late, after months of sales effort. The real cost isn't only the ARR, it's the cycle time spent reaching a gate we always fail.",
  },
  "saml-sso": {
    problem:
      "IT can't provision or deprovision through the company identity provider. Every user is a separate password, and a leaver keeps their access until someone remembers.",
    counterweight:
      "Only nine calls mention it because it rarely survives to a second conversation — it's a qualification gate, not a feature request. A low mention count here means the opposite of low demand.",
  },
  "granular-permissions": {
    problem:
      "Roles are workspace-wide, so a contractor invited to one project can read every project in the workspace, budgets included.",
    counterweight:
      "Usually raised by the same buyers who raise single sign-on, so some of this revenue is double-counted against it. Shipping one without the other may not actually unblock the deal.",
  },
  "time-tracking": {
    problem:
      "Hours live in a second tool, so billable work goes unlogged and someone reconciles a spreadsheet every Friday.",
    counterweight:
      "Asked for constantly by agencies and consultancies, and shipped by every competitor. Table stakes rather than differentiation — losing without it is more likely than winning with it.",
  },
  "timeline-view": {
    problem:
      "No dependency-aware schedule. A slipped milestone moves nothing downstream, and the exec schedule gets rebuilt by hand every week.",
    counterweight:
      "Seventeen calls, but often a request on behalf of a stakeholder who will never log in. Worth asking whether the buyer wants the view or wants the slide.",
  },
  "portfolio-rollup": {
    problem:
      "Leadership has no cross-project view, so the PMO spends the first two days of every month assembling a status deck by hand.",
    counterweight:
      "Only seven calls, but every one came from a buyer running sixty-plus projects — the largest seat counts and the slowest churn in the pipeline.",
  },
  "guest-access": {
    problem:
      "External clients and agencies need a paid seat to see anything, so teams email screenshots and approvals happen outside the tool.",
    counterweight:
      "The loudest ask in the corpus by a wide margin — and a pricing decision, not just a product one. Free guest seats may cost more in seat revenue than the deals they win.",
  },
  "api-rate-limits": {
    problem:
      "Rate limits are too low for a nightly warehouse sync, so integration jobs back off and an eleven-hour window isn't enough.",
    counterweight:
      "Five calls and $935k — the highest revenue-per-mention in the backlog. Everyone who raises it is technical, large, and already committed to integrating.",
  },
  "custom-fields": {
    problem:
      "Intake data has nowhere to live, so teams overload tags and end up with four hundred of them and no way to report.",
    counterweight:
      "Fifteen calls, and a foundation other things stand on — reporting, filtering and automation all get harder to build without it. Cheap to underrate.",
  },
  "slack-sync": {
    problem:
      "The integration is one-way. A reply in a Slack thread never reaches the task, so the tool and the conversation drift apart.",
    counterweight:
      "Thirteen calls and $31k. Genuinely loved and genuinely not worth money — nobody has bought or refused to buy over it.",
  },
  "capacity-planning": {
    problem:
      "Nobody can see who is over-allocated across projects until they say so, and resourcing lives in a spreadsheet that's wrong the moment it's saved.",
    counterweight:
      "Nineteen calls, and the fastest-rising thing in the backlog — first raised barely a year ago. Trajectory, not just volume.",
  },
  "bulk-edit": {
    problem:
      "Owner, date and status change one task at a time. A two-week slip is eighty manual edits, and a departure is two hours of clicking.",
    counterweight:
      "The most-mentioned item in the whole corpus, worth $31k. It's a retention and daily-satisfaction problem rather than a sales one — which is precisely why it never shows up in a lost-deal reason.",
  },
  "offline-mobile": {
    problem:
      "Field crews lose signal on site and the app stalls, so work orders go back to paper and sync never happens.",
    counterweight:
      "Three calls, two of them lost deals. A narrow vertical requirement that is absolute when it applies and irrelevant when it doesn't.",
  },
  "recurring-tasks": {
    problem:
      "Repeating checklists are duplicated by hand every cycle, and someone has to remember to do it.",
    counterweight:
      "Four calls, no lost deals, and probably a week of work. The kind of item that never wins a vote and never stops being asked for.",
  },
  "template-marketplace": {
    problem:
      "Every project manager sets projects up differently, so conventions live in people's heads and new starters spend their first week learning them.",
    counterweight:
      "$19k of lost deals makes this look trivial, but every new customer hits it in week one. It's an onboarding-time lever, and onboarding time is a leading indicator ARR can't see.",
  },
  "sla-uptime": {
    problem:
      "No contractual uptime commitment and no public status page, so procurement has nothing to review and vendor approval stalls.",
    counterweight:
      "Three calls, $421k. Mostly a legal and process change rather than engineering work — unusually cheap for the revenue it unblocks.",
  },
  "dark-mode": {
    problem:
      "No dark theme, and the product ignores the system setting entirely.",
    counterweight:
      "Zero lost deals and zero revenue behind it. Nothing here argues for shipping it except that it's small, popular, and visible on the first day.",
  },
  "ai-standup": {
    problem:
      "Nobody knows what actually moved yesterday without opening every project and reading it.",
    counterweight:
      "Two mentions, both unprompted asides at the end of a call. There's almost no evidence behind this one — judge it on conviction, because the corpus has nothing to say.",
  },
};

export const FALLBACK_NARRATIVE: Narrative = {
  problem: "No problem statement captured for this idea yet.",
  counterweight:
    "No evidence in the corpus either way. Judge it on the argument in the room.",
};

export function narrativeFor(key: string): Narrative {
  return NARRATIVE[key] ?? FALLBACK_NARRATIVE;
}
