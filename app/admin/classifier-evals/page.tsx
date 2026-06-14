import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function ClassifierEvalsPage() {
  const runs = await db.classifierRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      _count: { select: { results: true } },
      results: {
        where: { correct: false },
        select: { expectedLabel: true, predictedLabel: true },
      },
    },
  });
  return (
    <div>
      <p className="eyebrow">Detector quality</p>
      <h1 className="mt-2 text-3xl font-bold">Classifier evaluations</h1>
      <div className="mt-6 space-y-3">
        {runs.map((run) => (
          <section className="card p-5" key={run.id}>
            <p className="font-semibold">
              {run.detectorVersion} · {run.status}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              F1 {run.f1?.toFixed(3) ?? "-"} · precision{" "}
              {run.precision?.toFixed(3) ?? "-"} · recall{" "}
              {run.recall?.toFixed(3) ?? "-"} · false-positive rate{" "}
              {run.falsePositiveRate?.toFixed(3) ?? "-"} · false-negative rate{" "}
              {run.falseNegativeRate?.toFixed(3) ?? "-"} · examples{" "}
              {run._count.results}
            </p>
            {run.results.length > 0 && (
              <p className="mt-2 text-xs text-amber-300">
                Misclassifications:{" "}
                {run.results
                  .slice(0, 5)
                  .map((item) => `${item.expectedLabel}→${item.predictedLabel}`)
                  .join(", ")}
                {run.results.length > 5
                  ? ` +${run.results.length - 5} more`
                  : ""}
              </p>
            )}
          </section>
        ))}
        {!runs.length && (
          <p className="text-slate-400">
            Run <code>npm run eval:classifiers</code> with persistence enabled
            to populate this dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
