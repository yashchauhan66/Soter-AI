import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel, PayloadViewer, safeJson } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type EvidenceItemRow = {
  id: string;
  evidenceType: string;
  title: string;
  summary: string;
  riskLevel: string | null;
  controlName: string;
  status: string;
  evidenceJson: unknown;
  contentHash: string | null;
  createdAt: Date;
};

type EvidenceReportRow = {
  id: string;
  reportName: string;
  reportType: string;
  status: string;
  summary: string;
  evidenceIdsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export default async function EvidenceVaultPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [items, reports] = await Promise.all([
    safeRows<EvidenceItemRow>`
      SELECT "id", "evidenceType", "title", "summary", "riskLevel", "controlName",
        "status", "evidenceJson", "contentHash", "createdAt"
      FROM "ComplianceEvidenceItem"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `,
    safeRows<EvidenceReportRow>`
      SELECT "id", "reportName", "reportType", "status", "summary", "evidenceIdsJson", "createdAt", "updatedAt"
      FROM "ComplianceEvidenceReport"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  const controls = new Set(items.map((item) => item.controlName)).size;
  const warnings = items.filter((item) => item.status === "WARNING" || item.status === "FAIL").length;
  const highRisk = items.filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL").length;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Evidence vault"
        description="Package proof that AI security controls are enabled, attacks were blocked, approvals were captured, and incidents are reviewable."
        useCase="Compliance frameworks like SOC 2, ISO 27001, and HIPAA require auditable evidence that security controls are operating effectively. Without an evidence vault, proving that your AI guardrails are working requires manual log collection, screen captures, and time-consuming audits."
        howItWorks={[
          { heading: "Automatic evidence collection", body: "Every guard check, block, approval, and incident is automatically recorded as a compliance evidence item with type, status, risk level, and content hash." },
          { heading: "Organize by control", body: "Evidence items are grouped by the security control they demonstrate — input guard, output guard, escrow, lineage, etc. Each item shows its current status." },
          { heading: "Generate reports", body: "Package selected evidence items into compliance reports. Reports summarize the control status, evidence count, and overall compliance posture for auditors." },
          { heading: "Export for audit", body: "Export evidence reports with full detail for auditor review. Content is redacted for privacy while preserving cryptographic hashes for integrity verification." },
        ]}
        callout="The evidence vault captures and packages available data but cannot independently verify the effectiveness of controls. Combine with penetration testing, red team exercises, and manual review for comprehensive compliance assurance."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Evidence items" value={items.length} tone="gray" />
        <MetricCard label="Controls" value={controls} tone="cyan" />
        <MetricCard label="Warnings" value={warnings} tone="yellow" />
        <MetricCard label="High risk" value={highRisk} tone="red" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Evidence items</h2>
          <span className="text-xs font-medium text-slate-500">{items.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Status</th>
              <th>Type</th>
              <th>Risk</th>
              <th>Control</th>
              <th>Title</th>
              <th>Hash</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3"><StatusBadge value={item.status} /></td>
                <td>{item.evidenceType}</td>
                <td className="font-semibold"><RiskLevel level={item.riskLevel ?? "LOW"} /></td>
                <td>{item.controlName}</td>
                <td className="max-w-[320px] truncate">{item.title}</td>
                <td className="font-mono text-xs text-slate-500">{item.contentHash?.slice(0, 18) ?? "-"}</td>
                <td>{item.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={7}>No compliance evidence collected yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Reports</h2>
            <span className="text-xs font-medium text-slate-500">{reports.length} reports</span>
          </div>
          <div className="mt-4 grid gap-3">
            {reports.map((report) => (
              <div className="rounded-lg border border-slate-800 p-3 text-sm" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{report.reportName}</p>
                    <p className="mt-1 text-slate-400">{report.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">{report.reportType} / {formatEvidenceCount(report.evidenceIdsJson)} items</p>
                  </div>
                  <StatusBadge value={report.status} />
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="text-sm text-slate-500">No evidence reports generated yet.</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Latest evidence detail</h2>
            <span className="text-xs font-medium text-slate-500">Redacted</span>
          </div>
          <div className="mt-4 grid gap-3">
            {items.slice(0, 8).map((item) => (
              <div className="rounded-lg border border-slate-800 p-3 text-sm" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-slate-400">{item.summary}</p>
                  </div>
                  <RiskLevel level={item.riskLevel ?? "LOW"} />
                </div>
                <PayloadViewer title="Evidence data" value={safeJson(item.evidenceJson)} />
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-500">No redacted evidence detail available yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatEvidenceCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
