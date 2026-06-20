import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, PayloadViewer, EmptyRow, RiskLevel, safeJson } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type SemanticCheckRow = {
  id: string;
  sessionId: string;
  sourceIdsJson: unknown;
  destinationType: string;
  destinationName: string | null;
  contentRedacted: string;
  semanticRiskScore: number;
  decision: string;
  riskLevel: string;
  reason: string;
  findingsJson: unknown;
  createdAt: Date;
};

type SemanticSourceRow = {
  id: string;
  sourceId: string;
  sourceType: string;
  sensitivityLevel: string;
  fingerprintJson: unknown;
  contentHash: string;
  createdAt: Date;
};



export default async function SemanticEgressPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [checks, sources] = await Promise.all([
    safeRows<SemanticCheckRow>`
      SELECT "id", "sessionId", "sourceIdsJson", "destinationType", "destinationName",
        "contentRedacted", "semanticRiskScore", "decision", "riskLevel", "reason", "findingsJson", "createdAt"
      FROM "SemanticEgressCheck"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 150
    `,
    safeRows<SemanticSourceRow>`
      SELECT "id", "sourceId", "sourceType", "sensitivityLevel", "fingerprintJson", "contentHash", "createdAt"
      FROM "SemanticSourceFingerprint"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  const blocked = checks.filter((check) => check.decision === "BLOCK").length;
  const review = checks.filter((check) => check.decision === "REVIEW" || check.decision === "ASK_APPROVAL").length;
  const redacted = checks.filter((check) => check.decision === "REDACT").length;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Semantic egress firewall"
        description="Detect confidential meaning leaving the system, including paraphrased customer, roadmap, pricing, source-code, and private-context leakage."
        useCase="Keyword-based egress detection misses paraphrased or rewritten confidential content. Semantic egress uses deep content inspection to catch reworded secrets, abstracted roadmap data, and restructured source code — even when the exact phrasing has changed."
        howItWorks={[
          { heading: "Content is fingerprinted", body: "Confidential sources (documents, emails, code) are semantically fingerprinted when registered. Creating a semantic fingerprint that captures meaning, not just exact text." },
          { heading: "Outbound content is checked", body: "Every piece of content leaving the system — via tool calls, API responses, or memory writes — is compared against registered fingerprints for semantic similarity." },
          { heading: "Risk scoring and decision", body: "If outbound content matches a confidential source beyond a configurable threshold, the guard blocks, redacts, or flags for review based on your policy." },
          { heading: "Incident logging", body: "All egress checks are logged with redacted content, risk scores, findings, and the matched source fingerprints for audit and compliance." },
        ]}
        callout="Semantic egress reduces risk of data leakage but is not foolproof. Combine with blast radius analysis, context lineage, and least-privilege tool access for defense in depth."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Checks" value={checks.length} tone="gray" />
        <MetricCard label="Blocked" value={blocked} tone="red" />
        <MetricCard label="Review holds" value={review} tone="yellow" />
        <MetricCard label="Redactions" value={redacted} tone="blue" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent egress checks</h2>
          <span className="text-xs font-medium text-slate-500">{checks.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Decision</th>
              <th>Risk</th>
              <th>Score</th>
              <th>Destination</th>
              <th>Target</th>
              <th>Sources</th>
              <th>Session</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="py-3"><StatusBadge value={check.decision} /></td>
                <td className="font-semibold"><RiskLevel level={check.riskLevel} /></td>
                <td>{Math.round(check.semanticRiskScore)}</td>
                <td>{check.destinationType}</td>
                <td className="max-w-[220px] truncate text-slate-400">{check.destinationName ?? "-"}</td>
                <td className="max-w-[220px] truncate text-slate-400">{formatSourceIds(check.sourceIdsJson)}</td>
                <td className="font-mono text-xs text-slate-500">{check.sessionId}</td>
                <td>{check.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {checks.length === 0 && <EmptyRow colSpan={8} message="No semantic egress checks recorded yet." />}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Findings</h2>
          <span className="text-xs font-medium text-slate-500">Latest 20</span>
        </div>
        <div className="mt-4 grid gap-3">
          {checks.slice(0, 20).map((check) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={check.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{check.destinationType} to {check.destinationName ?? "unknown target"}</p>
                  <p className="mt-1 max-w-3xl text-slate-400">{check.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">Session {check.sessionId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={check.decision} />
                  <RiskLevel level={check.riskLevel} />
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <PayloadViewer title="Content redacted" value={check.contentRedacted} />
                <PayloadViewer title="Findings" value={safeJson(check.findingsJson)} />
              </div>
            </div>
          ))}
          
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Protected source fingerprints</h2>
          <span className="text-xs font-medium text-slate-500">{sources.length} sources</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sources.map((source) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={source.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{source.sourceId}</p>
                  <p className="mt-1 text-slate-400">{source.sourceType}</p>
                </div>
                <RiskLevel level={source.sensitivityLevel} />
              </div>
              <p className="mt-2 font-mono text-xs text-slate-500">{source.contentHash.slice(0, 24)}...</p>
              <PayloadViewer title="Fingerprint" value={safeJson(source.fingerprintJson)} />
            </div>
          ))}
          
        </div>
      </section>
    </div>
  );
}

function formatSourceIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") || "-" : "-";
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
