import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RecordRow = { id: string; agentName: string; memoryScope: string; memoryType: string; contentRedacted: string | null; status: string; riskLevel: string; updatedAt: Date };
type FindingRow = { memoryRecordId: string; findingType: string; riskLevel: string; reason: string };

const RISK_TONE: Record<string, string> = { LOW: "text-emerald-300", MEDIUM: "text-amber-300", HIGH: "text-orange-300", CRITICAL: "text-red-300" };
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300",
  QUARANTINED: "bg-red-400/10 text-red-300",
  NEEDS_REVIEW: "bg-yellow-400/10 text-yellow-300",
  DELETED: "bg-slate-700 text-slate-400",
};

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Memory firewall</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Detect and quarantine poisoned instructions in long-term agent memory before they affect future sessions. Quarantined memory is never returned to the agent.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Memory records" value={records.length} tone="gray" />
        <Metric label="Quarantined" value={quarantined} tone="red" />
        <Metric label="Needs review" value={records.filter((r) => r.status === "NEEDS_REVIEW").length} tone="yellow" />
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
                <span className={`text-xs font-semibold ${RISK_TONE[row.riskLevel] ?? "text-slate-400"}`}>{row.riskLevel}</span>
                <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_TONE[row.status] ?? "bg-slate-700 text-slate-300"}`}>{row.status}</span>
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

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";

const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

const check = await guard.checkMemoryPoisoning({
  agentName: "support-agent",
  memoryScope: "USER",
  memoryType: "INSTRUCTION",
  content: candidateMemory
});

if (check.decision === "QUARANTINE" || check.decision === "BLOCK") {
  // do not persist; raise an incident
}`}</pre>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "yellow" | "red" | "gray" }) {
  const tones = { green: "text-emerald-300", yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
