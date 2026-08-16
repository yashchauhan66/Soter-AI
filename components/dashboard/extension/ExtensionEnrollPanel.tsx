"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome, Copy, Download, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/MetricCard";

interface TokenRow {
  id: string;
  employeeEmail: string | null;
  department: string | null;
  role: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

function tokenStatus(t: TokenRow): string {
  if (t.revokedAt) return "REVOKED";
  if (new Date(t.expiresAt).getTime() <= Date.now()) return "EXPIRED";
  if (t.usedCount >= t.maxUses) return "USED_UP";
  return "ACTIVE";
}

export function ExtensionEnrollPanel({
  organizationId,
  initialTokens,
}: {
  organizationId: string;
  initialTokens: TokenRow[];
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [maxUses, setMaxUses] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setCode(null);
    try {
      const res = await fetch("/api/dashboard/extension/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          maxUses,
          expiresInDays,
          department: department.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to create enrollment code.");
      setCode(data.enrollmentCode);
      setTokens((prev) => [{ ...data.token, revokedAt: null }, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create enrollment code.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/dashboard/extension/tokens/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error();
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t)));
      router.refresh();
    } catch {
      setError("Could not revoke that code.");
    }
  }

  function copyCode() {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-cyan" />
        <h2 className="text-lg font-semibold">Install &amp; enroll</h2>
      </div>
      <p className="mt-1 text-sm text-slate-200">
        Install the extension, then connect each browser to your organization with a one-time enrollment code.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Install */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Step 1 · Install</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://chromewebstore.google.com/"
              target="_blank"
              rel="noreferrer"
              className="button-secondary !px-4 !py-2 text-sm"
            >
              <Chrome size={15} className="mr-2" /> Chrome Web Store
            </a>
            <a href="/downloads/soter-extension.zip" className="button-primary !px-4 !py-2 text-sm" download>
              <Download size={15} className="mr-2" /> Download .zip
            </a>
          </div>
          <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-slate-200">
            <li>Download and unzip the extension package.</li>
            <li>
              Open <code className="text-slate-300">chrome://extensions</code> and enable{" "}
              <span className="text-slate-300">Developer mode</span>.
            </li>
            <li>Click <span className="text-slate-300">Load unpacked</span> and select the unzipped folder.</li>
            <li>Pin the SoterAI icon, then enroll with the code from Step 2.</li>
          </ol>
        </div>

        {/* Enroll */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Step 2 · Generate enrollment code</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-200">
              Max uses
              <input
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="input mt-1 !px-3 !py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-200">
              Expires (days)
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="input mt-1 !px-3 !py-2 text-sm"
              />
            </label>
            <label className="col-span-2 text-xs text-slate-200">
              Department (optional)
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="input mt-1 !px-3 !py-2 text-sm"
              />
            </label>
          </div>
          <button onClick={generate} disabled={busy} className="button-primary mt-3 w-full !py-2 text-sm">
            {busy ? <Loader2 size={15} className="mr-2 animate-spin" /> : <KeyRound size={15} className="mr-2" />}
            Generate enrollment code
          </button>

          {code && (
            <div className="mt-3 rounded-lg border border-cyan/30 bg-cyan/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan">
                Copy now — shown only once
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-slate-950/70 px-2 py-1.5 text-xs text-slate-200">
                  {code}
                </code>
                <button onClick={copyCode} className="button-secondary !px-3 !py-1.5 text-xs">
                  <Copy size={13} className="mr-1" /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      </div>

      {/* Active codes */}
      {tokens.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-300">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Uses</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                const status = tokenStatus(t);
                return (
                  <tr key={t.id} className="border-b border-slate-900 text-slate-300">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-300">{t.id.slice(0, 10)}…</td>
                    <td className="py-2 pr-4">{t.department ?? "—"}</td>
                    <td className="py-2 pr-4">{t.usedCount}/{t.maxUses}</td>
                    <td className="py-2 pr-4">{new Date(t.expiresAt).toLocaleDateString()}</td>
                    <td className="py-2 pr-4"><StatusBadge value={status} /></td>
                    <td className="py-2 text-right">
                      {status === "ACTIVE" && (
                        <button onClick={() => revoke(t.id)} className="text-xs text-red-300 hover:underline">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
