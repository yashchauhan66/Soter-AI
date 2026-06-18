import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { id: string; documentId: string; trustScore: number; trustLevel: string; findingsJson: unknown; createdAt: Date; updatedAt: Date };

const TRUST_TONE: Record<string, string> = {
  TRUSTED: "text-emerald-300",
  SUSPICIOUS: "text-amber-300",
  NEEDS_REVIEW: "text-blue-300",
  QUARANTINED: "text-red-300",
};

export default async function RagTrustPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const rows = await safeRows<Row>`SELECT "id", "documentId", "trustScore", "trustLevel", "findingsJson", "createdAt", "updatedAt" FROM "RagDocumentTrust" WHERE "projectId" = ${project.id} ORDER BY "trustScore" ASC, "updatedAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agent firewall</p><h1 className="mt-2 text-3xl font-bold">RAG document trust</h1></div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Score</th><th>Trust level</th><th>Document</th><th>Findings</th><th>Updated</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-3 font-semibold">{row.trustScore}</td>
                <td className={`font-semibold ${TRUST_TONE[row.trustLevel] ?? "text-slate-300"}`}>{row.trustLevel}</td>
                <td className="font-mono text-xs">{row.documentId}</td>
                <td>{findingLabels(row.findingsJson)}</td>
                <td>{row.updatedAt.toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={5}>No scored documents yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function findingLabels(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "-";
  return value.map((finding) => (finding && typeof finding === "object" && "label" in finding ? String((finding as { label: unknown }).label) : String(finding))).join(", ");
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
