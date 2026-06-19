import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

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

const DECISION_TONE: Record<string, string> = {
  ALLOW: "bg-emerald-400/10 text-emerald-300",
  REDACT: "bg-yellow-400/10 text-yellow-300",
  ASK_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  BLOCK: "bg-red-400/10 text-red-300",
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Semantic egress firewall</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Detect confidential meaning leaving the system, including paraphrased customer, roadmap, pricing, source-code, and private-context leakage.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Checks" value={checks.length} tone="gray" />
        <Metric label="Blocked" value={blocked} tone="red" />
        <Metric label="Review holds" value={review} tone="yellow" />
        <Metric label="Redactions" value={redacted} tone="blue" />
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
                <td className="py-3"><Badge value={check.decision} /></td>
                <td className={`font-semibold ${RISK_TONE[check.riskLevel] ?? "text-slate-400"}`}>{check.riskLevel}</td>
                <td>{Math.round(check.semanticRiskScore)}</td>
                <td>{check.destinationType}</td>
                <td className="max-w-[220px] truncate text-slate-400">{check.destinationName ?? "-"}</td>
                <td className="max-w-[220px] truncate text-slate-400">{formatSourceIds(check.sourceIdsJson)}</td>
                <td className="font-mono text-xs text-slate-500">{check.sessionId}</td>
                <td>{check.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {checks.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={8}>No semantic egress checks recorded yet.</td></tr>}
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
                  <Badge value={check.decision} />
                  <span className={`text-xs font-bold ${RISK_TONE[check.riskLevel] ?? "text-slate-400"}`}>{check.riskLevel}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Payload title="Content redacted" value={check.contentRedacted} />
                <Payload title="Findings" value={formatJson(check.findingsJson)} />
              </div>
            </div>
          ))}
          {checks.length === 0 && <p className="text-sm text-slate-500">No semantic findings available yet.</p>}
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
                <span className={`text-xs font-bold ${RISK_TONE[source.sensitivityLevel] ?? "text-slate-400"}`}>{source.sensitivityLevel}</span>
              </div>
              <p className="mt-2 font-mono text-xs text-slate-500">{source.contentHash.slice(0, 24)}...</p>
              <Payload title="Fingerprint" value={formatJson(source.fingerprintJson)} />
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-slate-500">No protected source fingerprints recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "yellow" | "red" | "gray" | "blue" }) {
  const tones = { yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300", blue: "text-blue-300" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${DECISION_TONE[value] ?? "bg-slate-700 text-slate-300"}`}>{value}</span>;
}

function Payload({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">{value ?? "No data supplied."}</pre>
    </div>
  );
}

function formatSourceIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") || "-" : "-";
}

function formatJson(value: unknown) {
  if (!value) return "No data.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Data could not be formatted.";
  }
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
