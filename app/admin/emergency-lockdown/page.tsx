"use client";

import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { Activity, AlertTriangle, Ban, Check, Lock, ShieldAlert, Unlock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";

interface LockdownState {
  enabled: boolean;
  policyVersion: number;
  reason: string | null;
  enabledAt: string | null;
}

export default function EmergencyLockdownPage() {
  const [lockdown, setLockdown] = useState<LockdownState>({
    enabled: false,
    policyVersion: 0,
    reason: null,
    enabledAt: null,
  });
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/admin/emergency-lockdown", { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setLockdown(data.lockdown);
          if (data.lockdown.reason) setReason(data.lockdown.reason);
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("Failed to fetch lockdown state:", error);
      }
    })();
    return () => controller.abort();
  }, []);

  async function toggleLockdown(enable: boolean) {
    if (enable && !reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason for enabling lockdown" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/emergency-lockdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enable,
          reason: enable ? reason.trim() : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLockdown(data.lockdown);
        setMessage({
          type: "success",
          text: enable
            ? `Emergency lockdown enabled. Policy v${data.lockdown.policyVersion} pushed to all extensions.`
            : "Emergency lockdown disabled. Normal policies restored.",
        });
        if (!enable) setReason("");
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update lockdown state" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    /**
     * Page shell.
     *
     * Was `container mx-auto py-8 px-4 max-w-4xl` — a fourth distinct page-width
     * convention in this codebase, alongside `.container-page`, `.container-docs`,
     * and the dashboard grid. `.container-page` is the shared one.
     *
     * The light-mode remnants fixed here are the same class of bug documented in
     * app/admin/fleet/page.tsx: `text-muted-foreground` generates no CSS in this
     * project (there is no shadcn token layer), and `bg-red-50` / `text-red-800` /
     * `text-green-600` are light-theme values that render as near-white blocks or
     * illegibly dark text on `--surface-0`.
     */
    <div className="container-page max-w-4xl py-8">
      <PageHeader
        eyebrow="Incident response"
        title="Emergency lockdown control"
        icon={ShieldAlert}
        description="Instantly block all high-risk AI destinations across your organization when a security incident is detected."
        status={
          lockdown.enabled ? (
            <span className="badge-danger">Active</span>
          ) : (
            <span className="badge-neutral">Standby</span>
          )
        }
      />

      {lockdown.enabled && (
        <div className="danger-card mb-6" role="status">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-200">Emergency lockdown active</p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="text-rose-200/70">Enabled</dt>
                <dd>{lockdown.enabledAt ? new Date(lockdown.enabledAt).toLocaleString() : "Unknown"}</dd>
                <dt className="text-rose-200/70">Policy version</dt>
                <dd data-numeric>{lockdown.policyVersion}</dd>
                <dt className="text-rose-200/70">Reason</dt>
                <dd>{lockdown.reason || "No reason provided"}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* `role="status"` + aria-live: the outcome of enabling a lockdown must be
          announced, not only recoloured. */}
      {message && (
        <div
          className={message.type === "success" ? "tip-card mb-6" : "danger-card mb-6"}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6">
        <section className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-slate-100">
              <Activity size={16} aria-hidden="true" className="text-slate-400" />
              Current status
            </h2>
            <p className="mt-1 text-sm text-slate-400">Emergency lockdown protection status</p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Lockdown status</p>
                <p className={`text-2xl font-semibold ${lockdown.enabled ? "text-rose-300" : "text-emerald-300"}`}>
                  {lockdown.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Policy version</p>
                <p data-numeric className="font-mono text-xl text-slate-100">
                  {lockdown.policyVersion}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="font-semibold text-slate-100">Lockdown controls</h2>
            <p className="mt-1 text-sm text-slate-400">
              Enable or disable emergency lockdown for all enrolled extensions
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="label" htmlFor="reason">
                Reason for lockdown
              </label>
              <textarea
                id="reason"
                placeholder="e.g., Detected credential leak in #engineering Slack channel. Blocking all public AI access until investigation complete."
                value={reason}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)}
                disabled={loading}
                rows={4}
                className="input mt-2 min-h-24 w-full"
              />
              <p className="field-hint mt-2">
                This reason will be shown to employees when they attempt to use blocked AI tools.
              </p>
            </div>

            <div className="flex gap-4">
              {!lockdown.enabled ? (
                <button onClick={() => toggleLockdown(true)} disabled={loading} className="button-danger flex-1">
                  <Lock size={15} aria-hidden="true" />
                  {loading ? "Enabling…" : "Enable emergency lockdown"}
                </button>
              ) : (
                <button onClick={() => toggleLockdown(false)} disabled={loading} className="button-secondary flex-1">
                  <Unlock size={15} aria-hidden="true" />
                  {loading ? "Disabling…" : "Disable emergency lockdown"}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="font-semibold text-slate-100">What happens during lockdown</h2>
          </div>
          <div className="p-4">
            {/* Data-driven so "blocks" vs "still allowed" is a property of each
                item rather than a colour hand-typed five times — the previous
                version used red/green/blue bullets with no legend. */}
            <ul className="space-y-2.5 text-sm">
              {LOCKDOWN_EFFECTS.map((effect) => (
                <li key={effect.text} className="flex items-start gap-2.5">
                  {effect.blocks ? (
                    <Ban size={14} aria-hidden="true" className="mt-1 shrink-0 text-rose-400" />
                  ) : (
                    <Check size={14} aria-hidden="true" className="mt-1 shrink-0 text-emerald-400" />
                  )}
                  <span className="text-slate-300">{effect.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Effects of an active lockdown. `blocks` drives the icon and its tone. */
const LOCKDOWN_EFFECTS: Array<{ text: string; blocks: boolean }> = [
  { text: "All public AI tools (ChatGPT, Claude, Gemini, etc.) are blocked", blocks: true },
  { text: "File uploads to any destination are blocked", blocks: true },
  { text: "Unknown AI destinations are automatically blocked", blocks: true },
  { text: "Enterprise-approved AI tools remain accessible (if configured)", blocks: false },
  { text: "Policy syncs every 30 seconds instead of 15 minutes, for rapid updates", blocks: false },
];
