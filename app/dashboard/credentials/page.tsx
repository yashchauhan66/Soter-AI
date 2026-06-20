import { KeyRound, Globe, Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { listCredentials, getCredentialAccessLogs } from "@/lib/credentials/vault";

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
      <div>
        <p className="eyebrow">Secrets management</p>
        <h1 className="mt-2 text-3xl font-bold">MCP Credential Vault</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Securely store and manage credentials for MCP servers, tool integrations,
          and AI services. Secrets are encrypted at rest and never exposed in logs
          or API responses. Every access is audited.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <KeyRound className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Active credentials</p>
          <p className="mt-1 text-2xl font-bold">{activeCredentials.length}</p>
        </div>
        <div className="card p-5">
          <Globe className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Total stored</p>
          <p className="mt-1 text-2xl font-bold">{credentials.length}</p>
        </div>
        <div className="card p-5">
          <Clock className={`mb-2 ${expiringCredentials.length > 0 ? "text-amber-300" : "text-slate-500"}`} size={20} />
          <p className="text-sm text-slate-400">Expiring soon</p>
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
              <p className="text-sm text-slate-500">
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
                        : "bg-slate-600/30 text-slate-400"
                    }`}
                  >
                    {cred.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
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
                  <span className="text-xs text-slate-500">
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
            <p className="text-sm text-slate-500">No access recorded yet.</p>
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
                <p className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</p>
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
        <p className="mt-1 text-sm text-slate-400">
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
