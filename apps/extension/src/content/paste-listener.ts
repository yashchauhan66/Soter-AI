import type { RuntimeResponse } from "../lib/types";
import { canApprovalRelease, interruptionLevel, isFailClosedBlock, remediationAffordances, shouldSanitizeFragment } from "../lib/scanner";
import { createApprovalLedger } from "../lib/approval-ledger";
import type { AiSiteAdapter, PromptTarget } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { showCornerNotice, noticeHiddenPayloadRemoved } from "./corner-notice";
import { getFreshLineageContext } from "../lib/lineage-context";
import { safeFragmentText } from "../lib/rewrite";
import { stripSmuggledPayload } from "../../../../packages/detectors/src/normalize";

export function installPasteListener(adapter: AiSiteAdapter) {
  // SS-7: the paste path gets its own ledger, on the same terms as the submit path — bound to
  // the origin, single-use, expiring. Previously it had none, and its `onApproval` returned
  // `null` unconditionally, so the overlay's own contract ("`null` means nothing was
  // recorded") made every paste approval fail with an error the user could not act on.
  const approvals = createApprovalLedger();

  // v0.2.2: undoing the release puts the zero-width claim back. The browser restores the document to
  // the state before the edit it is undoing, and the claim was inserted *before* that edit, so it
  // reappears — measured in Edge, a Ctrl+Z after a paste left "here is my question: ​" in the
  // composer. It is invisible, so nobody would find it, and it would be sent to the model as part of
  // the prompt: a character the extension put in the user's writing and did not take out.
  //
  // This runs on `input`, i.e. after the browser has already done whatever it decided to undo, and it
  // only ever deletes our own placeholder. It cannot alter or countermand the undo itself.
  window.addEventListener("input", (event) => {
    if ((event as InputEvent).inputType !== "historyUndo") return;
    const target = currentPromptTarget(adapter);
    if (target) stripAnchorResidue(target.element);
  }, true);

  // v0.2.1 FIX: Register on WINDOW capture to fire before any page paste handler.
  window.addEventListener("paste", (event) => {
    const target = currentPromptTarget(adapter);
    if (!target?.element.contains(event.target as Node)) return;
    const pasted = event.clipboardData?.getData("text/plain") ?? "";
    if (!pasted.trim()) return;

    // v0.2.1 FIX: ALWAYS preventDefault so the raw text never enters the page DOM.
    // The scan runs first; only after the verdict do we insert safe text.
    // This eliminates the ~400ms exposure window where the raw secret was visible.
    event.preventDefault();
    event.stopImmediatePropagation();

    // v0.2.2 FIX: claim the caret NOW, synchronously, and write the verdict into that claim.
    //
    // Cancelling the paste and re-inserting after the scan (~55 ms, measured) left the insertion
    // point to be decided ~55 ms later, by which time a user who pastes and keeps typing — the
    // ordinary way people write a prompt — has moved the caret. The old code then inserted at
    // the *current* selection and called `range.deleteContents()` on it, so the pasted fragment
    // landed in the middle of the freshly typed words and part of them was destroyed. Measured in
    // Edge: typing " for a node service" right after pasting a benign sentence produced
    // " for explain the difference … blue-green deploya node service", where the same gesture in
    // the same browser without the extension produced the correct text. Data loss in the user's
    // own prompt, on every paste, with nothing sensitive involved.
    //
    // The placeholder is inserted where the paste actually happened and moves with the document as
    // the user types, so the verdict replaces it in the right place and the caret is never yanked.
    const anchor = claimPasteAnchor(target.element);

    void sendPasteScan(pasted).then(async (response) => {
      if (!response.ok || !response.result.hasFindings) {
        // Clean paste: insert the original text after the scan confirms it's safe — minus any
        // invisible smuggled payload. A concealed instruction that no rule happened to match is
        // still not something the user chose to send, and this only removes what renders as nothing.
        const { clean, removed } = stripSmuggledPayload(pasted);
        releasePasteAnchor(anchor, target.element, clean);
        if (removed > 0) noticeHiddenPayloadRemoved("paste", removed);
        return;
      }

      const result = response.result;
      // A fragment, not a whole prompt: the "Soter sanitized this prompt before sending" footer
      // would be spliced into the middle of whatever the user is writing, and would then be sent
      // to the model as part of the question. The scrubbing is kept; the sentence is not.
      const safeText = safeFragmentText(result);

      // Every outstanding grant was issued against a policy the extension has since stopped
      // trusting, so none of them may outlive that discovery.
      if (isFailClosedBlock(result)) approvals.purge();

      // A live grant releases this paste without prompting again — the same rule the submit
      // path uses, asked *after* a fresh scan so a grant is never authority to skip scanning.
      if (canApprovalRelease(result) && (await approvals.consume({ text: pasted, origin: location.origin }))) {
        // A grant releases the user's own words, not a payload hidden inside them: nobody approved
        // an instruction they could not see, so the de-smuggled text is what gets inserted.
        const { clean, removed } = stripSmuggledPayload(pasted);
        releasePasteAnchor(anchor, target.element, clean);
        if (removed > 0) noticeHiddenPayloadRemoved("paste", removed);
        return;
      }

      // Sensitive paste: insert the REDACTED text instead of the raw text — but only when the
      // policy's action actually authorises changing the user's words. `warn` and `log_only` do not;
      // see `shouldSanitizeFragment` for the two ordinary developer pastes this was corrupting.
      const candidate = shouldSanitizeFragment(result) ? safeText : pasted;
      // De-smuggle whatever we are about to insert, and measure "did this alter the user's words?"
      // against the de-smuggled ORIGINAL. Comparing against the raw clipboard string would count the
      // removal of invisible characters as an alteration and escalate an ordinary paste to a
      // full-screen modal — the exact over-interruption v0.2.2 was measured to fix.
      const { clean: inserted, removed: hiddenRemoved } = stripSmuggledPayload(candidate);
      const visibleOriginal = stripSmuggledPayload(pasted).clean;
      releasePasteAnchor(anchor, target.element, inserted);
      if (hiddenRemoved > 0) noticeHiddenPayloadRemoved("paste", hiddenRemoved, result.detectedDataTypes);

      // v0.2.2 FIX: interrupt in proportion to what the user has to decide. `interruptionLevel`
      // holds that judgement for both enforcement paths — see lib/scanner.ts for the measurement
      // that produced it (9 of 16 ordinary work pastes raised a full-screen modal and changed
      // nothing). The comparison is against what actually landed in the composer, so a verdict
      // that left the paste alone cannot be reported as an alteration.
      if (interruptionLevel(result, inserted !== visibleOriginal) === "notice") {
        // Two notices for one paste would have contradicted each other: measured in Edge, a
        // tag-smuggled paste showed "Soter removed 78 hidden characters" and, directly beneath it,
        // "nothing was changed". Something WAS changed — the payload — so that second sentence is a
        // false claim, and under-claiming is a false claim too. The removal notice already carries
        // the finding, so it is the only one that speaks when a payload was stripped.
        if (hiddenRemoved === 0) {
          const ruleNames = (result.policy?.matchedRules ?? []).map((rule) => rule.name).filter(Boolean);
          showCornerNotice({
            tone: "info",
            key: "soter-checked",
            title: "Soter checked this paste — nothing was changed",
            lines: [
              ruleNames.length ? `Matched: ${ruleNames.join(" · ")}` : "",
              result.detectedDataTypes.length ? `Flagged as: ${result.detectedDataTypes.join(", ")}` : "",
              "Your text is in the composer exactly as you pasted it.",
            ],
            autoDismissMs: 6000,
          });
        }
        return;
      }

      // A restore that cannot find its span must not fail in silence: the user pressed the one
      // button that exists to give them their own words back. If the site has rewritten the composer
      // since the paste, nothing is overwritten — but the original goes to the clipboard and the
      // reason is stated, so the way out is still a way out.
      //
      // "Their original" is the DE-SMUGGLED original: restoring the user's visible words must never
      // put a hidden instruction back into the composer, and they never typed one.
      const restoreOriginal = () => {
        if (swapPastedText(target, inserted, visibleOriginal)) return;
        void navigator.clipboard?.writeText(visibleOriginal);
        showCornerNotice({
          tone: "warning",
          key: "soter-restore-failed",
          title: "Your original text is on the clipboard",
          lines: [
            "The composer changed after the paste, so Soter did not overwrite what is in it now.",
            "Press Ctrl+V where you want your original text.",
          ],
        });
      };

      showSoterOverlay({
        result,
        onReplace: () => {
          // SS-11: on a fail-closed block nothing may be written back into the page.
          if (!remediationAffordances(result).canReplace) return;
          // Swap only the span this paste owns — never `setText(safeText)` over the whole field,
          // which would delete whatever the user had typed around the paste. `inserted` is what is
          // actually sitting there, which for a `redact` verdict is already the safe text (so this
          // is a no-op re-assertion) and for a `warn` verdict is the user's own fragment.
          swapPastedText(target, inserted, safeText);
        },
        onCopy: () => void navigator.clipboard?.writeText(safeText),
        // v0.2.2: on the paste path "proceed" means putting the user's own fragment back where the
        // redacted one is sitting — audited, and only for a verdict the kernel says may carry the
        // original text. Without it a warning about a pasted fragment silently replaced their words
        // with a redacted version and offered no way back.
        onProceed: () => {
          if (!remediationAffordances(result).canSubmitOriginal) return;
          chrome.runtime.sendMessage({
            type: "SOTER_AUDIT_BYPASS",
            text: pasted,
            url: location.href,
            action: result.action,
            eventType: "paste",
            justification: "warning acknowledged; pasted text kept as written",
          });
          restoreOriginal();
        },
        onApproval: async (justification) =>
          new Promise<string | null>((resolve) => {
            chrome.runtime.sendMessage(
              // The justification was previously dropped on the floor here, so an admin saw a
              // bare request with no stated reason to act on.
              { type: "SOTER_REQUEST_APPROVAL", text: pasted, url: location.href, justification },
              (res: any) => resolve(res && res.approvalId ? (res.approvalId as string) : null),
            );
          }),
        onCheckStatus: async (approvalId) =>
          new Promise<{ status: string; allowed?: boolean }>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "SOTER_CHECK_APPROVAL_STATUS", approvalId },
              (res: any) => resolve((res as { status: string; allowed?: boolean }) || { status: "PENDING" }),
            );
          }),
        onApproved: async (approvalId: string) => {
          // Claim the one-time approval server-side, and only restore the raw text if the
          // broker actually honors the claim.
          const claimId = approvalId || result.policy?.auditMetadata?.approvalId || "";
          const allowed = await new Promise<boolean>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "SOTER_CLAIM_APPROVAL", requestId: claimId, destination: location.hostname },
              (res: any) => resolve(res?.allowed === true),
            );
          });
          if (!allowed) return false;
          await approvals.grant({ text: pasted, origin: location.origin, kind: "admin_approval" });
          // The redacted text is sitting in the composer; approval means the user gets the
          // original back. If the swap cannot find it (the site rewrote the field), the
          // redacted text stays and the original is handed over on the clipboard instead —
          // failing towards less exposure, never towards a button that did nothing.
          restoreOriginal();
          return true;
        },
        onBypass: (justification) => {
          chrome.runtime.sendMessage({
            type: "SOTER_AUDIT_BYPASS",
            text: pasted,
            url: location.href,
            action: result.action,
            // The gesture that was overridden was a paste, not a submit. Without this the audit
            // log contradicted the scan event for the same text, which carries `"paste"`.
            eventType: "paste",
            justification,
          });
          void approvals
            .grant({ text: pasted, origin: location.origin, kind: "self_justification" })
            .then(() => restoreOriginal());
        },
        onDismissAudited: () => {
          // The override attempt is recorded and the redacted text stays in the composer —
          // closing the dialog never restores the raw value.
          chrome.runtime.sendMessage({
            type: "SOTER_AUDIT_BYPASS",
            text: pasted,
            url: location.href,
            action: result.action,
            eventType: "paste",
            justification: "paste block dismissed (redacted text kept)",
            dismissedOnly: true,
          });
        },
        onTamper: (detail) => {
          chrome.runtime.sendMessage({
            type: "SOTER_AUDIT_BYPASS",
            text: pasted,
            url: location.href,
            action: result.action,
            eventType: "paste",
            justification: `overlay tamper detected: ${detail}`,
            dismissedOnly: true,
          });
        },
      });
    });
  }, true);
}

/**
 * Swaps just the pasted span, leaving everything the user typed around it alone.
 *
 * The paste path cannot use the submit path's whole-field `setText(safeText)`: the paste is
 * usually one fragment inside a longer prompt, so replacing the field would silently delete
 * the rest of it. `lastIndexOf` because the freshly inserted copy is the one to swap when the
 * same string appears twice. Returns `false` when the span is gone, and the caller then
 * leaves the composer as it is.
 *
 * v0.2.2 FIX: the search is done on newline-normalised text, and this is not cosmetic. A
 * contenteditable's `innerText` reports line breaks as CRLF on Windows, while `from` is the string
 * the extension itself inserted, with LF. So `lastIndexOf` returned -1 for *every multi-line paste*
 * and the swap silently did nothing: "Send as written" left the redacted text in place, and so did
 * Replace and the post-approval restore. Measured in Edge on a pasted handler containing an internal
 * URL — the user clicked the button offered to give their own words back, the click was audited as
 * an override, and their words did not come back. A dead end dressed up as a way out, on the exact
 * platform the store build ships to. Both sides are normalised, so the offset and the length used to
 * cut the span belong to the same string; the editor re-splits the lines when it is written back.
 */
function swapPastedText(target: PromptTarget, from: string, to: string): boolean {
  if (from === to) return true;
  const current = target.getText().replace(/\r\n/g, "\n");
  const needle = from.replace(/\r\n/g, "\n");
  const index = current.lastIndexOf(needle);
  if (index === -1) return false;
  target.setText(current.slice(0, index) + to + current.slice(index + needle.length));
  return true;
}

/**
 * v0.2.2 — the caret claim that makes an asynchronous verdict safe to insert.
 *
 * A paste is cancelled before the page sees it and the text is written back only after the scan
 * returns. Between those two moments the user is still typing, so "where the caret is now" is the
 * wrong answer to "where did the paste happen". A placeholder claimed synchronously answers it
 * correctly: the DOM keeps it in place as text is inserted around it, and replacing it cannot
 * disturb anything the user typed in the meantime.
 *
 * Zero-width so it is invisible in the ~55 ms it exists, and cleaned up on every exit path.
 *
 * It is a *text node*, not an empty `<span>`, and that is the whole trick. The span version was
 * inserted in exactly the right place and still lost the race, measured in Edge frame by frame:
 *
 *   t=252ms  "before <span data-soter-paste-anchor></span>"      ← claimed correctly
 *   t=265ms  "before A<span data-soter-paste-anchor></span>"     ← the user's keystroke went BEFORE it
 *   t=318ms  "before AFTPASTEDPASTEDPASTED"                      ← so the paste landed after the typing
 *
 * An empty inline element is not a caret position a contenteditable will hold: `setStartAfter(span)`
 * is normalised to the nearest text position, which is the end of the preceding text node — i.e. in
 * front of the anchor. A text node has real offsets, so the caret sits *inside* it at offset 1 and
 * every following keystroke provably lands after the claim. Release then uses `replaceData`, which
 * the DOM spec requires to shift live ranges by the length delta, so the user's caret survives the
 * substitution instead of being flung to the end of the pasted text.
 */
const TEXT_ANCHOR = "​";

type PasteAnchor =
  | { kind: "text"; node: Text }
  | { kind: "value"; field: HTMLTextAreaElement | HTMLInputElement }
  | null;

function claimPasteAnchor(element: HTMLElement): PasteAnchor {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    // Replacing the selection is what a native paste does, so doing it now is not a change in
    // behaviour — only in timing.
    element.setRangeText(TEXT_ANCHOR, start, end, "end");
    return { kind: "value", field: element };
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return null;
  const node = document.createTextNode(TEXT_ANCHOR);
  range.deleteContents();
  range.insertNode(node);
  // Inside the anchor, past its one character: a text offset the editor cannot normalise away.
  range.setStart(node, TEXT_ANCHOR.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return { kind: "text", node };
}

/** The claim can be merged into a neighbouring text node by the editor, so identity is not enough. */
function findAnchorTextNode(element: HTMLElement): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Text).data.includes(TEXT_ANCHOR)) return node as Text;
  }
  return null;
}

/**
 * Removes any zero-width claim left in the field. Bounded, because it runs on a user gesture and a
 * pathological field must not be able to spin it.
 */
function stripAnchorResidue(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    if (!element.value.includes(TEXT_ANCHOR)) return;
    const caret = element.selectionStart ?? element.value.length;
    const removedBeforeCaret = element.value.slice(0, caret).split(TEXT_ANCHOR).length - 1;
    element.value = element.value.split(TEXT_ANCHOR).join("");
    const at = Math.max(0, caret - removedBeforeCaret);
    element.setSelectionRange(at, at);
    return;
  }
  for (let guard = 0; guard < 64; guard++) {
    const node = findAnchorTextNode(element);
    if (!node) return;
    // `replaceData` shifts live ranges, so removing the placeholder does not move the user's caret.
    node.replaceData(node.data.indexOf(TEXT_ANCHOR), TEXT_ANCHOR.length, "");
  }
}

/**
 * Replaces the current selection through the editor's own insertion path, so the browser records
 * the paste as one undoable edit.
 *
 * v0.2.2 FIX: the release used to write the verdict with `replaceData` / `setRangeText`, which
 * mutate the field without going through the editing host. The native undo stack therefore never
 * learned that the paste happened, so the user's Ctrl+Z removed the last edit the *browser* had
 * recorded — the words they typed before pasting — and left the pasted text sitting there. Measured
 * in Edge: typing "here is my question: ", pasting a sentence, then Ctrl+Z left
 * "and a plain sentence pasted in the middle", where the same three gestures in the same browser
 * with no extension left "here is my question: ". The undo key destroyed the user's own writing and
 * kept what they were trying to remove.
 *
 * `execCommand("insertText")` is deprecated and is still the only API that inserts into a
 * contenteditable *as an edit*: it fires the native beforeinput/input pair the site's editor is
 * listening for and pushes exactly one undo entry. Its return value is honoured — if the host
 * refuses the command the caller falls back to the direct mutation, which is worse for undo but
 * never loses the paste.
 */
function insertTextAsEdit(text: string): boolean {
  try {
    return document.execCommand("insertText", false, text);
  } catch {
    return false;
  }
}

/**
 * Line breaks, not length, are what make an undo-integrated insert expensive: the editing host turns
 * each one into a node, and the cost grows faster than the text does. Measured in Edge, same text in
 * the same editor, median of 7 (`harness/insert-cost.mjs`):
 *
 *     19,800 chars on ONE line   →     3.7 ms
 *      4,950 chars,  76 lines    →      41 ms
 *      9,900 chars, 151 lines    →     108 ms
 *     19,800 chars, 301 lines    →     335 ms       (0.1 ms via replaceData)
 *            90 chars,  1 line   →     0.9 ms       (0.1 ms via replaceData)
 *
 * So the paste people actually make — a sentence, a stack trace, a config block, a diff — gets undo
 * integration for under a millisecond, and only a bulk paste of hundreds of lines would buy it with
 * a stall the user can feel on the thread that also handles their typing.
 *
 * Above the cap the direct mutation is used instead. The text is correct and lands in the right
 * place; what is given up is that one paste's entry on the native undo stack, which is the lesser
 * harm against freezing the tab for a third of a second and worse as the paste grows.
 */
const UNDO_INTEGRATION_MAX_LINES = 100;
const UNDO_INTEGRATION_MAX_CHARS = 100_000;

function undoIntegrationIsAffordable(text: string): boolean {
  if (text.length > UNDO_INTEGRATION_MAX_CHARS) return false;
  let lines = 1;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
    if (++lines > UNDO_INTEGRATION_MAX_LINES) return false;
  }
  return true;
}

/**
 * Writes the verdict into the claim. Falls back to inserting at the live caret when the claim is
 * gone — a site that rewrites its own editor can drop it — which is the pre-0.2.2 behaviour, i.e.
 * the worst case is what every paste used to do, not a lost paste.
 *
 * The claim is *selected* and then overwritten as an edit, rather than patched in place: that is
 * what puts the paste on the undo stack, and selecting the placeholder means the insertion still
 * lands where the paste happened however far the caret has moved since. Insertion-as-an-edit needs
 * the field to be the active element, so a user who has clicked away is served by the direct
 * mutation instead — their focus is not stolen back, and undo where they are not typing is moot.
 */
function releasePasteAnchor(anchor: PasteAnchor, element: HTMLElement, text: string) {
  if (anchor?.kind === "value") {
    const field = anchor.field;
    const index = field.value.indexOf(TEXT_ANCHOR);
    if (index === -1) {
      insertTextAtCursor(element, text);
      return;
    }
    if (field === document.activeElement && undoIntegrationIsAffordable(text)) {
      // Where the user's caret is *now*: they have been typing while the scan ran, and an edit
      // leaves the caret at the end of what it inserted. See `restoreCaret`.
      const start = field.selectionStart ?? 0;
      const end = field.selectionEnd ?? start;
      field.setSelectionRange(index, index + TEXT_ANCHOR.length);
      if (insertTextAsEdit(text)) {
        const delta = text.length - TEXT_ANCHOR.length;
        const shift = (at: number) => (at > index ? at + delta : at);
        field.setSelectionRange(shift(start), shift(end));
        return;
      }
    }
    // "preserve" keeps the user's own selection, adjusted for the length change, instead of
    // snapping the caret to the end of the text we just wrote.
    field.setRangeText(text, index, index + TEXT_ANCHOR.length, "preserve");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (anchor?.kind === "text") {
    const node =
      anchor.node.isConnected && anchor.node.data.includes(TEXT_ANCHOR) ? anchor.node : findAnchorTextNode(element);
    if (!node) {
      insertTextAtCursor(element, text);
      return;
    }
    const index = node.data.indexOf(TEXT_ANCHOR);
    const active = document.activeElement;
    const focused = element === active || (active instanceof Node && element.contains(active));
    if (focused && undoIntegrationIsAffordable(text)) {
      // Where the user is, measured before the edit moves them. See `charactersAfterCaret`.
      const tail = charactersAfterCaret(element, node, index + TEXT_ANCHOR.length);
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + TEXT_ANCHOR.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (insertTextAsEdit(text)) {
        if (tail !== null) restoreCaretByTail(element, tail);
        return;
      }
    }
    // `replaceData` is specified to shift live ranges by the length delta, so the caret the user
    // has since moved survives the substitution instead of being flung to the end of the paste.
    node.replaceData(index, TEXT_ANCHOR.length, text);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return;
  }
  insertTextAtCursor(element, text);
}

/**
 * v0.2.2 FIX: an edit leaves the caret at the end of the text it inserted, which is *behind* the
 * keystrokes the user made while the scan was running — so everything they typed next landed in the
 * middle of what they had already written.
 *
 * `replaceData` is specified to shift live ranges, so the caret used to survive the substitution for
 * free. Insertion-as-an-edit gives no such guarantee: the editing host places the caret itself.
 * Measured in Edge, pasting a sentence and continuing to type immediately, the composer held
 * "…for a node service— and how does that affect rollback time?" where the identical gesture with
 * the extension off produced "…for a node service — and how…": the space the user typed first had
 * been carried to the far end of the prompt, because from that keystroke on they were typing in
 * front of their own text. Nothing was lost, which is why it took a byte-comparison to see it —
 * their words were simply no longer in the order they wrote them.
 *
 * The position is recorded as *how many characters follow the caret*, not as a (node, offset) pair.
 * The insertion goes in front of the caret, so that count is unchanged by it, and unlike a node
 * reference it survives the editing host splitting the node it inserts into — which is exactly what
 * it does for a multi-line paste.
 *
 * Returns null when the caret is not after the claim (nothing was typed during the scan): there is
 * then nothing to preserve, and the browser's own placement is already where the user is.
 */
function charactersAfterCaret(element: HTMLElement, anchor: Text, anchorEnd: number): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const caret = selection.getRangeAt(0);
  if (!caret.collapsed || !element.contains(caret.endContainer)) return null;
  try {
    const measure = document.createRange();
    measure.setEnd(element, element.childNodes.length);
    measure.setStart(anchor, anchorEnd);
    const fromAnchor = measure.toString().length;
    measure.setStart(caret.endContainer, caret.endOffset);
    const fromCaret = measure.toString().length;
    return fromCaret <= fromAnchor ? fromCaret : null;
  } catch {
    return null;
  }
}

/** Puts the caret back the counted number of characters from the end of the field. */
function restoreCaretByTail(element: HTMLElement, tail: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  let remaining = tail;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (remaining <= node.data.length) {
      const range = document.createRange();
      range.setStart(node, node.data.length - remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= node.data.length;
  }
  // The text after the caret is gone (the site rewrote its editor): leave the caret where the edit
  // put it rather than guessing at a position in a document this no longer describes.
}

/**
 * v0.2.1: Inserts text at the cursor position in the target element.
 * Works with contenteditable, textarea, and input elements.
 * Uses execCommand for contenteditable (preserves undo stack) and
 * setRangeText for textarea/input.
 */
function insertTextAtCursor(element: HTMLElement, text: string) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    element.setRangeText(text, start, end, "end");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  // contenteditable
  element.focus();
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    element.textContent = (element.textContent ?? "") + text;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function sendPasteScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => {
    void getFreshLineageContext().then((lineageContext) => {
      chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "paste", lineageContext }, (response) => {
        resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." });
      });
    });
  });
}
