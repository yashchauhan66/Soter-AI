import type { ExtensionState } from "../lib/types";
import { enrollmentMarkup, enrollmentStatusLabel, escapeHtml, wireEnrollment } from "../lib/enrollment-ui";

export function renderSidePanel(root: HTMLElement, state: ExtensionState) {
  const latest = state.latestScan;
  const enrolled = state.enrollmentStatus === "enrolled";
  const lockdown = state.policy?.emergencyLockdown?.enabled ?? false;
  const responseScanningEnabled = state.policy?.destinations?.some((destination) => destination.enabled && destination.responseScanningEnabled) ?? false;
  root.innerHTML = `
    <style>
      body { margin:0; font-family:Inter,ui-sans-serif,system-ui,sans-serif; background:#f7f9fc; color:#172033; } .shell { min-height:100vh; } header { padding:16px; background:#fff; border-bottom:1px solid #e5ebf3; } h1,h2,p { margin:0; } h1 { font-size:18px; } h2 { font-size:13px; text-transform:uppercase; color:#506176; }
      .status { color:${lockdown ? "#b42318" : enrolled ? "#067647" : "#7a4d00"}; font-weight:750; font-size:12px; text-transform:uppercase; margin-top:4px; } .content { padding:14px; display:grid; gap:12px; } section { background:#fff; border:1px solid #e5ebf3; border-radius:8px; padding:12px; display:grid; gap:10px; } .row { display:flex; justify-content:space-between; gap:12px; font-size:13px; } .value { font-weight:700; text-align:right; overflow-wrap:anywhere; }
      label { display:grid; gap:4px; font-size:12px; font-weight:700; } input,textarea { box-sizing:border-box; width:100%; border:1px solid #cdd8e4; border-radius:6px; padding:9px; } textarea { min-height:90px; font:12px ui-monospace,monospace; } button { border:1px solid #1463ff; background:#1463ff; color:#fff; border-radius:6px; padding:8px 10px; font-weight:700; cursor:pointer; } button.secondary { border-color:#bcc8d7; background:#fff; color:#172033; } .help,.empty { color:#5f6f84; font-size:13px; line-height:1.45; } .error { color:#b42318; font-size:12px; } .lockdown { border-color:#fda29b; background:#fff1f0; color:#b42318; font-weight:700; }
    </style>
    <div class="shell"><header><h1>Soter Control Plane</h1><div class="status">${escapeHtml(enrollmentStatusLabel(state))}</div></header><div class="content">
      ${lockdown ? '<section class="lockdown">Emergency lockdown active — strict rules are cached and enforced locally.</section>' : ""}
      ${!enrolled ? enrollmentMarkup(state) : `
        <section data-enrollment-view="${state.enrollmentMode === "managed" ? "managed" : "enrolled"}"><h2>${state.enrollmentMode === "managed" ? "Managed by organization" : "Enrollment"}</h2>
          <div class="row"><span>Organization</span><span class="value">${escapeHtml(state.config.organizationName ?? state.config.organizationId)}</span></div>
          <div class="row"><span>Employee</span><span class="value">${escapeHtml(state.config.employeeEmail ?? state.config.employeeId)}</span></div>
          <div class="row"><span>Department / role</span><span class="value">${escapeHtml([state.config.department, state.config.role].filter(Boolean).join(" / ") || "Not assigned")}</span></div>
          <div class="row"><span>Policy sync</span><span class="value">${escapeHtml(state.policySyncStatus)}</span></div>
          <div class="row"><span>Policy version</span><span class="value">${escapeHtml(state.policy?.version ?? "unknown")}</span></div>
          <div class="row"><span>Response scanning</span><span class="value">${responseScanningEnabled ? "Enabled for configured AI destinations" : "Disabled"}</span></div>
        </section>
        ${latest ? latestScanSection(latest) : '<section><h2>Latest Scan</h2><p class="empty">No prompt has been scanned on this AI site yet.</p></section>'}`}
    </div></div>`;
  wireEnrollment(root, (next) => renderSidePanel(root, next));
  root.querySelector("[data-copy-safe]")?.addEventListener("click", () => { if (latest) void navigator.clipboard.writeText(latest.rewrittenSafeText || latest.redactedText); });
  root.querySelector("[data-request-approval]")?.addEventListener("click", () => { if (latest) chrome.runtime.sendMessage({ type:"SOTER_REQUEST_APPROVAL", text:latest.redactedText, url:location.href }); });
}

function latestScanSection(latest: NonNullable<ExtensionState["latestScan"]>) {
  return `<section><h2>Latest Scan</h2><div class="row"><span>Action</span><span class="value">${escapeHtml(latest.action)}</span></div><div class="row"><span>Risk score</span><span class="value">${latest.riskScore}</span></div><div class="row"><span>Detected</span><span class="value">${escapeHtml(latest.detectedDataTypes.join(", ") || "None")}</span></div><textarea readonly>${escapeHtml(latest.rewrittenSafeText || latest.redactedText)}</textarea><button data-copy-safe>Copy safe prompt</button><button class="secondary" data-request-approval>Request approval</button></section>`;
}
