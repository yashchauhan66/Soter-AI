"use client";

import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { AlertTriangle, Lock, Unlock, Activity } from "lucide-react";

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
    } catch (error) {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Emergency Lockdown Control</h1>
        <p className="text-muted-foreground">
          Instantly block all high-risk AI destinations across your organization when a security incident is detected.
        </p>
      </div>

      {lockdown.enabled && (
        <div className="mb-6 rounded-lg border border-red-500 bg-red-50 p-4">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div className="text-red-800">
            <strong>Emergency Lockdown Active</strong>
            <br />
            Enabled: {lockdown.enabledAt ? new Date(lockdown.enabledAt).toLocaleString() : "Unknown"}
            <br />
            Policy Version: {lockdown.policyVersion}
            <br />
            Reason: {lockdown.reason || "No reason provided"}
          </div>
        </div>
      )}

      {message && (
        <div className={`mb-6 rounded-lg border p-4 ${message.type === "success" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
          <div className={message.type === "success" ? "text-green-800" : "text-red-800"}>
            {message.text}
          </div>
        </div>
      )}

      <div className="grid gap-6">
        <div className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity className="h-5 w-5" />
              Current Status
            </h2>
            <p className="text-sm text-slate-400">Emergency lockdown protection status</p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lockdown Status</p>
                <p className={`text-2xl font-bold ${lockdown.enabled ? "text-red-600" : "text-green-600"}`}>
                  {lockdown.enabled ? "ENABLED" : "DISABLED"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Policy Version</p>
                <p className="text-xl font-mono">{lockdown.policyVersion}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="font-semibold">Lockdown Controls</h2>
            <p className="text-sm text-slate-400">Enable or disable emergency lockdown for all enrolled extensions</p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="text-sm font-medium" htmlFor="reason">Reason for Lockdown</label>
              <textarea
                id="reason"
                placeholder="e.g., Detected credential leak in #engineering Slack channel. Blocking all public AI access until investigation complete."
                value={reason}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)}
                disabled={loading}
                rows={4}
                className="input mt-2 min-h-24 w-full"
              />
              <p className="text-sm text-muted-foreground mt-2">
                This reason will be shown to employees when they attempt to use blocked AI tools.
              </p>
            </div>

            <div className="flex gap-4">
              {!lockdown.enabled ? (
                <button onClick={() => toggleLockdown(true)} disabled={loading} className="flex flex-1 items-center justify-center rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
                  <Lock className="mr-2 h-4 w-4" />
                  {loading ? "Enabling..." : "Enable Emergency Lockdown"}
                </button>
              ) : (
                <button onClick={() => toggleLockdown(false)} disabled={loading} className="flex flex-1 items-center justify-center rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
                  <Unlock className="mr-2 h-4 w-4" />
                  {loading ? "Disabling..." : "Disable Emergency Lockdown"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="border-b border-slate-800 p-4">
            <h2 className="font-semibold">What Happens During Lockdown</h2>
          </div>
          <div className="p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>All public AI tools (ChatGPT, Claude, Gemini, etc.) are blocked</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>File uploads to any destination are blocked</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>Unknown AI destinations are automatically blocked</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span>Enterprise-approved AI tools remain accessible (if configured)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>Policy syncs every 30 seconds (instead of 15 minutes) for rapid updates</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
