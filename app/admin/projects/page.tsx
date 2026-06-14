import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { organization: { select: { name: true, slug: true } }, _count: { select: { apiKeys: true, guardLogs: true, webhooks: true } } },
  });
  return (
    <div>
      <p className="eyebrow">Platform admin</p>
      <h1 className="mt-2 text-3xl font-bold">Projects</h1>
      <section className="mt-6 card p-5">
        <div className="space-y-3 text-sm">
          {projects.map((project) => (
            <div className="rounded-lg border border-slate-800 p-3" key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{project.publicName ?? project.name}</p>
                <p className="text-slate-500">{project.disabledAt ? "disabled" : "active"}</p>
              </div>
              <p className="mt-2 text-slate-400">{project.organization?.name ?? "Legacy project"} - {project._count.apiKeys} keys - {project._count.guardLogs} logs - {project._count.webhooks} webhooks</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
