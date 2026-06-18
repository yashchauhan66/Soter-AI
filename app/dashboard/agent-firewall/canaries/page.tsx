import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { id: string; tokenLabel: string; scope: string; active: boolean; createdAt: Date; triggeredAt: Date | null };

export default async function CanaryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const rows = await safeRows<Row>`SELECT "id", "tokenLabel", "scope", "active", "createdAt", "triggeredAt" FROM "CanaryToken" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agent firewall</p><h1 className="mt-2 text-3xl font-bold">Canaries</h1></div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="grid gap-3">
        {rows.map((row) => (
          <div className="card grid gap-2 p-4 text-sm md:grid-cols-[1fr_auto]" key={row.id}>
            <div><p className="font-semibold">{row.tokenLabel}</p><p className="text-slate-500">{row.scope} - created {row.createdAt.toLocaleString()}</p></div>
            <span className={row.triggeredAt ? "text-red-300" : "text-emerald-300"}>{row.triggeredAt ? `Triggered ${row.triggeredAt.toLocaleString()}` : row.active ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {rows.length === 0 && <section className="card p-5 text-sm text-slate-500">No canary tokens yet.</section>}
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
