"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProjectSwitcher({
  projects,
  selectedId,
}: {
  projects: Array<{ id: string; name: string }>;
  selectedId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectProject(projectId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
      <span className="text-slate-500">Project</span>
      <select
        aria-label="Selected project"
        className="bg-transparent font-semibold outline-none"
        value={selectedId}
        onChange={(event) => selectProject(event.target.value)}
      >
        {projects.map((project) => (
          <option className="bg-slate-950" key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
