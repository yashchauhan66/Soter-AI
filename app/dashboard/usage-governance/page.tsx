import { Shield, Users, ClipboardCheck, FileBarChart, Ban, CheckCircle, Clock, Activity, Landmark, Eye, Scale } from "lucide-react";
import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { getGovernanceSummary } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

export default async function UsageGovernancePage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const summary = await getGovernanceSummary(active.org.id);

  return (
    <div className="space-y-7">
      {/* ── Premium Hero Header ── */}
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-slate-950/60 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">Core product</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
              <Landmark size={20} className="text-violet-300" />
            </span>
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">AI Usage Governance</h1>
              <p className="mt-1 text-sm text-slate-400">For 50-500 employee companies</p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-slate-300">
            Employees paste company data into ChatGPT, Claude, and Cursor every day. Define company-wide policies,
            set department-specific rules, classify data sensitivity, monitor usage, and maintain a complete audit trail for legal accountability.
          </p>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <HeroFeature icon={<Shield size={18} />} title="Policy control" text="Allow/block AI providers, set department rules, require approval." />
          <HeroFeature icon={<Eye size={18} />} title="Employee DLP" text="Detect and block company data flowing to unauthorized AI tools." />
          <HeroFeature icon={<Scale size={18} />} title="Legal accountability" text="Complete audit trail with compliance reports for regulators." />
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 transition hover:border-violet-500/30">
          <Shield className="mb-2 text-violet-300" size={20} />
          <p className="text-sm text-slate-400">Compliance score</p>
          <p className="mt-1 text-2xl font-bold text-violet-300">{summary.complianceScore}%</p>
        </div>
        <div className="card p-5">
          <ClipboardCheck className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Policy rules</p>
          <p className="mt-1 text-2xl font-bold">{summary.totalRules}</p>
        </div>
        <div className="card p-5">
          <Users className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Departments</p>
          <p className="mt-1 text-2xl font-bold">{summary.totalDepartments}</p>
        </div>
        <div className="card p-5">
          <Clock className="mb-2 text-amber-300" size={20} />
          <p className="text-sm text-slate-400">Pending approvals</p>
          <p className="mt-1 text-2xl font-bold">{summary.pendingApprovals}</p>
        </div>
      </div>

      {/* ── Activity Stats ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <CheckCircle className="text-emerald-400" size={24} />
          <div>
            <p className="text-sm text-slate-400">Allowed events</p>
            <p className="text-xl font-bold">{summary.allowedEvents}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <Ban className="text-red-400" size={24} />
          <div>
            <p className="text-sm text-slate-400">Blocked events</p>
            <p className="text-xl font-bold">{summary.blockedEvents}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <Activity className="text-cyan" size={24} />
          <div>
            <p className="text-sm text-slate-400">Active policy</p>
            <p className="text-xl font-bold">Enabled</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/usage-governance/policy"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Shield className="mb-3 text-cyan" size={24} />
          <h3 className="font-semibold">Policy Configuration</h3>
          <p className="mt-2 text-sm text-slate-400">
            Set default actions, data handling rules, and approval requirements for AI tool usage.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/providers"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Ban className="mb-3 text-orange-300" size={24} />
          <h3 className="font-semibold">Provider Allow/Block Lists</h3>
          <p className="mt-2 text-sm text-slate-400">
            Allow or block specific AI providers and models. Set rules for OpenAI, Anthropic, and more.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/departments"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Users className="mb-3 text-purple-300" size={24} />
          <h3 className="font-semibold">Department Rules</h3>
          <p className="mt-2 text-sm text-slate-400">
            Define per-department AI usage policies. Different rules for engineering, marketing, finance.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/data-classification"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <ClipboardCheck className="mb-3 text-yellow-300" size={24} />
          <h3 className="font-semibold">Data Classification</h3>
          <p className="mt-2 text-sm text-slate-400">
            Define what data sensitivity levels can be sent to which AI providers.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/approvals"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Clock className="mb-3 text-amber-300" size={24} />
          <h3 className="font-semibold">Approval Requests</h3>
          <p className="mt-2 text-sm text-slate-400">
            Review and manage requests to use AI providers that require approval.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/audit"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Activity className="mb-3 text-emerald-300" size={24} />
          <h3 className="font-semibold">Audit Trail</h3>
          <p className="mt-2 text-sm text-slate-400">
            Complete audit log of AI usage events, policy changes, and approval decisions.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/reports"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <FileBarChart className="mb-3 text-blue-300" size={24} />
          <h3 className="font-semibold">Compliance Reports</h3>
          <p className="mt-2 text-sm text-slate-400">
            Generate and view governance compliance reports with trends and recommendations.
          </p>
        </Link>

        <Link
          href="/dashboard/usage-governance/monitoring"
          className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5 sm:col-span-2 lg:col-span-1"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
          <Activity className="mb-3 text-cyan" size={24} />
          <h3 className="font-semibold">Employee Monitoring</h3>
          <p className="mt-2 text-sm text-slate-400">
            Monitor AI tool usage across your organization. See top users and providers.
          </p>
        </Link>
      </div>

      {/* ── Top Providers & Users ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-semibold">Top AI Providers</h2>
          {summary.topProviders.length === 0 ? (
            <p className="text-sm text-slate-500">No provider usage tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.topProviders.map((provider) => (
                <div
                  className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 text-sm"
                  key={provider.name}
                >
                  <span>{provider.name}</span>
                  <span className="text-cyan">{provider.count} events</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-lg font-semibold">Top Users</h2>
          {summary.topUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No user activity tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.topUsers.map((user) => (
                <div
                  className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 text-sm"
                  key={user.userId}
                >
                  <span className="text-slate-400">User {user.userId.slice(0, 8)}</span>
                  <span className="text-cyan">{user.count} events</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HeroFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-violet-300">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
