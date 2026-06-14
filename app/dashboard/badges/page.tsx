import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientProjectActions } from "@/components/dashboard/ClientProjectActions";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const user = await getCurrentUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, publicName: true, badgeSlug: true, badgeEnabled: true, plan: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <p className="eyebrow">Public trust</p>
      <h1 className="mt-2 text-3xl font-bold">Security badges</h1>
      <p className="mt-3 text-slate-400">Each project ships a public badge endpoint and embeddable script. The page never exposes raw logs or customer text.</p>

      {!projects.length ? (
        <div className="card mt-7 p-10 text-center">
          <ShieldCheck className="mx-auto text-slate-700" size={42} />
          <p className="mt-4 font-semibold">No projects yet</p>
          <p className="mt-2 text-sm text-slate-500">Create a project to issue its public badge slug.</p>
          <Link href="/dashboard/projects/new" className="button-primary mt-5 inline-flex">Create project</Link>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {projects.map((project) => {
            const embed = `<script src="/badge.js" data-project-id="${project.badgeSlug}"></script>`;
            return (
              <article key={project.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{project.publicName ?? project.name}</p>
                    <p className="mt-1 text-xs text-slate-500">slug: <code>{project.badgeSlug}</code></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${project.badgeEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                      {project.badgeEnabled ? "ENABLED" : "DISABLED"}
                    </span>
                    <Link href={`/security-status/${project.badgeSlug}`} target="_blank" className="button-secondary !px-3 !py-2 text-xs gap-1">
                      <ExternalLink size={14} /> Open public page
                    </Link>
                    <ClientProjectActions projectId={project.id} badgeEnabled={project.badgeEnabled} />
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300"><code>{embed}</code></pre>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
