"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Plus, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import { formatDate } from "@/lib/utils";

const ALL_EVENTS = [
  "guard.prompt_injection.blocked",
  "guard.jailbreak.detected",
  "guard.secret.detected",
  "guard.pii.redacted",
  "guard.system_prompt_leak.blocked",
  "guard.unsafe_output.blocked",
  "usage.limit.warning",
  "usage.limit.exceeded",
] as const;

type Project = { id: string; name: string };
type Endpoint = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  secretPreview: string;
  projectId: string;
  createdAt: string | Date;
  project: { name: string };
  _count: { deliveries: number };
};
type Delivery = {
  id: string;
  event: string;
  status: string;
  responseCode: number | null;
  attempts: number;
  errorMessage: string | null;
  createdAt: string | Date;
};

export function WebhookManager({ projects, endpoints }: { projects: Project[]; endpoints: Endpoint[] }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(endpoints[0]?.id ?? "");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingId, setLoadingId] = useState("");
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/webhooks/deliveries?endpointId=${encodeURIComponent(activeId)}`)
      .then((response) => response.json())
      .then((data) => Array.isArray(data) ? setDeliveries(data) : setDeliveries([]))
      .catch(() => setDeliveries([]));
  }, [activeId, endpoints.length]);

  async function createEndpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const form = new FormData(event.currentTarget);
      const events = ALL_EVENTS.filter((name) => form.get(`event:${name}`));
      if (!events.length) throw new Error("Select at least one event.");
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.get("projectId"),
          url: form.get("url"),
          description: form.get("description") || undefined,
          events,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not create webhook.");
      setRevealed({ id: data.id, secret: data.signingSecret });
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create webhook.");
    } finally {
      setCreating(false);
    }
  }

  async function rotate(id: string) {
    setLoadingId(id);
    setError("");
    try {
      const response = await fetch("/api/webhooks/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Rotate failed.");
      setRevealed({ id, secret: data.signingSecret });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rotate failed.");
    } finally {
      setLoadingId("");
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setLoadingId(id);
    try {
      await fetch("/api/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      router.refresh();
    } finally {
      setLoadingId("");
    }
  }

  async function remove(id: string) {
    setLoadingId(id);
    try {
      await fetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setLoadingId("");
    }
  }

  async function sendTest(id: string) {
    setLoadingId(id);
    setTestStatus(null);
    try {
      const response = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setTestStatus({ id, ok: false, message: data.message ?? "Test failed." });
      } else if (data.success) {
        setTestStatus({ id, ok: true, message: `Delivered (HTTP ${data.status}).` });
      } else {
        setTestStatus({ id, ok: false, message: data.error ?? "Test delivery failed." });
      }
      router.refresh();
    } finally {
      setLoadingId("");
    }
  }

  async function copySecret() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-7">
      {!projects.length && (
        <div className="card p-6 text-sm text-amber-200">
          <p className="font-semibold">Create a project first.</p>
          <p className="mt-2 text-amber-200/80">Webhooks are scoped to a project. Add a project, then return here.</p>
        </div>
      )}

      <form onSubmit={createEndpoint} className="card grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <input name="url" required className="input" placeholder="https://example.com/webhooks/cyberrakshak" />
          <select name="projectId" required className="input" defaultValue={projects[0]?.id ?? ""}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <input name="description" className="input" maxLength={200} placeholder="Description (optional)" />
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Events</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_EVENTS.map((name) => (
              <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 hover:border-cyan/50">
                <input type="checkbox" name={`event:${name}`} defaultChecked={name.startsWith("guard.")} className="h-4 w-4 accent-cyan" />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
        <button disabled={creating || !projects.length} className="button-primary gap-2 self-start">
          <Plus size={16} /> {creating ? "Creating..." : "Add webhook"}
        </button>
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </form>

      {revealed && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-semibold text-amber-200">Signing secret. Copy it now. It will not be shown again.</p>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm">{revealed.secret}</code>
            <button type="button" className="button-secondary !px-4" onClick={copySecret} aria-label="Copy signing secret">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}

      {!endpoints.length ? (
        <div className="card p-10 text-center">
          <Webhook className="mx-auto text-slate-700" size={42} />
          <p className="mt-4 font-semibold">No webhooks yet</p>
          <p className="mt-2 text-sm text-slate-500">Add an HTTPS endpoint to receive guard event notifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className={`card p-5 ${activeId === endpoint.id ? "border-cyan/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm">{endpoint.url}</p>
                  <p className="mt-1 text-xs text-slate-500">{endpoint.project.name} · created {formatDate(endpoint.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-600">Secret: <code>{endpoint.secretPreview}</code></p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${endpoint.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                    {endpoint.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                  <button onClick={() => sendTest(endpoint.id)} disabled={loadingId === endpoint.id} className="button-secondary !px-3 !py-2 text-xs gap-1">
                    <Send size={14} /> Test
                  </button>
                  <button onClick={() => rotate(endpoint.id)} disabled={loadingId === endpoint.id} className="button-secondary !px-3 !py-2 text-xs gap-1">
                    <RefreshCw size={14} /> Rotate
                  </button>
                  <button onClick={() => toggle(endpoint.id, endpoint.isActive)} disabled={loadingId === endpoint.id} className="button-secondary !px-3 !py-2 text-xs">
                    {endpoint.isActive ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(endpoint.id)} disabled={loadingId === endpoint.id} className="button-secondary !px-3 !py-2 text-xs text-red-300 gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {endpoint.events.map((name) => (
                  <span key={name} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300">{name}</span>
                ))}
              </div>
              {testStatus?.id === endpoint.id && (
                <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs ${testStatus.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {testStatus.message}
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveId(endpoint.id)}
                className="mt-3 text-xs text-cyan hover:underline"
              >
                {activeId === endpoint.id ? "Hide deliveries" : "View recent deliveries"}
              </button>
              {activeId === endpoint.id && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">HTTP</th>
                        <th className="px-3 py-2">Attempts</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {deliveries.length ? deliveries.map((delivery) => (
                        <tr key={delivery.id}>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatDate(delivery.createdAt)}</td>
                          <td className="px-3 py-2">{delivery.event}</td>
                          <td className="px-3 py-2">
                            <span className={delivery.status === "SUCCESS" ? "text-emerald-300" : delivery.status === "FAILED" ? "text-red-300" : "text-slate-400"}>
                              {delivery.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">{delivery.responseCode ?? "-"}</td>
                          <td className="px-3 py-2">{delivery.attempts}</td>
                          <td className="max-w-72 truncate px-3 py-2 text-slate-500">{delivery.errorMessage ?? "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No deliveries yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
