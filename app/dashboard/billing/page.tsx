import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { PlanGrid } from "@/components/dashboard/PlanGrid";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkMonthlyLimit, planLimit } from "@/lib/rateLimit";
import { BillingActions } from "@/components/ops/BillingActions";

export const dynamic = "force-dynamic";

type PlanCard = {
  id: "STARTER" | "PRO" | "AGENCY";
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: PlanCard[] = [
  { id: "STARTER", name: "Starter", price: "₹999/month", description: "For solo founders shipping a real chatbot.", features: ["Everything in Free", "Webhooks + retry queue", "Monthly reports", "5 projects"] },
  { id: "PRO", name: "Pro", price: "₹2,999/month", description: "For growing teams and indie SaaS.", features: ["Everything in Starter", "Security badge", "Higher rate limits", "20 projects"], highlight: true },
  { id: "AGENCY", name: "Agency", price: "₹9,999/month", description: "For agencies protecting client chatbots.", features: ["Everything in Pro", "Agency dashboard", "White-label PDF reports", "Client management"] },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, projects, active] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
    getActiveOrganization(),
  ]);
  if (!active) {
    return <div className="card p-10 text-center text-slate-400">No organization available.</div>;
  }
  const usage = await checkMonthlyLimit(project.id, project.plan);
  const limit = planLimit(project.plan);
  const ratio = limit > 0 ? Math.min(1, usage.used / limit) : 0;
  const [subscription, invoices, planChanges] = await Promise.all([
    db.subscription.findUnique({ where: { organizationId: active.org.id } }),
    db.invoice.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.planChangeLog.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Billing &amp; usage</p>
          <h1 className="mt-2 text-3xl font-bold">Plan and billing</h1>
          <p className="mt-3 text-slate-400">
            Razorpay-backed subscriptions. Plan changes update on verified payment events; the server never trusts client-side payment status.
          </p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="card mt-7 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Current plan</p>
            <p className="text-3xl font-bold">{active.org.plan}</p>
            <p className="mt-1 text-xs text-slate-500">Subscription status: {subscription?.status ?? "TRIAL"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500">Used this month (project)</p>
            <p className="text-3xl font-bold">{usage.used.toLocaleString("en-IN")}<span className="text-base font-normal text-slate-500"> / {limit.toLocaleString("en-IN")}</span></p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${usage.exceeded ? "bg-red-400" : usage.warning ? "bg-amber-400" : "bg-cyan"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {usage.warning && !usage.exceeded && (
          <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
            You have used {Math.round(ratio * 100)}% of the {project.plan} monthly quota.
          </p>
        )}
        {usage.exceeded && (
          <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            Monthly quota exceeded. Guarded API responses now return HTTP 429 with the <code>RATE_LIMIT</code> risk type until the next billing cycle or upgrade.
          </p>
        )}
        {subscription?.status === "TRIAL" && subscription.trialEndsAt && <p className="mt-3 text-sm text-cyan">Trial ends {subscription.trialEndsAt.toLocaleDateString()}. Upgrade is activated only after server verification.</p>}
        {(subscription?.status === "PAST_DUE" || subscription?.status === "GRACE_PERIOD") && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">Payment requires attention. Grace period ends {subscription.gracePeriodEndsAt?.toLocaleDateString() ?? "soon"}. Retry payment through verified checkout.</p>}
        {subscription && <BillingActions organizationId={active.org.id} status={subscription.status} />}
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-2"><section><h2 className="text-lg font-semibold">Invoices</h2><div className="mt-3 divide-y divide-slate-800 border-y border-slate-800">{invoices.length ? invoices.map(invoice => <div className="flex items-center justify-between py-3 text-sm" key={invoice.id}><div><p>{invoice.invoiceNumber ?? invoice.id}</p><p className="text-slate-500">{invoice.status} · {(invoice.amount/100).toLocaleString("en-IN",{style:"currency",currency:invoice.currency})}</p></div>{invoice.hostedUrl ? <a className="text-cyan hover:underline" href={invoice.hostedUrl} rel="noreferrer" target="_blank">Download</a> : <span className="text-slate-600">Unavailable</span>}</div>) : <p className="py-5 text-sm text-slate-500">No invoices yet.</p>}</div></section><section><h2 className="text-lg font-semibold">Plan history</h2><div className="mt-3 divide-y divide-slate-800 border-y border-slate-800">{planChanges.map(change => <div className="py-3 text-sm" key={change.id}><p>{change.fromPlan ?? "NEW"} → {change.toPlan}</p><p className="text-slate-500">{change.reason ?? "Plan change"} · {change.createdAt.toLocaleDateString()}</p></div>)}</div></section></div>

      <h2 className="mt-9 text-lg font-semibold">Plans</h2>
      <div className="mt-4">
        <PlanGrid
          organizationId={active.org.id}
          currentPlan={active.org.plan}
          plans={PLANS}
          enterpriseEmail={process.env.ENTERPRISE_CONTACT_EMAIL ?? "sales@cyberrakshak.dev"}
        />
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Razorpay handles checkout. The server verifies <code>razorpay_signature</code> with the configured key
        secret before activating a plan. The webhook endpoint
        <code className="mx-1">/api/billing/webhook</code>
        verifies the X-Razorpay-Signature header before updating subscription state.
      </p>
    </div>
  );
}
