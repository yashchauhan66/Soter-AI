import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MONTHLY_PLAN_VALUE: Record<string, number> = {
  STARTER: 999,
  PRO: 2_999,
  AGENCY: 9_999,
};

function averageHours(values: Array<{ startedAt: Date; completedAt: Date | null }>) {
  const durations = values
    .filter((value) => value.completedAt)
    .map((value) => (value.completedAt!.getTime() - value.startedAt.getTime()) / 3_600_000);
  return durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
}

export default async function GrowthMetricsPage() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    newLeads,
    outreachSent,
    outreachReplies,
    demosBooked,
    trialsStarted,
    onboardings,
    paidOrganizations,
    activeProjects,
    guardedRequests,
    blockedRisks,
    reportsGenerated,
    feedbackGroups,
    paidAccountActivity,
  ] = await Promise.all([
    db.contactLead.count({ where: { createdAt: { gte: monthStart } } }),
    db.productEvent.count({ where: { eventType: "outreach.sent", occurredAt: { gte: monthStart } } }),
    db.productEvent.count({ where: { eventType: "outreach.replied", occurredAt: { gte: monthStart } } }),
    db.productEvent.count({ where: { eventType: "demo.booked", occurredAt: { gte: monthStart } } }),
    db.subscription.count({ where: { status: "TRIAL", createdAt: { gte: monthStart } } }),
    db.customerOnboarding.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { startedAt: true, firstGuardRequestAt: true, firstReportAt: true, completedAt: true },
    }),
    db.organization.findMany({
      where: { subscription: { status: "ACTIVE" } },
      select: { id: true, plan: true },
    }),
    db.project.count({ where: { guardLogs: { some: { createdAt: { gte: fourteenDaysAgo } } } } }),
    db.guardLog.count({ where: { createdAt: { gte: monthStart } } }),
    db.guardLog.count({ where: { action: "BLOCK", createdAt: { gte: monthStart } } }),
    db.report.count({ where: { createdAt: { gte: monthStart } } }),
    db.detectionFeedback.groupBy({
      by: ["feedback"],
      where: { createdAt: { gte: monthStart } },
      _count: true,
    }),
    db.organization.findMany({
      where: { subscription: { status: "ACTIVE" } },
      select: {
        id: true,
        projects: {
          select: { guardLogs: { where: { createdAt: { gte: fourteenDaysAgo } }, take: 1, select: { id: true } } },
        },
      },
    }),
  ]);

  const activeBetas = onboardings.filter((item) => item.firstGuardRequestAt && !item.completedAt).length;
  const activated = onboardings.filter((item) => item.firstGuardRequestAt).length;
  const activationRate = onboardings.length ? Math.round((activated / onboardings.length) * 100) : 0;
  const timeToFirstRequest = averageHours(onboardings.map((item) => ({ startedAt: item.startedAt, completedAt: item.firstGuardRequestAt })));
  const timeToFirstReport = averageHours(onboardings.map((item) => ({ startedAt: item.startedAt, completedAt: item.firstReportAt })));
  const mrr = paidOrganizations.reduce((total, organization) => total + (MONTHLY_PLAN_VALUE[organization.plan] ?? 0), 0);
  const churnRisk = paidAccountActivity.filter((organization) => organization.projects.every((project) => project.guardLogs.length === 0)).length;
  const feedbackCount = feedbackGroups.reduce((total, group) => total + group._count, 0);
  const falsePositiveCount = feedbackGroups.find((group) => group.feedback === "FALSE_POSITIVE")?._count ?? 0;
  const falseNegativeCount = feedbackGroups.find((group) => group.feedback === "FALSE_NEGATIVE")?._count ?? 0;
  const replyRate = outreachSent ? (outreachReplies / outreachSent) * 100 : null;
  const leadToPaidRate = newLeads ? (paidOrganizations.length / newLeads) * 100 : null;

  const cards = [
    ["New leads", newLeads],
    ["Outreach sent", outreachSent],
    ["Replies", outreachReplies],
    ["Reply rate", replyRate === null ? "No data" : `${replyRate.toFixed(1)}%`],
    ["Demos booked", demosBooked],
    ["Trials started", trialsStarted],
    ["Active beta users", activeBetas],
    ["Paid customers", paidOrganizations.length],
    ["Estimated MRR", `INR ${mrr.toLocaleString("en-IN")}`],
    ["Churn risk", churnRisk],
    ["Activation rate", `${activationRate}%`],
    ["Lead-to-paid indicator", leadToPaidRate === null ? "No data" : `${leadToPaidRate.toFixed(1)}%`],
    ["Time to first request", timeToFirstRequest === null ? "No data" : `${timeToFirstRequest}h`],
    ["Time to first report", timeToFirstReport === null ? "No data" : `${timeToFirstReport}h`],
    ["Active projects (14d)", activeProjects],
    ["Requests scanned", guardedRequests],
    ["Risks blocked", blockedRisks],
    ["Reports generated", reportsGenerated],
    ["Feedback received", feedbackCount],
    ["False positive rate", feedbackCount ? `${((falsePositiveCount / feedbackCount) * 100).toFixed(1)}%` : "No data"],
    ["False negative reports", falseNegativeCount],
  ];

  return (
    <div>
      <p className="eyebrow">Founder-led growth</p>
      <h1 className="mt-2 text-3xl font-bold">Business KPI dashboard</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Current-month indicators from existing product and billing records. MRR excludes custom Enterprise contracts until entered in the finance system.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <section className="card p-5" key={String(label)}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </section>
        ))}
      </div>
      <p className="mt-7 text-sm text-slate-500">
        Outreach cards require ProductEvent values `outreach.sent` and `outreach.replied`. The lead-to-paid card is a directional current-month indicator, not a cohort conversion calculation. Custom contract revenue remains outside estimated MRR.
      </p>
    </div>
  );
}
