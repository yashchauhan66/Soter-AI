import { canApprovalRelease, isFailClosedBlock, remediationAffordances, shouldPreventSubmit } from "../lib/scanner";
import type { RuntimeResponse } from "../lib/types";
import { createApprovalLedger, createReplayBypass, type ReplayBypass } from "../lib/approval-ledger";
import type { AiSiteAdapter, PromptTarget } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installSubmitInterceptor(adapter: AiSiteAdapter) {
  const replayBypass = createReplayBypass<HTMLElement>();
  const approvals = createApprovalLedger();

  const handleIntent = async (event: Event, target: PromptTarget | null) => {
    if (!target) return;
    const text = target.getText().trim();
    if (!text) return;

    // SS-7: the gesture is stopped and the text is scanned *first*, unconditionally. The
    // previous `approvedPrompts.has(text)` short-circuit sat above this line, so an approval
    // granted once kept releasing that exact string with no scan at all — through a policy
    // change, an emergency lockdown, or a tampered bundle arriving afterwards.
    event.preventDefault();
    event.stopImmediatePropagation();

    const decision = await evaluateSubmitInterception(text, (value) => sendScan(value, "submit"));

    // If scanning failed (e.g. offline) and fail-closed is active, scanner.ts returns a 'block' action result.
    if (!decision.response.ok) {
      // In case the message passing itself returned an error (e.g. extension state could not be loaded)
      return;
    }

    const result = decision.response.result;

    if (!decision.intercept) {
      replay(event, replayBypass, adapter);
      return;
    }

    // Every outstanding grant was issued against a policy the extension has since stopped
    // trusting, so none of them may outlive that discovery.
    if (isFailClosedBlock(result)) approvals.purge();

    // A live grant releases this submission only if the kernel says this decision is
    // releasable. The order matters: an unreleasable decision must not spend the grant.
    if (canApprovalRelease(result) && (await approvals.consume({ text, origin: location.origin }))) {
      replay(event, replayBypass, adapter);
      return;
    }

    showSoterOverlay({
      result,
      onReplace: () => {
        // SS-11: the kernel decides whether a remediation path exists at all. On a
        // fail-closed block (policy tamper / unsigned-but-required / offline fail-closed)
        // nothing may be written back into the page and nothing may be replayed — the
        // overlay does not render this button, and this guard means an injected click on a
        // stale overlay cannot reach the submit path either.
        if (!remediationAffordances(result).canReplace) return;
        const safeText = result.rewrittenSafeText || result.redactedText;
        target.setText(safeText);
        // No grant is recorded for the safe variant, and none is needed: the redacted text
        // re-scans clean, so if the synthetic click below is swallowed the user's next
        // genuine click is released by a fresh scan rather than by a stored token.
        replay(event, replayBypass, adapter);
      },
      onCopy: () => void navigator.clipboard?.writeText(result.rewrittenSafeText || result.redactedText),
      onApproval: async (justification) => {
        return new Promise<string | null>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SOTER_REQUEST_APPROVAL", text, url: location.href, justification },
            (res: any) => {
              if (res && res.approvalId) {
                resolve(res.approvalId as string);
              } else {
                resolve(null);
              }
            }
          );
        });
      },
      onCheckStatus: async (approvalId) => {
        return new Promise<{ status: string; allowed?: boolean }>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SOTER_CHECK_APPROVAL_STATUS", approvalId },
            (res: any) => resolve((res as { status: string; allowed?: boolean }) || { status: "PENDING" })
          );
        });
      },
      onApproved: async (approvalId: string) => {
        // Claim the one-time approval server-side. Only grant + replay the ORIGINAL prompt
        // if the broker actually honors the claim. This closes the hole where a client could
        // replay on an unhonored/spoofed claim.
        // v0.2.1 FIX: use the approvalId passed from the polling loop instead of
        // relying on auditMetadata which may not have it set yet.
        const claimId = approvalId || result.policy?.auditMetadata?.approvalId || "";
        const allowed = await new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "SOTER_CLAIM_APPROVAL",
              requestId: claimId,
              destination: location.hostname,
            },
            (res: any) => resolve(res?.allowed === true),
          );
        });
        if (!allowed) return false;
        // SS-7: bound to the origin the claim named, spent by the first submission that uses
        // it — the replay below, or one deliberate re-click if the site re-rendered its send
        // button and swallowed the synthetic one — and expiring either way.
        await approvals.grant({ text, origin: location.origin, kind: "admin_approval" });
        replay(event, replayBypass, adapter);
        return true;
      },
      onDismissAudited: () => {
        // Hard-enforcement block dismissed: audit the override attempt. Do NOT
        // whitelist or replay — the submission stays blocked.
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          justification: "hard-enforcement block dismissed (no submit)",
          dismissedOnly: true,
        });
      },
      onTamper: (detail) => {
        // SS-6: a page that removes or neutralises the verdict is attempting an override, so
        // it is audited on the existing bypass channel with `dismissedOnly` — nothing was
        // submitted, and no new message type or network surface is introduced for it.
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          justification: `overlay tamper detected: ${detail}`,
          dismissedOnly: true,
        });
      },
      onBypass: (justification) => {
        // require_justification self-service bypass: audit, grant, and replay.
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          justification
        });
        void approvals
          .grant({ text, origin: location.origin, kind: "self_justification" })
          .then(() => replay(event, replayBypass, adapter));
      }
    });
  };

  // v0.2.1 FIX: Register on WINDOW (not document) in CAPTURE phase.
  // Window capture fires before document capture regardless of registration order,
  // closing the bypass where a page registers capture listeners at document_start.
  window.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
    // SS-12: single-use and time-boxed. A token that was armed but never consumed (the site
    // re-rendered the button, the synthetic click was swallowed) expires instead of leaving
    // that element permanently unscanned, and falls through to the scan below.
    if (element instanceof HTMLElement && replayBypass.consume(element)) {
      return;
    }
    if (element && adapter.isSubmitControl(element)) void handleIntent(event, currentPromptTarget(adapter));
  }, true);

  // v0.2.1 FIX: Also intercept mousedown and pointerdown in capture phase.
  // Some pages trigger submit on mousedown/pointerdown instead of click.
  window.addEventListener("mousedown", (event) => {
    const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
    if (element instanceof HTMLElement && replayBypass.consume(element)) return;
    if (element && adapter.isSubmitControl(element)) void handleIntent(event, currentPromptTarget(adapter));
  }, true);

  window.addEventListener("pointerdown", (event) => {
    const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
    if (element instanceof HTMLElement && replayBypass.consume(element)) return;
    if (element && adapter.isSubmitControl(element)) void handleIntent(event, currentPromptTarget(adapter));
  }, true);

  // v0.2.1 FIX: Register keydown on WINDOW capture to beat page document_start listeners.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = currentPromptTarget(adapter);
    if (target?.element.contains(event.target as Node)) {
      void handleIntent(event, target);
    }
  }, true);

  // v0.2.1 FIX: Also hook keyup — some pages send on keyup instead of keydown.
  window.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = currentPromptTarget(adapter);
    if (target?.element.contains(event.target as Node)) {
      void handleIntent(event, target);
    }
  }, true);

  // v0.2.1 FIX: Hook beforeinput as a last-resort catch for form submissions
  // triggered by input events (e.g. some frameworks submit on input change).
  window.addEventListener("beforeinput", (event) => {
    if (event.inputType !== "insertLineBreak") return;
    const target = currentPromptTarget(adapter);
    if (target?.element.contains(event.target as Node)) {
      void handleIntent(event, target);
    }
  }, true);
}

export async function evaluateSubmitInterception(
  text: string,
  scan: (text: string) => Promise<RuntimeResponse>,
) {
  const response = await scan(text);
  if (!response.ok) return { intercept: true, response };
  return {
    intercept: response.result.hasFindings || shouldPreventSubmit(response.result.action),
    response,
  };
}

function sendScan(text: string, eventType: "submit" | "paste" | "scan" | "context_menu") {
  return new Promise<RuntimeResponse>((resolve) => {
    void getFreshLineageContext().then((lineageContext) => {
      chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType, lineageContext }, (response) => {
        resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." });
      });
    });
  });
}

function replay(event: Event, replayBypass: ReplayBypass<HTMLElement>, adapter?: AiSiteAdapter) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (event.type === "keydown") {
    if (adapter) {
      const submitControls = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"));
      const submitBtn = submitControls.find((btn) => adapter.isSubmitControl(btn)) as HTMLElement;
      if (submitBtn) {
        replayBypass.arm(submitBtn);
        submitBtn.click();
        return;
      }
    }
    const form = target.closest("form");
    if (form) {
      try {
        form.requestSubmit();
      } catch {
        form.submit();
      }
      return;
    }
  }

  replayBypass.arm(target);
  setTimeout(() => target.click(), 0);
}
