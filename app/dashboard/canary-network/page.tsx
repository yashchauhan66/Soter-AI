import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel, PayloadViewer } from "@/components/dashboard/MetricCard";
import { disableDashboardCanary } from "./actions";

export const dynamic = "force-dynamic";

type CanaryTokenRow = {
  id: string;
  tokenLabel: string;
  scope: string;
  active: boolean;
  createdAt: Date;
  triggeredAt: Date | null;
};

type CanaryLeakRow = {
  id: string;
  canaryTokenId: string | null;
  sessionId: string | null;
  location: string;
  decision: string;
  riskLevel: string;
  reason: string;
  contentRedacted: string;
  createdAt: Date;
};



export default async function CanaryNetworkPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [tokens, leaks] = await Promise.all([
    safeRows<CanaryTokenRow>`
      SELECT "id", "tokenLabel", "scope", "active", "createdAt", "triggeredAt"
      FROM "CanaryToken"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 120
    `,
    safeRows<CanaryLeakRow>`
      SELECT
        "id",
        "canaryTokenId",
        "sessionId",
        "location",
        "decision",
        "riskLevel",
        "reason",
        "contentRedacted",
        "createdAt"
      FROM "CanaryLeakEvent"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 120
    `,
  ]);

  const activeCount = tokens.filter((t) => t.active).length;
  const triggeredCount = tokens.filter((t) => t.triggeredAt).length;
  const blockedLeads = leaks.filter((l) => l.decision === "BLOCK").length;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Prompt injection canary network"
        description="Canary tokens detect protected-context leakage across outputs, tool calls, emails, API requests, browser forms, and memory writes — helping you identify data exfiltration and prompt injection in real time."
        useCase="Canary tokens are digital tripwires placed in sensitive contexts. If an attacker successfully injects a prompt that causes the AI to leak or repeat protected content, the canary token will appear in the output — alerting you to the breach. Unlike content filters that look for known patterns, canary tokens can detect entirely novel attacks."
        howItWorks={[
          { heading: "Deploy canary tokens", body: "Insert unique canary tokens into protected contexts — agent instructions, system prompts, RAG documents, or email signatures. Each token is a unique, high-entropy string that looks like real data." },
          { heading: "Monitor all outputs", body: "The system checks every AI output, tool call, API request, browser form submission, email, and memory write for canary token presence." },
          { heading: "Detect and block leaks", body: "When a canary token is detected outside its intended context, the system blocks the leak, records the event with the exact location and content, and alerts your team." },
          { heading: "Investigate and respond", body: "Each leak event includes the session ID, location where the token was found, risk level, and redacted content — enabling rapid investigation of the breach source." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

// Register canary tokens in sensitive contexts
await soter.registerCanaryToken({
  label: "System-prompt canary v2",
  scope: "SYSTEM_PROMPT",
  token: "CYBERGUARD_CANARY_a1b2c3d4e5f6",
});

// Check all outbound content for canary leaks
const result = await soter.checkCanaryLeak({
  content: aiOutput,
  location: "chat_response",
  sessionId: "session-123",
});

if (result.leakDetected) {
  // Block the response and alert security team
  throw new Error("Protected context leak detected");
}`}
        callout="Canary tokens are a powerful detection mechanism but require careful deployment — tokens must be unique, secret, and placed in contexts where leakage would be meaningful. Combine with semantic egress detection and context lineage for defense in depth."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Active canaries" value={activeCount} tone="gray" />
        <MetricCard label="Triggered" value={triggeredCount} tone="yellow" />
        <MetricCard label="Blocked leaks" value={blockedLeads} tone="red" />
        <MetricCard label="Total leaks" value={leaks.length} tone="blue" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Canary tokens</h2>
          <span className="text-xs font-medium text-slate-500">{tokens.length} tokens</span>
        </div>

        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Status</th>
              <th>Scope</th>
              <th>Label</th>
              <th>Last triggered</th>
              <th>Disable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tokens.map((t: CanaryTokenRow) => (
              <tr key={t.id}>
                <td className="py-3"><StatusBadge value={t.active ? "ACTIVE" : "DISABLED"} /></td>
                <td className="text-slate-300">{t.scope}</td>
                <td className="max-w-[240px] truncate text-slate-400">{t.tokenLabel || "-"}</td>
                <td className="font-mono text-xs text-slate-500">{t.triggeredAt ? t.triggeredAt.toLocaleString() : "-"}</td>
                <td className="py-3">
                  <form action={disableDashboardCanary}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="canaryId" value={t.id} />
                    <input type="hidden" name="reason" value="Disabled from dashboard by user." />
                    <button
                      type="submit"
                      disabled={!t.active}
                      className="rounded bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td className="py-5 text-slate-500" colSpan={5}>No canary tokens recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Leak events</h2>
          <span className="text-xs font-medium text-slate-500">Latest {Math.min(60, leaks.length)}</span>
        </div>

        <div className="mt-4 grid gap-3">
          {leaks.slice(0, 60).map((l: CanaryLeakRow) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={l.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{l.location}</p>
                  <p className="mt-1 max-w-3xl text-slate-400">{l.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">Session {l.sessionId ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">{l.createdAt.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={l.decision} />
                  <RiskLevel level={l.riskLevel} />
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <PayloadViewer title="Content redacted" value={l.contentRedacted} />
                <PayloadViewer title="Canary token id" value={l.canaryTokenId ?? null} />
              </div>
            </div>
          ))}
          {leaks.length === 0 && <p className="text-sm text-slate-500">No canary leaks recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  // Inputs are interpolated via Prisma params; schema errors should surface instead of hiding leak telemetry.
  const sql = strings.reduce((acc, chunk, i) => `${acc}${chunk}${i < values.length ? `$${i + 1}` : ""}`, "");
  return db.$queryRawUnsafe<T[]>(sql, ...values);
}
