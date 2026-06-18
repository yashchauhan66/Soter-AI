import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CheckRow = { id: string; agentName: string; domain: string | null; action: string | null; actionCategory: string; decision: string; riskLevel: string; reason: string; userConsentProvided: boolean; createdAt: Date };

const DECISION_TONE: Record<string, string> = {
  ALLOW: "bg-emerald-400/10 text-emerald-300",
  ASK_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  TAKEOVER_REQUIRED: "bg-orange-400/10 text-orange-300",
  BLOCK: "bg-red-400/10 text-red-300",
};
const RISK_TONE: Record<string, string> = { LOW: "text-emerald-300", MEDIUM: "text-amber-300", HIGH: "text-orange-300", CRITICAL: "text-red-300" };

export default async function LegalBoundaryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const checks = await safeRows<CheckRow>`SELECT "id", "agentName", "domain", "action", "actionCategory", "decision", "riskLevel", "reason", "userConsentProvided", "createdAt" FROM "LegalBoundaryCheck" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  const blocked = checks.filter((c) => c.decision === "BLOCK").length;
  const takeover = checks.filter((c) => c.decision === "TAKEOVER_REQUIRED").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Legal boundary guard</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Stop computer-use and browser agents from crossing legal, compliance, or consent boundaries: payments, logins, terms acceptance, scraping, and personal-data uploads. This is risk control and consent enforcement, not legal advice.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Checks" value={checks.length} tone="gray" />
        <Metric label="Blocked" value={blocked} tone="red" />
        <Metric label="Takeover required" value={takeover} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Recent checks</h2>
        <table className="mt-4 w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Decision</th><th>Risk</th><th>Category</th><th>Domain</th><th>Consent</th><th>Reason</th><th>When</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${DECISION_TONE[check.decision] ?? "bg-slate-700 text-slate-300"}`}>{check.decision}</span></td>
                <td className={`font-semibold ${RISK_TONE[check.riskLevel] ?? "text-slate-400"}`}>{check.riskLevel}</td>
                <td className="font-mono text-xs">{check.actionCategory}</td>
                <td>{check.domain ?? "-"}</td>
                <td>{check.userConsentProvided ? "yes" : "no"}</td>
                <td className="max-w-[260px] truncate text-slate-400">{check.reason}</td>
                <td>{check.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {checks.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={7}>No legal-boundary checks yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";

const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

const verdict = await guard.checkLegalBoundary({
  agentName: "openclaw",
  websiteUrl: "https://example.com/checkout",
  domain: "example.com",
  action: "submit_order",
  actionCategory: "PURCHASE",
  userConsentProvided: false,
  metadata: { loggedIn: true, paymentInvolved: true }
});

if (verdict.decision === "TAKEOVER_REQUIRED") return handOffToHuman(verdict.requiredUserMessage);
if (verdict.decision === "BLOCK") throw new Error(verdict.reason);`}</pre>
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
