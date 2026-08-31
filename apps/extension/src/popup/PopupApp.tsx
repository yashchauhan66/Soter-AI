import type { ExtensionState } from "../lib/types";
import { enrollmentMarkup, enrollmentStatusLabel, escapeHtml, isTrialMode, wireEnrollment } from "../lib/enrollment-ui";
import { isLockdownEnforcing, lockdownRestrictions, responseScanningStatus } from "../lib/scanner";

/**
 * The version shown to the user is read from the manifest, never typed in by hand.
 *
 * The footer said "v0.2.0" while the shipped manifest was 0.2.1, so the one number a user
 * quotes in a support ticket was wrong. Reading the manifest makes it impossible to drift.
 */
function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "";
  }
}

export function renderPopup(root: HTMLElement, state: ExtensionState) {
  const trial = isTrialMode(state);
  const enrolled = state.enrollmentStatus === "enrolled" && !trial;
  const lockdownFlagged = state.policy?.emergencyLockdown?.enabled ?? false;
  const lockdown = isLockdownEnforcing(state);
  const restrictions = lockdownRestrictions(state);
  const responseScanning = responseScanningStatus(state);
  const statusLabel = enrollmentStatusLabel(state);
  const version = extensionVersion();
  const statusColor = lockdown ? "var(--soter-danger)" : enrolled || trial ? "var(--soter-success)" : "var(--soter-warning)";
  const statusBg = lockdown ? "var(--soter-danger-bg)" : enrolled || trial ? "var(--soter-success-bg)" : "var(--soter-warning-bg)";

  root.innerHTML = `
    <style>
      :root {
        --soter-primary: #2563eb;
        --soter-primary-hover: #1d4ed8;
        --soter-primary-light: #eff6ff;
        --soter-success: #059669;
        --soter-success-bg: #ecfdf5;
        --soter-warning: #d97706;
        --soter-warning-bg: #fffbeb;
        --soter-danger: #dc2626;
        --soter-danger-bg: #fef2f2;
        --soter-text: #0f172a;
        --soter-text-secondary: #475569;
        --soter-text-muted: #94a3b8;
        --soter-border: #e2e8f0;
        --soter-bg: #f8fafc;
        --soter-card: #ffffff;
        --soter-radius: 10px;
        --soter-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      }
      * { box-sizing: border-box; }
      body { margin: 0; width: 360px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, ui-sans-serif, system-ui, sans-serif; color: var(--soter-text); background: var(--soter-bg); font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
      .shell { display: flex; flex-direction: column; }
      
      /* Header */
      .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 16px; color: white; }
      .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-icon { width: 32px; height: 32px; background: linear-gradient(135deg, var(--soter-primary), #7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: white; }
      .brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
      .brand-sub { font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
      .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 16px; font-size: 11px; font-weight: 600; background: ${statusBg}; color: ${statusColor}; }
      .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      
      /* Content */
      .content { padding: 14px; display: grid; gap: 12px; }
      
      /* Cards */
      .card { background: var(--soter-card); border: 1px solid var(--soter-border); border-radius: var(--soter-radius); padding: 14px; box-shadow: var(--soter-shadow); }
      .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soter-text-secondary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
      .card-title svg { width: 14px; height: 14px; opacity: 0.7; }
      
      /* Alert */
      .alert { border-radius: var(--soter-radius); padding: 12px 14px; font-size: 12px; font-weight: 600; display: flex; align-items: flex-start; gap: 8px; line-height: 1.55; }
      .alert-danger { background: var(--soter-danger-bg); border: 1px solid #fecaca; color: var(--soter-danger); }
      .alert-warning { background: var(--soter-warning-bg); border: 1px solid #fde68a; color: var(--soter-warning); }
      .alert-icon { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
      
      /* Rows */
      .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--soter-border); font-size: 12px; }
      .row:last-child { border-bottom: none; padding-bottom: 0; }
      .row-label { color: var(--soter-text-secondary); font-weight: 500; }
      .row-value { font-weight: 600; text-align: right; max-width: 55%; overflow-wrap: anywhere; }
      
      /* Buttons */
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; width: 100%; }
      .btn-primary { background: var(--soter-primary); color: white; }
      .btn-primary:hover { background: var(--soter-primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
      .btn-secondary { background: var(--soter-card); color: var(--soter-text); border: 1px solid var(--soter-border); }
      .btn-secondary:hover { background: var(--soter-bg); border-color: #cbd5e1; }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      
      /* Forms */
      .form-group { margin-bottom: 12px; }
      .form-label { display: block; font-size: 11px; font-weight: 600; color: var(--soter-text-secondary); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.03em; }
      .form-input { width: 100%; border: 1.5px solid var(--soter-border); border-radius: 8px; padding: 9px 11px; font-size: 13px; transition: all 0.15s ease; background: var(--soter-card); color: var(--soter-text); }
      .form-input:focus { outline: none; border-color: var(--soter-primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
      
      /* Help & Error */
      .help { color: var(--soter-text-muted); font-size: 11px; line-height: 1.5; margin-top: 6px; }
      .error { color: var(--soter-danger); font-size: 11px; font-weight: 500; margin-top: 6px; }
      
      /* Divider */
      .divider { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
      .divider-line { flex: 1; height: 1px; background: var(--soter-border); }
      .divider-text { font-size: 11px; color: var(--soter-text-muted); font-weight: 500; }
      
      /* Link */
      .link { color: var(--soter-primary); text-decoration: none; font-weight: 600; font-size: 12px; }
      .link:hover { text-decoration: underline; }
      
      /* Footer */
      .footer { padding: 10px 14px; text-align: center; font-size: 10px; color: var(--soter-text-muted); border-top: 1px solid var(--soter-border); background: var(--soter-card); }
      
      /* Enrollment */
      .enrollment h2 { font-size: 14px; font-weight: 700; margin: 0 0 6px; color: var(--soter-text); }
      
      /* Button group */
      .btn-group { display: grid; gap: 8px; margin-top: 10px; }
      
      /* Open sidepanel link */
      .open-panel { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; font-size: 12px; color: var(--soter-primary); font-weight: 600; cursor: pointer; text-decoration: none; border-radius: 8px; transition: background 0.15s ease; }
      .open-panel:hover { background: var(--soter-primary-light); }
    </style>
    <div class="shell">
      <header class="header">
        <div class="header-top">
          <div class="brand">
            <div class="brand-icon">S</div>
            <div>
              <div class="brand-name">Soter Enterprise</div>
              <div class="brand-sub">AI Control Plane</div>
            </div>
          </div>
        </div>
        <span class="status-badge"><span class="status-dot"></span>${escapeHtml(statusLabel)}</span>
      </header>
      
      <div class="content">
        ${lockdown ? `
        <div class="alert alert-danger">
          <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>
            <strong>Emergency lockdown active.</strong> In force right now:
            <br>${restrictions.map((restriction) => escapeHtml(restriction)).join("<br>")}
          </span>
        </div>` : lockdownFlagged ? `
        <div class="alert alert-warning">
          <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Lockdown is switched on in your policy but every restriction in it is turned off, so nothing extra is being blocked. Ask your administrator to configure it.</span>
        </div>` : ""}

        ${!enrolled || trial ? enrollmentMarkup(state) : ""}
        ${enrolled || trial ? `
        <div class="card" data-enrollment-view="${trial ? "trial" : state.enrollmentMode === "managed" ? "managed" : "enrolled"}">
          <div class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${trial ? "Trial Status" : "Organization Status"}
          </div>
          <div class="row"><span class="row-label">Organization</span><span class="row-value">${escapeHtml(state.config.organizationName ?? state.config.organizationId)}</span></div>
          <div class="row"><span class="row-label">Employee</span><span class="row-value">${escapeHtml(state.config.employeeEmail ?? state.config.employeeId)}</span></div>
          <div class="row"><span class="row-label">Department / Role</span><span class="row-value">${escapeHtml([state.config.department, state.config.role].filter(Boolean).join(" / ") || "Not assigned")}</span></div>
          <div class="row"><span class="row-label">Policy Version</span><span class="row-value">${escapeHtml(state.policy?.version ?? "unknown")}</span></div>
          <div class="row"><span class="row-label">Response Scanning</span><span class="row-value">${escapeHtml(responseScanning.label)}</span></div>
          <div class="row"><span class="row-label">Policy Sync</span><span class="row-value">${escapeHtml(syncStatusLabel(state.policySyncStatus))}</span></div>
          <div class="row"><span class="row-label">Last Checked</span><span class="row-value">${escapeHtml(formatTimestamp(state.lastHeartbeatAt))}</span></div>
          <div class="btn-group">
            <button class="btn btn-primary" data-heartbeat>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Check for policy updates
            </button>
          </div>
          <p class="help" data-sync-feedback style="text-align:center;" hidden></p>
        </div>` : ""}

        ${privacySection({ enrolled: enrolled || trial, responseScanningLabel: responseScanning.label, lockdown, lockdownFlagged })}
      </div>

      <footer class="footer">
        Soter Enterprise AI Control Plane${version ? ` v${escapeHtml(version)}` : ""} &middot; <a href="https://soterai.in/privacy" target="_blank" class="link">Privacy</a> &middot; <a href="https://soterai.in/terms" target="_blank" class="link">Terms</a>
      </footer>
    </div>`;

  wireEnrollment(root, (next) => renderPopup(root, next));
  // "Check for policy updates" now reports what happened. It used to re-render silently, so a
  // click on an unchanged policy looked identical to a click that did nothing at all.
  root.querySelector("[data-heartbeat]")?.addEventListener("click", () => {
    const button = root.querySelector<HTMLButtonElement>("[data-heartbeat]");
    const feedback = root.querySelector<HTMLElement>("[data-sync-feedback]");
    const previousVersion = state.policy?.version;
    if (button) { button.disabled = true; button.textContent = "Checking…"; }
    chrome.runtime.sendMessage({ type: "SOTER_SYNC_POLICY" }, (response) => {
      const next = (response as { state?: ExtensionState } | undefined)?.state;
      if (!next) {
        if (button) { button.disabled = false; button.textContent = "Check for policy updates"; }
        if (feedback) { feedback.hidden = false; feedback.textContent = "Could not reach the policy service. Your cached policy is still enforced."; }
        return;
      }
      const changed = next.policy?.version !== previousVersion;
      renderPopup(root, next);
      const freshFeedback = root.querySelector<HTMLElement>("[data-sync-feedback]");
      if (freshFeedback) {
        freshFeedback.hidden = false;
        freshFeedback.textContent = changed
          ? `Updated to policy ${next.policy?.version ?? "unknown"}.`
          : next.policySyncStatus === "offline" || next.policySyncStatus === "error"
            ? "Could not reach the policy service. Your cached policy is still enforced."
            : "Already up to date.";
      }
    });
  });
}

/** Sync status in words a user can act on, not the internal enum value. */
function syncStatusLabel(status: ExtensionState["policySyncStatus"]): string {
  switch (status) {
    case "fresh": return "Up to date";
    case "stale": return "Out of date — will retry";
    case "offline": return "Offline — using cached policy";
    case "error": return "Sync failed — using cached policy";
    case "never": return "Not synced yet";
    default: return status;
  }
}

/** ISO timestamps are unreadable in a status row; show local time plus how long ago. */
function formatTimestamp(value?: string): string {
  if (!value) return "Never";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  const minutes = Math.floor((Date.now() - at.getTime()) / 60000);
  const ago = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`;
  return `${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${ago})`;
}

function privacySection({
  enrolled,
  responseScanningLabel,
  lockdown,
  lockdownFlagged,
}: {
  enrolled: boolean;
  responseScanningLabel: string;
  lockdown: boolean;
  lockdownFlagged: boolean;
}) {
  const rawPromptStatus = enrolled
    ? "No by default. Only explicit admin full-prompt logging can change this."
    : "No. Enroll to receive organization policy.";
  return `
    <div class="card" aria-label="What leaves browser?">
      <div class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        What leaves browser?
      </div>
      <div class="row"><span class="row-label">Raw prompt to SoterAI</span><span class="row-value" data-privacy-raw-prompt="${enrolled ? "no-by-default" : "no"}">${escapeHtml(rawPromptStatus)}</span></div>
      <div class="row"><span class="row-label">Stored locally</span><span class="row-value">Redacted preview, safe rewrite, hashes, and policy cache</span></div>
      <div class="row"><span class="row-label">Backend audit event</span><span class="row-value">${enrolled ? "Metadata, decision, risk score, redacted preview" : "None before enrollment"}</span></div>
      <div class="row"><span class="row-label">Response scanning</span><span class="row-value">${escapeHtml(responseScanningLabel)}</span></div>
      <div class="row"><span class="row-label">Emergency mode</span><span class="row-value">${lockdown ? "Strict cached policy active" : lockdownFlagged ? "Flagged, no restrictions set" : "Inactive"}</span></div>
      <p class="help">Secrets are detected and rewritten in the browser first; extension storage avoids keeping raw prompt text by default.</p>
    </div>`;
}