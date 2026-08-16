import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { detectionQualityMetrics } from "@/lib/ops/quality";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
export const dynamic = "force-dynamic";
export default async function DetectionFeedbackPage() { const active = await getActiveOrganization(); const rows = active ? await db.detectionFeedback.findMany({ where: { organizationId: active.org.id }, include: { review: true, guardLog: { select: { riskTypes: true, action: true, createdAt: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : []; const metrics = detectionQualityMetrics(rows.map(row => ({ feedback: row.feedback, detector: row.review?.detector, accepted: row.review?.status === "ACCEPTED" }))); return <div className="space-y-6"><FeatureGuide
    eyebrow="Detection quality"
    title="Feedback and tuning"
    description="Review the false-positive and false-negative feedback your team logs against guard decisions, so you can measure detection quality and tune policies with real evidence."
    useCase="No detector is perfect — some benign traffic gets flagged, and some real attacks slip through. This view aggregates the feedback your reviewers attach to guard-log decisions into concrete quality metrics: false-positive rate, false-negative rate, and how many flags were accepted as correct. It turns anecdotal 'this alert was wrong' complaints into numbers you can act on."
    howItWorks={[
      { heading: "Capture feedback", body: "Each piece of feedback is tied to a specific guard-log decision, recording whether the detection was a true hit, a false positive, or a missed detection (false negative)." },
      { heading: "Review and label", body: "Reviewers accept or reject the flagged decisions. The linked review records the detector involved and the accepted/rejected status." },
      { heading: "Compute quality metrics", body: "The page rolls feedback into false-positive rate, false-negative rate, accepted count, and total volume — a snapshot of how well detection is currently performing." },
      { heading: "Tune with evidence", body: "Use the weakest signals and recurring false positives to adjust thresholds and rules, then watch the rates move on the next batch of feedback." },
    ]}
    callout="This is a read-only quality view. It reports detection accuracy from reviewer feedback; it does not itself change guard policies. Metrics reflect only the feedback that has been logged, so they are as complete as your review coverage."
  /><div className="grid gap-4 sm:grid-cols-4">{[["Feedback",metrics.total],["False positive rate",`${(metrics.falsePositiveRate*100).toFixed(1)}%`],["False negative rate",`${(metrics.falseNegativeRate*100).toFixed(1)}%`],["Accepted",metrics.accepted]].map(([label,value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-200">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></section>)}</div><div className="mt-7 divide-y divide-slate-800 border-y border-slate-800">{rows.map(row => <div className="py-4" key={row.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{row.feedback}</p><span className="text-sm text-cyan">{row.review?.status ?? "PENDING"}</span></div><p className="mt-1 text-sm text-slate-300">{row.guardLog.action} · {row.guardLog.riskTypes.join(", ")} · {row.createdAt.toLocaleDateString()}</p>{row.note && <p className="mt-2 text-sm text-slate-300">{row.note}</p>}</div>)}</div></div>; }
