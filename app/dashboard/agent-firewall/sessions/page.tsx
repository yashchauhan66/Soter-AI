import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

type Row = { id: string; agentName: string; agentType: string; status: string; createdAt: Date; endedAt: Date | null };

export default async function AgentFirewallSessionsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const sessions = await safeRows<Row>`SELECT "id", "agentName", "agentType", "status", "createdAt", "endedAt" FROM "AgentSession" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent firewall"
        title="Sessions"
        description="See every agent that has authenticated through the firewall — its name, type, status, and lifetime — so each run of an AI agent has an identity you can track."
        useCase="Before you can govern what an agent does, you need to know which agent is acting. A session is created when an agent authenticates through the firewall with a passport and token, giving that run a stable identity. This page lists those sessions so you can tell active agents from ended ones and tie later actions, approvals, and replays back to a specific session."
        howItWorks={[
          { heading: "Agent authenticates", body: "An agent presents its passport and token to the firewall. On success, a session is opened for that run of the agent." },
          { heading: "Capture identity", body: "The session records the agent name and type so you always know who is behind a given series of actions." },
          { heading: "Track the lifecycle", body: "Each session carries a status and start time, and an end time once it closes, so you can see which agents are currently active." },
          { heading: "Correlate downstream", body: "The session id links this run to its action logs, approvals, and replay timeline — the anchor the rest of the firewall hangs off." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({ apiKey: process.env.SOTER_API_KEY });

// Open a firewall session for an agent run
const session = await soter.startAgentSession({
  agentName: "support-copilot",
  agentType: "customer-service",
});

// Use session.id when checking actions so they tie back to this run
`}
        callout="This is a read-only view of authenticated agent sessions. Creating and enforcing sessions happens in the firewall SDK/API; agent-firewall action checking is currently preview tracking, not runtime enforcement."
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Agent</th><th>Type</th><th>Status</th><th>Started</th><th>Ended</th><th>Session</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {sessions.map((row) => <tr key={row.id}><td className="py-3 font-medium">{row.agentName}</td><td>{row.agentType}</td><td>{row.status}</td><td>{row.createdAt.toLocaleString()}</td><td>{row.endedAt?.toLocaleString() ?? "-"}</td><td className="font-mono text-xs">{row.id}</td></tr>)}
            {sessions.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No agent sessions yet. Sessions appear here once an agent authenticates through the firewall with a passport and token.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
