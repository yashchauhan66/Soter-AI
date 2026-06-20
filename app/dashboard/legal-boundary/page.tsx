import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type CheckRow = { id: string; agentName: string; domain: string | null; action: string | null; actionCategory: string; decision: string; riskLevel: string; reason: string; userConsentProvided: boolean; createdAt: Date };

export default async function LegalBoundaryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const checks = await safeRows<CheckRow>`SELECT "id", "agentName", "domain", "action", "actionCategory", "decision", "riskLevel", "reason", "userConsentProvided", "createdAt" FROM "LegalBoundaryCheck" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  const blocked = checks.filter((c) => c.decision === "BLOCK").length;
  const takeover = checks.filter((c) => c.decision === "TAKEOVER_REQUIRED").length;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Legal boundary guard"
        description="Stop computer-use and browser agents from crossing legal, compliance, or consent boundaries: payments, logins, terms acceptance, scraping, and personal-data uploads. This is risk control and consent enforcement, not legal advice."
        useCase="Autonomous computer-use agents can inadvertently perform actions with legal consequences — making purchases, accepting terms of service, submitting forms, or uploading personal data. Without explicit guards, these actions happen silently with no user consent or oversight."
        howItWorks={[
          { heading: "Define action categories", body: "Configure which action categories (PURCHASE, LOGIN, TERMS_ACCEPTANCE, FORM_SUBMISSION, DATA_UPLOAD, SCRAPING) require consent or are completely blocked." },
          { heading: "Agent actions are checked", body: "When an agent attempts an action in a browser or API call, the legal boundary guard evaluates the action against the configured policy and user consent status." },
          { heading: "Decision and enforcement", body: "Actions are ALLOWed, BLOCKed, or flagged for human TAKEOVER. TAKEOVER_REQUIRED means the agent must pause and hand control to a human." },
          { heading: "Audit trail", body: "All boundary checks are logged with the action details, decision, risk level, and whether user consent was provided. The log serves as a compliance audit trail." },
        ]}
        integrationCode={`import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

const verdict = await soter.checkLegalBoundary({
  agentName: "openclaw",
  websiteUrl: "https://example.com/checkout",
  domain: "example.com",
  action: "submit_order",
  actionCategory: "PURCHASE",
  userConsentProvided: false,
  metadata: { loggedIn: true, paymentInvolved: true }
});

if (verdict.decision === "TAKEOVER_REQUIRED") return handOffToHuman(verdict.requiredUserMessage);
if (verdict.decision === "BLOCK") throw new Error(verdict.reason);`}
        callout="Legal boundary guard is a risk control mechanism, not a substitute for legal advice or compliance review. Consult your legal team to define appropriate policies for your use case and jurisdiction."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Checks" value={checks.length} tone="gray" />
        <MetricCard label="Blocked" value={blocked} tone="red" />
        <MetricCard label="Takeover required" value={takeover} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Recent checks</h2>
        <table className="mt-4 w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Decision</th><th>Risk</th><th>Category</th><th>Domain</th><th>Consent</th><th>Reason</th><th>When</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="py-3"><StatusBadge value={check.decision} /></td>
                <td><RiskLevel level={check.riskLevel} /></td>
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
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
