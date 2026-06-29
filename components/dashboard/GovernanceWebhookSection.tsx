"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Webhook,
} from "lucide-react";

const GOVERNANCE_EVENTS = [
  "governance.enforcement.blocked",
  "governance.enforcement.approval_required",
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
  createdAt: string;
  project: { name: string };
  _count: { deliveries: number };
};

interface GovernanceWebhookSectionProps {
  projects: Project[];
}

export function GovernanceWebhookSection({ projects }: GovernanceWebhookSectionProps) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...GOVERNANCE_EVENTS]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch endpoints that have governance events
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/webhooks");
        const data = await response.json();
        if (Array.isArray(data)) {
          const governanceEndpoints = data.filter((ep: Endpoint) =>
            ep.events?.some((e) => e.startsWith("governance.")),
          );
          setEndpoints(governanceEndpoints);
        }
      } catch {
        // Silent fail — endpoints stay empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setCreating(true);

    try {
      if (!selectedEvents.length) throw new Error("Select at least one governance event.");

      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: (form.elements.namedItem("projectId") as HTMLSelectElement).value,
          url: (form.elements.namedItem("url") as HTMLInputElement).value,
          description: (form.elements.namedItem("description") as HTMLInputElement).value || undefined,
          events: selectedEvents,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not create webhook.");

      setRevealed({ id: data.id, secret: data.signingSecret });
      form.reset();
      router.refresh();

      // Reload endpoints
      const reload = await fetch("/api/webhooks");
      const reloadData = await reload.json();
      if (Array.isArray(reloadData)) {
        setEndpoints(reloadData.filter((ep: Endpoint) =>
          ep.events?.some((e) => e.startsWith("governance.")),
        ));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create webhook.");
    } finally {
      setCreating(false);
    }
  }

  async function removeWebhook(id: string) {
    try {
      await fetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
      router.refresh();
    } catch {
      // Silent
    }
  }

  async function toggleWebhook(id: string, isActive: boolean) {
    try {
      await fetch("/api/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      setEndpoints((prev) =>
        prev.map((ep) => (ep.id === id ? { ...ep, isActive: !isActive } : ep)),
      );
      router.refresh();
    } catch {
      // Silent
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function copySecret() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const hasGovernanceSubscriptions = endpoints.some((ep) =>
    ep.events?.some((e) => GOVERNANCE_EVENTS.includes(e as typeof GOVERNANCE_EVENTS[number])),
  );

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Webhook size={18} className="text-cyan" />
            Webhook Subscriptions
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Receive real-time notifications when governance policy blocks or requires approval for
            AI provider access. Configure full webhook management at{" "}
            <a
              href="/dashboard/webhooks"
              className="text-cyan underline underline-offset-2 hover:text-cyan/80"
            >
              Webhooks
              <ExternalLink size={12} className="ml-0.5 inline" />
            </a>
          </p>
        </div>
      </div>

      {/* Active subscription status */}
      {!loading && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 px-4 py-3 text-sm">
          {hasGovernanceSubscriptions ? (
            <>
              <Bell size={16} className="text-emerald-400" />
              <span className="text-emerald-200">
                Governance notifications active
              </span>
              <span className="text-xs text-slate-500">
                ({endpoints.filter((ep) => ep.isActive).length} endpoint(s))
              </span>
            </>
          ) : (
            <>
              <BellOff size={16} className="text-slate-500" />
              <span className="text-slate-400">No governance webhook subscriptions configured</span>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      )}

      {/* Existing governance webhooks */}
      {!loading && endpoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active endpoints with governance events
          </p>
          {endpoints.map((ep) => {
            const govEvents = ep.events.filter((e) => e.startsWith("governance."));
            return (
              <div
                key={ep.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-slate-300">{ep.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {govEvents.map((ev) => (
                        <span
                          key={ev}
                          className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300"
                        >
                          {ev.replace("governance.enforcement.", "")}
                        </span>
                      ))}
                      {ep.events
                        .filter((e) => !e.startsWith("governance."))
                        .slice(0, 2)
                        .map((ev) => (
                          <span
                            key={ev}
                            className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-500"
                          >
                            {ev}
                          </span>
                        ))}
                      {ep.events.filter((e) => !e.startsWith("governance.")).length > 2 && (
                        <span className="text-[11px] text-slate-600">
                          +{ep.events.filter((e) => !e.startsWith("governance.")).length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        ep.isActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {ep.isActive ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => toggleWebhook(ep.id, ep.isActive)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {ep.isActive ? "Pause" : "Resume"}
                  </button>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={() => removeWebhook(ep.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
                    className="text-xs text-cyan hover:text-cyan/80 transition-colors"
                  >
                    {expandedId === ep.id ? "Hide details" : "Details"}
                  </button>
                  <span className="text-xs text-slate-600">{ep._count.deliveries} deliveries</span>
                </div>

                {expandedId === ep.id && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                    <p>Project: {ep.project.name}</p>
                    <p className="mt-1">Secret: {ep.secretPreview}</p>
                    {ep.description && <p className="mt-1">{ep.description}</p>}
                    <p className="mt-1">
                      Created: {new Date(ep.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1">
                      All events: {ep.events.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && endpoints.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <Webhook size={32} className="mx-auto text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-400">No governance webhooks yet</p>
          <p className="mt-1 text-xs text-slate-600">
            Add a webhook endpoint below to receive governance enforcement notifications.
          </p>
        </div>
      )}

      {/* Create new webhook form */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-cyan hover:text-cyan/80 transition-colors">
          <Plus size={16} className="mr-1 inline" />
          Add governance webhook endpoint
        </summary>
        <form onSubmit={createWebhook} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Endpoint URL</label>
              <input
                name="url"
                type="url"
                required
                placeholder="https://example.com/webhooks/soterai"
                className="input w-full"
                maxLength={2048}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Project</label>
              <select name="projectId" required className="input w-full">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Description (optional)
            </label>
            <input
              name="description"
              placeholder="Governance enforcement alerts"
              className="input w-full max-w-md"
              maxLength={200}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-400">
              Governance events to subscribe to
            </legend>
            <div className="flex flex-wrap gap-3">
              {GOVERNANCE_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedEvents.includes(ev)
                      ? "border-cyan/50 bg-cyan/10 text-cyan-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="h-4 w-4 accent-cyan"
                  />
                  <span>{ev.replace("governance.enforcement.", "")}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={creating || !selectedEvents.length || !projects.length}
            className="button-primary gap-2"
          >
            {creating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Add webhook
              </>
            )}
          </button>

          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
          )}
        </form>
      </details>

      {/* Revealed secret */}
      {revealed && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Signing secret. Copy it now. It will not be shown again.
          </p>
          <div className="mt-2 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm">
              {revealed.secret}
            </code>
            <button
              type="button"
              className="button-secondary !px-4"
              onClick={copySecret}
              aria-label="Copy signing secret"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Link to full webhooks page */}
      <div className="pt-2 text-center text-xs text-slate-600">
        <a
          href="/dashboard/webhooks"
          className="text-cyan underline underline-offset-2 hover:text-cyan/80"
        >
          Manage all webhook endpoints →
        </a>
      </div>
    </section>
  );
}
