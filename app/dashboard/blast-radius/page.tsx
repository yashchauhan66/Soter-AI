import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string; agentName: string; agentType: string | null; blastRadiusScore: number; riskLevel: string;
  findingsJson: unknown; recommendationsJson: unknown; updatedAt: Date;
};

export default async function BlastRadiusPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const profiles = await safeRows<ProfileRow>`SELECT "id", "agentName", "agentType", "blastRadiusScore", "riskLevel", "findingsJson", "recommendationsJson", "updatedAt" FROM "AgentRiskProfile" WHERE "projectId" = ${project.id} ORDER BY "blastRadiusScore" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Blast radius simulator"
        description="Estimate how much damage each agent could do if compromised, based on its tools, data access, destinations, and policies. Higher scores mean a wider blast radius."
        useCase="Without blast radius analysis, a single compromised agent with broad tool access — like email read + email send + CRM update + filesystem delete — could exfiltrate sensitive data or cause widespread damage. Blast radius simulation helps you identify and reduce the potential impact of agent compromise."
        howItWorks={[
          { heading: "Define agent capabilities", body: "Register each agent's tools, permissions, data sources, external destinations, and memory access patterns with the SDK." },
          { heading: "Run simulation", body: "The simulator analyzes the agent's full capability graph — what tools it can call, what data it can access, where data can flow, and what destructive actions are possible." },
          { heading: "Review score and findings", body: "Each agent receives a blast radius score and risk level. Detailed findings explain the specific risk vectors, and recommendations suggest how to reduce the blast radius." },
          { heading: "Iterate and improve", body: "Use the recommendations to tighten permissions, add approval gates, restrict data access, and reduce the agent's overall blast radius over time." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

const result = await soter.simulateBlastRadius({
  agentName: "support-agent",
  agentType: "computer_use",
  tools: ["gmail.read", "gmail.send", "crm.update", "filesystem.read"],
  permissions: { "gmail.send": "approval_required", "filesystem.delete": "blocked" },
  dataSources: [{ type: "EMAIL", sensitivity: "CONFIDENTIAL" }],
  externalDestinations: ["email_external"],
  memoryAccess: { longTermMemory: true }
});

console.log(result.blastRadiusScore, result.riskLevel);`}
        callout="Blast radius simulation is a planning tool that estimates potential impact based on declared capabilities. It does not prevent attacks on its own — combine with least-privilege tool access, approval workflows, and monitoring for defense in depth."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Agent profiles" value={profiles.length} tone="gray" />
        <MetricCard label="High risk" value={profiles.filter((p) => ["HIGH", "CRITICAL"].includes(p.riskLevel)).length} tone="red" />
        <MetricCard label="Medium risk" value={profiles.filter((p) => p.riskLevel === "MEDIUM").length} tone="yellow" />
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
                <p className={`text-3xl font-bold ${profile.riskLevel === "CRITICAL" ? "text-red-300" : profile.riskLevel === "HIGH" ? "text-orange-300" : profile.riskLevel === "MEDIUM" ? "text-amber-300" : "text-emerald-300"}`}>{profile.blastRadiusScore}</p>
                <p className="text-xs"><RiskLevel level={profile.riskLevel} /></p>
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
    </div>
  );
}

function toList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
