import { LogsTable } from "@/components/dashboard/LogsTable";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; cursor?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const limitValue = Number(params.limit ?? 50);
  const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 50;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  const logs = await db.guardLog.findMany({
    where: { projectId: project.id, ...(params.cursor ? { createdAt: { lt: new Date(params.cursor) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: guardLogListSelect,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1 className="mt-2 text-3xl font-bold">Guard logs</h1>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <p className="mb-7 mt-3 text-slate-400">Sensitive values are displayed and stored only in redacted form.</p>
      <LogsTable logs={logs} />
    </div>
  );
}
