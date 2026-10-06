/**
 * Ground truth for the synthetic corpus.
 *
 * This file is the *input* to transcript generation only. The mining step never
 * imports it — mining reads `/data/transcripts/` like a real CRM export, and
 * `npm run verify:seed` checks that what mining rediscovers matches what we
 * designed here. That round trip is what makes the demo honest.
 *
 * Two tensions are deliberately engineered and asserted by the verifier:
 *   1. bulk-edit is mentioned in ~3x more calls than saml-sso, but saml-sso is
 *      cited in ~9x more lost deals. Evidence dimensions disagree loudly.
 *   2. guest-access and audit-log land at comparable overall weight with
 *      opposite composition — a wide, popular champion against a heavily
 *      armoured one — so a room genuinely splits on them.
 */

export type Origin = "mined" | "human";

export interface FeatureDesign {
  id: string;
  /** Champion name shown on the board. */
  name: string;
  /** One sentence, written as a PM would write it. */
  description: string;
  /** How many of the 40 calls should mention it. */
  calls: number;
  /** How many closed-lost deals should cite it as a blocker. */
  lostDeals: number;
  /** Earliest call that mentions it. Drives backlog age → visible wear. */
  firstMention: string;
  /**
   * Where the idea comes from. Hidden until the results screen.
   * `human` ideas sit below the mining threshold — they exist because someone
   * in the building believes in them, not because the corpus demanded them.
   */
  origin: Origin;
  /** Who typed it in, revealed at the end. Only for human-origin ideas. */
  submittedBy?: string;
  /**
   * Bias for which lost deals cite this. "enterprise" pulls the big-ARR logos,
   * so security/compliance gaps end up carrying the revenue weight.
   */
  dealAffinity: "enterprise" | "midmarket" | "smb";
  /** Natural phrasings a customer would use. Feeds the transcript renderer. */
  quotes: string[];
  /** How a lost deal describes this gap in its post-mortem line. */
  lostReasonPhrase: string;
}

export const FEATURE_DESIGN: FeatureDesign[] = [
  {
    id: "audit-log",
    name: "Audit Trail",
    description:
      "Immutable, exportable log of every change to a project, task, or permission.",
    calls: 11,
    lostDeals: 7,
    firstMention: "2024-01-18",
    origin: "mined",
    dealAffinity: "enterprise",
    lostReasonPhrase: "no exportable audit history for the compliance team",
    quotes: [
      "Our compliance team is going to ask who changed what and when. Can you export that?",
      "We need a full audit history. Every edit, every access change, with a timestamp and a person attached.",
      "Internal audit does a quarterly pull. If I can't hand them a change log for the whole workspace, this doesn't get through review.",
      "Right now if a due date moves, nobody can tell me who moved it. That's the whole problem.",
      "SOC 2 auditors want evidence. An activity feed in the UI isn't evidence, I need a CSV I can archive.",
      "Does the history go back forever, or does it roll off? Because a ninety day window is useless to us.",
      "The tool we're on now has an audit export and that's genuinely the only reason we still pay for it.",
    ],
  },
  {
    id: "saml-sso",
    name: "Single Sign-On",
    description:
      "SAML and SCIM so accounts provision and deprovision through the company identity provider.",
    calls: 9,
    lostDeals: 9,
    firstMention: "2024-02-27",
    origin: "mined",
    dealAffinity: "enterprise",
    lostReasonPhrase: "no SAML single sign-on, which IT treated as non-negotiable",
    quotes: [
      "Before we go further, do you support SAML? Because our IT team will not approve a tool with separate passwords.",
      "We're an Okta shop. Everything has to sign in through Okta, no exceptions.",
      "When someone leaves the company, IT deactivates them in one place and expects it to propagate. Does that work here?",
      "Security review is going to bounce this immediately without SSO. I've watched it happen twice this year.",
      "SCIM provisioning matters more than SSO honestly. Manually adding four hundred people is not happening.",
      "I'll be blunt, single sign-on is a gate. Everything else we can work around.",
    ],
  },
  {
    id: "granular-permissions",
    name: "Permission Grid",
    description:
      "Role-based access down to the project and field level, so contractors see only their slice.",
    calls: 10,
    lostDeals: 6,
    firstMention: "2024-04-16",
    origin: "mined",
    dealAffinity: "enterprise",
    lostReasonPhrase: "permissions too coarse to keep contractors out of internal projects",
    quotes: [
      "Admin or member is not enough. I need someone who can comment but can't reassign work.",
      "We have three agencies in here. They absolutely cannot see each other's projects, or each other's budgets.",
      "Can I lock a specific field? The cost field should be visible to four people and nobody else.",
      "Legal asked me whether a contractor could see the whole workspace. The honest answer was yes, and that ended the conversation.",
      "Everyone being able to delete anything makes my leadership nervous, and honestly it makes me nervous.",
      "I want project-level roles, not just workspace-level. That's the gap.",
    ],
  },
  {
    id: "time-tracking",
    name: "Time Tracking",
    description:
      "Native time entry against tasks, with rollups per person, project, and billing period.",
    calls: 12,
    lostDeals: 3,
    firstMention: "2024-06-11",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "no native time tracking, forcing a second tool for billing",
    quotes: [
      "We bill clients hourly. If time doesn't live next to the task, people don't log it, and then we don't invoice it.",
      "Right now the team tracks hours in a spreadsheet and someone reconciles it every Friday. It's genuinely miserable.",
      "Can you start a timer on a task? That's the whole ask.",
      "We need hours rolled up by project for month end. Doesn't have to be fancy.",
      "I'd want to see estimated versus actual on every task, otherwise our estimates never improve.",
      "The finance team pulls timesheets on the second. If that's a manual export I'm the one doing it.",
    ],
  },
  {
    id: "timeline-view",
    name: "Timeline View",
    description:
      "Dependency-aware Gantt timeline with drag-to-reschedule and automatic downstream shifts.",
    calls: 17,
    lostDeals: 3,
    firstMention: "2024-08-22",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "no dependency-aware timeline for the delivery plan",
    quotes: [
      "My exec team thinks in Gantt charts. I can hand them a board and they will hand it straight back.",
      "If I move one milestone, everything after it should move too. Does it do that?",
      "We need a timeline view. Not a calendar, a real timeline with dependencies drawn on it.",
      "Every client kickoff starts with a schedule slide. I'm rebuilding that slide by hand every single week.",
      "Can I see the critical path? When something slips I need to know immediately whether the launch date moved.",
      "The board view is great for the team and useless for my steering committee.",
    ],
  },
  {
    id: "portfolio-rollup",
    name: "Portfolio Roll-Up",
    description:
      "One cross-project view of status, spend, and risk for leadership, updated without manual reporting.",
    calls: 7,
    lostDeals: 4,
    firstMention: "2024-10-03",
    origin: "mined",
    dealAffinity: "enterprise",
    lostReasonPhrase: "no portfolio-level roll-up for leadership reporting",
    quotes: [
      "I run sixty projects. I need one screen that tells me which ones are red, without opening sixty tabs.",
      "Leadership wants a portfolio view. Status, spend, and risk across every program in one place.",
      "My PMO spends the first two days of every month assembling a status deck by hand. That's the thing I'm trying to kill.",
      "Can I group projects into programs, and programs into a portfolio? Three levels, basically.",
      "Per-project reporting is table stakes. Across projects is what I'm actually buying.",
    ],
  },
  {
    id: "guest-access",
    name: "Guest Passes",
    description:
      "Free, scoped external collaborators so clients and agencies participate without a paid seat.",
    calls: 22,
    lostDeals: 5,
    firstMention: "2024-11-19",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "external client collaboration would have required paying for every guest seat",
    quotes: [
      "Half the people on any given project don't work here. Am I buying seats for our clients?",
      "We need guest access. Client comes in, sees their project, sees nothing else, costs me nothing.",
      "Today we email screenshots to clients. It's 2026 and we are emailing screenshots.",
      "If every external reviewer needs a full license this gets expensive fast, and my CFO will notice.",
      "Can a guest comment and approve without being able to wander into other projects?",
      "Our agency partners live in this tool with us or the whole thing falls apart.",
      "The approval loop is the bottleneck, and the approver is always someone outside the company.",
    ],
  },
  {
    id: "api-rate-limits",
    name: "API Throughput",
    description:
      "Higher API rate limits and bulk endpoints so large workspaces can sync without backing off.",
    calls: 5,
    lostDeals: 3,
    firstMention: "2025-01-14",
    origin: "mined",
    dealAffinity: "enterprise",
    lostReasonPhrase: "API rate limits too low to sync the data warehouse",
    quotes: [
      "We sync everything into Snowflake nightly. At your current rate limit that job takes eleven hours.",
      "Is there a bulk endpoint? Paginating a hundred thousand tasks at that limit is not viable.",
      "Our integration team hit your rate limit in the trial. That's not a great sign for production.",
      "We'd need a much higher API ceiling, and ideally webhooks so we're not polling at all.",
      "Everything we buy has to feed the warehouse. If the API can't keep up, it doesn't get bought.",
    ],
  },
  {
    id: "custom-fields",
    name: "Custom Fields",
    description:
      "User-defined typed fields on tasks and projects, filterable and reportable everywhere.",
    calls: 15,
    lostDeals: 2,
    firstMention: "2025-02-25",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "custom fields too limited to model their intake process",
    quotes: [
      "Every request has a client code and a billing type. Those need to be real fields, not text in the description.",
      "Can I add a dropdown field and then filter the whole workspace by it?",
      "We tried using tags for this and ended up with four hundred tags. It's a mess.",
      "Custom fields need to work in reporting too, otherwise what's the point of capturing them.",
      "Our intake form has nine questions. All nine need somewhere to live on the task.",
      "Formula fields would be a nice-to-have, plain custom fields are the requirement.",
    ],
  },
  {
    id: "slack-sync",
    name: "Slack Two-Way",
    description:
      "Bidirectional Slack sync so a thread reply lands on the task and a task update lands in channel.",
    calls: 13,
    lostDeals: 1,
    firstMention: "2025-04-09",
    origin: "mined",
    dealAffinity: "smb",
    lostReasonPhrase: "Slack integration was one-way notifications only",
    quotes: [
      "My team lives in Slack. If they have to leave Slack to update a task, they won't update the task.",
      "Notifications into a channel is the easy half. I want a reply in the thread to post back as a comment.",
      "Can I create a task from a Slack message? That's the moment the work actually gets named.",
      "The integration you have now is one-way and everybody ignores it.",
      "Honestly the tool that wins here is the one that makes Slack the interface.",
      "We'd want per-channel routing, so the design channel only hears about design work.",
    ],
  },
  {
    id: "capacity-planning",
    name: "Workload Radar",
    description:
      "Capacity view showing who is over-allocated across every project before the sprint starts.",
    calls: 19,
    lostDeals: 4,
    firstMention: "2025-06-17",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "no workload or capacity view to prevent over-allocating the team",
    quotes: [
      "I have no idea who is drowning until they tell me they're drowning, and by then it's late.",
      "I want a workload view. People down one axis, weeks across the top, red where they're over.",
      "Our designers sit on six projects each. Nobody can see the total, including the designers.",
      "Capacity planning is the reason I'm shopping. Everything else we have.",
      "If I assign one more task to someone at a hundred and twenty percent, the tool should tell me.",
      "Resourcing conversations happen in a spreadsheet that's wrong the moment I save it.",
      "Show me utilisation by person, and let me drag work to someone with room.",
    ],
  },
  {
    id: "bulk-edit",
    name: "Bulk Task Surgery",
    description:
      "Multi-select tasks and change owner, date, or status across hundreds of rows at once.",
    calls: 24,
    lostDeals: 1,
    firstMention: "2025-02-04",
    origin: "mined",
    dealAffinity: "smb",
    lostReasonPhrase: "editing tasks one at a time was untenable at that volume",
    quotes: [
      "When a project slips two weeks I have to open eighty tasks and change eighty due dates. One at a time.",
      "Give me a checkbox and a change-owner button and you've saved me an afternoon a week.",
      "Somebody left the team last month. Reassigning their work took me two hours of clicking.",
      "Multi-select and bulk edit. That's it, that's the whole request.",
      "Every single person on my team has complained about not being able to change more than one task at a time.",
      "I can select multiple tasks but the only thing I can do with the selection is delete them, which is terrifying.",
      "Bulk edit isn't glamorous but it's the difference between the tool helping and the tool being a chore.",
    ],
  },
  {
    id: "offline-mobile",
    name: "Offline Mode",
    description:
      "Mobile app that keeps working on a job site with no signal and syncs when it reconnects.",
    calls: 3,
    lostDeals: 2,
    firstMention: "2025-11-11",
    origin: "mined",
    dealAffinity: "midmarket",
    lostReasonPhrase: "mobile app unusable on job sites without connectivity",
    quotes: [
      "Our crews are in basements and parking structures. No signal, and the app just spins.",
      "Field techs need to update jobs offline and have it sync later. That's non-negotiable for us.",
      "The mobile app is fine in the office, which is the one place nobody needs it.",
    ],
  },
  {
    id: "recurring-tasks",
    name: "Recurring Tasks",
    description:
      "Tasks and checklists that regenerate on a schedule without anyone remembering to clone them.",
    calls: 4,
    lostDeals: 0,
    firstMention: "2026-01-20",
    origin: "mined",
    dealAffinity: "smb",
    lostReasonPhrase: "no recurring task scheduling",
    quotes: [
      "We run the same twelve-step checklist every month. Someone duplicates it by hand every month.",
      "Can a task repeat weekly? Genuinely surprised that's not in here.",
      "Recurring maintenance work is maybe forty percent of what we do.",
      "I'd want the recurrence to skip weekends, but that's detail.",
    ],
  },
  {
    id: "template-marketplace",
    name: "Template Market",
    description:
      "Shared library of project templates teams can publish internally and pull from.",
    calls: 4,
    lostDeals: 1,
    firstMention: "2026-02-24",
    origin: "human",
    submittedBy: "Marcus Ellery, VP Product",
    dealAffinity: "smb",
    lostReasonPhrase: "no template library to standardise how projects get set up",
    quotes: [
      "Every project manager sets up projects differently. I want one blessed template everyone starts from.",
      "Is there a template gallery? Even a basic one would save the onboarding conversation.",
      "We'd publish our own templates internally if you gave us somewhere to put them.",
      "New PMs spend their first week figuring out our conventions. A template would just tell them.",
    ],
  },
  {
    id: "sla-uptime",
    name: "Uptime SLA",
    description:
      "Contractual uptime guarantee with a public status page and incident history.",
    calls: 3,
    lostDeals: 2,
    firstMention: "2026-03-31",
    origin: "human",
    submittedBy: "Priya Raman, Head of Customer Success",
    dealAffinity: "enterprise",
    lostReasonPhrase: "no contractual uptime SLA for procurement",
    quotes: [
      "Procurement needs a written uptime commitment. Ninety-nine point nine, in the contract.",
      "Do you have a public status page? Our vendor review checks for one.",
      "If you go down during our launch week I need to know what the remedy is, contractually.",
    ],
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "A dark theme across the whole product, respecting the system setting.",
    calls: 3,
    lostDeals: 0,
    firstMention: "2026-05-12",
    origin: "human",
    submittedBy: "Jules Nakamura, Design Lead",
    dealAffinity: "smb",
    lostReasonPhrase: "no dark theme",
    quotes: [
      "Half my team asked me to ask you about dark mode. So, dark mode.",
      "Is there a dark theme? Our engineers will complain, they always complain.",
      "Not a dealbreaker at all, but dark mode would make people happy on day one.",
    ],
  },
  {
    id: "ai-standup",
    name: "AI Standup Digest",
    description:
      "Generated daily summary of what moved, what stalled, and what needs a decision.",
    calls: 2,
    lostDeals: 0,
    firstMention: "2026-06-30",
    origin: "human",
    submittedBy: "Dana Whitfield, CRO",
    dealAffinity: "smb",
    lostReasonPhrase: "no automated status summary",
    quotes: [
      "Everyone's shipping AI summaries now. Do you have anything that writes the standup for me?",
      "If it could tell me each morning what actually changed yesterday, I'd read that every day.",
    ],
  },
];

/** Only features at or above this many calls get surfaced by mining. */
export const MINING_CALL_THRESHOLD = 5;

/**
 * The loud disagreement. One champion is mentioned in far more calls, the other
 * is cited in far more lost deals. Body size and armour should point opposite
 * ways, and a viewer should feel that before reading a single number.
 */
export const DIMENSION_CLASH = { a: "bulk-edit", b: "saml-sso" } as const;

/**
 * The designed dead heat. Comparable overall weight, opposite composition:
 * Guest Passes is the crowd favourite (22 calls, a physically huge champion),
 * Audit Trail quietly carries seven lost deals and the second-biggest weapon.
 * Bot biases are tuned in `src/lib/game/bots.ts` so this one actually splits.
 */
export const DESIGNED_RIVALRY = { a: "guest-access", b: "audit-log" } as const;
