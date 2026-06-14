import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MLOverviewPage() {
  await requireAdmin();
  const [datasets, models, evaluations, reviewPending, deployments] = await Promise.all([
    db.mLDataset.count(),
    db.mLModelVersion.count(),
    db.mLModelEvaluation.count(),
    db.mLReviewQueue.count({ where: { status: "PENDING" } }),
    db.mLModelDeployment.count({ where: { rolloutMode: { in: ["SHADOW", "PARTIAL", "FULL"] } } }),
  ]);
  const recent = await db.mLModelEvaluation.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { modelVersion: true, dataset: true },
  });
  return (
    <div>
      <p className="eyebrow">ML registry</p>
      <h1 className="mt-2 text-3xl font-bold">Classifier quality, datasets, and rollouts</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Track ML classifier precision, recall, F1, and false positive/negative rates. Models can run in SHADOW, PARTIAL, or FULL rollout. Rule-based detectors always remain authoritative; an ML failure falls back automatically.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {[
          ["Datasets", datasets, "/admin/ml/datasets"],
          ["Model versions", models, "/admin/ml"],
          ["Evaluations", evaluations, "/admin/ml/evaluations"],
          ["Review queue (open)", reviewPending, "/admin/ml/review"],
          ["Active deployments", deployments, "/admin/ml/deployments"],
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="card p-5 hover:border-cyan-500/40">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-cyan">{String(value)}</p>
          </Link>
        ))}
      </div>
      <section className="mt-10 card p-6">
        <h2 className="font-semibold">Latest evaluations</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No evaluations yet. Start one with <code>POST /api/admin/ml/evaluations</code> after creating a dataset and a model version.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Model</th>
                <th className="py-2 text-left">Dataset</th>
                <th className="py-2 text-right">Precision</th>
                <th className="py-2 text-right">Recall</th>
                <th className="py-2 text-right">F1</th>
                <th className="py-2 text-right">FP rate</th>
                <th className="py-2 text-right">FN rate</th>
                <th className="py-2 text-right">Examples</th>
                <th className="py-2 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((evaluation) => (
                <tr key={evaluation.id} className="border-t border-slate-800">
                  <td className="py-2">{evaluation.modelVersion.name} <span className="text-slate-500">{evaluation.modelVersion.version}</span></td>
                  <td className="py-2">{evaluation.dataset.name} v{evaluation.dataset.version}</td>
                  <td className="py-2 text-right">{evaluation.precision.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.recall.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.f1.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.falsePositiveRate.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.falseNegativeRate.toFixed(3)}</td>
                  <td className="py-2 text-right">{evaluation.totalExamples}</td>
                  <td className="py-2 text-right text-slate-400">{evaluation.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
