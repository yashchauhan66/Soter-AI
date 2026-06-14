import { getCurrentUserProjects } from "@/lib/auth";
import { safeRedTeamScenarios } from "@/lib/redteam/scenarios";

export default async function RedTeamPage() {
  const projects = await getCurrentUserProjects();
  return <div><p className="eyebrow">Authorized validation</p><h1 className="mt-2 text-3xl font-bold">Defensive red-team suite</h1><p className="mt-3 max-w-3xl text-slate-400">Runs only against a project you own or administer, requires explicit API confirmation, and uses non-destructive test prompts.</p><div className="mt-6 card p-5"><p className="font-semibold">Available projects: {projects.length}</p><p className="mt-2 text-sm text-slate-400">POST <code>/api/redteam/run</code> with <code>projectId</code> and <code>confirmed: true</code>.</p></div><div className="mt-6 grid gap-3 md:grid-cols-2">{safeRedTeamScenarios.map((scenario) => <section className="card p-4" key={scenario.key}><p className="font-semibold">{scenario.category}</p><p className="mt-1 text-xs text-slate-500">{scenario.severity} · {scenario.owaspMapping.join(", ")}</p></section>)}</div></div>;
}
