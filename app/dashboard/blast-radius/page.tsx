import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string; agentName: string; agentType: string | null; blastRadiusScore: number; riskLevel: string;
  findingsJson: unknown; recommendationsJson: unknown; updatedAt: Date;
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300", MEDIUM: "text-amber-300", HIGH: "text-orange-300", CRITICAL: "text-red-300",
};

export default async function BlastRadiusPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const profiles = await safeRows<ProfileRow>`SELECT "id", "agentName", "agentType", "blastRadiusScore", "riskLevel", "findingsJson", "recommendationsJson", "updatedAt" FROM "AgentRiskProfile" WHERE "projectId" = ${project.id} ORDER BY "blastRadiusScore" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Blast radius simulator</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Estimate how much damage each agent could do if compromised, based on its tools, data access, destinations, and policies. Higher scores mean a wider blast radius.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <section className="grid gap-3">
        {profiles.map((profile) => (
          <div className="card p-5" key={profile.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{profile.agentName}</p>
                <p className="text-xs text-slate-500">{profile.agentType ?? "agent"} · updated {profile.updatedAt.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${RISK_TONE[profile.riskLevel] ?? "text-slate-300"}`}>{profile.blastRadiusScore}</p>
                <p className={`text-xs font-semibold ${RISK_TONE[profile.riskLevel] ?? "text-slate-400"}`}>{profile.riskLevel}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Findings</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-300">{toList(profile.findingsJson).map((item, i) => <li key={i}>· {item}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Recommendations</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-300">{toList(profile.recommendationsJson).map((item, i) => <li key={i}>· {item}</li>)}</ul>
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && <section className="card p-5 text-sm text-slate-500">No agent risk profiles yet. Run a simulation via the SDK or API.</section>}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";

const guard = createCybersecurityGuardClient({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!
});

const result = await guard.simulateBlastRadius({
  agentName: "support-agent",
  agentType: "computer_use",
  tools: ["gmail.read", "gmail.send", "crm.update", "filesystem.read"],
  permissions: { "gmail.send": "approval_required", "filesystem.delete": "blocked" },
  dataSources: [{ type: "EMAIL", sensitivity: "CONFIDENTIAL" }],
  externalDestinations: ["email_external"],
  memoryAccess: { longTermMemory: true }
});

console.log(result.blastRadiusScore, result.riskLevel);`}</pre>
      </section>
    </div>
  );
}

function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
