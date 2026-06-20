/** Tour step definitions for the interactive dashboard feature tour */

export interface TourStep {
  /** Unique step key */
  id: string;
  /** The title shown in the tooltip */
  title: string;
  /** Detailed description of the feature */
  description: string;
  /** CSS selector for the element to highlight (or just a section label) */
  selector?: string;
  /** Sidebar group this belongs to */
  group: string;
  /** Target href for "Go there" action */
  href?: string;
  /** Icon emoji for the step */
  icon: string;
}

export const TOUR_STEPS: TourStep[] = [
  // ── Welcome ──────────────────────────────────────────────────────
  {
    id: "welcome",
    title: "Welcome to Soter Guard 👋",
    description:
      "This 2-minute tour will show you around the dashboard so you can protect your AI chatbots, agents, and RAG systems from prompt injection, data leakage, and unsafe outputs. Use Next → to explore, or Skip to start on your own.",
    group: "Getting started",
    icon: "🚀",
  },

  // ── Operate ──────────────────────────────────────────────────────
  {
    id: "overview",
    title: "Dashboard overview",
    description:
      "Your security command center. See total requests scanned, blocked attacks, PII redactions, secrets prevented, average risk score, and top risk types — all at a glance. Recent guard logs are shown below for quick inspection.",
    selector: '[href="/dashboard"]',
    group: "Operate",
    href: "/dashboard",
    icon: "📊",
  },
  {
    id: "guard-logs",
    title: "Guard logs",
    description:
      "Every input and output guard decision is logged here. Filter by risk type, action, date range, or search keywords. Click any log to see the full finding details, redacted content, and risk breakdown.",
    selector: '[href="/dashboard/logs"]',
    group: "Operate",
    href: "/dashboard/logs",
    icon: "📜",
  },
  {
    id: "reports",
    title: "Reports",
    description:
      "Generate monthly security reports with attack trends, top risks, and recommendations. Agency partners can export white-label PDF reports with custom branding for client presentations.",
    selector: '[href="/dashboard/reports"]',
    group: "Operate",
    href: "/dashboard/reports",
    icon: "📈",
  },
  {
    id: "customer-success",
    title: "Customer success",
    description:
      "Monitor activation rates, product health, usage funnel, and churn risk across your organization. Track which onboarding steps users complete and where they drop off.",
    selector: '[href="/dashboard/customer-success"]',
    group: "Operate",
    href: "/dashboard/customer-success",
    icon: "📋",
  },
  {
    id: "detection-feedback",
    title: "Detection feedback",
    description:
      "Help improve detection accuracy by providing feedback on guard decisions. Mark false positives and false negatives so the system learns from real-world usage patterns.",
    selector: '[href="/dashboard/detection-feedback"]',
    group: "Operate",
    href: "/dashboard/detection-feedback",
    icon: "🎯",
  },

  // ── Configure ────────────────────────────────────────────────────
  {
    id: "projects",
    title: "Projects",
    description:
      "Projects group all your configuration — API keys, webhooks, logs, and badges — under one namespace. Use separate projects for development, staging, and production environments.",
    selector: '[href="/dashboard/projects"]',
    group: "Configure",
    href: "/dashboard/projects",
    icon: "📁",
  },
  {
    id: "api-keys",
    title: "API keys",
    description:
      "Generate scoped API keys with test (ck_test_) and live (ck_live_) prefixes. Keys are peppered-hashed and never stored in plaintext. The raw value is shown only once at creation — copy it immediately.",
    selector: '[href="/dashboard/api-keys"]',
    group: "Configure",
    href: "/dashboard/api-keys",
    icon: "🔑",
  },
  {
    id: "policy",
    title: "Policy engine",
    description:
      "Configure guard policies — set risk thresholds, choose action defaults (block, redact, allow, review), and define custom rules for specific risk types like prompt injection or PII detection.",
    selector: '[href="/dashboard/policy"]',
    group: "Configure",
    href: "/dashboard/policy",
    icon: "⚙️",
  },
  {
    id: "webhooks",
    title: "Webhooks",
    description:
      "Receive real-time signed events for blocked attacks, PII redactions, secrets detected, and usage limit warnings. Each webhook includes an HMAC-SHA256 signature so you can verify authenticity.",
    selector: '[href="/dashboard/webhooks"]',
    group: "Configure",
    href: "/dashboard/webhooks",
    icon: "🔗",
  },
  {
    id: "rag-security",
    title: "RAG security",
    description:
      "Protect retrieval-augmented generation pipelines. Guard user queries before retrieval, filter risky source documents, and inspect LLM responses for data leakage from your knowledge base.",
    selector: '[href="/dashboard/rag"]',
    group: "Configure",
    href: "/dashboard/rag",
    icon: "📚",
  },
  {
    id: "agent-firewall",
    title: "Agent firewall",
    description:
      "Define what tools, actions, destinations, and data types your AI agents can access. The firewall blocks unauthorized tool calls, data exfiltration, and privilege escalation attempts.",
    selector: '[href="/dashboard/agent-firewall"]',
    group: "Configure",
    href: "/dashboard/agent-firewall",
    icon: "🛡️",
  },
  {
    id: "badges",
    title: "Security badges",
    description:
      "Display a 'Protected by Soter' badge on your website or chatbot interface. Badges show real-time defense metrics and build user trust without revealing sensitive data.",
    selector: '[href="/dashboard/badges"]',
    group: "Configure",
    href: "/dashboard/badges",
    icon: "🏅",
  },
  {
    id: "shadow-ai",
    title: "Shadow AI detection",
    description:
      "Discover unauthorized AI tool usage across your organization. Shadow AI detection helps you identify unsanctioned chatbots, LLM integrations, and data flows that bypass security controls.",
    selector: '[href="/dashboard/shadow-ai"]',
    group: "Configure",
    href: "/dashboard/shadow-ai",
    icon: "👁️",
  },
  {
    id: "redteam",
    title: "Red team lab",
    description:
      "Test your guard configuration against adversarial prompts. Run automated red-team suites with known attack patterns (jailbreaks, injections, leak attempts) to measure detection coverage.",
    selector: '[href="/dashboard/redteam/lab"]',
    group: "Configure",
    href: "/dashboard/redteam/lab",
    icon: "⚔️",
  },
  {
    id: "cost-firewall",
    title: "Cost firewall",
    description:
      "Prevent runaway LLM costs by setting per-session, per-user, and per-model spending limits. Get alerts when usage approaches thresholds and automatically block further requests when exceeded.",
    selector: '[href="/dashboard/cost-firewall"]',
    group: "Configure",
    href: "/dashboard/cost-firewall",
    icon: "💰",
  },

  // ── Agent Security ───────────────────────────────────────────────
  {
    id: "agent-passports",
    title: "Agent passports",
    description:
      "Issue cryptographically signed identities to your AI agents. Passports carry claims about the agent's permitted scope, tools, data access, and expiration — verified before every action.",
    selector: '[href="/dashboard/agent-passports"]',
    group: "Agent security",
    href: "/dashboard/agent-passports",
    icon: "🪪",
  },
  {
    id: "intent-guard",
    title: "Intent guard",
    description:
      "Verify that every planned agent action matches the original user intent. Detect when an agent tries to drift from what the user actually asked — even if individual actions seem safe.",
    selector: '[href="/dashboard/intent-guard"]',
    group: "Agent security",
    href: "/dashboard/intent-guard",
    icon: "🎯",
  },
  {
    id: "tool-chain",
    title: "Tool chain detector",
    description:
      "Detect risky multi-tool sequences. A single read + a single send might be safe, but reading a database and emailing the result is exfiltration. The tool chain detector catches these compound attacks.",
    selector: '[href="/dashboard/tool-chain"]',
    group: "Agent security",
    href: "/dashboard/tool-chain",
    icon: "⛓️",
  },
  {
    id: "escrow",
    title: "Transaction escrow",
    description:
      "Hold high-risk agent actions for human review before execution. Approve, edit, or deny destructive operations like DELETE, fund transfers, or config changes. Every decision is audited.",
    selector: '[href="/dashboard/escrow"]',
    group: "Agent security",
    href: "/dashboard/escrow",
    icon: "🔒",
  },
  {
    id: "dry-run",
    title: "Sandbox dry-run",
    description:
      "Simulate agent actions without executing them. See predicted effects, risk scores, and decisions before any real damage. Fail closed when simulation shows unsafe outcomes.",
    selector: '[href="/dashboard/dry-run"]',
    group: "Agent security",
    href: "/dashboard/dry-run",
    icon: "📦",
  },
  {
    id: "semantic-egress",
    title: "Semantic egress firewall",
    description:
      "Detect confidential meaning leaving the system — even paraphrased content. The firewall understands semantics, not just keywords, so it catches reworded secrets, roadmap data, and source-code leakage.",
    selector: '[href="/dashboard/semantic-egress"]',
    group: "Agent security",
    href: "/dashboard/semantic-egress",
    icon: "📡",
  },
  {
    id: "evidence-vault",
    title: "Evidence vault",
    description:
      "Package compliance proof: blocked attacks, human approvals, configuration snapshots, and security reports. Export evidence bundles for SOC 2, ISO 27001, and internal audits.",
    selector: '[href="/dashboard/evidence-vault"]',
    group: "Agent security",
    href: "/dashboard/evidence-vault",
    icon: "📋",
  },
  {
    id: "lineage",
    title: "Context lineage firewall",
    description:
      "Track where AI data came from and where it's going. Block context leakage between different security domains — prevent customer data from flowing into public-facing agents.",
    selector: '[href="/dashboard/lineage"]',
    group: "Agent security",
    href: "/dashboard/lineage",
    icon: "🌐",
  },
  {
    id: "blast-radius",
    title: "Blast radius simulator",
    description:
      "Estimate the damage each agent could cause if compromised. The simulator analyzes tools, data access, destinations, and permissions to produce a risk score from 0-100.",
    selector: '[href="/dashboard/blast-radius"]',
    group: "Agent security",
    href: "/dashboard/blast-radius",
    icon: "📡",
  },
  {
    id: "memory-firewall",
    title: "Memory firewall",
    description:
      "Detect and quarantine poisoned instructions in agent long-term memory. Prevent prompt injection from persisting across sessions via stored memory.",
    selector: '[href="/dashboard/memory-firewall"]',
    group: "Agent security",
    href: "/dashboard/memory-firewall",
    icon: "🧠",
  },
  {
    id: "mcp-drift",
    title: "MCP tool drift",
    description:
      "Monitor MCP (Model Context Protocol) servers for risky changes. Detect new capabilities, prompt injection in tool descriptions, schema changes, and endpoint mutations that could compromise agents.",
    selector: '[href="/dashboard/mcp-drift"]',
    group: "Agent security",
    href: "/dashboard/mcp-drift",
    icon: "🔄",
  },
  {
    id: "legal-boundary",
    title: "Legal boundary guard",
    description:
      "Stop computer-use and browser agents from crossing legal boundaries: payments, login, terms acceptance, data scraping, and personal-data uploads. Includes user consent enforcement.",
    selector: '[href="/dashboard/legal-boundary"]',
    group: "Agent security",
    href: "/dashboard/legal-boundary",
    icon: "⚖️",
  },

  // ── Agency ───────────────────────────────────────────────────────
  {
    id: "partner-program",
    title: "Partner program",
    description:
      "Join the agency partner program to manage multiple client projects under one account. White-label the dashboard and reports with your own branding.",
    selector: '[href="/dashboard/partner"]',
    group: "Agency",
    href: "/dashboard/partner",
    icon: "🤝",
  },
  {
    id: "agency",
    title: "Agency overview",
    description:
      "Manage all your client projects from a single dashboard. View aggregated metrics, client health, and revenue across your entire portfolio.",
    selector: '[href="/dashboard/agency"]',
    group: "Agency",
    href: "/dashboard/agency",
    icon: "🏢",
  },
  {
    id: "white-label",
    title: "White-label reports",
    description:
      "Generate branded PDF security reports for your clients. Add your logo, colors, and messaging. Reports include attack stats, top risks, and recommendations — all under your brand.",
    selector: '[href="/dashboard/reports/white-label"]',
    group: "Agency",
    href: "/dashboard/reports/white-label",
    icon: "📄",
  },

  // ── Account ──────────────────────────────────────────────────────
  {
    id: "billing",
    title: "Billing & usage",
    description:
      "View your plan, monthly usage, and upgrade options. Plans range from Free (100 requests/month) to Enterprise (unlimited). Usage resets monthly.",
    selector: '[href="/dashboard/billing"]',
    group: "Account",
    href: "/dashboard/billing",
    icon: "💳",
  },
  {
    id: "settings",
    title: "Settings",
    description:
      "Manage your profile, organization details, team members, notification preferences, and API key rotation schedule. Also configure session timeouts and audit logging preferences.",
    selector: '[href="/dashboard/settings"]',
    group: "Account",
    href: "/dashboard/settings",
    icon: "⚙️",
  },
  {
    id: "onboarding",
    title: "Onboarding checklist",
    description:
      "Complete the guided setup: create a project, generate API keys, send your first guarded request, configure a webhook, enable the badge, and generate a report.",
    selector: '[href="/dashboard/onboarding"]',
    group: "Account",
    href: "/dashboard/onboarding",
    icon: "✅",
  },
  {
    id: "integrations",
    title: "Integration wizard",
    description:
      "Copy-paste integration code for your tech stack. Supports Next.js, Express, Python, FastAPI, LangChain, WordPress, and REST API. Test your connection and send sample prompts.",
    selector: '[href="/dashboard/integrations"]',
    group: "Account",
    href: "/dashboard/integrations",
    icon: "🔌",
  },

  // ── Tour Complete ────────────────────────────────────────────────
  {
    id: "complete",
    title: "You're all set! 🎉",
    description:
      "You've explored all the key features. Start by creating a project and generating an API key, then use the Integration Wizard to connect your first chatbot. Click the help button (?) anytime to restart this tour. Happy securing!",
    group: "Getting started",
    icon: "🎉",
  },
];

/** Get tour steps for a specific sidebar group */
export function getTourStepsByGroup(group: string): TourStep[] {
  return TOUR_STEPS.filter((step) => step.group === group);
}

/** Total number of tour steps */
export const TOUR_STEP_COUNT = TOUR_STEPS.length;

/** Sidebar groups in order */
export const TOUR_GROUPS = [
  "Getting started",
  "Operate",
  "Configure",
  "Agent security",
  "Agency",
  "Account",
] as const;
