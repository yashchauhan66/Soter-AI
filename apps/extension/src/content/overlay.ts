import type { ScanResult } from "../lib/types";
import { remediationAffordances } from "../lib/scanner";
import { createOverlaySentinel, type OverlaySentinel } from "./overlay-sentinel";

interface OverlayOptions {
  result: ScanResult;
  onReplace?: () => void;
  onCopy?: () => void;
  /** Fired when a hard-enforcement block is dismissed. Must NOT submit — audit only. */
  onDismissAudited?: () => void;
  onApproval?: (justification: string) => Promise<string | null>;
  /**
   * Fired after the server reports APPROVED. Implementations should claim the
   * one-time approval server-side and only submit if the claim is honored.
   * Receives the approvalId so the claim can reference the correct request.
   * Returns true if the submission actually proceeded.
   */
  onApproved?: (approvalId: string) => Promise<boolean> | boolean | void;
  /** Fired for require_justification self-service bypass. Handles its own audit + replay. */
  onBypass?: (justification: string) => void;
  onCheckStatus?: (approvalId: string) => Promise<{ status: string; allowed?: boolean }>;
  /**
   * SS-6: fired when the page removed, re-parented or neutralised the enforcement overlay.
   * Rate-limited by the sentinel. The overlay itself stays free of any `chrome.*` dependency,
   * so the caller decides how a tamper attempt is recorded.
   */
  onTamper?: (detail: string) => void;
}

export function showSoterOverlay(options: OverlayOptions) {
  renderSoterOverlay(options);
}

/**
 * SS-6: the host's inline style, re-applied with `!important` on every integrity check.
 *
 * Author *inline* `!important` outranks an author stylesheet's `!important`, so this is what a
 * page's `[data-soter-overlay] { display: none !important }` loses to. Set through
 * `setProperty(..., "important")` rather than `host.style.x =`, which cannot express priority.
 */
const HOST_STYLE: ReadonlyArray<readonly [string, string]> = [
  ["position", "fixed"],
  ["inset", "0"],
  ["z-index", "2147483647"],
  ["display", "block"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["pointer-events", "auto"],
  ["transform", "none"],
];

/** Backstop cadence for anything the observers cannot see. Cleared when the overlay closes. */
// v0.2.1 FIX: reduced from 500ms to 150ms for faster tamper detection.
const OVERLAY_TICK_MS = 150;

interface WatchdogState {
  host: HTMLElement;
  options: OverlayOptions;
  sentinel: OverlaySentinel;
  observers: MutationObserver[];
  ticker: ReturnType<typeof setInterval> | null;
}

/** One overlay at a time, so a new verdict retires the previous watchdog rather than racing it. */
let activeWatchdog: WatchdogState | null = null;

/**
 * Intervals owned by the current overlay (approval polling). Tracked at module scope because a
 * watchdog re-mount replaces the rendered tree, and a poll left running against a detached
 * shadow root would keep talking to the broker for its full five-minute timeout.
 */
let activeTimers: Array<ReturnType<typeof setInterval>> = [];

function clearActiveTimers() {
  for (const timer of activeTimers) clearInterval(timer);
  activeTimers = [];
}

function createOverlayHost(): HTMLElement {
  const host = document.createElement("div");
  applyHostIntegrity(host);
  return host;
}

function applyHostIntegrity(host: HTMLElement) {
  host.setAttribute("data-soter-overlay", "true");
  for (const [property, value] of HOST_STYLE) {
    host.style.setProperty(property, value, "important");
  }
  // A `z-index` tie resolves in DOM order, so being last is part of being visible.
  if (host.parentElement === document.documentElement && document.documentElement.lastElementChild !== host) {
    document.documentElement.appendChild(host);
  }
}

function hostIsIntact(host: HTMLElement): boolean {
  if (host.getAttribute("data-soter-overlay") !== "true") return false;
  if (document.documentElement.lastElementChild !== host) return false;
  return HOST_STYLE.every(
    ([property, value]) =>
      host.style.getPropertyValue(property) === value && host.style.getPropertyPriority(property) === "important",
  );
}

function teardownWatchdog() {
  if (!activeWatchdog) return;
  activeWatchdog.sentinel.stop();
  for (const observer of activeWatchdog.observers) observer.disconnect();
  if (activeWatchdog.ticker !== null) clearInterval(activeWatchdog.ticker);
  activeWatchdog = null;
}

function observeHost(state: WatchdogState) {
  for (const observer of state.observers) observer.disconnect();
  const react = () => { state.sentinel.check(); };
  // The host is a direct child of <html>, so no `subtree`: the observer is woken by changes
  // to that one child list rather than by every mutation the page makes to its own DOM.
  const structure = new MutationObserver(react);
  structure.observe(document.documentElement, { childList: true });
  const attributes = new MutationObserver(react);
  attributes.observe(state.host, { attributes: true, attributeFilter: ["style", "data-soter-overlay", "class", "hidden"] });
  state.observers = [structure, attributes];
  if (state.ticker === null) state.ticker = setInterval(react, OVERLAY_TICK_MS);
  // v0.2.1 FIX: also run a requestAnimationFrame loop for sub-frame tamper detection.
  // This catches style changes that happen between interval ticks.
  const rafLoop = () => {
    if (!activeWatchdog || activeWatchdog.sentinel !== state.sentinel) return;
    state.sentinel.check();
    requestAnimationFrame(rafLoop);
  };
  requestAnimationFrame(rafLoop);
}

function installOverlayWatchdog(host: HTMLElement, options: OverlayOptions, inherited?: OverlaySentinel) {
  if (inherited && activeWatchdog && activeWatchdog.sentinel === inherited) {
    // A re-mount keeps the same sentinel, so the repair budget spans the whole attack rather
    // than resetting itself every time the page removes the overlay again.
    activeWatchdog.host = host;
    activeWatchdog.options = options;
    observeHost(activeWatchdog);
    return;
  }
  const state = { host, options, observers: [], ticker: null } as unknown as WatchdogState;
  state.sentinel = createOverlaySentinel({
    isMounted: () => state.host.isConnected && state.host.parentElement === document.documentElement,
    isIntact: () => hostIsIntact(state.host),
    restoreIntegrity: () => applyHostIntegrity(state.host),
    remount: () => renderSoterOverlay(state.options, state.sentinel),
    now: () => Date.now(),
    onTamper: (detail) => state.options.onTamper?.(detail),
  });
  activeWatchdog = state;
  observeHost(state);
}

function renderSoterOverlay(options: OverlayOptions, inherited?: OverlaySentinel) {
  if (inherited && activeWatchdog?.sentinel === inherited) {
    // Re-parented rather than removed: drop the old host explicitly, because the attribute it
    // is found by may have been the thing the page stripped.
    activeWatchdog.host.remove();
  } else {
    teardownWatchdog();
  }
  document.querySelector("[data-soter-overlay]")?.remove();
  clearActiveTimers();
  const host = createOverlayHost();
  document.documentElement.appendChild(host);

  /** Closes the overlay for a legitimate reason: the watchdog must not fight the user. */
  const close = () => {
    clearActiveTimers();
    teardownWatchdog();
    host.remove();
  };

  // SS-6: `closed`, so `host.shadowRoot` is `null` for the page and the verdict, the redacted
  // preview and the justification field are unreadable from page script. Content scripts run
  // in an isolated world with their own built-ins, so a page that patches
  // `Element.prototype.attachShadow` does not intercept this call (proved at runtime by
  // RT-709). What the page *can* still do is remove or neutralise the host in the shared
  // light DOM, which is what the watchdog installed at the end of this function answers.
  const shadow = host.attachShadow({ mode: "closed" });
  const result = options.result;
  const detected = result.detectedDataTypes.length ? result.detectedDataTypes.join(", ") : "None";
  const action = result.action;

  // Determine user messages and actions
  let statusHtml = "";
  let actionButtonsHtml = "";
  let justificationInputHtml = "";

  if (action === "block") {
    const affordances = remediationAffordances(result);
    if (!affordances.canReplace) {
      // SS-11: a fail-closed block (policy tamper, unsigned bundle where signing is
      // required, offline + fail-closed) means the extension does not trust the policy it
      // would evaluate against. Offering "Use safe prompt" here would write text back into
      // the page and replay the submit, so it is not rendered at all. Dismiss is audited
      // and never submits.
      actionButtonsHtml = `
        <button data-action="copy">Copy redacted preview</button>
        <button data-action="dismiss" class="danger">Dismiss (audited)</button>
      `;
      statusHtml = `<div class="status-badge error">Submission Blocked — Policy Unverified</div>`;
    } else {
      actionButtonsHtml = `
        <button data-action="copy">Copy safe prompt</button>
        <button data-action="replace" class="primary">Use safe prompt</button>
      `;
      if (result.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block")) {
        actionButtonsHtml = `
          <button data-action="copy">Copy safe prompt</button>
          <button data-action="replace" class="primary">Use safe prompt</button>
          <button data-action="dismiss" class="danger">Dismiss (audited)</button>
        `;
      }
      statusHtml = `<div class="status-badge error">Submission Blocked</div>`;
    }
  } else if (action === "require_approval") {
    justificationInputHtml = `
      <div class="input-group">
        <label for="justification">Business Justification *</label>
        <input type="text" id="justification" placeholder="Enter reason (e.g. debugging production issue)" />
      </div>
    `;
    actionButtonsHtml = `
      <button data-action="dismiss">Cancel</button>
      <button data-action="approval" class="danger">Request Approval & Submit</button>
    `;
    statusHtml = `<div class="status-badge warning">Approval Required</div>`;
  } else if (action === "require_justification") {
    justificationInputHtml = `
      <div class="input-group">
        <label for="justification">Bypass Justification *</label>
        <input type="text" id="justification" placeholder="Provide explanation to bypass security warning" />
      </div>
    `;
    actionButtonsHtml = `
      <button data-action="dismiss">Cancel</button>
      <button data-action="bypass" class="warning-btn">Submit with Justification</button>
    `;
    statusHtml = `<div class="status-badge warning">Justification Required</div>`;
  } else {
    // default/warn
    actionButtonsHtml = `
      <button data-action="dismiss">Dismiss</button>
      <button data-action="copy">Copy safe prompt</button>
      <button data-action="replace" class="primary">Use safe prompt</button>
    `;
    statusHtml = `<div class="status-badge info">Security Warning</div>`;
  }

  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; }
      .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 24px; animation: fadeIn 0.2s ease; }
      .panel { width: min(560px, 100%); background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; display: flex; flex-direction: column; animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); max-height: calc(100vh - 48px); }
      .header { padding: 18px 24px; background: linear-gradient(180deg, #f8fafc, #ffffff); border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .brand-icon { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; flex-shrink: 0; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3); }
      .title { margin: 0; font-size: 15px; line-height: 1.3; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { margin: 1px 0 0; font-size: 11px; color: #94a3b8; font-weight: 500; }

      .status-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; letter-spacing: 0.06em; flex-shrink: 0; }
      .status-badge.error { background: #fee2e2; color: #991b1b; }
      .status-badge.warning { background: #fef3c7; color: #92400e; }
      .status-badge.info { background: #e0f2fe; color: #075985; }

      .body { padding: 20px 24px; display: grid; gap: 14px; overflow-y: auto; }
      .message { margin: 0; color: #475569; line-height: 1.55; font-size: 13.5px; }

      .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
      .metric { display: flex; flex-direction: column; gap: 3px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 10px 12px; border-radius: 10px; }
      .metric-label { color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .metric-value { font-weight: 700; color: #0f172a; font-size: 14px; }

      .preview-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.05em; }
      textarea { width: 100%; min-height: 100px; box-sizing: border-box; resize: vertical; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; background: #f8fafc; }

      .input-group { display: flex; flex-direction: column; gap: 6px; }
      .input-group label { font-size: 12px; font-weight: 650; color: #334155; }
      .input-group input { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
      .input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }

      .spinner-container { display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 18px; border: 1px dashed #e2e8f0; border-radius: 10px; background: #f8fafc; }
      .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
      .spinner-text { font-size: 13px; font-weight: 600; color: #475569; }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; padding: 16px 24px 20px; border-top: 1px solid #f1f5f9; background: #ffffff; }
      button { border: 1px solid #e2e8f0; background: #ffffff; color: #334155; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
      button:hover { background: #f8fafc; border-color: #cbd5e1; }
      button:active { transform: scale(0.98); }
      button.primary { background: #2563eb; border-color: #2563eb; color: white; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3); }
      button.primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
      button.danger { background: #dc2626; border-color: #dc2626; color: white; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3); }
      button.danger:hover { background: #b91c1c; border-color: #b91c1c; }
      button.warning-btn { background: #d97706; border-color: #d97706; color: white; box-shadow: 0 1px 3px rgba(217, 119, 6, 0.3); }
      button.warning-btn:hover { background: #b45309; border-color: #b45309; }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
    </style>
    <div class="backdrop">
      <section class="panel" role="dialog" aria-modal="true" aria-label="Soter Warning">
        <div class="header">
          <div class="brand">
            <span class="brand-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
            <div>
              <h2 class="title">Soter Security Guard</h2>
              <p class="subtitle">Enterprise AI Data Protection</p>
            </div>
          </div>
          ${statusHtml}
        </div>
        <div class="body">
          <p class="message">${escapeHtml(result.policy.userMessage || "Sensitive data properties matched enterprise filters.")}</p>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Risk Category</span>
              <span class="metric-value">${escapeHtml(detected)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Risk Score</span>
              <span class="metric-value">${result.riskScore}/100</span>
            </div>
          </div>
          
          <div>
            <span class="preview-label">Redacted/Safe Preview</span>
            <textarea readonly>${escapeHtml(result.rewrittenSafeText || result.redactedText)}</textarea>
          </div>

          ${justificationInputHtml}

          <div class="spinner-container" id="spinner-box">
            <div class="spinner"></div>
            <div class="spinner-text" id="spinner-msg">Waiting for administrator approval...</div>
          </div>
        </div>
        <div class="actions" id="action-bar">
          ${actionButtonsHtml}
        </div>
      </section>
    </div>
  `;

  const getJustificationInput = () => shadow.querySelector("#justification") as HTMLInputElement | null;
  const getSpinnerBox = () => shadow.querySelector("#spinner-box") as HTMLElement;
  const getSpinnerMsg = () => shadow.querySelector("#spinner-msg") as HTMLElement;
  const getActionBar = () => shadow.querySelector("#action-bar") as HTMLElement;

  shadow.querySelector("[data-action='dismiss']")?.addEventListener("click", () => {
    // On a hard-enforcement block, "Dismiss (audited)" closes the overlay but
    // records the override attempt and does NOT let the submission through.
    if (action === "block") {
      options.onDismissAudited?.();
    }
    close();
  });

  shadow.querySelector("[data-action='copy']")?.addEventListener("click", () => {
    options.onCopy?.();
  });

  shadow.querySelector("[data-action='replace']")?.addEventListener("click", () => {
    options.onReplace?.();
    close();
  });

  // Handle request approval polling
  const requestApprovalBtn = shadow.querySelector("[data-action='approval']");
  if (requestApprovalBtn) {
    requestApprovalBtn.addEventListener("click", async () => {
      const justificationVal = getJustificationInput()?.value.trim() || "";
      if (!justificationVal) {
        alert("Please enter a business justification reason.");
        return;
      }

      // Hide actions, show loader
      getActionBar().style.display = "none";
      const justificationEl = getJustificationInput();
      if (justificationEl) justificationEl.disabled = true;

      const spinnerBox = getSpinnerBox();
      spinnerBox.style.display = "flex";

      try {
        const approvalId = await options.onApproval?.(justificationVal);
        if (!approvalId) {
          throw new Error("Failed to record approval request.");
        }

        // Start polling
        let pollAttempts = 0;
        const interval = setInterval(async () => {
          pollAttempts++;
          if (pollAttempts > 100) { // Timeout after ~5 mins
            clearInterval(interval);
            getSpinnerMsg().textContent = "Approval timeout. Please try again later.";
            getSpinnerMsg().style.color = "#dc2626";
            return;
          }

          if (!options.onCheckStatus) return;
          const statusResult = await options.onCheckStatus(approvalId);

          if (statusResult.status === "APPROVED" || statusResult.allowed) {
            clearInterval(interval);
            getSpinnerMsg().textContent = "Approved! Claiming authorization...";
            getSpinnerMsg().style.color = "#16a34a";
            // Claim the one-time approval server-side. Only submit if the
            // claim is actually honored — never replay on a rejected claim.
            // v0.2.1 FIX: pass the approvalId so the claim references the correct request.
            const proceeded = await options.onApproved?.(approvalId);
            if (proceeded === false) {
              getSpinnerMsg().textContent = "Authorization could not be claimed. Submission blocked.";
              getSpinnerMsg().style.color = "#dc2626";
              setTimeout(close, 2500);
            } else {
              getSpinnerMsg().textContent = "Authorized. Submitting prompt...";
              setTimeout(close, 1000);
            }
          } else if (statusResult.status === "DENIED") {
            clearInterval(interval);
            getSpinnerMsg().textContent = "Approval request denied by administrator.";
            getSpinnerMsg().style.color = "#dc2626";
            setTimeout(() => {
              getActionBar().style.display = "flex";
              if (justificationEl) justificationEl.disabled = false;
              spinnerBox.style.display = "none";
            }, 3000);
          }
        }, 3000);
        activeTimers.push(interval);

      } catch (err) {
        alert(err instanceof Error ? err.message : "Approval request failed.");
        getActionBar().style.display = "flex";
        if (justificationEl) justificationEl.disabled = false;
        spinnerBox.style.display = "none";
      }
    });
  }

  // Handle submit with justification bypass
  const bypassBtn = shadow.querySelector("[data-action='bypass']");
  if (bypassBtn) {
    bypassBtn.addEventListener("click", () => {
      const justificationVal = getJustificationInput()?.value.trim() || "";
      if (!justificationVal) {
        alert("Please enter a justification reason.");
        return;
      }
      options.onBypass?.(justificationVal);
      close();
    });
  }

  // Last, so the watchdog only ever guards a fully rendered overlay.
  installOverlayWatchdog(host, options, inherited);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}
