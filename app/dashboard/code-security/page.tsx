import { Bot, Github, LockKeyhole, ShieldCheck } from "lucide-react";
import { CodeSecurityReviewClient } from "@/components/dashboard/CodeSecurityReviewClient";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function CodeSecurityPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "project:read");

  return (
    <div className="space-y-7">
      <header className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 via-slate-950/60 to-violet-500/10 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2"><span className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan">New · Startup security</span></div>
            <p className="eyebrow mt-5">AI-assisted secure development</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">AI Code Security Review</h1>
            <p className="mt-3 max-w-3xl text-slate-300">Catch secrets, authorization flaws, injection paths, unsafe AI-output execution, and insecure configuration before AI-generated code reaches production.</p>
          </div>
          <ProjectSwitcher projects={projects} selectedId={project.id} />
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <Feature icon={<Bot size={18} />} title="AI-aware context" text="Production, exposure, data, and auth signals tune severity." />
          <Feature icon={<Github size={18} />} title="PR security gate" text="Copy a GitHub Actions workflow that fails risky changes." />
          <Feature icon={<ShieldCheck size={18} />} title="Audit evidence" text="Export mapped OWASP, SOC 2, ISO 27001, and NIST SSDF evidence." />
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400"><LockKeyhole className="mt-0.5 shrink-0 text-emerald-300" size={18} /><p><strong className="text-slate-200">Privacy by design:</strong> submitted source is analyzed in-request and is not persisted by this feature. Finding evidence is truncated and credential values are redacted.</p></div>
      <CodeSecurityReviewClient projectId={project.id} />
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><div className="flex items-center gap-2 text-cyan">{icon}<h2 className="text-sm font-semibold text-white">{title}</h2></div><p className="mt-2 text-xs leading-5 text-slate-400">{text}</p></div>;
}
