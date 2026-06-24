import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel, PayloadViewer, EmptyRow, safeJson } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  sessionId: string;
  agentIdentityId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type StepRow = {
  id: string;
  toolChainSessionId: string;
  stepIndex: number;
  tool: string;
  action: string;
  sourceType: string;
  destinationType: string;
  dataSensitivity: string;
  decision: string;
  riskLevel: string;
  createdAt: Date;
};

type FindingRow = {
  id: string;
  toolChainSessionId: string;
  findingType: string;
  riskLevel: string;
  summary: string;
  involvedStepsJson: unknown;
  recommendation: string;
  createdAt: Date;
};

export default async function ToolChainPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [sessions, steps, findings] = await Promise.all([
    safeRows<SessionRow>`
      SELECT "id", "sessionId", "agentIdentityId", "status", "createdAt", "updatedAt"
      FROM "ToolChainSession"
      WHERE "projectId" = ${project.id}
      ORDER BY "updatedAt" DESC
      LIMIT 50
    `,
    safeRows<StepRow>`
      SELECT "id", "toolChainSessionId", "stepIndex", "tool", "action", "sourceType",
        "destinationType", "dataSensitivity", "decision", "riskLevel", "createdAt"
      FROM "ToolChainStep"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 150
    `,
    safeRows<FindingRow>`
      SELECT "id", "toolChainSessionId", "findingType", "riskLevel", "summary",
        "involvedStepsJson", "recommendation", "createdAt"
      FROM "ToolChainFinding"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  const blocked = steps.filter((step) => step.decision === "BLOCK").length;
  const review = steps.filter((step) => step.decision === "REVIEW" || step.decision === "ASK_APPROVAL").length;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Tool chain detector"
        description="Detect risky multi-tool sequences where safe individual steps combine into exfiltration, poisoning, or privilege escalation paths."
        useCase="Individual tool calls might appear safe in isolation — a file-read followed by an email-send seems harmless. But in sequence, reading a confidential file and emailing it externally is data exfiltration. Tool chain detection analyzes the full sequence of tool calls to identify dangerous multi-step attack patterns."
        howItWorks={[
          { heading: "Track tool sessions", body: "Each agent interaction creates a session that tracks the sequence of tool calls made. Every step is recorded with its source, destination, action, and data sensitivity." },
          { heading: "Analyze sequences", body: "The analyzer examines the chain of tool calls — looking for patterns like read-sensitive-data → call-external-api, or db-query → memory-write → tool-execute that could indicate exfiltration, poisoning, or escalation." },
          { heading: "Detect dangerous chains", body: "Findings are generated when a sequence of individually-safe steps creates a combined risk. Each finding identifies the pattern, the involved steps, and the risk level." },
          { heading: "Block or review", body: "Depending on your policy, dangerous chains can be blocked entirely or flagged for human review. Recommendations suggest how to break the chain." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

// Each tool call is tracked as part of a session
const step = await soter.trackToolChainStep({
  sessionId: "session-123",
  stepIndex: 4,
  tool: "email.send",
  action: "send",
  sourceType: "FILE_SYSTEM",
  destinationType: "EXTERNAL_EMAIL",
  dataSensitivity: "CONFIDENTIAL",
});

// Check if the current chain has become risky
if (step.chainRisk === "CRITICAL") {
  // abort the session, raise an incident
}`}
        callout="Tool chain detection requires SDK integration to track individual steps in each session. Without step tracking, multi-step attacks cannot be detected. Combine with intent guard and blast radius analysis for comprehensive agent security."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Sessions" value={sessions.length} tone="gray" />
        <MetricCard label="Steps" value={steps.length} tone="gray" />
        <MetricCard label="Blocked chains" value={blocked} tone="red" />
        <MetricCard label="Review holds" value={review} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Chain timeline</h2>
          <span className="text-xs font-medium text-slate-500">{steps.length} recent steps</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Decision</th>
              <th>Risk</th>
              <th>Step</th>
              <th>Source</th>
              <th>Action</th>
              <th>Destination</th>
              <th>Data</th>
              <th>Tool</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {steps.map((step) => (
              <tr key={step.id}>
                <td className="py-3"><StatusBadge value={step.decision} /></td>
                <td><RiskLevel level={step.riskLevel} /></td>
                <td>#{step.stepIndex}</td>
                <td>{step.sourceType}</td>
                <td>{step.action}</td>
                <td>{step.destinationType}</td>
                <td>{step.dataSensitivity}</td>
                <td className="font-mono text-xs text-slate-400">{step.tool}</td>
                <td>{step.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {steps.length === 0 && <EmptyRow colSpan={9} message="No tool chain steps recorded yet." />}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Findings</h2>
          <span className="text-xs font-medium text-slate-500">{findings.length} recent</span>
        </div>
        <div className="mt-4 grid gap-3">
          {findings.map((finding) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={finding.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{finding.findingType}</p>
                  <p className="mt-1 max-w-3xl text-slate-400">{finding.summary}</p>
                  <p className="mt-2 max-w-3xl text-xs text-slate-500">{finding.recommendation}</p>
                </div>
                <RiskLevel level={finding.riskLevel} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Steps {formatSteps(finding.involvedStepsJson)}</p>
              <PayloadViewer title="Involved steps" value={safeJson(finding.involvedStepsJson)} />
            </div>
          ))}
          {findings.length === 0 && <p className="text-sm text-slate-500">No dangerous chain findings recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}

function formatSteps(value: unknown) {
  if (!Array.isArray(value)) return "-";
  return value.filter((item): item is number => typeof item === "number").join(" -> ") || "-";
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
