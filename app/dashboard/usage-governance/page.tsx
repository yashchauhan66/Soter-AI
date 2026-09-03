import { Shield, Users, ClipboardCheck, FileBarChart, Ban, CheckCircle, Clock, Activity, Eye, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { getActiveOrganization } from "@/lib/auth/guards";
import { getGovernanceSummary } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

/**
 * Section navigation for AI Usage Governance.
 *
 * Extracted from eight hand-written `<Link>` blocks. Beyond removing ~90 lines of
 * duplication, a data table is what lets the grid stay consistent: previously
 * each card repeated its own hover chain, so any future change had to be applied
 * eight times and inevitably would not be.
 */
const NAV_CARDS: Array<{
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Accent for the leading icon only — never for text or borders. */
  tone: string;
  /** Fills the trailing gap on a 2-column layout when the count is odd. */
  wide?: boolean;
}> = [
  {
    href: "/dashboard/usage-governance/policy",
    title: "Policy configuration",
    description: "Set default actions, data handling rules, and approval requirements for AI tool usage.",
    Icon: Shield,
    tone: "text-cyan",
  },
  {
    href: "/dashboard/usage-governance/providers",
    title: "Provider allow / block lists",
    description: "Allow or block specific AI providers and models, including OpenAI and Anthropic.",
    Icon: Ban,
    tone: "text-slate-400",
  },
  {
    href: "/dashboard/usage-governance/departments",
    title: "Department rules",
    description: "Define per-department AI usage policies for engineering, marketing, and finance.",
    Icon: Users,
    tone: "text-slate-400",
  },
  {
    href: "/dashboard/usage-governance/data-classification",
    title: "Data classification",
    description: "Define which data sensitivity levels may be sent to which AI providers.",
    Icon: ClipboardCheck,
    tone: "text-slate-400",
  },
  {
    href: "/dashboard/usage-governance/approvals",
    title: "Approval requests",
    description: "Review and manage requests to use AI providers that require approval.",
    Icon: Clock,
    tone: "text-amber-300",
  },
  {
    href: "/dashboard/usage-governance/audit",
    title: "Audit trail",
    description: "Complete audit log of AI usage events, policy changes, and approval decisions.",
    Icon: Activity,
    tone: "text-slate-400",
  },
  {
    href: "/dashboard/usage-governance/reports",
    title: "Compliance reports",
    description: "Generate governance compliance reports with trends and recommendations.",
    Icon: FileBarChart,
    tone: "text-slate-400",
  },
  {
    href: "/dashboard/usage-governance/monitoring",
    title: "Employee monitoring",
    description: "Monitor AI tool usage across your organization and see top users and providers.",
    Icon: Eye,
    tone: "text-slate-400",
    wide: true,
  },
];

export default async function UsageGovernancePage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-200">No active organization.</p>;

  const summary = await getGovernanceSummary(active.org.id);

  return (
    <div className="space-y-7">
      {/**
       * Page header.
       *
       * Was a violet gradient hero with a blurred colour orb, a 2xl radius, and a
       * 4xl headline — landing-page furniture on an internal console page. Three
       * problems it caused: the violet had no relationship to the rest of the
       * product's palette, the orb + gradient occupied ~220px before any data was
       * visible, and the "Core product" badge is marketing copy aimed at a buyer,
       * not an operator who is already inside the product.
       *
       * It is now a standard page header. The three capability blurbs are kept
       * because they explain what the section does, but as a plain hairline-
       * separated row rather than gradient cards.
       */}
      <header>
        <p className="eyebrow">Governance</p>
        <h1 className="heading-3 mt-2.5">AI usage governance</h1>
        <p className="mt-3 max-w-prose leading-7 text-slate-400">
          Employees paste company data into ChatGPT, Claude, and Cursor every day. Define company-wide
          policies, set department-specific rules, classify data sensitivity, monitor usage, and keep a
          complete audit trail for legal accountability.
        </p>

        <div className="mt-6 grid overflow-hidden rounded-card border border-slate-800 sm:grid-cols-3">
          <HeroFeature icon={<Shield size={16} />} title="Policy control" text="Allow or block AI providers, set department rules, require approval." />
          <HeroFeature icon={<Eye size={16} />} title="Employee DLP" text="Detect and block company data flowing to unauthorized AI tools." />
          <HeroFeature icon={<Scale size={16} />} title="Legal accountability" text="Complete audit trail with compliance reports for regulators." />
        </div>
      </header>

      {/**
       * Summary metrics.
       *
       * Two separate grids (4 + 3) became one row of 4 plus one row of 3 rendered
       * through the shared `MetricCard`. The hand-rolled tiles each set their own
       * icon colour, value size, and label colour, so the same figure was styled
       * three different ways on one page — and one of them carried a stray
       * `hover:border-violet-500/30` on a tile that is not clickable.
       *
       * `MetricCard` also supplies `data-numeric`, which the hand-rolled versions
       * lacked: without tabular figures these counts visibly reflow as they tick.
       */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Compliance score"
          value={`${summary.complianceScore}%`}
          tone={summary.complianceScore >= 80 ? "green" : summary.complianceScore >= 50 ? "yellow" : "red"}
          hint="Share of governance controls currently configured"
          icon={Shield}
        />
        <MetricCard label="Policy rules" value={summary.totalRules} icon={ClipboardCheck} />
        <MetricCard label="Departments" value={summary.totalDepartments} icon={Users} />
        <MetricCard
          label="Pending approvals"
          value={summary.pendingApprovals}
          tone={summary.pendingApprovals > 0 ? "yellow" : "gray"}
          hint={summary.pendingApprovals > 0 ? "Awaiting a decision" : "Nothing waiting on you"}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Allowed events" value={summary.allowedEvents} tone="green" icon={CheckCircle} />
        <MetricCard label="Blocked events" value={summary.blockedEvents} tone="red" icon={Ban} />
        <MetricCard
          label="Active policy"
          value={summary.hasEnabledPolicy ? "Enabled" : "Not configured"}
          tone={summary.hasEnabledPolicy ? "green" : "yellow"}
          icon={Activity}
        />
      </div>

      {/* ── Navigation Cards ──
          Data-driven rather than eight near-identical hand-written <Link> blocks.
          Each previously carried its own 4-part hover chain plus a decorative
          gradient accent bar, which is 8 copies of the same 6 classes to keep in
          sync — and the reason the hover behaviour had already drifted from the
          rest of the console. `.card-interactive` now owns that behaviour. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_CARDS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`card card-interactive p-5 ${item.wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
          >
            <item.Icon className={`mb-3 ${item.tone}`} size={22} aria-hidden="true" />
            <h3 className="font-semibold text-slate-100">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
          </Link>
        ))}
      </div>

      {/**
       * Top providers / users.
       *
       * The rows were `rounded-xl bg-slate-950/60` — a *darker* fill than the card
       * that contains them, with no border, which read as holes punched in the
       * panel. They now use `.surface`, the shared one-step-down container, so a
       * nested list looks the same here as it does everywhere else in the console.
       */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-100">Top AI providers</h2>
          {summary.topProviders.length === 0 ? (
            <p className="text-sm text-slate-400">No provider usage tracked yet.</p>
          ) : (
            <div className="space-y-2">
              {summary.topProviders.map((provider) => (
                <div className="surface flex items-center justify-between p-3 text-sm" key={provider.name}>
                  <span className="text-slate-200">{provider.name}</span>
                  <span data-numeric className="text-slate-400">{provider.count} events</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-100">Top users</h2>
          {summary.topUsers.length === 0 ? (
            <p className="text-sm text-slate-400">No user activity tracked yet.</p>
          ) : (
            <div className="space-y-2">
              {summary.topUsers.map((user) => (
                <div className="surface flex items-center justify-between p-3 text-sm" key={user.userId}>
                  <span className="font-mono text-slate-200">User {user.userId.slice(0, 8)}</span>
                  <span data-numeric className="text-slate-400">{user.count} events</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * One capability blurb in the header strip.
 *
 * Rendered as a cell of a bordered grid (hairline dividers between cells) rather
 * than as its own rounded card. Three rounded cards inside a rounded header is
 * the nesting problem described in the radii note in globals.css.
 */
function HeroFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border-b border-slate-800 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
