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
  Chrome,
  Code2,
  FileSearch,
  FlaskConical,
  GitBranch,
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

/* ── Product ────────────────────────────────────────────────────── */
const productGroups: NavGroup[] = [
  {
    label: "Control AI agents",
    caption: "Decide what agents are allowed to do",
    links: [
      { href: "/ai-agent-security", label: "AI agent security", desc: "Approve, block or hold agent actions", icon: Bot },
      { href: "/mcp-security", label: "MCP and tool security", desc: "Review tool calls before they run", icon: Workflow },
      { href: "/ai-workflow-security", label: "Workflow security", desc: "Guard n8n, Make and Zapier flows", icon: GitBranch },
      { href: "/model-supply-chain-security", label: "Model supply chain", desc: "Scan model files and dependencies", icon: Boxes },
    ],
  },
  {
    label: "Protect AI usage",
    caption: "Check what goes in and what comes out",
    links: [
      { href: "/ai-user-security", label: "AI user security", desc: "Policies for how people use AI at work", icon: Users },
      { href: "/ai-data-leakage-prevention", label: "Data leakage and PII", desc: "Redact secrets and personal data", icon: FileSearch },
      { href: "/prompt-injection-protection", label: "Prompt injection", desc: "Flag overrides, jailbreaks and prompt theft", icon: ShieldAlert },
      { href: "/rag-security", label: "RAG security", desc: "Check retrieved text before the model reads it", icon: BookOpen },
      { href: "/llm-firewall", label: "LLM firewall", desc: "One policy for every prompt and reply", icon: Scale },
      { href: "/ai-security-india", label: "Indian identifiers and DPDP", desc: "Aadhaar-like numbers, PAN, GSTIN, UPI, IFSC", icon: Landmark },
    ],
  },
];

/* ── Integrations ───────────────────────────────────────────────── */
const integrationGroups: NavGroup[] = [
  {
    label: "Where it runs",
    links: [
      { href: "/extensions/ide", label: "IDE Guard", desc: "VS Code extension", icon: Code2, tag: "Beta" },
      { href: "/extensions/browser", label: "Browser Guard", desc: "Chrome and Edge extension", icon: Chrome, tag: "Beta" },
      { href: "/integrations", label: "All integrations", desc: "SDKs, REST API and automation nodes", icon: Puzzle },
      { href: "/local-ai-broker", label: "Local AI broker", desc: "Keep inspection on your own machine", icon: Activity },
    ],
  },
  {
    label: "Build with SoterAI",
    links: [
      { href: "/docs", label: "Documentation", desc: "Quickstart, SDKs and API reference", icon: BookOpen },
      { href: "/docs/rest-api", label: "REST API", desc: "Guard endpoints for any language", icon: Code2 },
      { href: "/playground", label: "Playground", desc: "Try the engine without signing up", icon: FlaskConical },
      { href: "/demo", label: "Guided demos", desc: "Walkthroughs of blocked attacks", icon: PlayCircle },
    ],
  },
];

/* ── Evidence ───────────────────────────────────────────────────── */
const evidenceGroups: NavGroup[] = [
  {
    label: "Proof",
    caption: "Each number comes with its test and its limits",
    links: [
      { href: "/benchmarks", label: "Benchmarks", desc: "Results, method and limits", icon: BarChart3 },
      { href: "/benchmark", label: "Dataset and method", desc: "What the test set does and does not cover", icon: ScrollText },
      { href: "/comparison", label: "Compare alternatives", desc: "A factual, dated comparison", icon: Scale },
      { href: "/case-studies", label: "Threat scenarios", desc: "How attacks unfold, step by step", icon: Newspaper },
    ],
  },
  {
    label: "Trust",
    links: [
      { href: "/trust", label: "Trust center", desc: "Controls, subprocessors and posture", icon: ShieldCheck },
      { href: "/compliance/owasp-llm-top-10", label: "OWASP LLM Top 10", desc: "Alignment per risk area", icon: BadgeCheck },
      { href: "/limitations", label: "Known limitations", desc: "What this does not stop", icon: ScrollText },
      { href: "/changelog", label: "Changelog", desc: "What changed, and when", icon: Newspaper },
    ],
  },
];

/**
 * Desktop header sections: five, down from five-plus-about-35-links.
 *
 * Every dropdown's links are rendered into the server HTML (hidden until opened),
 * so crawlers see them. Before this, panels mounted only on hover and ten pages
 * had no link from anywhere in the HTML.
 */
export const PRIMARY_NAV: NavSection[] = [
  {
    label: "Product",
    groups: productGroups,
    feature: {
      href: "/playground",
      eyebrow: "No signup",
      title: "Run it on your own text",
      copy: "Paste a prompt, a reply or a tool request. See the verdict, the marks on your text, and how long it took.",
      cta: "Open the playground",
    },
  },
  {
    label: "Integrations",
    groups: integrationGroups,
    feature: {
      href: "/docs/quickstart",
      eyebrow: "Quickstart",
      title: "Guard your first request",
      copy: "Create a project, keep the key on your server, and wrap one call. Everything else is optional.",
      cta: "Read the quickstart",
    },
  },
  { label: "Evidence", groups: evidenceGroups },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * How a link relates to the page the visitor is on.
 *
 *  - "page": the link points at this exact page.
 *  - "true": the link points at a section this page sits inside (`/docs` while on
 *    `/docs/python`). `aria-current="true"` marks the current item in a set
 *    without claiming it is the page itself.
 *  - undefined: unrelated. "/" is never an ancestor, or every page would match it.
 */
export type NavCurrent = "page" | "true" | undefined;

export function navCurrent(pathname: string | null | undefined, href: string): NavCurrent {
  if (!pathname) return undefined;
  if (pathname === href) return "page";
  if (href !== "/" && pathname.startsWith(`${href}/`)) return "true";
  return undefined;
}

/**
 * The one top-level item that owns the current page, or null.
 *
 * Exactly one item may be marked, because a current-page marker that names two
 * places is not a marker. The earlier version highlighted both "Integrations" and
 * "Docs" on every docs page: the Integrations menu links to /docs and
 * /docs/rest-api, so it matched too.
 *
 *  1. An item with its own `href` owns that page and everything below it, so
 *     /docs/rest-api belongs to Docs even though a menu also links to it.
 *  2. Otherwise the menu whose link matches the most specific path wins; on a tie
 *     the earlier item wins.
 */
export function activeSectionLabel(
  pathname: string | null | undefined,
  nav: NavSection[] = PRIMARY_NAV,
): string | null {
  if (!pathname) return null;

  for (const section of nav) {
    if (section.href && navCurrent(pathname, section.href)) return section.label;
  }

  let best: { label: string; length: number } | null = null;
  for (const section of nav) {
    for (const group of section.groups ?? []) {
      for (const link of group.links) {
        if (navCurrent(pathname, link.href) && (!best || link.href.length > best.length)) {
          best = { label: section.label, length: link.href.length };
        }
      }
    }
  }
  return best ? best.label : null;
}

/* ── Footer ─────────────────────────────────────────────────────── */
export const FOOTER_NAV: NavGroup[] = [
  {
    label: "Product",
    links: [
      { href: "/ai-agent-security", label: "AI agent security" },
      { href: "/ai-user-security", label: "AI user security" },
      { href: "/prompt-injection-protection", label: "Prompt injection" },
      { href: "/jailbreak-detection", label: "Jailbreak detection" },
      { href: "/ai-data-leakage-prevention", label: "Data leakage and PII" },
      { href: "/ai-security-india", label: "Indian identifiers and DPDP" },
      { href: "/rag-security", label: "RAG security" },
      { href: "/mcp-security", label: "MCP and tool security" },
      { href: "/llm-firewall", label: "LLM firewall" },
      { href: "/llm-security", label: "LLM security overview" },
      { href: "/ai-safe-mode", label: "AI safe mode" },
    ],
  },
  {
    label: "Developers",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/quickstart", label: "Quickstart" },
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
      { href: "/benchmark", label: "Dataset and method" },
      { href: "/comparison", label: "Compare alternatives" },
      { href: "/case-studies", label: "Threat scenarios" },
      { href: "/limitations", label: "Known limitations" },
      { href: "/compliance", label: "Compliance status" },
      { href: "/trust", label: "Trust center" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/press", label: "Press and media" },
      { href: "/support", label: "Support" },
      { href: "/contact-sales", label: "Contact sales" },
      { href: "/enterprise", label: "Enterprise" },
      { href: "/enterprise-ai-security", label: "Security teams" },
      { href: "/partners/agency", label: "Agencies and MSPs" },
      { href: "/student-discount", label: "Students" },
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
  "/ai-platform-security": "AI Platform Security",
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
/**
 * Ancestor paths that are not pages. A breadcrumb built from the URL would link to them
 * and land on a 404, which the link audit found for /extensions and /partners. Each one
 * is mapped to the nearest real page and given that page's name.
 */
const CRUMB_PARENT_OVERRIDES: Record<string, { name: string; path: string }> = {
  "/extensions": { name: "Integrations", path: "/integrations" },
  "/partners": { name: "Partners", path: "/partners/agency" },
};

export function buildCrumbs(pathname: string): Crumb[] {
  if (!pathname || pathname === "/") return [];

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];

  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    const redirected = CRUMB_PARENT_OVERRIDES[accumulated];
    // An ancestor that maps to a page already in the trail would repeat it, so skip it.
    if (redirected && crumbs.some((c) => c.path === redirected.path)) continue;
    crumbs.push(redirected ?? { name: PATH_OVERRIDES[accumulated] ?? formatSegment(segment), path: accumulated });
  }

  return crumbs;
}

