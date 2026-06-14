import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import dynamicImport from "next/dynamic";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { loadProjectPolicy } from "@/lib/guard/policy";

export const dynamic = "force-dynamic";

const PolicyForm = dynamicImport(() => import("@/components/dashboard/PolicyForm").then((mod) => mod.PolicyForm));

export default async function PolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "policy:manage");
  const policy = await loadProjectPolicy(project.id);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Project policy</p>
          <h1 className="mt-2 text-3xl font-bold">Guard policy &amp; thresholds</h1>
          <p className="mt-3 text-slate-400">Choose a mode, toggle individual detectors, add custom topics or patterns, and set the fallback message returned on a block.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <PolicyForm projectId={project.id} initial={policy} />
    </div>
  );
}
