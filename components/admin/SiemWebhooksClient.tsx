"use client";

import { useState, useCallback } from "react";
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Send, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  endpointUrl: string;
  enabled: boolean;
  maxAttempts: number;
  deliveryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Delivery {
  id: string;
  eventId: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface Props {
  organizations: Array<{ id: string; name: string }>;
  initialIntegrations: Integration[];
  eventTypes: readonly string[];
}

export function SiemWebhooksClient({ organizations, initialIntegrations, eventTypes }: Props) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([...eventTypes]);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean } | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/siem-webhooks?organizationId=${encodeURIComponent(organizationId)}`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations ?? []);
      }
    } catch { /* ignore */ }
  }, [organizationId]);

  const createIntegration = useCallback(async () => {
    if (!newName || !newUrl || !organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/siem-webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId, name: newName, endpointUrl: newUrl, eventTypes: newEvents,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSigningSecret(data.signingSecret);
        setShowCreate(false);
        setNewName("");
        setNewUrl("");
        await fetchIntegrations();
      } else {
        setError(data.message ?? "Failed to create webhook");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [newName, newUrl, newEvents, organizationId, fetchIntegrations]);

  const toggleIntegration = useCallback(async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/siem-webhooks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    await fetchIntegrations();
  }, [fetchIntegrations]);

  const deleteIntegration = useCallback(async (id: string) => {
    if (!confirm("Delete this webhook integration?")) return;
    await fetch(`/api/admin/siem-webhooks/${id}`, { method: "DELETE" });
    await fetchIntegrations();
  }, [fetchIntegrations]);

  const testWebhook = useCallback(async (id: string) => {
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/siem-webhooks/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ id, ok: data.ok });
    } catch {
      setTestResult({ id, ok: false });
    }
  }, []);

  const loadDeliveries = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const res = await fetch(`/api/admin/siem-webhooks/${id}/deliveries?limit=20`);
      const data = await res.json();
      setDeliveries(data.deliveries ?? []);
    } catch {
      setDeliveries([]);
    }
  }, [expandedId]);

  return (
    <div>
      {signingSecret && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-300">
            <AlertCircle size={16} /> Save your signing secret now — it will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-slate-950 p-3 text-xs text-slate-200">{signingSecret}</code>
          <button className="mt-2 text-xs text-slate-400 underline" onClick={() => setSigningSecret(null)}>Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      <label className="mb-4 block max-w-md text-sm text-slate-300">
        Organization
        <select
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          value={organizationId}
          onChange={(e) => { setOrganizationId(e.target.value); }}
        >
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>

      <div className="mb-6 flex items-center gap-3">
        <button className="button-primary flex items-center gap-2" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> Add Webhook Endpoint
        </button>
        <button className="text-sm text-slate-400 underline" onClick={fetchIntegrations}>Refresh</button>
      </div>

      {showCreate && (
        <div className="card mb-6 p-5">
          <h3 className="font-semibold">Create SIEM Webhook</h3>
          <input className="input mt-3" placeholder="Integration name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="input mt-2" placeholder="https://your-siem.example.com/webhook" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <p className="mt-3 text-xs text-slate-500">Event types:</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {eventTypes.map((et) => (
              <label key={et} className="flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={newEvents.includes(et)}
                  onChange={(e) => setNewEvents(e.target.checked ? [...newEvents, et] : newEvents.filter((x) => x !== et))}
                />
                {et}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="button-primary" disabled={loading || !newName || !newUrl} onClick={createIntegration}>
              {loading ? "Creating..." : "Create"}
            </button>
            <button className="text-sm text-slate-400" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {integrations.length === 0 && (
          <div className="card p-6 text-center text-slate-500">No SIEM webhook integrations configured.</div>
        )}
        {integrations.map((int) => (
          <div key={int.id} className="card overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Webhook size={18} className="text-cyan" />
                <div>
                  <p className="font-medium text-slate-200">{int.name}</p>
                  <p className="text-xs text-slate-500">{new URL(int.endpointUrl).hostname}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {testResult?.id === int.id && (
                  <span className={`text-xs ${testResult.ok ? "text-lime" : "text-red-400"}`}>
                    {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  </span>
                )}
                <button className="rounded p-1 text-slate-400 hover:bg-slate-800" title="Test webhook" onClick={() => testWebhook(int.id)}>
                  <Send size={14} />
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-slate-800" title="Toggle" onClick={() => toggleIntegration(int.id, int.enabled)}>
                  {int.enabled ? <ToggleRight size={18} className="text-lime" /> : <ToggleLeft size={18} className="text-slate-600" />}
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-red-900/40" title="Delete" onClick={() => deleteIntegration(int.id)}>
                  <Trash2 size={14} />
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-slate-800" title="Deliveries" onClick={() => loadDeliveries(int.id)}>
                  {expandedId === int.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
            {expandedId === int.id && (
              <div className="border-t border-slate-800 bg-slate-950/50 p-4">
                <p className="mb-2 text-xs font-medium text-slate-400">Recent deliveries ({deliveries.length})</p>
                {deliveries.length === 0 ? (
                  <p className="text-xs text-slate-600">No deliveries yet.</p>
                ) : (
                  <div className="space-y-1">
                    {deliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{new Date(d.createdAt).toLocaleString()}</span>
                        <span className={d.status === "DELIVERED" ? "text-lime" : d.status === "FAILED" ? "text-red-400" : "text-amber-300"}>
                          {d.status} {d.responseCode ? `(${d.responseCode})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
