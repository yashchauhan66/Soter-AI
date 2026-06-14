import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MLDeploymentsPage() {
  await requireAdmin();
  const deployments = await db.mLModelDeployment.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      modelVersion: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  return (
    <div>
      <p className="eyebrow">ML registry</p>
      <h1 className="mt-2 text-3xl font-bold">Deployments</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Rollout modes: OFF, SHADOW (record only), PARTIAL (sampled), FULL. Switching to FULL automatically demotes any prior FULL deployment for the same project.
      </p>
      <section className="mt-6 card p-6">
        {deployments.length === 0 ? (
          <p className="text-sm text-slate-400">No deployments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Org</th>
                <th className="py-2 text-left">Model</th>
                <th className="py-2 text-left">Project scope</th>
                <th className="py-2 text-left">Mode</th>
                <th className="py-2 text-right">Percent</th>
                <th className="py-2 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment) => (
                <tr key={deployment.id} className="border-t border-slate-800">
                  <td className="py-2">{deployment.organization.name}</td>
                  <td className="py-2">{deployment.modelVersion.name} <span className="text-slate-500">{deployment.modelVersion.version}</span></td>
                  <td className="py-2">{deployment.projectId ?? <span className="text-slate-500">all</span>}</td>
                  <td className="py-2"><span className={modeClass(deployment.rolloutMode)}>{deployment.rolloutMode}</span></td>
                  <td className="py-2 text-right">{deployment.rolloutPercent}%</td>
                  <td className="py-2 text-right text-slate-400">{deployment.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function modeClass(mode: string) {
  if (mode === "FULL") return "rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300";
  if (mode === "PARTIAL") return "rounded-md bg-amber-500/15 px-2 py-1 text-amber-300";
  if (mode === "SHADOW") return "rounded-md bg-cyan-500/15 px-2 py-1 text-cyan-300";
  return "rounded-md bg-slate-700/30 px-2 py-1 text-slate-300";
}
