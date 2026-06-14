import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MLEvaluationsPage() {
  await requireAdmin();
  const evaluations = await db.mLModelEvaluation.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { modelVersion: true, dataset: true, organization: { select: { name: true } } },
  });
  return (
    <div>
      <p className="eyebrow">ML registry</p>
      <h1 className="mt-2 text-3xl font-bold">Evaluations</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Precision, recall, F1, and calibration error for each evaluation. Review queue items are seeded for false positives and false negatives.</p>
      <section className="mt-6 card p-6">
        {evaluations.length === 0 ? (
          <p className="text-sm text-slate-400">No evaluations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Org</th>
                <th className="py-2 text-left">Model</th>
                <th className="py-2 text-left">Dataset</th>
                <th className="py-2 text-right">P</th>
                <th className="py-2 text-right">R</th>
                <th className="py-2 text-right">F1</th>
                <th className="py-2 text-right">FP</th>
                <th className="py-2 text-right">FN</th>
                <th className="py-2 text-right">ECE</th>
                <th className="py-2 text-right">N</th>
                <th className="py-2 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => (
                <tr key={evaluation.id} className="border-t border-slate-800">
                  <td className="py-2">{evaluation.organization.name}</td>
                  <td className="py-2">{evaluation.modelVersion.name} <span className="text-slate-500">{evaluation.modelVersion.version}</span></td>
                  <td className="py-2">{evaluation.dataset.name} v{evaluation.dataset.version}</td>
                  <td className="py-2 text-right">{evaluation.precision.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.recall.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.f1.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.falsePositiveRate.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.falseNegativeRate.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.calibrationError.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.totalExamples}</td>
                  <td className="py-2 text-right text-slate-400">{evaluation.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
