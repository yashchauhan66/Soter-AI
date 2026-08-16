import { KeyRound, Globe, Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { listCredentials, getCredentialAccessLogs } from "@/lib/credentials/vault";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, _projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "credentials:read");

  const orgId = project.organizationId ?? "";
  const [credentials, accessLogs] = await Promise.all([
    listCredentials(orgId),
    getCredentialAccessLogs(orgId, 10),
  ]);

  const expiryThreshold = new Date(new Date().getTime() + 7 * 86400_000);
  const activeCredentials = credentials.filter((c) => c.status === "ACTIVE");
  const expiringCredentials = credentials.filter(
    (c) => c.expiresAt && c.expiresAt < expiryThreshold,
  );

  return (
    <div className="space-y-7">
      <FeatureGuide
        eyebrow="Secrets management"
        title="MCP Credential Vault"
        description="Securely store and manage credentials for MCP servers, tool integrations, and AI services. Secrets are encrypted at rest with AES-256-GCM and never exposed in logs or API responses."
        useCase="AI agents and MCP servers need credentials to reach the tools they operate. Scattering those secrets across env files and configs makes rotation painful and leaks likely. The vault centralizes them, keeps only an encrypted value plus a short preview, and records every access so you have a full audit trail."
        howItWorks={[
          { heading: "Store a credential", body: "Register an MCP server or tool credential with its server URL and secret. The secret is encrypted with AES-256-GCM before it is written; only a short preview is ever shown." },
          { heading: "Access is audited", body: "Every read, use, and rotation is logged with success or failure so you can see who or what touched each credential and when." },
          { heading: "Rotate on schedule", body: "Rotate secrets in place without changing references. Credentials expiring within 7 days are flagged so you can rotate before they lapse." },
          { heading: "Revoke when done", body: "Revoke a credential to disable it immediately. Its status moves out of ACTIVE and it can no longer be used." },
        ]}
        integrationCode={`// Store an MCP server credential (server-side only)
const res = await fetch("https://soterai.in/api/credentials", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.SOTER_API_KEY}\`,
  },
  body: JSON.stringify({
    projectId: "your-project-id",
    name: "GitHub MCP token",
    serverUrl: "https://api.githubcopilot.com/mcp/",
    secret: process.env.GITHUB_MCP_TOKEN,
  }),
});`}
        callout="Secret values are never returned by the list or access-log APIs — only an encrypted record and a short preview. Rotate a credential to change its value."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <KeyRound className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">Active credentials</p>
          <p className="mt-1 text-2xl font-bold">{activeCredentials.length}</p>
        </div>
        <div className="card p-5">
          <Globe className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">Total stored</p>
          <p className="mt-1 text-2xl font-bold">{credentials.length}</p>
        </div>
        <div className="card p-5">
          <Clock className={`mb-2 ${expiringCredentials.length > 0 ? "text-amber-300" : "text-slate-300"}`} size={20} />
          <p className="text-sm text-slate-200">Expiring soon</p>
          <p className="mt-1 text-2xl font-bold">{expiringCredentials.length}</p>
        </div>
      </div>

      {expiringCredentials.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          {expiringCredentials.length} credential(s) expiring within 7 days. Rotate them
          before they expire.
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Stored credentials</h2>
        <div className="space-y-2">
          {credentials.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-300">
                No credentials stored yet. Add an MCP server credential to get started.
              </p>
            </div>
          )}
          {credentials.map((cred) => (
            <div className="card flex items-center justify-between p-4" key={cred.id}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{cred.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      cred.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-600/30 text-slate-200"
                    }`}
                  >
                    {cred.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  {cred.serverUrl} · Preview: {cred.preview}
                </p>
                {cred.lastUsedAt && (
                  <p className="text-xs text-slate-600">
                    Last used: {cred.lastUsedAt.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cred.expiresAt && (
                  <span className="text-xs text-slate-300">
                    Expires {cred.expiresAt.toLocaleDateString()}
                  </span>
                )}
                <Link
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                  href={`/dashboard/credentials/${cred.id}?project=${project.id}`}
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Access log</h2>
        <div className="space-y-2">
          {accessLogs.length === 0 && (
            <p className="text-sm text-slate-300">No access recorded yet.</p>
          )}
          {accessLogs.map((log) => (
            <div
              className="card flex items-center justify-between p-3 text-sm"
              key={log.id}
            >
              <div>
                <p className="font-medium">
                  {log.action} · {log.vault.name}
                </p>
                <p className="text-xs text-slate-300">{log.createdAt.toLocaleString()}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  log.success
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {log.success ? "Success" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Add a credential</h2>
        <p className="mt-1 text-sm text-slate-200">
          Store a new MCP server or tool credential. Secrets are encrypted with
          AES-256-GCM and never exposed in plaintext.
        </p>
        <Link
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90"
          href={`/dashboard/credentials/new?project=${project.id}`}
        >
          <ShieldCheck size={16} />
          Add credential
        </Link>
      </div>
    </div>
  );
}
