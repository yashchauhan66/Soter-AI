import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MLReviewPage() {
  await requireAdmin();
  const items = await db.mLReviewQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { modelVersion: true, organization: { select: { name: true } } },
  });
  return (
    <div>
      <p className="eyebrow">ML registry</p>
      <h1 className="mt-2 text-3xl font-bold">False positive / negative review queue</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Reviewers can resolve, dismiss, or push misclassified examples back into the dataset via <code>POST /api/admin/ml/review/:id</code>.</p>
      <section className="mt-6 card p-6">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items awaiting review.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Kind</th>
                <th className="py-2 text-left">Org</th>
                <th className="py-2 text-left">Model</th>
                <th className="py-2 text-left">Expected</th>
                <th className="py-2 text-left">Predicted</th>
                <th className="py-2 text-right">Confidence</th>
                <th className="py-2 text-left">Redacted text</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 align-top">
                  <td className="py-2">{item.kind}</td>
                  <td className="py-2">{item.organization.name}</td>
                  <td className="py-2">{item.modelVersion ? `${item.modelVersion.name} ${item.modelVersion.version}` : "-"}</td>
                  <td className="py-2">{item.expectedLabel}</td>
                  <td className="py-2">{item.predictedLabel}</td>
                  <td className="py-2 text-right">{item.confidence.toFixed(2)}</td>
                  <td className="py-2 max-w-md truncate text-slate-300">{item.redactedText.slice(0, 200)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
