import type { ExtensionState } from "./types";
import { DEFAULT_EXTENSION_API_BASE_URL } from "../../../../packages/shared/src/constants";

export function enrollmentMarkup(state: ExtensionState) {
  if (state.enrollmentStatus === "enrolled") return "";
  return `
    <div class="card enrollment" data-enrollment-view="not-enrolled">
      <div class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Connect to Your Organization
      </div>
      <p class="help" style="margin-top:0;margin-bottom:12px;">Enter the enrollment code supplied by your administrator to activate enterprise protection.</p>
      
      <div class="form-group">
        <label class="form-label" for="enrollment-code">Enrollment Code</label>
        <input class="form-input" id="enrollment-code" data-enrollment-code type="password" autocomplete="off" spellcheck="false" placeholder="Enter your enrollment code" />
      </div>
      
      <div class="form-group">
        <label class="form-label" for="api-base-url">API Base URL</label>
        <input class="form-input" id="api-base-url" data-api-base-url type="url" value="${escapeHtml(state.config.apiBaseUrl || DEFAULT_EXTENSION_API_BASE_URL)}" />
      </div>
      
      <div class="btn-group">
        <button class="btn btn-primary" data-enroll>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Connect
        </button>
      </div>
      
      <p class="error" data-enrollment-error hidden></p>
      
      <div class="divider">
        <div class="divider-line"></div>
        <span class="divider-text">or</span>
        <div class="divider-line"></div>
      </div>
      
      <div class="btn-group">
        <button class="btn btn-secondary" data-start-trial>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"/></svg>
          Try Free with Sample Policy
        </button>
      </div>
      <p class="help" style="text-align:center;">No enrollment code needed. Local-only protection with a built-in policy.</p>
      
      <p class="help" style="text-align:center;margin-top:10px;">
        Don't have an enterprise account?<br>
        <a href="${DEFAULT_EXTENSION_API_BASE_URL}/enterprise/pilot" target="_blank" class="link">Learn more or Request Access</a>
      </p>
    </div>`;
}

export function enrollmentStatusLabel(state: ExtensionState) {
  if (state.policy?.emergencyLockdown?.enabled) return "Emergency lockdown active";
  if (state.policySyncStatus === "offline") return "Offline cached policy";
  if (state.policySyncStatus === "error") return "Policy sync failed";
  if (state.enrollmentMode === "managed") return "Managed by organization";
  if (state.enrollmentStatus === "enrolled") return "Enrolled";
  return "Not enrolled";
}

export function wireEnrollment(root: HTMLElement, onComplete: (state: ExtensionState) => void) {
  // v0.2.0: self-service trial. Sends SOTER_START_TRIAL (extension-page-scoped in the
  // message contract) and re-renders with the returned state on success.
  root.querySelector("[data-start-trial]")?.addEventListener("click", () => {
    const button = root.querySelector<HTMLButtonElement>("[data-start-trial]");
    const error = root.querySelector<HTMLElement>("[data-enrollment-error]");
    if (button) { button.disabled = true; button.textContent = "Starting trial…"; }
    chrome.runtime.sendMessage({ type: "SOTER_START_TRIAL" }, (response) => {
      const result = response as { ok?: boolean; error?: string; state?: ExtensionState } | undefined;
      if (result?.ok && result.state) return onComplete(result.state);
      if (button) { button.disabled = false; button.textContent = "Try Free with Sample Policy"; }
      if (error) { error.hidden = false; error.textContent = result?.error ?? "Could not start trial mode."; }
    });
  });
  root.querySelector("[data-enroll]")?.addEventListener("click", () => {
    const button = root.querySelector<HTMLButtonElement>("[data-enroll]");
    const code = root.querySelector<HTMLInputElement>("[data-enrollment-code]")?.value.trim() ?? "";
    const apiBaseUrl = root.querySelector<HTMLInputElement>("[data-api-base-url]")?.value.trim().replace(/\/$/, "") ?? "";
    const error = root.querySelector<HTMLElement>("[data-enrollment-error]");
    if (!code || !apiBaseUrl) {
      if (error) { error.hidden = false; error.textContent = "Enrollment code and API URL are required."; }
      return;
    }
    if (button) { button.disabled = true; button.textContent = "Enrolling…"; }
    chrome.runtime.sendMessage({ type: "SOTER_ENROLL", enrollmentCode: code, apiBaseUrl }, (response) => {
      const result = response as { ok?: boolean; error?: string; state?: ExtensionState } | undefined;
      if (result?.ok && result.state) return onComplete(result.state);
      if (button) { button.disabled = false; button.textContent = "Connect"; }
      if (error) { error.hidden = false; error.textContent = result?.error ?? "Enrollment failed. Check the code and API URL."; }
    });
  });
}

export function escapeHtml(value: string) {
  const AMP = "&" + "amp;";
  const LT = "&" + "lt;";
  const GT = "&" + "gt;";
  const QUOT = "&" + "quot;";
  const APOS = "&" + "#039;";
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return AMP;
      case "<": return LT;
      case ">": return GT;
      case '"': return QUOT;
      case "'": return APOS;
      default: return char;
    }
  });
}
