import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

type Row = { id: string; tokenLabel: string; scope: string; active: boolean; createdAt: Date; triggeredAt: Date | null };

export default async function CanaryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const rows = await safeRows<Row>`SELECT "id", "tokenLabel", "scope", "active", "createdAt", "triggeredAt" FROM "CanaryToken" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent firewall"
        title="Canaries"
        description="Plant decoy secrets and tokens for your agents and get alerted the moment one is read or used — a tripwire for prompt injection and data exfiltration."
        useCase="If an attacker hijacks an agent through prompt injection, the goal is usually to read secrets and send them somewhere. Canary tokens are believable-looking decoy credentials you scatter through context, memory, or documents. They are never used by legitimate code, so any time one is touched it is a high-confidence signal that something is probing or exfiltrating your data — no false positives from normal activity."
        howItWorks={[
          { heading: "Generate a canary", body: "Create a labelled canary token scoped to where it will live — a config value, a memory entry, or a RAG document. It looks like a real secret but belongs to nothing." },
          { heading: "Plant the decoy", body: "Place the token where a compromised agent would plausibly find it. Legitimate workflows never reference it, so it just sits there as bait." },
          { heading: "Watch for a trigger", body: "The moment the canary is read or used, it is marked as triggered with a timestamp — a strong indicator of injection or exfiltration in progress." },
          { heading: "Investigate the leak", body: "A triggered canary tells you which decoy fired and when, so you can trace back the session or agent that touched it and respond." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({ apiKey: process.env.SOTER_API_KEY });

// Mint a decoy secret and plant it in agent context
const canary = await soter.createCanary({
  tokenLabel: "aws-prod-key",
  scope: "agent-memory",
});

// Report any observed use of the decoy value
await soter.reportCanaryUse({ token: canary.token });`}
        callout="Canaries are a detection tripwire — they alert you when a decoy is touched, they do not themselves block the agent action. Pair them with the firewall policy and approval gate to act on a trigger."
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="grid gap-3">
        {rows.map((row) => (
          <div className="card grid gap-2 p-4 text-sm md:grid-cols-[1fr_auto]" key={row.id}>
            <div><p className="font-semibold">{row.tokenLabel}</p><p className="text-slate-300">{row.scope} - created {row.createdAt.toLocaleString()}</p></div>
            <span className={row.triggeredAt ? "text-red-300" : "text-emerald-300"}>{row.triggeredAt ? `Triggered ${row.triggeredAt.toLocaleString()}` : row.active ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {rows.length === 0 && <section className="card p-5 text-sm text-slate-300">No canary tokens yet. Generate a canary to plant a decoy secret — you&apos;ll be alerted the moment an agent or model tries to use it.</section>}
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
