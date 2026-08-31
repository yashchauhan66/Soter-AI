import type { ScanResult } from "../lib/types";
import { remediationAffordances } from "../lib/scanner";
import { createOverlaySentinel, type OverlaySentinel } from "./overlay-sentinel";

interface OverlayOptions {
  result: ScanResult;
  /**
   * What was stopped, for wording only. A blocked `.env` upload used to be described as a
   * "prompt" throughout — "Copy safe prompt", "Your prompt has not been sent" — which reads as
   * if the dialog belonged to some other event than the one the user just triggered.
   */
  subject?: "prompt" | "file";
  /**
   * Rewrites the page's text with the safe version. When absent, the "Use safe prompt" button
   * is not rendered at all: the file-upload path cannot rewrite a file's contents, and a button
   * that closes the dialog while the user believes their content was substituted is worse than
   * no button.
   */
  onReplace?: () => void;
  /**
   * v0.2.2: proceeds with the text exactly as the user wrote it, audited.
   *
   * Only rendered when the kernel says `canSubmitOriginal` — i.e. for a `warn`/`redact`-level
   * verdict, never for a block, an approval request or a fail-closed state. It exists because
   * without it those verdicts were a dead end: the gesture had already been cancelled, "Dismiss"
   * does not submit, and "Use safe prompt" substitutes different words — so a user who had merely
   * been *warned* about their own React component could not send it at all, and no wording in the
   * dialog said so. `remediationAffordances` had authorised this path since SS-11; only the UI was
   * missing, which made the extension quietly stricter than its own policy engine.
   */
  onProceed?: () => void;
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
  // v0.2.2: four longhands, not `inset: 0`. See `expectedHostStyle()` — the shorthand was the
  // bug that silently disabled this entire watchdog.
  ["top", "0px"],
  ["right", "0px"],
  ["bottom", "0px"],
  ["left", "0px"],
  ["z-index", "2147483647"],
  ["display", "block"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["pointer-events", "auto"],
  ["transform", "none"],
];

/**
 * v0.2.2 — what the browser actually *stores* for each declaration above.
 *
 * `hostIsIntact()` compares the host's inline style against what we asked for, and CSSOM does
 * not promise to hand back the string you gave it. `setProperty("inset", "0")` reads back as
 * `"0px"`, so the comparison failed on a freshly mounted, completely untouched host — on every
 * overlay, on every site, from the first check. The sentinel therefore treated its own healthy
 * overlay as tampered with: it "restored" the host on every tick, spent the 20-action budget in
 * roughly a third of a second (the watchdog then stands down *permanently*), and burned both
 * tamper audit reports on a phantom, so a genuine attack afterwards was neither repaired nor
 * reported. Runtime-proved in Edge: two `overlay tamper detected` audit events for an
 * interaction that was nothing but a paste and a dismiss.
 *
 * The declarations are longhands now, which alone fixes it — but the expectation is also
 * canonicalized through the browser itself, so re-introducing a shorthand here cannot silently
 * disable the watchdog a second time. The probe element is detached and never sees the page.
 */
let canonicalHostStyle: ReadonlyArray<readonly [string, string]> | null = null;
function expectedHostStyle(): ReadonlyArray<readonly [string, string]> {
  if (canonicalHostStyle) return canonicalHostStyle;
  const probe = document.createElement("div");
  for (const [property, value] of HOST_STYLE) probe.style.setProperty(property, value, "important");
  canonicalHostStyle = HOST_STYLE.map(([property]) => [property, probe.style.getPropertyValue(property)] as const);
  return canonicalHostStyle;
}

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
  if (host.parentElement === document.documentElement && foreignElementAfter(host)) {
    document.documentElement.appendChild(host);
  }
}

/**
 * Is a *page* element stacked after ours?
 *
 * The rule this enforces is "nothing the page owns paints over the verdict", not "our host is
 * literally the last node in the document". The extension mounts page-level furniture of its own
 * — the corner-notice stack — and counting that as an attack made a file-release confirmation
 * look identical to a hostile page appending a maximum-`z-index` cover.
 */
function foreignElementAfter(host: HTMLElement): boolean {
  for (let sibling = host.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (!sibling.hasAttribute("data-soter-overlay") && !sibling.hasAttribute("data-soter-notice-stack")) return true;
  }
  return false;
}

function hostIsIntact(host: HTMLElement): boolean {
  if (host.getAttribute("data-soter-overlay") !== "true") return false;
  if (foreignElementAfter(host)) return false;
  return expectedHostStyle().every(
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
  // v0.2.2: the 0.2.1 `requestAnimationFrame` loop is gone.
  //
  // It re-checked the host ~60 times a second for the entire life of the overlay — including the
  // full five minutes of an approval wait — and it bought nothing the two observers above do not
  // already deliver synchronously: an inline-style or attribute edit wakes the attribute
  // observer, and a removal or re-parent wakes the child-list observer. A page stylesheet cannot
  // beat inline `!important`, so there is no third path for it to catch.
  //
  // What it did do was turn any persistent disagreement into instant budget exhaustion: 20
  // corrective actions at 60 Hz is a third of a second, after which the sentinel stands down for
  // good. The 150ms ticker is the backstop, and it leaves the budget meaning what it says —
  // twenty corrections in ten seconds.
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
    for (const undo of cleanups) {
      try { undo(); } catch { /* a failed cleanup must not keep the overlay open */ }
    }
    cleanups.length = 0;
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

  // Which rule actually fired. Without it the dialog told the user *that* something was
  // wrong and never *which policy* said so, which is the first thing anyone asks — and the
  // first thing they need in order to raise it with their admin.
  const matchedRuleNames = Array.from(
    new Set(result.policy.matchedRules.map((rule) => rule.name).filter((name) => typeof name === "string" && name.length > 0)),
  );
  const matchedRulesHtml = matchedRuleNames.length
    ? `<div class="metric wide">
              <span class="metric-label">Matched policy rule${matchedRuleNames.length > 1 ? "s" : ""}</span>
              <span class="metric-value rules">${escapeHtml(matchedRuleNames.join(" · "))}</span>
            </div>`
    : "";

  /** Torn down by `close()`, so the modal never leaves a listener behind on the page. */
  const cleanups: Array<() => void> = [];
  /** The approval poll, hoisted so "Stop waiting" can cancel it. */
  let approvalPoll: ReturnType<typeof setInterval> | null = null;

  // Determine user messages and actions
  let statusHtml = "";
  let actionButtonsHtml = "";
  let justificationInputHtml = "";

  const subject = options.subject === "file" ? "file" : "prompt";
  const safeNoun = subject === "file" ? "redacted preview" : "safe prompt";
  const canReplace = typeof options.onReplace === "function";

  if (action === "block") {
    const affordances = remediationAffordances(result);
    const hardEnforced = result.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block");
    if (!affordances.canReplace) {
      // SS-11: a fail-closed block (policy tamper, unsigned bundle where signing is
      // required, offline + fail-closed) means the extension does not trust the policy it
      // would evaluate against. Offering "Use safe prompt" here would write text back into
      // the page and replay the submit, so it is not rendered at all. Dismiss is audited
      // and never submits.
      actionButtonsHtml = `
        <button data-action="copy">Copy redacted preview</button>
        <button data-action="dismiss" class="danger">Close (audited)</button>
      `;
      statusHtml = `<div class="status-badge error">Submission Blocked — Policy Unverified</div>`;
    } else {
      // Every block now offers a way out that does not submit. Previously the dismiss button
      // was rendered *only* when the hard-enforcement rule had matched, which is exactly the
      // case where an escape hatch is least appropriate — while an ordinary policy block, the
      // common case, left the user with no way to close the dialog and edit the prompt by
      // hand. Dismissing still never submits, and it is audited either way.
      actionButtonsHtml = `
        <button data-action="dismiss" class="${hardEnforced ? "danger" : ""}">Close (audited)</button>
        <button data-action="copy">Copy ${safeNoun}</button>
        ${canReplace ? `<button data-action="replace" class="primary">Use safe ${subject}</button>` : ""}
      `;
      statusHtml = `<div class="status-badge error">Submission Blocked${hardEnforced ? " — Hard Enforcement" : ""}</div>`;
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
    // v0.2.2: "Send as written" is the primary path here, because a warning is information, not a
    // refusal. The kernel decides whether it may appear (`canSubmitOriginal` is false for every
    // action that prevents submission and for fail-closed states), and the caller decides what
    // proceeding means — replaying the submit, or restoring the pasted fragment — and audits it.
    const canProceed = typeof options.onProceed === "function" && remediationAffordances(result).canSubmitOriginal;
    actionButtonsHtml = `
      <button data-action="dismiss">Dismiss</button>
      <button data-action="copy">Copy ${safeNoun}</button>
      ${canReplace ? `<button data-action="replace" class="${canProceed ? "" : "primary"}">Use safe ${subject}</button>` : ""}
      ${canProceed ? `<button data-action="proceed" class="primary">Send as written</button>` : ""}
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
      .metric.wide { grid-column: 1 / -1; }
      .metric-label { color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .metric-value { font-weight: 700; color: #0f172a; font-size: 14px; overflow-wrap: anywhere; }
      .metric-value.rules { font-size: 13px; font-weight: 650; color: #334155; }

      .inline-error { margin: 0; font-size: 12.5px; font-weight: 600; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 9px 12px; }
      .inline-error[hidden] { display: none; }

      .preview-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.05em; }
      textarea { width: 100%; min-height: 100px; box-sizing: border-box; resize: vertical; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; background: #f8fafc; }

      .input-group { display: flex; flex-direction: column; gap: 6px; }
      .input-group label { font-size: 12px; font-weight: 650; color: #334155; }
      .input-group input { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
      .input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }

      .spinner-container { display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 18px; border: 1px dashed #e2e8f0; border-radius: 10px; background: #f8fafc; }
      .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
      .spinner-text { font-size: 13px; font-weight: 600; color: #475569; text-align: center; }
      .spinner-hint { font-size: 11.5px; color: #94a3b8; text-align: center; margin: -4px 0 0; }

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
            ${matchedRulesHtml}
          </div>

          <div>
            <span class="preview-label">Redacted/Safe Preview</span>
            <textarea readonly>${escapeHtml(result.rewrittenSafeText || result.redactedText)}</textarea>
          </div>

          ${justificationInputHtml}

          <p class="inline-error" id="inline-error" role="alert" aria-live="assertive" hidden></p>

          <div class="spinner-container" id="spinner-box">
            <div class="spinner"></div>
            <div class="spinner-text" id="spinner-msg">Waiting for administrator approval...</div>
            <p class="spinner-hint" id="spinner-hint">Your ${subject} has not been sent. You can keep this tab open.</p>
            <button type="button" data-action="stop-wait">Stop waiting</button>
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
  const getSpinnerHint = () => shadow.querySelector("#spinner-hint") as HTMLElement | null;
  const getActionBar = () => shadow.querySelector("#action-bar") as HTMLElement;
  const getStopWaitBtn = () => shadow.querySelector("[data-action='stop-wait']") as HTMLButtonElement | null;

  /**
   * Errors are shown inside the dialog, not through `alert()`.
   *
   * `alert()` was the wrong tool three times over: it is a *page*-level modal, so it renders
   * outside the closed shadow root the verdict deliberately lives in; it blocks the event loop,
   * which stalls the approval poll running behind it; and its text is unstyled and
   * unattributable, so "Failed to record approval request." looked to a real user like the
   * extension itself had broken with no hint of what to do next. It also cannot be dismissed
   * by anything but a click, which strands keyboard users.
   */
  const showInlineError = (message: string) => {
    const box = shadow.querySelector("#inline-error") as HTMLElement | null;
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  };
  const clearInlineError = () => {
    const box = shadow.querySelector("#inline-error") as HTMLElement | null;
    if (!box) return;
    box.hidden = true;
    box.textContent = "";
  };
  /** Flags the justification field and puts the caret back in it, so the fix is one keystroke away. */
  const requireJustification = (message: string): string | null => {
    const input = getJustificationInput();
    const value = input?.value.trim() || "";
    if (value) {
      input?.removeAttribute("aria-invalid");
      clearInlineError();
      return value;
    }
    input?.setAttribute("aria-invalid", "true");
    showInlineError(message);
    input?.focus();
    return null;
  };

  const dismiss = () => {
    // On a block, closing the dialog records the override attempt and never lets the
    // submission through. Applies to every block, not only hard enforcement.
    if (action === "block") options.onDismissAudited?.();
    close();
  };

  shadow.querySelector("[data-action='dismiss']")?.addEventListener("click", dismiss);

  shadow.querySelector("[data-action='copy']")?.addEventListener("click", () => {
    options.onCopy?.();
    const button = shadow.querySelector("[data-action='copy']") as HTMLButtonElement | null;
    if (!button) return;
    // Confirm the copy in place. A clipboard write with no acknowledgement reads as a dead button.
    const original = button.textContent ?? "Copy";
    button.textContent = "Copied";
    const restore = setTimeout(() => { button.textContent = original; }, 1600);
    cleanups.push(() => clearTimeout(restore));
  });

  shadow.querySelector("[data-action='replace']")?.addEventListener("click", () => {
    options.onReplace?.();
    close();
  });

  shadow.querySelector("[data-action='proceed']")?.addEventListener("click", () => {
    options.onProceed?.();
    close();
  });

  // Esc closes the dialog exactly where a button already offers that, so the keyboard can do
  // nothing the mouse cannot: on a block it takes the audited-dismiss path, and where no
  // dismiss is rendered at all Esc does nothing rather than becoming a silent bypass.
  const escapable = shadow.querySelector("[data-action='dismiss']") !== null;
  if (escapable) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, true);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown, true));
  }

  // Focus lands where the user's next action is: the field they must fill, else the primary
  // button. Without this the focus ring stayed in the page behind a modal dialog.
  const initialFocus =
    getJustificationInput() ??
    (shadow.querySelector("button.primary, button.danger, button.warning-btn, .actions button") as HTMLElement | null);
  initialFocus?.focus();

  // Handle request approval polling
  const requestApprovalBtn = shadow.querySelector("[data-action='approval']");
  if (requestApprovalBtn) {
    requestApprovalBtn.addEventListener("click", async () => {
      const justificationVal = requireJustification("Enter a business justification so your administrator can act on this request.");
      if (!justificationVal) return;

      const restoreForm = () => {
        getActionBar().style.display = "flex";
        const input = getJustificationInput();
        if (input) input.disabled = false;
        getSpinnerBox().style.display = "none";
      };

      // Hide actions, show loader
      getActionBar().style.display = "none";
      const justificationEl = getJustificationInput();
      if (justificationEl) justificationEl.disabled = true;

      const spinnerBox = getSpinnerBox();
      spinnerBox.style.display = "flex";
      getSpinnerMsg().style.color = "";
      getSpinnerMsg().textContent = "Sending request to your administrator…";

      try {
        const approvalId = await options.onApproval?.(justificationVal);
        if (!approvalId) {
          throw new Error(
            `Your request could not be recorded, so nothing was sent to your administrator. Check your connection and try again${canReplace ? ", or use the safe prompt instead" : ""}.`,
          );
        }

        // Start polling
        const POLL_MS = 3000;
        const MAX_ATTEMPTS = 100; // ~5 minutes
        let pollAttempts = 0;
        const elapsed = () => {
          const seconds = pollAttempts * (POLL_MS / 1000);
          return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
        };
        getSpinnerMsg().textContent = "Waiting for administrator approval… 0:00";
        const interval = setInterval(async () => {
          pollAttempts++;
          if (pollAttempts > MAX_ATTEMPTS) {
            clearInterval(interval);
            approvalPoll = null;
            getSpinnerMsg().textContent = "No answer after 5 minutes. Nothing was sent.";
            getSpinnerMsg().style.color = "#dc2626";
            const hint = getSpinnerHint();
            if (hint) hint.textContent = "Your request is still on record — your administrator can approve it later.";
            const stop = getStopWaitBtn();
            if (stop) stop.textContent = "Back to options";
            return;
          }

          if (!options.onCheckStatus) return;
          getSpinnerMsg().textContent = `Waiting for administrator approval… ${elapsed()}`;
          const statusResult = await options.onCheckStatus(approvalId);

          if (statusResult.status === "APPROVED" || statusResult.allowed) {
            clearInterval(interval);
            approvalPoll = null;
            getSpinnerMsg().textContent = "Approved. Claiming authorization…";
            getSpinnerMsg().style.color = "#16a34a";
            const stop = getStopWaitBtn();
            if (stop) stop.style.display = "none";
            // Claim the one-time approval server-side. Only submit if the
            // claim is actually honored — never replay on a rejected claim.
            // v0.2.1 FIX: pass the approvalId so the claim references the correct request.
            const proceeded = await options.onApproved?.(approvalId);
            if (proceeded === false) {
              getSpinnerMsg().textContent = "Authorization could not be claimed. Nothing was sent.";
              getSpinnerMsg().style.color = "#dc2626";
              setTimeout(close, 2500);
            } else {
              getSpinnerMsg().textContent = `Authorized. Releasing your ${subject}…`;
              setTimeout(close, 1000);
            }
          } else if (statusResult.status === "DENIED") {
            clearInterval(interval);
            approvalPoll = null;
            getSpinnerMsg().textContent = "Your administrator denied this request. Nothing was sent.";
            getSpinnerMsg().style.color = "#dc2626";
            const stop = getStopWaitBtn();
            if (stop) stop.style.display = "none";
            setTimeout(restoreForm, 3000);
          }
        }, POLL_MS);
        approvalPoll = interval;
        activeTimers.push(interval);

      } catch (err) {
        showInlineError(err instanceof Error ? err.message : "The approval request failed. Nothing was sent.");
        restoreForm();
      }
    });
  }

  // Waiting must be interruptible: the poll runs for five minutes, and a user who decides to
  // rewrite the prompt instead had no way back to the buttons.
  getStopWaitBtn()?.addEventListener("click", () => {
    if (approvalPoll !== null) {
      clearInterval(approvalPoll);
      approvalPoll = null;
    }
    const stop = getStopWaitBtn();
    if (stop) {
      stop.textContent = "Stop waiting";
      stop.style.display = "";
    }
    const hint = getSpinnerHint();
    if (hint) hint.textContent = `Your ${subject} has not been sent. You can keep this tab open.`;
    getSpinnerMsg().style.color = "";
    getSpinnerMsg().textContent = "Waiting for administrator approval...";
    getSpinnerBox().style.display = "none";
    const input = getJustificationInput();
    if (input) input.disabled = false;
    getActionBar().style.display = "flex";
    input?.focus();
  });

  // Handle submit with justification bypass
  const bypassBtn = shadow.querySelector("[data-action='bypass']");
  if (bypassBtn) {
    bypassBtn.addEventListener("click", () => {
      const justificationVal = requireJustification("Enter a reason. It is recorded with this override in your organization's audit log.");
      if (!justificationVal) return;
      options.onBypass?.(justificationVal);
      close();
    });
  }

  // Typing clears the validation message rather than leaving stale red text on screen.
  getJustificationInput()?.addEventListener("input", () => {
    getJustificationInput()?.removeAttribute("aria-invalid");
    clearInlineError();
  });

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
