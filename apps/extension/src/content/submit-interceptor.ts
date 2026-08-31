import { canApprovalRelease, interruptionLevel, isFailClosedBlock, remediationAffordances, shouldPreventSubmit } from "../lib/scanner";
import type { RuntimeResponse } from "../lib/types";
import { createApprovalLedger, createReplayBypass, type ReplayBypass } from "../lib/approval-ledger";
import type { AiSiteAdapter, PromptTarget } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { showCornerNotice, noticeHiddenPayloadRemoved } from "./corner-notice";
import { safeFragmentText } from "../lib/rewrite";
import { getFreshLineageContext } from "../lib/lineage-context";
import { stripSmuggledPayload } from "../../../../packages/detectors/src/normalize";

/**
 * @param failClosedOnScanError whether the org has asked for "if Soter cannot check it, do not
 *   send it". Read from the destination context at install time, because the state it comes from
 *   is unreachable in exactly the situation it governs — a scan that could not run.
 */
export function installSubmitInterceptor(adapter: AiSiteAdapter, failClosedOnScanError = false) {
  const replayBypass = createReplayBypass<HTMLElement>();
  const approvals = createApprovalLedger();

  // v0.2.2 FIX: one physical click on a submit control fires pointerdown, mousedown AND click, and
  // all three are hooked (sites submit on different ones). Each ran the full scan+replay, so a
  // single Send-button press produced two or three synthetic replay clicks — the page's own send
  // handler fired more than once and the message was sent twice. This claims the gesture on its
  // first phase; the later phases of the SAME gesture fall through until handleIntent clears it.
  let pointerGestureActive = false;

  const handleIntent = async (event: Event, target: PromptTarget | null) => {
    try {
      await handleIntentInner(event, target);
    } finally {
      // One physical pointer gesture is one submission. Cleared only after the whole decision
      // resolves, so the same gesture's later phases stay suppressed for the ~55 ms the scan runs.
      pointerGestureActive = false;
    }
  };

  const handleIntentInner = async (event: Event, target: PromptTarget | null) => {
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

    // v0.2.2 FIX: neutralize an invisible smuggled payload before ANY path below can replay the
    // gesture. This sits after the scan on purpose — the scan must see the decoded payload so the
    // finding is real — and before every `replay()`, including the fail-open scan-error path and the
    // overlay's own "send as written", because the page sends whatever the composer holds.
    //
    // Why strip rather than block: a hidden "ignore all previous instructions" reaches the model but
    // never reaches the user's eyes, so there is nothing for them to decide and no way for them to
    // proofread it. Holding their message hostage over characters they cannot see interrupts work
    // they meant to do; sending it ships an attack they never wrote. Removing exactly the invisible
    // carriers does neither — measured below, every visible character survives byte-identical.
    const smuggled = stripSmuggledPayload(text);
    if (smuggled.removed > 0) {
      target.setText(smuggled.clean);
      noticeHiddenPayloadRemoved("message", smuggled.removed, decision.response.ok ? decision.response.result.detectedDataTypes : []);
    }

    // v0.2.2 FIX: a scan that could not run must never eat the user's message in silence.
    //
    // `ok: false` does not mean "unsafe" — a policy decision always arrives as `ok: true` with an
    // action, fail-closed blocks included. It means the check itself did not happen: the MV3
    // service worker was asleep or restarting, the extension was updated or reloaded under an open
    // tab ("Extension context invalidated"), the user toggled Soter off from the popup while this
    // tab stayed open, or `scanPrompt` threw. The gesture had already been cancelled two lines
    // above, and this branch used to `return` — so the user pressed Enter, nothing was sent, no
    // dialog appeared, and no notice explained it. Their prompt simply sat there, and pressing
    // Enter again did the same thing. That is the most damaging thing this extension could do to
    // someone's work, and it was invisible.
    //
    // So: say what happened, every time. If the org asked to fail closed when Soter cannot check,
    // the message is withheld and the notice says so plainly; otherwise the work goes through
    // unchecked and the notice says that instead. Silence is not one of the options.
    if (!decision.response.ok) {
      const reason = decision.response.message || "The Soter background service did not respond.";
      if (failClosedOnScanError) {
        showCornerNotice({
          tone: "critical",
          key: "soter-scan-unavailable",
          title: "Not sent — Soter could not check this message",
          lines: [reason, "Your organization's policy blocks sending when Soter is unavailable.", "Reload the page or try again in a moment."],
        });
        return;
      }
      showCornerNotice({
        tone: "warning",
        key: "soter-scan-unavailable",
        title: "Sent without a Soter check",
        lines: [reason, "Soter could not scan this message, so it was not held up. Reload the page to restore scanning."],
      });
      replay(event, replayBypass, adapter);
      return;
    }

    const result = decision.response.result;

    if (!decision.intercept) {
      replay(event, replayBypass, adapter);
      return;
    }

    // v0.2.2 FIX: a finding is not by itself a reason to stop the user. See `interruptionLevel`
    // in lib/scanner.ts. Compared against the footer-stripped safe text, because a `redact`-level
    // verdict always appends the explanatory footer and would otherwise look like an alteration
    // even when not one character of the user's own words changed.
    if (interruptionLevel(result, safeFragmentText(result).trim() !== text) === "notice") {
      // Silent when a payload was stripped: "It was sent exactly as you wrote it" would be untrue
      // (an invisible instruction was taken out), and the removal notice above already said so
      // along with the finding. One accurate notice beats two that disagree.
      if (smuggled.removed === 0) {
        const ruleNames = Array.from(new Set(result.policy.matchedRules.map((rule) => rule.name).filter(Boolean)));
        showCornerNotice({
          tone: "info",
          key: "soter-checked",
          title: "Soter checked this message — nothing was changed",
          lines: [
            ruleNames.length ? `Matched: ${ruleNames.join(" · ")}` : "",
            result.detectedDataTypes.length ? `Flagged as: ${result.detectedDataTypes.join(", ")}` : "",
            "It was sent exactly as you wrote it, and the match is in your audit log.",
          ],
          autoDismissMs: 6000,
        });
      }
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
        // De-smuggled: the "safe" variant is derived from the text the user pasted, so on a `warn`
        // it still carries the hidden payload verbatim. Writing that back would undo the strip above.
        target.setText(stripSmuggledPayload(safeText).clean);
        // No grant is recorded for the safe variant, and none is needed: the redacted text
        // re-scans clean, so if the synthetic click below is swallowed the user's next
        // genuine click is released by a fresh scan rather than by a stored token.
        replay(event, replayBypass, adapter);
      },
      onCopy: () => void navigator.clipboard?.writeText(result.rewrittenSafeText || result.redactedText),
      // v0.2.2: the way out of a warning that is neither "send different words" nor "give up".
      // The overlay only renders it when `remediationAffordances().canSubmitOriginal` is true, so
      // a block, an approval request and every fail-closed state are structurally excluded; this
      // guard repeats the question so an injected click on a stale overlay cannot reach `replay`.
      onProceed: () => {
        if (!remediationAffordances(result).canSubmitOriginal) return;
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          eventType: "submit",
          justification: "warning acknowledged; sent as written",
        });
        replay(event, replayBypass, adapter);
      },
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
        // Block dismissed: audit the override attempt. Do NOT whitelist or replay — the
        // submission stays blocked. Every block offers this exit now, not only a
        // hard-enforcement one, so the recorded reason no longer claims otherwise.
        const hardEnforced = result.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block");
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text,
          url: location.href,
          action: result.action,
          justification: hardEnforced
            ? "hard-enforcement block dismissed (no submit)"
            : "block dismissed (no submit)",
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
  //
  // v0.2.2 FIX: pointerdown, mousedown and click are all hooked because pages submit on different
  // ones, but they are three phases of ONE press — not three submissions. Only the first phase
  // scans. The later phases are still cancelled, so a page that submits on mousedown cannot run
  // ahead of a verdict that pointerdown is still fetching, but they do not scan, audit, overlay or
  // replay a second time. Measured in Edge before this: one click on Send called the page's own
  // send handler twice.
  const onPointerPhase = (event: Event) => {
    const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
    // SS-12: single-use and time-boxed. A token that was armed but never consumed (the site
    // re-rendered the button, the synthetic click was swallowed) expires instead of leaving
    // that element permanently unscanned, and falls through to the scan below.
    if (element instanceof HTMLElement && replayBypass.consume(element)) return;
    if (!element || !adapter.isSubmitControl(element)) return;
    if (pointerGestureActive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    pointerGestureActive = true;
    void handleIntent(event, currentPromptTarget(adapter));
  };

  window.addEventListener("click", onPointerPhase, true);
  // Some pages trigger submit on mousedown/pointerdown instead of click.
  window.addEventListener("mousedown", onPointerPhase, true);
  window.addEventListener("pointerdown", onPointerPhase, true);

  // v0.2.2 FIX: one Enter press is one submission, so it is scanned once.
  //
  // `keydown` and `keyup` are both hooked because sites differ in which one they send on. Both were
  // running the full path, so a single Enter produced two scans, two audit events and two overlays
  // stacked on top of each other — the user dismissing the visible one found another underneath.
  // Once keydown has claimed the press, its keyup is still cancelled (a keyup-submitting page must
  // not slip past the dialog that keydown put on screen) but it is not scanned or shown again.
  let enterClaimedByKeyDown = false;

  // v0.2.1 FIX: Register keydown on WINDOW capture to beat page document_start listeners.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = currentPromptTarget(adapter);
    if (target?.element.contains(event.target as Node)) {
      enterClaimedByKeyDown = true;
      void handleIntent(event, target);
    }
  }, true);

  // v0.2.1 FIX: Also hook keyup — some pages send on keyup instead of keydown.
  window.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = currentPromptTarget(adapter);
    if (!target?.element.contains(event.target as Node)) return;
    if (enterClaimedByKeyDown) {
      enterClaimedByKeyDown = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    void handleIntent(event, target);
  }, true);

  // v0.2.2 FIX: there is deliberately NO `beforeinput` submit hook.
  //
  // It used to catch `inputType === "insertLineBreak"` as "a last-resort catch for form submissions
  // triggered by input events". That input type is not a submission — it is Shift+Enter, the gesture
  // every one of these composers uses for a newline. So the hook cancelled the newline and ran the
  // submit path on it. Measured in Edge: with the pre-0.2.2 `replay` the line break was silently
  // swallowed (Shift+Enter did nothing at all, and multi-line prompts became impossible to type);
  // once `replay` learned to reach the site's send control, the same hook turned Shift+Enter into
  // "send this message now" — the extension submitting the user's half-written prompt for them.
  //
  // Nothing is lost by removing it. A plain Enter is caught by the keydown/keyup hooks above, which
  // are on window capture and therefore run before the page's own listener, so a site that submits
  // on Enter is still intercepted. A soft line break is not a submission and there is nothing to
  // scan: no text is leaving the page.
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

/**
 * v0.2.2 FIX: replay the gesture that the user actually made, not the event object that happened
 * to reach this closure last.
 *
 * One Enter press fires `keydown` **and** `keyup`, and both are hooked (some sites send on keyup).
 * Both cancel, both scan, both raise an overlay; the second one wins the screen. So the overlay the
 * user clicks "Send as written" on is normally the *keyup* one — and this function's send-button
 * branch was gated on `event.type === "keydown"`, so keyup fell through to `target.click()` on the
 * composer div, which submits nothing. Measured in Edge: the click landed, `onProceed` ran, the
 * audit was written, and the message was never sent. The dead end the proceed button exists to
 * remove was still there for every keyboard user.
 *
 * A keyboard submit is therefore replayed through the site's send control whatever key phase
 * delivered it, and only a real pointer gesture on a control replays as a click on that control.
 * `beforeinput` is deliberately not in that set: see the note where its hook used to be — the only
 * thing that ever delivered it here was Shift+Enter, and routing a line break to the send control
 * sends the user's unfinished message.
 */
function replay(event: Event, replayBypass: ReplayBypass<HTMLElement>, adapter?: AiSiteAdapter) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const keyboardSubmit = event.type === "keydown" || event.type === "keyup";
  if (keyboardSubmit) {
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
