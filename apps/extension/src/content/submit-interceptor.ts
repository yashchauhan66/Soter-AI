import { shouldPreventSubmit } from "../lib/scanner";
import type { RuntimeResponse } from "../lib/types";
import type { AiSiteAdapter, PromptTarget } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installSubmitInterceptor(adapter: AiSiteAdapter) {
  const replayBypass = new WeakSet<HTMLElement>();
  const approvedPrompts = new Set<string>();

  const handleIntent = async (event: Event, target: PromptTarget | null) => {
    if (!target) return;
    const text = target.getText().trim();
    if (!text) return;

    // Check if this prompt has been approved or bypassed
    if (approvedPrompts.has(text)) {
      replay(event, replayBypass, adapter);
      return;
    }

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

    showSoterOverlay({
      result,
      onReplace: () => {
        const safeText = result.rewrittenSafeText || result.redactedText;
        target.setText(safeText);
        approvedPrompts.add(safeText);
        // Automatically replay submit event
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
      onApproved: () => {
        // Claim the one-time approval server-side. Only whitelist + replay the
        // ORIGINAL prompt if the broker actually honors the claim. This closes
        // the hole where a client could replay on an unhonored/spoofed claim.
        return new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "SOTER_CLAIM_APPROVAL",
              requestId: result.policy?.auditMetadata?.approvalId || "",
              destination: location.hostname,
            },
            (res: any) => {
              const allowed = res?.allowed === true;
              if (allowed) {
                approvedPrompts.add(text);
                replay(event, replayBypass, adapter);
              }
              resolve(allowed);
            }
          );
        });
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
      onBypass: (justification) => {
        // require_justification self-service bypass: audit, whitelist, and replay.
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          justification
        });
        approvedPrompts.add(text);
        replay(event, replayBypass, adapter);
      }
    });
  };

  document.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
    if (element instanceof HTMLElement && replayBypass.has(element)) {
      replayBypass.delete(element);
      return;
    }
    if (element && adapter.isSubmitControl(element)) void handleIntent(event, currentPromptTarget(adapter));
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = currentPromptTarget(adapter);
    if (target?.element.contains(event.target as Node)) {
      // Avoid processing twice if the event propagates
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

function replay(event: Event, replayBypass: WeakSet<HTMLElement>, adapter?: AiSiteAdapter) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (event.type === "keydown") {
    if (adapter) {
      const submitControls = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"));
      const submitBtn = submitControls.find((btn) => adapter.isSubmitControl(btn)) as HTMLElement;
      if (submitBtn) {
        replayBypass.add(submitBtn);
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

  replayBypass.add(target);
  setTimeout(() => target.click(), 0);
}
