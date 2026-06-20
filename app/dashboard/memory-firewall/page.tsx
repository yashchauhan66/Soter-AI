import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type RecordRow = { id: string; agentName: string; memoryScope: string; memoryType: string; contentRedacted: string | null; status: string; riskLevel: string; updatedAt: Date };
type FindingRow = { memoryRecordId: string; findingType: string; riskLevel: string; reason: string };

export default async function MemoryFirewallPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const [records, findings] = await Promise.all([
    safeRows<RecordRow>`SELECT "id", "agentName", "memoryScope", "memoryType", "contentRedacted", "status", "riskLevel", "updatedAt" FROM "AgentMemoryRecord" WHERE "projectId" = ${project.id} ORDER BY "updatedAt" DESC LIMIT 100`,
    safeRows<FindingRow>`SELECT "memoryRecordId", "findingType", "riskLevel", "reason" FROM "MemoryPoisoningFinding" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 300`,
  ]);
  const findingsByRecord = new Map<string, FindingRow[]>();
  for (const finding of findings) {
    const list = findingsByRecord.get(finding.memoryRecordId) ?? [];
    list.push(finding);
    findingsByRecord.set(finding.memoryRecordId, list);
  }
  const quarantined = records.filter((row) => row.status === "QUARANTINED").length;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Memory firewall"
        description="Detect and quarantine poisoned instructions in long-term agent memory before they affect future sessions. Quarantined memory is never returned to the agent."
        useCase="Memory poisoning is a critical attack vector where an attacker injects malicious instructions into an agent's long-term memory during one session, which then affects all future sessions. Traditional input guards only catch attacks at the moment of input — memory firewall protects against persistent, cross-session attacks."
        howItWorks={[
          { heading: "Content is analyzed", body: "When memory is written, each piece of content is analyzed for prompt injection, jailbreak attempts, and instruction poisoning using deep content inspection." },
          { heading: "Risk scoring", body: "Each memory record receives a risk score. Suspicious content is flagged and categorized by the type of poisoning detected." },
          { heading: "Automated quarantine", body: "High-risk memory is automatically quarantined — it is stored but never returned to the agent. Medium-risk records are marked for review." },
          { heading: "Audit and recovery", body: "All quarantine events are logged with findings. You can review, release, or permanently delete quarantined memory from the dashboard." },
        ]}
        integrationCode={`import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

const check = await soter.checkMemory({
  agentName: "support-agent",
  memoryScope: "USER",
  memoryType: "INSTRUCTION",
  content: candidateMemory
});

if (check.decision === "QUARANTINE" || check.decision === "BLOCK") {
  // do not persist; raise an incident
}`}
        callout="Memory firewall detects known poisoning patterns but cannot guarantee complete protection against novel attacks. Combine with periodic memory audits and least-privilege memory access for defense in depth."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Memory records" value={records.length} tone="gray" />
        <MetricCard label="Quarantined" value={quarantined} tone="red" />
        <MetricCard label="Needs review" value={records.filter((r) => r.status === "NEEDS_REVIEW").length} tone="yellow" />
      </div>

      <section className="grid gap-3">
        {records.map((row) => (
          <div className="card p-4 text-sm" key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{row.agentName} · <span className="text-slate-400">{row.memoryScope}/{row.memoryType}</span></p>
                <p className="mt-1 max-w-2xl truncate text-slate-400">{row.contentRedacted ?? "(no content)"}</p>
              </div>
              <div className="flex items-center gap-2">
                <RiskLevel level={row.riskLevel} />
                <StatusBadge value={row.status} />
              </div>
            </div>
            {(findingsByRecord.get(row.id) ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-200">
                {(findingsByRecord.get(row.id) ?? []).map((finding, i) => <li key={i}>· {finding.findingType}: {finding.reason}</li>)}
              </ul>
            )}
          </div>
        ))}
        {records.length === 0 && <section className="card p-5 text-sm text-slate-500">No memory records yet. Check or store memory via the API/SDK.</section>}
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
