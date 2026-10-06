/**
 * The offline clusterer.
 *
 * Mining has two backends. The Anthropic one does open-ended extraction and
 * clustering and is what you'd point at a real CRM. This one matches
 * distinctive phrasings to canonical clusters, and exists because a live demo
 * should not depend on a network call, and because `verify:seed` needs a
 * deterministic result to assert against.
 *
 * Patterns key on how customers actually phrase the ask, not on the feature
 * name — "who moved it", "eighty due dates", "we're an Okta shop". A cluster
 * counts a call once no matter how many of its patterns hit.
 */

export interface LexiconEntry {
  key: string;
  name: string;
  description: string;
  patterns: RegExp[];
}

export const LEXICON: LexiconEntry[] = [
  {
    key: "audit-log",
    name: "Audit Trail",
    description:
      "Immutable, exportable log of every change to a project, task, or permission.",
    patterns: [
      /audit\s+(history|log|export|trail)/i,
      /change\s+log/i,
      /who\s+changed\s+what/i,
      /who\s+moved\s+it/i,
      /internal\s+audit/i,
      /SOC\s*2/i,
      /history\s+go\s+back/i,
    ],
  },
  {
    key: "saml-sso",
    name: "Single Sign-On",
    description:
      "SAML and SCIM so accounts provision and deprovision through the company identity provider.",
    patterns: [
      /\bSAML\b/i,
      /\bSSO\b/i,
      /single\s+sign-?on/i,
      /\bOkta\b/i,
      /\bSCIM\b/i,
      /deactivates\s+them\s+in\s+one\s+place/i,
    ],
  },
  {
    key: "granular-permissions",
    name: "Permission Grid",
    description:
      "Role-based access down to the project and field level, so contractors see only their slice.",
    patterns: [
      /permission/i,
      /admin\s+or\s+member/i,
      /lock\s+a\s+specific\s+field/i,
      /see\s+each\s+other's\s+projects/i,
      /contractor\s+could\s+see/i,
      /delete\s+anything/i,
      /project-level\s+roles/i,
    ],
  },
  {
    key: "time-tracking",
    name: "Time Tracking",
    description:
      "Native time entry against tasks, with rollups per person, project, and billing period.",
    patterns: [
      /time\s+(tracking|entry)/i,
      /timer\s+on\s+a\s+task/i,
      /tracks?\s+hours/i,
      /hours\s+(rolled\s+up|logged)/i,
      /timesheet/i,
      /bill\s+clients\s+hourly/i,
      /estimated\s+versus\s+actual/i,
    ],
  },
  {
    key: "timeline-view",
    name: "Timeline View",
    description:
      "Dependency-aware Gantt timeline with drag-to-reschedule and automatic downstream shifts.",
    patterns: [
      /\bgantt\b/i,
      /timeline\s+view/i,
      /critical\s+path/i,
      /dependenc/i,
      /milestone/i,
      /schedule\s+slide/i,
      /steering\s+committee/i,
    ],
  },
  {
    key: "portfolio-rollup",
    name: "Portfolio Roll-Up",
    description:
      "One cross-project view of status, spend, and risk for leadership, updated without manual reporting.",
    patterns: [
      /portfolio/i,
      /roll-?up/i,
      /\bPMO\b/,
      /status\s+deck/i,
      /sixty\s+projects/i,
      /across\s+projects/i,
    ],
  },
  {
    key: "guest-access",
    name: "Guest Passes",
    description:
      "Free, scoped external collaborators so clients and agencies participate without a paid seat.",
    patterns: [
      /\bguests?\b/i,
      /external\s+(reviewer|collaborat)/i,
      /don't\s+work\s+here/i,
      /email(ing)?\s+screenshots/i,
      /agency\s+partners/i,
      /someone\s+outside\s+the\s+company/i,
      /seats\s+for\s+our\s+clients/i,
    ],
  },
  {
    key: "api-rate-limits",
    name: "API Throughput",
    description:
      "Higher API rate limits and bulk endpoints so large workspaces can sync without backing off.",
    patterns: [
      /rate\s+limit/i,
      /bulk\s+endpoint/i,
      /API\s+ceiling/i,
      /\bSnowflake\b/i,
      /data\s+warehouse/i,
      /feed\s+the\s+warehouse/i,
    ],
  },
  {
    key: "custom-fields",
    name: "Custom Fields",
    description:
      "User-defined typed fields on tasks and projects, filterable and reportable everywhere.",
    patterns: [
      /custom\s+fields?/i,
      /dropdown\s+field/i,
      /formula\s+field/i,
      /client\s+code/i,
      /four\s+hundred\s+tags/i,
      /intake\s+form/i,
    ],
  },
  {
    key: "slack-sync",
    name: "Slack Two-Way",
    description:
      "Bidirectional Slack sync so a thread reply lands on the task and a task update lands in channel.",
    patterns: [
      /\bslack\b/i,
      /one-way/i,
      /per-channel\s+routing/i,
      /notifications\s+into\s+a\s+channel/i,
      /reply\s+in\s+the\s+thread/i,
    ],
  },
  {
    key: "capacity-planning",
    name: "Workload Radar",
    description:
      "Capacity view showing who is over-allocated across every project before the sprint starts.",
    patterns: [
      /workload/i,
      /capacity/i,
      /utili[sz]ation/i,
      /over-?allocat/i,
      /resourcing/i,
      /who\s+is\s+drowning/i,
      /six\s+projects\s+each/i,
      /hundred\s+and\s+twenty\s+percent/i,
    ],
  },
  {
    key: "bulk-edit",
    name: "Bulk Task Surgery",
    description:
      "Multi-select tasks and change owner, date, or status across hundreds of rows at once.",
    patterns: [
      /bulk\s+edit/i,
      /multi-?select/i,
      /one\s+(task\s+)?at\s+a\s+time/i,
      /change-owner\s+button/i,
      /reassigning\s+their\s+work/i,
      /select\s+multiple\s+tasks/i,
      /eighty\s+(tasks|due\s+dates)/i,
    ],
  },
  {
    key: "offline-mobile",
    name: "Offline Mode",
    description:
      "Mobile app that keeps working on a job site with no signal and syncs when it reconnects.",
    patterns: [
      /offline/i,
      /no\s+signal/i,
      /basements/i,
      /field\s+techs/i,
      /mobile\s+app/i,
    ],
  },
  {
    key: "recurring-tasks",
    name: "Recurring Tasks",
    description:
      "Tasks and checklists that regenerate on a schedule without anyone remembering to clone them.",
    patterns: [
      /recurr/i,
      /repeat\s+weekly/i,
      /twelve-step\s+checklist/i,
      /skip\s+weekends/i,
    ],
  },
  {
    key: "template-marketplace",
    name: "Template Market",
    description:
      "Shared library of project templates teams can publish internally and pull from.",
    patterns: [/template/i],
  },
  {
    key: "sla-uptime",
    name: "Uptime SLA",
    description:
      "Contractual uptime guarantee with a public status page and incident history.",
    patterns: [/uptime/i, /status\s+page/i, /\bSLA\b/, /contractual/i],
  },
  {
    key: "dark-mode",
    name: "Dark Mode",
    description: "A dark theme across the whole product, respecting the system setting.",
    patterns: [/dark\s+(mode|theme)/i],
  },
  {
    key: "ai-standup",
    name: "AI Standup Digest",
    description:
      "Generated daily summary of what moved, what stalled, and what needs a decision.",
    patterns: [
      /AI\s+summar/i,
      /writes\s+the\s+standup/i,
      /what\s+actually\s+changed\s+yesterday/i,
      /automated\s+status\s+summary/i,
    ],
  },
];

/** Every cluster whose phrasing appears in `text`. */
export function matchClusters(text: string): string[] {
  return LEXICON.filter((e) => e.patterns.some((p) => p.test(text))).map((e) => e.key);
}

export const LEXICON_BY_KEY = new Map(LEXICON.map((e) => [e.key, e]));
