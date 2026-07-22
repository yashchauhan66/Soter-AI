import {
  Activity,
  AlertOctagon,
  BadgeCheck,
  Banknote,
  Boxes,
  Bot,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Database,
  FileSearch,
  FileWarning,
  Fingerprint,
  FlaskConical,
  Gauge,
  GitBranch,
  Github,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  type LucideIcon,
  MessagesSquare,
  Network,
  Radar,
  RadioTower,
  ScrollText,
  ShieldAlert,
  ShieldHalf,
  Siren,
  Swords,
  TrendingUp,
  Workflow,
} from "lucide-react";

/**
 * Live badge counts computed in the admin server layout.
 * Keys are referenced by nav items to surface act-now / queue-building signals.
 */
export type AdminBadgeCounts = {
  pendingApprovals: number;
  openTickets: number;
  unresolvedFeedback: number;
  failedDeliveries24h: number;
  failedJobs24h: number;
  shadowFindings24h: number;
  mlReviewQueue: number;
  lockedOrgs: number;
};

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short description shown in the command palette. */
  hint: string;
  /** Extra terms to match against in the command palette search. */
  keywords?: string[];
  /** Badge key + tone. `red` = act now, `amber` = queue building up. */
  badge?: { key: keyof AdminBadgeCounts; tone: "red" | "amber" };
};

export type AdminNavGroup = { title: string; items: AdminNavItem[] };

/**
 * Single source of truth for admin navigation. Consumed by the sidebar,
 * the command palette (Cmd/Ctrl+K), and the overview quick-launch grid so
 * every admin service is reachable from exactly one registry.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Command center",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard, hint: "Live platform posture and priority queue", keywords: ["dashboard", "home", "start"] },
      { label: "System health", href: "/admin/system-health", icon: Gauge, hint: "Database, KMS, vector, and Redis health", keywords: ["status", "uptime", "infra"] },
      { label: "Production & workers", href: "/admin/production", icon: Activity, hint: "Background jobs and worker backlog", keywords: ["jobs", "queue", "background"], badge: { key: "failedJobs24h", tone: "red" } },
    ],
  },
  {
    title: "Detection & ML",
    items: [
      { label: "Detection quality", href: "/admin/detection-quality", icon: Radar, hint: "Recall, false positives, and feedback review", keywords: ["recall", "accuracy", "fpr"] },
      { label: "Classifiers", href: "/admin/classifier-evals", icon: BadgeCheck, hint: "Classifier evaluation runs", keywords: ["eval", "model", "guard"] },
      { label: "Benchmarks", href: "/admin/benchmarks", icon: Gauge, hint: "External benchmark comparisons", keywords: ["lakera", "owasp", "compare"] },
      { label: "Red team", href: "/admin/redteam", icon: Swords, hint: "Adversarial attack simulations", keywords: ["attack", "jailbreak", "adversarial"] },
      { label: "Threat intel", href: "/admin/threat-intel", icon: Radar, hint: "Live threat intelligence feed", keywords: ["ioc", "feed", "intelligence"] },
      { label: "ML pipeline", href: "/admin/ml", icon: BrainCircuit, hint: "Training pipeline overview", keywords: ["training", "model", "pipeline"] },
      { label: "Datasets", href: "/admin/ml/datasets", icon: Database, hint: "Training and evaluation datasets", keywords: ["data", "corpus", "labels"] },
      { label: "Evaluations", href: "/admin/ml/evaluations", icon: FlaskConical, hint: "Model evaluation results", keywords: ["metrics", "score", "test"] },
      { label: "Review queue", href: "/admin/ml/review", icon: ClipboardCheck, hint: "Pending detection labels awaiting review", keywords: ["label", "annotate", "pending"], badge: { key: "mlReviewQueue", tone: "amber" } },
      { label: "Deployments", href: "/admin/ml/deployments", icon: GitBranch, hint: "Model version rollout and rollback", keywords: ["rollout", "version", "release"] },
    ],
  },
  {
    title: "Policies & governance",
    items: [
      { label: "AI policies", href: "/admin/ai-policies", icon: ShieldHalf, hint: "Org-wide AI usage policies", keywords: ["rules", "policy", "governance"] },
      { label: "AI destinations", href: "/admin/ai-destinations", icon: Network, hint: "Allowed and blocked AI endpoints", keywords: ["endpoints", "allowlist", "blocklist"] },
      { label: "Approvals", href: "/admin/approvals", icon: ClipboardCheck, hint: "Pending AI usage approval requests", keywords: ["approve", "request", "review"], badge: { key: "pendingApprovals", tone: "amber" } },
      { label: "Emergency lockdown", href: "/admin/ai-policies/emergency-lockdown", icon: Siren, hint: "Policy-level emergency lockdown", keywords: ["kill switch", "freeze", "halt"], badge: { key: "lockedOrgs", tone: "red" } },
      { label: "Lockdown console", href: "/admin/emergency-lockdown", icon: AlertOctagon, hint: "Global lockdown control console", keywords: ["kill switch", "freeze", "halt"] },
    ],
  },
  {
    title: "Agent firewall & data",
    items: [
      { label: "Shadow AI", href: "/admin/shadow-ai", icon: Bot, hint: "Unsanctioned AI tool discovery", keywords: ["discovery", "unsanctioned", "tools"], badge: { key: "shadowFindings24h", tone: "amber" } },
      { label: "Data lineage", href: "/admin/data-lineage", icon: GitBranch, hint: "Sensitive data flow tracking", keywords: ["flow", "provenance", "tracking"] },
      { label: "File scan events", href: "/admin/file-scan-events", icon: FileSearch, hint: "File upload scan results", keywords: ["upload", "scan", "files"] },
      { label: "Fingerprint vault", href: "/admin/fingerprint-vault", icon: Fingerprint, hint: "Secret fingerprint matches", keywords: ["secrets", "hash", "match"] },
    ],
  },
  {
    title: "Extension fleet",
    items: [
      { label: "Extension health", href: "/admin/extension-health", icon: RadioTower, hint: "Deployed extension fleet status", keywords: ["devices", "agents", "browser"] },
      { label: "Enrollments", href: "/admin/extension-enrollments", icon: KeyRound, hint: "Enrollment tokens and devices", keywords: ["tokens", "enroll", "devices"] },
      { label: "Extension events", href: "/admin/extension-events", icon: ScrollText, hint: "Extension telemetry event log", keywords: ["logs", "telemetry", "events"] },
    ],
  },
  {
    title: "Tenants & growth",
    items: [
      { label: "Organizations", href: "/admin/organizations", icon: Building2, hint: "All tenant organizations", keywords: ["tenants", "orgs", "customers"] },
      { label: "Projects", href: "/admin/projects", icon: Workflow, hint: "All projects across tenants", keywords: ["apps", "workspaces"] },
      { label: "Growth metrics", href: "/admin/growth/metrics", icon: TrendingUp, hint: "Signups, retention, and revenue", keywords: ["revenue", "signups", "retention", "billing"] },
      { label: "Support", href: "/admin/support", icon: LifeBuoy, hint: "Support tickets across tenants", keywords: ["tickets", "help", "desk"], badge: { key: "openTickets", tone: "amber" } },
      { label: "Queries", href: "/admin/queries", icon: MessagesSquare, hint: "Contact leads, pilots, and replies", keywords: ["contact", "leads", "inbox", "reply"], badge: { key: "unresolvedFeedback", tone: "amber" } },
      { label: "Abuse", href: "/admin/abuse", icon: ShieldAlert, hint: "Abuse reports and rate-limit hits", keywords: ["report", "spam", "ratelimit"] },
    ],
  },
  {
    title: "Platform & security",
    items: [
      { label: "KMS", href: "/admin/kms", icon: LockKeyhole, hint: "Key management and secret store", keywords: ["keys", "encryption", "secrets"] },
      { label: "SIEM webhooks", href: "/admin/integrations/siem-webhooks", icon: RadioTower, hint: "SIEM webhook delivery status", keywords: ["webhook", "delivery", "splunk"], badge: { key: "failedDeliveries24h", tone: "red" } },
      { label: "SIEM exports", href: "/admin/siem", icon: Boxes, hint: "Bulk SIEM export jobs", keywords: ["export", "logs", "splunk"] },
      { label: "Supply chain", href: "/admin/supply-chain", icon: Github, hint: "Dependency and supply-chain audit", keywords: ["dependencies", "sbom", "packages"] },
      { label: "Privacy", href: "/admin/privacy", icon: FileWarning, hint: "Data subject requests and retention", keywords: ["gdpr", "dsr", "retention", "delete"] },
      { label: "Billing & revenue", href: "/admin/growth/metrics", icon: Banknote, hint: "Subscriptions and payment events", keywords: ["revenue", "payments", "subscriptions"] },
    ],
  },
];

/** Flattened list of every unique nav destination, for the command palette. */
export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Custom event the sidebar/topbar buttons dispatch to open the command palette. */
export const ADMIN_PALETTE_EVENT = "soter:admin-palette-open";

/** Fire from any client component to open the palette without lifting shared state. */
export function openAdminCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_PALETTE_EVENT));
  }
}
