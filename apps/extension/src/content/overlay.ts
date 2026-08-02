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
   * Returns true if the submission actually proceeded.
   */
  onApproved?: () => Promise<boolean> | boolean | void;
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
const OVERLAY_TICK_MS = 500;

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
  const react = () => void state.sentinel.check();
  // The host is a direct child of <html>, so no `subtree`: the observer is woken by changes
  // to that one child list rather than by every mutation the page makes to its own DOM.
  const structure = new MutationObserver(react);
  structure.observe(document.documentElement, { childList: true });
  const attributes = new MutationObserver(react);
  attributes.observe(state.host, { attributes: true, attributeFilter: ["style", "data-soter-overlay", "class", "hidden"] });
  state.observers = [structure, attributes];
  if (state.ticker === null) state.ticker = setInterval(react, OVERLAY_TICK_MS);
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
      .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 24px; }
      .panel { width: min(580px, 100%); background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column; }
      .header { padding: 20px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
      .title { margin: 0; font-size: 18px; line-height: 1.4; font-weight: 700; color: #0f172a; }
      
      .status-badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.05em; }
      .status-badge.error { background: #fee2e2; color: #991b1b; }
      .status-badge.warning { background: #fef3c7; color: #92400e; }
      .status-badge.info { background: #e0f2fe; color: #075985; }

      .body { padding: 24px; display: grid; gap: 16px; }
      .message { margin: 0; color: #475569; line-height: 1.5; font-size: 14px; }
      
      .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 13px; }
      .metric { display: flex; flex-direction: column; gap: 4px; }
      .metric-label { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; }
      .metric-value { font-weight: 700; color: #334155; }

      .preview-label { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block; }
      textarea { width: 100%; min-height: 110px; box-sizing: border-box; resize: vertical; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; background: #f8fafc; }
      
      .input-group { display: flex; flex-direction: column; gap: 6px; }
      .input-group label { font-size: 12px; font-weight: 650; color: #334155; }
      .input-group input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; }
      .input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }
      
      .spinner-container { display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #fafafa; }
      .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
      .spinner-text { font-size: 13px; font-weight: 600; color: #475569; }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; padding: 18px 24px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
      button { border: 1px solid #cbd5e1; background: #ffffff; color: #334155; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
      button:hover { background: #f8fafc; border-color: #b4fee2; }
      button.primary { background: #2563eb; border-color: #2563eb; color: white; }
      button.primary:hover { background: #1d4ed8; }
      button.danger { background: #dc2626; border-color: #dc2626; color: white; }
      button.danger:hover { background: #b91c1c; }
      button.warning-btn { background: #d97706; border-color: #d97706; color: white; }
      button.warning-btn:hover { background: #b45309; }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
    </style>
    <div class="backdrop">
      <section class="panel" role="dialog" aria-modal="true" aria-label="Soter Warning">
        <div class="header">
          <h2 class="title">Soter Security Guard</h2>
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
            const proceeded = await options.onApproved?.();
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
