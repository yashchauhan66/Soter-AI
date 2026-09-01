/**
 * Single source of truth for site navigation.
 *
 * The header, the mobile drawer, the footer, and the breadcrumb trail all read
 * from this file. Previously each of those surfaces hard-coded its own link
 * list, so they drifted apart: the desktop nav offered six items, the mobile
 * drawer six *different* items, and the footer a fourth set. A visitor got a
 * different information architecture depending on their viewport.
 *
 * Keeping the IA in data also means:
 *   - breadcrumb labels resolve without a second lookup table (used by both the
 *     visible trail and BreadcrumbList structured data)
 *   - adding a page is one edit, not four
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Chrome,
  Code2,
  FileSearch,
  FlaskConical,
  GitBranch,
  GraduationCap,
  Landmark,
  LifeBuoy,
  Newspaper,
  PlayCircle,
  Puzzle,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  /** One-line value statement. Shown in the mega menu and mobile drawer. */
  desc?: string;
  icon?: LucideIcon;
  /** Renders a status chip, e.g. "Beta". Only set when genuinely accurate. */
  tag?: string;
}

export interface NavGroup {
  label: string;
  /** Optional sub-heading inside a mega-menu column. */
  caption?: string;
  links: NavLink[];
}

export interface NavSection {
  /** Trigger label in the desktop header. */
  label: string;
  /** When set, the trigger is a plain link instead of a dropdown. */
  href?: string;
  groups?: NavGroup[];
  /** Promoted call-to-action rendered in the panel's side rail. */
  feature?: {
    href: string;
    eyebrow: string;
    title: string;
    copy: string;
    cta: string;
  };
}

/* ── Platform ───────────────────────────────────────────────────── */
const platformGroups: NavGroup[] = [
  {
    label: "Protect AI agents",
    caption: "Control what agents are allowed to do",
    links: [
      { href: "/ai-agent-security", label: "AI Agent Security", desc: "Approve, block, and roll back agent actions", icon: Bot },
      { href: "/mcp-security", label: "MCP & Tool Security", desc: "Review tool calls before they execute", icon: Workflow },
      { href: "/ai-workflow-security", label: "Workflow Security", desc: "Guard n8n, Make, and Zapier automations", icon: GitBranch },
      { href: "/model-supply-chain-security", label: "Model Supply Chain", desc: "Scan model artifacts and dependencies", icon: Boxes },
    ],
  },
  {
    label: "Protect AI usage",
    caption: "Govern how people use AI at work",
    links: [
      { href: "/ai-user-security", label: "AI User Security", desc: "Policies for employee AI usage", icon: Users },
      { href: "/ai-data-leakage-prevention", label: "Data Leakage Prevention", desc: "Redact secrets and Indian PII", icon: FileSearch },
      { href: "/prompt-injection-protection", label: "Prompt Injection Defense", desc: "Block overrides, jailbreaks, extraction", icon: ShieldAlert },
      { href: "/rag-security", label: "RAG Security", desc: "Inspect retrieved context and citations", icon: BookOpen },
    ],
  },
];

/* ── Integrations ───────────────────────────────────────────────── */
const integrationGroups: NavGroup[] = [
  {
    label: "Where the guard runs",
    links: [
      { href: "/extensions/ide", label: "IDE Guard", desc: "VS Code, Cursor, Windsurf, Kiro", icon: Code2, tag: "Beta" },
      { href: "/extensions/browser", label: "Browser Guard", desc: "Chrome and Microsoft Edge", icon: Chrome, tag: "Beta" },
      { href: "/integrations", label: "All integrations", desc: "SDKs, REST API, platforms", icon: Puzzle },
      { href: "/local-ai-broker", label: "Local AI Broker", desc: "Keep inspection on your own machine", icon: Activity },
    ],
  },
  {
    label: "Build with SoterAI",
    links: [
      { href: "/docs", label: "Documentation", desc: "Quickstart, SDKs, API reference", icon: BookOpen },
      { href: "/docs/rest-api", label: "REST API", desc: "Language-agnostic guard endpoints", icon: Code2 },
      { href: "/playground", label: "Playground", desc: "Test the guard without signing up", icon: FlaskConical },
      { href: "/demo", label: "Live demo", desc: "Watch attacks get blocked", icon: PlayCircle },
    ],
  },
];

/* ── Evidence ───────────────────────────────────────────────────── */
const evidenceGroups: NavGroup[] = [
  {
    label: "Proof",
    caption: "Published methodology, not marketing claims",
    links: [
      { href: "/benchmarks", label: "Benchmarks", desc: "Detection results and methodology", icon: BarChart3 },
      { href: "/benchmark", label: "Dataset & limitations", desc: "What the corpus does and does not cover", icon: ScrollText },
      { href: "/comparison", label: "Compare alternatives", desc: "Honest feature-by-feature view", icon: Scale },
      { href: "/case-studies", label: "Case studies", desc: "How incidents actually unfold", icon: Newspaper },
    ],
  },
  {
    label: "Trust",
    links: [
      { href: "/trust", label: "Trust center", desc: "Controls, subprocessors, posture", icon: ShieldCheck },
      { href: "/compliance/owasp-llm-top-10", label: "OWASP LLM Top 10", desc: "Mapped coverage per risk area", icon: BadgeCheck },
      { href: "/security", label: "Security overview", desc: "How the platform is built", icon: ShieldCheck },
      { href: "/limitations", label: "Known limitations", desc: "What SoterAI does not claim", icon: ScrollText },
    ],
  },
];

/* ── Solutions ──────────────────────────────────────────────────── */
const solutionsGroups: NavGroup[] = [
  {
    label: "By team",
    links: [
      { href: "/enterprise", label: "Enterprise", desc: "SSO, SCIM, retention, audit evidence", icon: Building2 },
      { href: "/enterprise-ai-security", label: "Security teams", desc: "One policy across every AI surface", icon: ShieldCheck },
      { href: "/partners/agency", label: "Agencies & MSPs", desc: "Offer AI security as a service", icon: Landmark },
      { href: "/student-discount", label: "Students", desc: "Discounted access for learning", icon: GraduationCap },
    ],
  },
  {
    label: "By need",
    links: [
      { href: "/ai-security-india", label: "AI security in India", desc: "Aadhaar, PAN, GSTIN, UPI, IFSC", icon: Landmark },
      { href: "/compliance", label: "Compliance mapping", desc: "Align controls to frameworks", icon: Scale },
      { href: "/llm-firewall", label: "LLM Firewall", desc: "Inspect every prompt and response", icon: ShieldAlert },
    ],
  },
];

/**
 * Desktop header sections. The order follows a buyer's actual question
 * sequence: what is it → where does it run → can I believe it → who is it for
 * → what does it cost.
 */
export const PRIMARY_NAV: NavSection[] = [
  {
    label: "Platform",
    groups: platformGroups,
    feature: {
      href: "/playground",
      eyebrow: "No signup required",
      title: "Run a real decision",
      copy: "Paste a prompt and see the findings, redaction, risk score, and the action the guard would take.",
      cta: "Open the playground",
    },
  },
  {
    label: "Integrations",
    groups: integrationGroups,
    feature: {
      href: "/docs",
      eyebrow: "Under 10 minutes",
      title: "Guard your first request",
      copy: "Create a project, keep the key server-side, and wrap one call. Everything else is optional.",
      cta: "Read the quickstart",
    },
  },
  { label: "Evidence", groups: evidenceGroups },
  { label: "Solutions", groups: solutionsGroups },
  { label: "Pricing", href: "/pricing" },
];

/* ── Footer ─────────────────────────────────────────────────────── */
export const FOOTER_NAV: NavGroup[] = [
  {
    label: "Platform",
    links: [
      { href: "/ai-agent-security", label: "AI Agent Security" },
      { href: "/ai-user-security", label: "AI User Security" },
      { href: "/prompt-injection-protection", label: "Prompt Injection Defense" },
      { href: "/ai-data-leakage-prevention", label: "Data Leakage Prevention" },
      { href: "/rag-security", label: "RAG Security" },
      { href: "/mcp-security", label: "MCP & Tool Security" },
      { href: "/llm-firewall", label: "LLM Firewall" },
    ],
  },
  {
    label: "Developers",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/rest-api", label: "REST API" },
      { href: "/integrations", label: "Integrations" },
      { href: "/extensions/ide", label: "IDE Guard" },
      { href: "/extensions/browser", label: "Browser Guard" },
      { href: "/playground", label: "Playground" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    label: "Evidence",
    links: [
      { href: "/benchmarks", label: "Benchmarks" },
      { href: "/benchmark", label: "Dataset & methodology" },
      { href: "/comparison", label: "Compare alternatives" },
      { href: "/case-studies", label: "Case studies" },
      { href: "/limitations", label: "Known limitations" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/trust", label: "Trust center" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" },
      { href: "/support", label: "Support" },
      { href: "/contact-sales", label: "Contact sales" },
      { href: "/responsible-disclosure", label: "Report a vulnerability" },
    ],
  },
];

export const LEGAL_NAV: NavLink[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/data-retention", label: "Data retention" },
  { href: "/subprocessors", label: "Subprocessors" },
];

/** Quick-links shown as a shortcut row at the top of the mobile drawer. */
export const MOBILE_SHORTCUTS: NavLink[] = [
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/pricing", label: "Pricing", icon: Sparkles },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

/* ── Breadcrumbs ────────────────────────────────────────────────── */

/**
 * Segment labels that do not read well when naively de-slugified — acronyms,
 * product names, and region codes. Anything absent falls back to title-casing.
 */
const SEGMENT_OVERRIDES: Record<string, string> = {
  ai: "AI",
  api: "API",
  "api-keys": "API Keys",
  faq: "FAQ",
  ide: "IDE",
  india: "India",
  js: "JavaScript",
  llm: "LLM",
  llms: "LLMs",
  mcp: "MCP",
  ml: "ML",
  "owasp-llm-top-10": "OWASP LLM Top 10",
  pii: "PII",
  rag: "RAG",
  rest: "REST",
  "rest-api": "REST API",
  scim: "SCIM",
  sdk: "SDK",
  siem: "SIEM",
  sso: "SSO",
  vscode: "VS Code",
};

/** Full-path label overrides, applied before per-segment formatting. */
const PATH_OVERRIDES: Record<string, string> = {
  "/ai-agent-security": "AI Agent Security",
  "/ai-data-leakage-prevention": "AI Data Leakage Prevention",
  "/ai-security-india": "AI Security in India",
  "/ai-user-security": "AI User Security",
  "/benchmark": "Dataset & Methodology",
  "/cursor-ai-security": "Cursor AI Security",
  "/mcp-security": "MCP & Tool Security",
  "/rag-security": "RAG Security",
  "/vscode-ai-security": "VS Code AI Security",
  "/windsurf-ai-security": "Windsurf AI Security",
};

/**
 * Turn a URL segment into a display label.
 * `"prompt-injection-protection"` → `"Prompt Injection Protection"`.
 */
export function formatSegment(segment: string): string {
  const direct = SEGMENT_OVERRIDES[segment.toLowerCase()];
  if (direct) return direct;

  return segment
    .split("-")
    .map((word) => SEGMENT_OVERRIDES[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Build a breadcrumb trail from a pathname.
 *
 * Returns an empty array for `/`: a lone "Home" crumb is visual noise, and
 * Google ignores a single-item BreadcrumbList. Labels come from the URL the
 * visitor is already on, so no data fetch is needed.
 */
export function buildCrumbs(pathname: string): Crumb[] {
  if (!pathname || pathname === "/") return [];

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];

  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({
      name: PATH_OVERRIDES[accumulated] ?? formatSegment(segment),
      path: accumulated,
    });
  }

  return crumbs;
}

