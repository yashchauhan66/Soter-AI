import type { ExtensionState } from "../lib/types";
import { enrollmentMarkup, enrollmentStatusLabel, escapeHtml, wireEnrollment } from "../lib/enrollment-ui";

export function renderPopup(root: HTMLElement, state: ExtensionState) {
  const enrolled = state.enrollmentStatus === "enrolled";
  const lockdown = state.policy?.emergencyLockdown?.enabled ?? false;
  const responseScanningEnabled = state.policy?.destinations?.some((destination) => destination.enabled && destination.responseScanningEnabled) ?? false;
  root.innerHTML = `
    <style>
      body { margin:0; width:340px; font-family:Inter,ui-sans-serif,system-ui,sans-serif; color:#172033; background:#fff; }
      .shell { padding:14px; display:grid; gap:12px; } h1,h2,p { margin:0; } h1 { font-size:17px; } h2 { font-size:14px; }
      .pill { display:inline-flex; width:fit-content; border-radius:999px; padding:4px 9px; font-size:12px; font-weight:750; background:${lockdown ? "#fee4e2" : enrolled ? "#dcfae6" : "#fff3cd"}; color:${lockdown ? "#b42318" : enrolled ? "#067647" : "#7a4d00"}; }
      .rows,section { display:grid; gap:8px; border-top:1px solid #edf1f6; padding-top:10px; } .row { display:flex; justify-content:space-between; gap:12px; font-size:13px; } .value { font-weight:700; text-align:right; overflow-wrap:anywhere; }
      label { display:grid; gap:4px; font-size:12px; font-weight:700; } input { box-sizing:border-box; width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:8px; } button { border:1px solid #1463ff; background:#1463ff; color:white; border-radius:6px; padding:8px 10px; font-weight:700; cursor:pointer; } button:disabled { opacity:.65; cursor:wait; }
      .help { color:#5f6f84; font-size:12px; line-height:1.4; } .error { color:#b42318; font-size:12px; } .lockdown { border:1px solid #fda29b; background:#fff1f0; color:#b42318; border-radius:7px; padding:9px; font-size:12px; font-weight:700; }
    </style>
    <div class="shell">
      <h1>Soter Enterprise</h1>
      <span class="pill" data-status>${escapeHtml(enrollmentStatusLabel(state))}</span>
      ${lockdown ? '<div class="lockdown">Emergency lockdown is active. Strict organization policy is enforced from the offline cache.</div>' : ""}
      ${!enrolled ? enrollmentMarkup(state) : `
        <div class="rows" data-enrollment-view="${state.enrollmentMode === "managed" ? "managed" : "enrolled"}">
          <div class="row"><span>Organization</span><span class="value">${escapeHtml(state.config.organizationName ?? state.config.organizationId)}</span></div>
          <div class="row"><span>Employee</span><span class="value">${escapeHtml(state.config.employeeEmail ?? state.config.employeeId)}</span></div>
          <div class="row"><span>Department / role</span><span class="value">${escapeHtml([state.config.department, state.config.role].filter(Boolean).join(" / ") || "Not assigned")}</span></div>
          <div class="row"><span>Policy version</span><span class="value">${escapeHtml(state.policy?.version ?? "unknown")}</span></div>
          <div class="row"><span>Response scanning</span><span class="value">${responseScanningEnabled ? "Enabled for configured AI destinations" : "Disabled"}</span></div>
          <div class="row"><span>Sync status</span><span class="value">${escapeHtml(state.policySyncStatus)}</span></div>
          <div class="row"><span>Last heartbeat</span><span class="value">${escapeHtml(state.lastHeartbeatAt ?? "never")}</span></div>
        </div>
        <button data-heartbeat>Sync now</button>`}
    </div>`;
  wireEnrollment(root, (next) => renderPopup(root, next));
  root.querySelector("[data-heartbeat]")?.addEventListener("click", () => chrome.runtime.sendMessage({ type: "SOTER_SYNC_POLICY" }, (response) => {
    const next = (response as { state?: ExtensionState } | undefined)?.state;
    if (next) renderPopup(root, next);
  }));
}
