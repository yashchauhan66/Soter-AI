import { getCurrentUserProjects } from "@/lib/auth";
import { safeRedTeamScenarios } from "@/lib/redteam/scenarios";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export default async function RedTeamPage() {
  const projects = await getCurrentUserProjects();
  return <div className="space-y-6"><FeatureGuide
    eyebrow="Authorized validation"
    title="Defensive red-team suite"
    description="Validate your own guard policies against a curated set of non-destructive attack prompts — prompt injection, jailbreaks, PII exfiltration, tool misuse, and more — mapped to OWASP LLM risks."
    useCase="You need proof that your guard policies actually block the attacks they claim to. This suite runs a library of safe, non-destructive test prompts against a project you own or administer, so you can confirm coverage and catch regressions before an attacker does. It is a defensive validation tool for your own systems — not an offensive tool aimed at third parties."
    howItWorks={[
      { heading: "Authorize a project", body: "You can only run the suite against a project you own or administer. The API requires policy:manage permission, so runs are scoped to systems you are responsible for." },
      { heading: "Confirm the run", body: "Trigger the suite by POSTing to /api/redteam/run with your projectId and confirmed: true. The explicit confirmation flag ensures no run happens by accident." },
      { heading: "Execute safe scenarios", body: "Each scenario is a non-destructive test prompt mapped to an OWASP LLM category and an expected action (block, rewrite, or human review). Prompts are stored redacted; raw prompts are never logged." },
      { heading: "Review results", body: "Each scenario reports whether your policy responded as expected. Use the AI Red Team Lab view to track pass rate, weakest categories, and trend over time." },
    ]}
    integrationCode={`// Trigger the defensive suite against a project you administer.
// The API validates policy:manage permission server-side.
const res = await fetch("https://api.cybersecurityguard.com/api/redteam/run", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.SOTER_API_KEY,
  },
  body: JSON.stringify({
    projectId: "your-project-id",
    confirmed: true, // explicit authorization — required
  }),
});

const { runId } = await res.json();
// Poll the run / open the Red Team Lab to review pass rate and weak categories.`}
    callout="Authorized use only. The suite runs exclusively against a project you own or administer, requires an explicit confirmed: true flag, and uses non-destructive test prompts. It is not an offensive tool for attacking systems you do not control."
  /><div className="card p-5"><p className="font-semibold">Available projects: {projects.length}</p><p className="mt-2 text-sm text-slate-400">POST <code>/api/redteam/run</code> with <code>projectId</code> and <code>confirmed: true</code>.</p></div><div className="mt-6 grid gap-3 md:grid-cols-2">{safeRedTeamScenarios.map((scenario) => <section className="card p-4" key={scenario.key}><p className="font-semibold">{scenario.category}</p><p className="mt-1 text-xs text-slate-500">{scenario.severity} · {scenario.owaspMapping.join(", ")}</p></section>)}</div></div>;
}
