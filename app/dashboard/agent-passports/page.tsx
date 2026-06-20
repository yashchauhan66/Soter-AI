import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { revokeDashboardAgentPassport } from "./actions";

export const dynamic = "force-dynamic";

type IdentityRow = {
  id: string;
  name: string;
  agentType: string;
  description: string | null;
  status: string;
  createdAt: Date;
};

type PassportRow = {
  id: string;
  sessionId: string;
  status: string;
  agentName: string;
  agentType: string;
  allowedToolsJson: unknown;
  blockedToolsJson: unknown;
  approvalRequiredToolsJson: unknown;
  allowedDomainsJson: unknown;
  blockedDomainsJson: unknown;
  riskScore: number;
  riskLevel: string;
  expiresAt: Date;
  createdAt: Date;
};

type AuditRow = {
  id: string;
  action: string;
  decision: string;
  reason: string;
  createdAt: Date;
  agentName: string;
  sessionId: string;
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300",
  DISABLED: "bg-slate-500/10 text-slate-300",
  QUARANTINED: "bg-red-400/10 text-red-300",
  REVOKED: "bg-red-400/10 text-red-300",
  EXPIRED: "bg-amber-400/10 text-amber-300",
};

export default async function AgentPassportsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [identities, passports, audits] = await Promise.all([
    safeRows<IdentityRow>`SELECT "id", "name", "agentType", "description", "status", "createdAt" FROM "AgentIdentity" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
    safeRows<PassportRow>`
      SELECT p."id", p."sessionId", p."status", p."allowedToolsJson", p."blockedToolsJson", p."approvalRequiredToolsJson",
        p."allowedDomainsJson", p."blockedDomainsJson", p."riskScore", p."riskLevel", p."expiresAt", p."createdAt",
        i."name" AS "agentName", i."agentType"
      FROM "AgentSessionPassport" p
      INNER JOIN "AgentIdentity" i ON i."id" = p."agentIdentityId" AND i."projectId" = p."projectId"
      WHERE p."projectId" = ${project.id}
      ORDER BY p."createdAt" DESC
      LIMIT 100
    `,
    safeRows<AuditRow>`
      SELECT a."id", a."action", a."decision", a."reason", a."createdAt", i."name" AS "agentName", p."sessionId"
      FROM "AgentPassportAudit" a
      INNER JOIN "AgentIdentity" i ON i."id" = a."agentIdentityId" AND i."projectId" = a."projectId"
      INNER JOIN "AgentSessionPassport" p ON p."id" = a."sessionPassportId" AND p."projectId" = a."projectId"
      WHERE a."projectId" = ${project.id}
      ORDER BY a."createdAt" DESC
      LIMIT 50
    `,
  ]);

  const { now, activePassports, highRisk } = computePassportStats(passports);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Agent passports</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Issue scoped identities and session passports before agents can use tools, memory, domains, or data scopes.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Agent identities" value={identities.length} tone="gray" />
        <Metric label="Active passports" value={activePassports.length} tone="green" />
        <Metric label="High risk sessions" value={highRisk} tone="red" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Session passports</h2>
          <span className="text-xs font-medium text-slate-500">{passports.length} total</span>
        </div>
        <table className="mt-4 w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Agent</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Allowed tools</th>
              <th>Blocked tools</th>
              <th>Domains</th>
              <th>Expires</th>
              <th>Session</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {passports.map((passport) => {
              const status = passport.status === "ACTIVE" && passport.expiresAt.getTime() <= now ? "EXPIRED" : passport.status;
              return (
                <tr key={passport.id}>
                  <td className="py-3">
                    <p className="font-medium">{passport.agentName}</p>
                    <p className="text-xs text-slate-500">{passport.agentType}</p>
                  </td>
                  <td><StatusPill value={status} /></td>
                  <td>
                    <p className={`font-semibold ${RISK_TONE[passport.riskLevel] ?? "text-slate-300"}`}>{passport.riskLevel}</p>
                    <p className="text-xs text-slate-500">{passport.riskScore}/100</p>
                  </td>
                  <td className="max-w-[180px] text-xs text-slate-400">{formatList(passport.allowedToolsJson)}</td>
                  <td className="max-w-[180px] text-xs text-slate-400">{formatList(passport.blockedToolsJson)}</td>
                  <td className="max-w-[180px] text-xs text-slate-400">
                    <span className="text-emerald-300">{formatList(passport.allowedDomainsJson)}</span>
                    <span className="mx-1 text-slate-600">/</span>
                    <span className="text-red-300">{formatList(passport.blockedDomainsJson)}</span>
                  </td>
                  <td>{passport.expiresAt.toLocaleString()}</td>
                  <td className="font-mono text-xs">{passport.sessionId}</td>
                  <td>
                    {status === "ACTIVE" ? (
                      <form action={revokeDashboardAgentPassport}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="passportId" value={passport.id} />
                        <input type="hidden" name="reason" value="Revoked from Agent Passports dashboard." />
                        <button className="rounded border border-red-400/40 px-3 py-1 text-xs font-medium text-red-200 transition hover:bg-red-400/10" type="submit">
                          Revoke
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {passports.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={9}>No agent session passports issued yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agent identities</h2>
            <span className="text-xs font-medium text-slate-500">{identities.length} total</span>
          </div>
          <div className="mt-4 grid gap-3">
            {identities.map((identity) => (
              <div className="rounded-lg border border-slate-800 p-3 text-sm" key={identity.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{identity.name}</p>
                    <p className="text-xs text-slate-500">{identity.agentType}</p>
                  </div>
                  <StatusPill value={identity.status} />
                </div>
                {identity.description && <p className="mt-2 line-clamp-2 text-slate-400">{identity.description}</p>}
                <p className="mt-2 text-xs text-slate-500">Created {identity.createdAt.toLocaleString()}</p>
              </div>
            ))}
            {identities.length === 0 && <p className="text-sm text-slate-500">Create an agent identity through the API to begin issuing passports.</p>}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Passport audit events</h2>
            <span className="text-xs font-medium text-slate-500">{audits.length} recent</span>
          </div>
          <div className="mt-4 space-y-3">
            {audits.map((audit) => (
              <div className="grid gap-2 rounded-lg border border-slate-800 p-3 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center" key={audit.id}>
                <StatusPill value={audit.decision} />
                <div>
                  <p className="font-medium">{audit.action} - {audit.agentName}</p>
                  <p className="text-slate-400">{audit.reason}</p>
                  <p className="mt-1 font-mono text-xs text-slate-600">{audit.sessionId}</p>
                </div>
                <p className="text-xs text-slate-500">{audit.createdAt.toLocaleString()}</p>
              </div>
            ))}
            {audits.length === 0 && <p className="text-sm text-slate-500">No passport audit events recorded yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "gray" }) {
  const tones = { green: "text-emerald-300", red: "text-red-300", gray: "text-slate-300" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_TONE[value] ?? "bg-slate-700 text-slate-300"}`}>{value}</span>;
}

function formatList(value: unknown) {
  const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  if (items.length === 0) return "-";
  if (items.length <= 3) return items.join(", ");
  return `${items.slice(0, 3).join(", ")} +${items.length - 3}`;
}

function computePassportStats(passports: PassportRow[]) {
  const now = Date.now();
  const activePassports = passports.filter((passport) => passport.status === "ACTIVE" && passport.expiresAt.getTime() > now);
  const highRisk = passports.filter((passport) => ["HIGH", "CRITICAL"].includes(passport.riskLevel)).length;
  return { now, activePassports, highRisk };
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
