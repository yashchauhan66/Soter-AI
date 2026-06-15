import Link from "next/link";
import { FeedbackReviewForm } from "@/components/phase8/AdminPhase8Forms";
import { db } from "@/lib/db";
import { detectionQualityMetrics } from "@/lib/phase8/quality";

export const dynamic = "force-dynamic";

const FEEDBACK_PAGE_SIZE = 50;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminDetectionQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const cursor = parseCursorDate(params.cursor);
  const feedbackRows = await db.detectionFeedback.findMany({
    where: cursor ? { createdAt: { lt: cursor } } : undefined,
    orderBy: { createdAt: "desc" },
    take: FEEDBACK_PAGE_SIZE + 1,
    select: {
      id: true,
      feedback: true,
      createdAt: true,
      review: { select: { status: true, detector: true } },
      organization: { select: { name: true } },
      guardLog: { select: { action: true, riskTypes: true, redactedText: true } },
    },
  });
  const hasMore = feedbackRows.length > FEEDBACK_PAGE_SIZE;
  const rows = feedbackRows.slice(0, FEEDBACK_PAGE_SIZE);
  const metrics = detectionQualityMetrics(
    rows.map((row) => ({
      feedback: row.feedback,
      detector: row.review?.detector,
      accepted: row.review?.status === "ACCEPTED",
    })),
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Accuracy loop</p>
          <h1 className="mt-2 text-3xl font-bold">Detection quality review</h1>
        </div>
        {hasMore && (
          <Link className="text-sm font-semibold text-cyan" href={`/admin/detection-quality?cursor=${rows.at(-1)?.createdAt.toISOString()}`}>
            Next feedback
          </Link>
        )}
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {[
          ["Feedback count", metrics.total],
          ["False positive rate", `${(metrics.falsePositiveRate * 100).toFixed(1)}%`],
          ["False negative rate", `${(metrics.falseNegativeRate * 100).toFixed(1)}%`],
          ["Top noisy detector", metrics.topNoisyDetector],
        ].map(([label, value]) => (
          <section className="card p-5" key={String(label)}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
          </section>
        ))}
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <article className="card p-5" key={row.id}>
            <div className="flex justify-between">
              <p className="font-semibold">{row.feedback}</p>
              <span className="text-sm text-cyan">{row.review?.status ?? "PENDING"}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {row.organization.name} - {row.guardLog.action} - {row.guardLog.riskTypes.join(", ")}
            </p>
            {row.guardLog.redactedText && (
              <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap bg-slate-950 p-3 text-xs text-slate-300">
                {row.guardLog.redactedText}
              </pre>
            )}
            <FeedbackReviewForm feedbackId={row.id} />
          </article>
        ))}
      </div>
    </div>
  );
}
