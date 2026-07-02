"use client";

import { useCallback, useEffect, useState } from "react";
import { Plug, RefreshCw, Send, RotateCcw, Trash2 } from "lucide-react";
import type { Organization } from "@prisma/client";

const SIEM_WEBHOOK_EVENT_TYPES = [
  "EXTENSION_HEARTBEAT",
  "PROMPT_BLOCKED",
  "PROMPT_REDACTED",
  "PROMPT_REWRITTEN",
  "APPROVAL_REQUESTED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "SHADOW_AI_DISCOVERED",
  "EMERGENCY_LOCKDOWN_ENABLED",
  "EMERGENCY_LOCKDOWN_DISABLED",
] as const;

type SiemWebhookEventType = (typeof SIEM_WEBHOOK_EVENT_TYPES)[number];

interface Integration {
  id: string;
  name: string;
  endpointUrl: string;
  enabled: boolean;
  eventTypes: SiemWebhookEventType[];
  secretPreview: string | null;
  createdAt: string;
}

interface Delivery {
  id: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: string;
  event: { eventType: string; severity: string; createdAt: string };
}

export function SiemWebhooksClient({ organizations }: { organizations: Pick<Organization, "id" | "name">[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [form, setForm] = useState({
    name: "Security webhook",
    endpointUrl: "",
    secret: "",
    enabled: true,
    eventTypes: [...SIEM_WEBHOOK_EVENT_TYPES] as SiemWebhookEventType[],
  });

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/siem-webhooks?organizationId=${encodeURIComponent(organizationId)}`);
    if (response.ok) {
      const body = await response.json() as { integrations: Integration[] };
      setIntegrations(body.integrations);
      setSelectedId((current) => current ?? body.integrations[0]?.id ?? null);
    }
  }, [organizationId]);

  const loadDeliveries = useCallback(async (webhookId: string) => {
    const response = await fetch(`/api/admin/siem-webhooks/${webhookId}/deliveries`);
    if (response.ok) setDeliveries(((await response.json()) as { deliveries: Delivery[] }).deliveries);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, organizationId]);

  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeliveries(selectedId);
  }, [selectedId, loadDeliveries]);

  const toggleEvent = (eventType: SiemWebhookEventType) => {
    setForm((current) => ({
      ...current,
      eventTypes: current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((value) => value !== eventType)
        : [...current.eventTypes, eventType],
    }));
  };

  const create = async () => {
    const response = await fetch("/api/admin/siem-webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, organizationId }),
    });
    if (response.ok) await load();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/siem-webhooks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) await load();
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/admin/siem-webhooks/${id}`, { method: "DELETE" });
    if (response.ok) {
      setSelectedId(null);
      await load();
    }
  };

  const test = async (id: string) => {
    const response = await fetch(`/api/admin/siem-webhooks/${id}/test`, { method: "POST" });
    if (response.ok) await loadDeliveries(id);
  };

  const retry = async (id: string) => {
    const response = await fetch(`/api/admin/siem-webhooks/${id}/retry`, { method: "POST" });
    if (response.ok) await loadDeliveries(id);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold"><Plug className="text-cyan" size={24} /> SIEM Webhooks</h1>
          <p className="mt-1 text-sm text-slate-400">Tenant-scoped signed webhook export with redacted payloads and delivery logs.</p>
        </div>
        <button className="rounded-md border border-slate-700 p-2 text-slate-300" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[0.9fr_1.3fr]">
        <section className="rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Add Webhook</h2>
          <div className="grid gap-3">
            <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="https://siem.example.com/ingest" value={form.endpointUrl} onChange={(event) => setForm({ ...form, endpointUrl: event.target.value })} />
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="HMAC secret" type="password" value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled
            </label>
            <div className="grid max-h-52 gap-2 overflow-auto rounded-md border border-slate-800 p-3">
              {SIEM_WEBHOOK_EVENT_TYPES.map((eventType) => (
                <label key={eventType} className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={form.eventTypes.includes(eventType)} onChange={() => toggleEvent(eventType)} /> {eventType}
                </label>
              ))}
            </div>
            <button className="rounded-md bg-cyan px-4 py-2 text-sm font-bold text-slate-950" onClick={create}>Add webhook</button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Configured Webhooks</h2>
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div key={integration.id} className={`rounded-md border p-3 ${selectedId === integration.id ? "border-cyan/70" : "border-slate-800"}`}>
                <button className="block w-full text-left" onClick={() => setSelectedId(integration.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-200">{integration.name}</span>
                    <span className={integration.enabled ? "text-lime" : "text-slate-500"}>{integration.enabled ? "enabled" : "disabled"}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{integration.endpointUrl}</p>
                  <p className="mt-1 text-xs text-slate-500">{integration.eventTypes.length} event types · secret {integration.secretPreview ? "set" : "not set"}</p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => patch(integration.id, { enabled: !integration.enabled })}>{integration.enabled ? "Disable" : "Enable"}</button>
                  <button className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => test(integration.id)}><Send size={13} /> Test</button>
                  <button className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => retry(integration.id)}><RotateCcw size={13} /> Retry</button>
                  <button className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-xs text-red-300" onClick={() => remove(integration.id)}><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Delivery Logs</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-3">Event</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Attempts</th><th className="px-3 py-3">HTTP</th><th className="px-3 py-3">Error</th><th className="px-3 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-3 py-3 text-slate-200">{delivery.event.eventType}</td>
                  <td className="px-3 py-3">{delivery.status}</td>
                  <td className="px-3 py-3 text-slate-400">{delivery.attempts}</td>
                  <td className="px-3 py-3 text-slate-400">{delivery.responseCode ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-500">{delivery.errorMessage ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-500">{new Date(delivery.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
