import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROJECT_PAGE_SIZE = 50;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const cursor = parseCursorDate(params.cursor);
  const rows = await db.project.findMany({
    where: cursor ? { createdAt: { lt: cursor } } : undefined,
    orderBy: { createdAt: "desc" },
    take: PROJECT_PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      publicName: true,
      disabledAt: true,
      createdAt: true,
      organization: { select: { name: true, slug: true } },
      _count: { select: { apiKeys: true, guardLogs: true, webhooks: true } },
    },
  });
  const hasMore = rows.length > PROJECT_PAGE_SIZE;
  const projects = rows.slice(0, PROJECT_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Platform admin</p>
          <h1 className="mt-2 text-3xl font-bold">Projects</h1>
        </div>
        {hasMore && (
          <Link className="text-sm font-semibold text-cyan" href={`/admin/projects?cursor=${projects.at(-1)?.createdAt.toISOString()}`}>
            Next projects
          </Link>
        )}
      </div>
      <section className="mt-6 card p-5">
        <div className="space-y-3 text-sm">
          {projects.map((project) => (
            <div className="rounded-lg border border-slate-800 p-3" key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{project.publicName ?? project.name}</p>
                <p className="text-slate-500">{project.disabledAt ? "disabled" : "active"}</p>
              </div>
              <p className="mt-2 text-slate-400">
                {project.organization?.name ?? "Legacy project"} - {project._count.apiKeys} keys - {project._count.guardLogs} logs - {project._count.webhooks} webhooks
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
