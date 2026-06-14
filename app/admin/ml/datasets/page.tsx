import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MLDatasetsPage() {
  await requireAdmin();
  const datasets = await db.mLDataset.findMany({
    orderBy: [{ name: "asc" }, { version: "desc" }],
    include: { _count: { select: { examples: true } }, organization: { select: { name: true, slug: true } } },
  });
  return (
    <div>
      <p className="eyebrow">ML registry</p>
      <h1 className="mt-2 text-3xl font-bold">Datasets</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Each dataset is versioned and tenant-scoped. Examples are redacted before storage. Import via <code>POST /api/admin/ml/datasets</code>.
      </p>
      <section className="mt-6 card p-6">
        {datasets.length === 0 ? (
          <p className="text-sm text-slate-400">No datasets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Organization</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-right">Version</th>
                <th className="py-2 text-right">Examples</th>
                <th className="py-2 text-right">Active</th>
                <th className="py-2 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.id} className="border-t border-slate-800">
                  <td className="py-2">{dataset.organization.name}</td>
                  <td className="py-2">{dataset.name}</td>
                  <td className="py-2 text-right">v{dataset.version}</td>
                  <td className="py-2 text-right">{dataset._count.examples}</td>
                  <td className="py-2 text-right">{dataset.isActive ? "yes" : "no"}</td>
                  <td className="py-2 text-right text-slate-400">{dataset.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
