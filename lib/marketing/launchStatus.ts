export type LaunchStatus = "Stable" | "Beta" | "Labs" | "Coming Soon";

/**
 * Maps a launch status to a semantic badge class from `globals.css`.
 *
 * Lives here rather than in a component because the homepage Features grid and
 * the pricing page both render status chips. When each file owned its own map,
 * every status rendered in the same cyan chip on both pages — making "Stable",
 * "Beta", and "Labs" visually identical, which defeats the point of publishing
 * honest status labels at all.
 */
export const STATUS_BADGE: Record<LaunchStatus, string> = {
  Stable: "badge-success",
  Beta: "badge-info",
  Labs: "badge-warning",
  "Coming Soon": "badge-neutral",
};

export const finalPositioning =
  "SoterAI is the control layer that stops sensitive data and risky AI-agent actions across browsers, IDEs, workflows, and APIs before they become security incidents.";

export const heroCopy = {
  headline: "Stop sensitive company data and risky AI-agent actions—before they become incidents.",
  subheading:
    "One security layer to inspect prompts and outputs, redact secrets and Indian PII, and approve or block agent tool calls across browsers, IDEs, workflows, and APIs.",
  primaryCta: "Test It Live — No Signup",
  secondaryCta: "Book Security Demo",
};

export const primaryIcp = [
  "AI startups",
  "SMB engineering teams",
  "Security-conscious developers",
  "Teams using ChatGPT, Claude, Cursor, VS Code, and n8n",
  "Teams needing AI usage visibility before buying heavy enterprise DLP or SOC tools",
];

export const productStatus: Array<{
  name: string;
  status: LaunchStatus;
  copy: string;
  cta: string;
  href: string;
}> = [
  { name: "API Guard", status: "Stable", copy: "Input, output, RAG, and grounding checks for server-side AI apps.", cta: "Try API", href: "/docs/rest-api" },
  { name: "Browser Guard", status: "Beta", copy: "Extension-based visibility and control for AI use in browser workflows.", cta: "Install browser extension", href: "/extensions/browser" },
  { name: "IDE Guard", status: "Beta", copy: "Secure AI-assisted development across all major IDEs.", cta: "Install IDE Guard", href: "/extensions/ide" },
  { name: "n8n Guard", status: "Beta", copy: "Guard nodes for workflow builders who need AI checks inside automation.", cta: "Add n8n Node", href: "/integrations/n8n" },
  { name: "Make Guard", status: "Beta", copy: "SoterAI modules for Make.com scenarios that scan AI inputs and outputs inline.", cta: "Add Make Node", href: "/integrations/make" },
  { name: "Zapier Guard", status: "Beta", copy: "Zapier actions that check AI prompts and responses before data reaches external apps.", cta: "Add Zapier Node", href: "/integrations/zapier" },
  { name: "MCP / Agent Guard", status: "Labs", copy: "Risk review for MCP tools and agent actions before sensitive operations execute.", cta: "Review agent controls", href: "/mcp-security" },
  { name: "Audit Evidence", status: "Stable", copy: "Redacted logs, signed exports, benchmark evidence, and trust-review artifacts.", cta: "View trust center", href: "/trust" },
];

export const roleMessaging = [
  { role: "For Developers", copy: "Add server-side guard checks without exposing API keys or raw secrets in client code." },
  { role: "For Security Teams", copy: "See risky AI usage, blocked events, redactions, and audit evidence across projects." },
  { role: "For AI Startups", copy: "Ship AI features with prompt-injection, PII, secrets, and unsafe-output controls from day one." },
  { role: "For Admins", copy: "Manage workspaces, RBAC, retention, billing state, and security review workflows." },
  { role: "For Workflow Builders", copy: "Insert guard checks into n8n and automation flows before data reaches external models." },
];

export const trustProof = [
  { label: "Tests passed", value: "Evidence generated per run", note: "Typecheck, lint, test, audit, build, and readiness commands are recorded in Phase 14." },
  { label: "Benchmark page", value: "Published methodology", note: "Self-maintained synthetic benchmark; not an independent third-party study." },
  { label: "Marketplace status", value: "Status-labeled", note: "No marketplace approval is claimed unless a live listing or approval record exists." },
  { label: "Security methodology", value: "Documented", note: "Internal self-pentest and disclosure process are tracked separately from external audit evidence." },
  { label: "External pentest", value: "EVIDENCE REQUIRED", note: "Enterprise GA claims remain blocked until an independent report exists." },
];

export const forbiddenClaims = {
  "100% secure": false,
  "SOC2 compliant": false,
  "best in world": false,
  "zero false positives": false,
  "all integrations production ready": false,
  "marketplace approved": false,
};
