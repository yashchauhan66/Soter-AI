/**
 * v0.2.2 — the extension may not stop the user's work more than the verdict warrants.
 *
 * Measured in real Edge against the built extension, on a fresh unenrolled install with the policy
 * `lib/storage.ts` actually ships: 9 of 16 completely ordinary work pastes raised a full-screen
 * modal with a page-wide backdrop, and in all 9 the text was handed back byte for byte unchanged.
 * The interrupt gate was `hasFindings` alone, and the only response to a finding was that modal.
 *
 * Worse, on the submit path the same verdicts *withheld the message*: the gesture was cancelled,
 * "Dismiss" does not submit, and the only other button substituted different words — so a user who
 * had merely been warned about their own React component could not send it at all. And a scan that
 * could not run (`ok: false` — a sleeping MV3 worker, a reloaded extension, an exception) hit a bare
 * `return` after `preventDefault()`, so Enter did nothing, forever, with no dialog and no notice.
 *
 * These tests pin the corrected proportions in both directions: no interruption for a finding that
 * changes nothing, and no weakening of the verdicts that must interrupt.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getState } from "../../apps/extension/src/lib/storage";
import { interruptionLevel, scanPrompt, shouldSanitizeFragment } from "../../apps/extension/src/lib/scanner";
import { safeFragmentText } from "../../apps/extension/src/lib/rewrite";
import { looksLikePolicyBundle } from "../../apps/extension/src/background/policy-sync";
import type { ScanResult } from "../../apps/extension/src/lib/types";

const storage = new Map<string, unknown>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.map((key) => [key, storage.get(key)]));
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) storage.set(key, value);
      },
    },
  },
  runtime: { sendMessage() {} },
  alarms: { create() {} },
};

const SOURCE = {
  paste: readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/content/paste-listener.ts"), "utf8"),
  submit: readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/content/submit-interceptor.ts"), "utf8"),
  worker: readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"), "utf8"),
  content: readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/content/index.ts"), "utf8"),
  overlay: readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/content/overlay.ts"), "utf8"),
};

/** A minimal result with only the fields `interruptionLevel` reads. */
function verdict(action: ScanResult["action"], hasFindings: boolean): ScanResult {
  return {
    hasFindings,
    riskScore: hasFindings ? 40 : 0,
    detectedDataTypes: hasFindings ? ["source_code"] : [],
    findings: [],
    action,
    redactedText: "text",
    rewrittenSafeText: "text",
    scannedAt: new Date(0).toISOString(),
    policy: {
      action,
      severity: "medium",
      matchedRules: [{ id: "r", name: "Redact business-sensitive text", action, severity: "medium" }],
      userMessage: "",
      adminMessage: "",
      redactedText: "text",
      rewrittenSafeText: "text",
      auditMetadata: {},
    },
  } as unknown as ScanResult;
}

/* ── The rule itself ──────────────────────────────────────────────────────── */

test("PI-900: every verdict that withholds the user's text still interrupts", () => {
  for (const action of ["block", "require_approval", "require_justification"] as const) {
    assert.equal(interruptionLevel(verdict(action, true), false), "decision",
      `${action} withholds the submission, so the user must be shown it`);
    // Even with nothing detected — a fail-closed block carries no findings of its own.
    assert.equal(interruptionLevel(verdict(action, false), false), "decision",
      `${action} must interrupt regardless of hasFindings`);
  }
});

test("PI-901: altered text always interrupts, whatever the action", () => {
  for (const action of ["allow", "warn", "redact"] as const) {
    assert.equal(interruptionLevel(verdict(action, true), true), "decision",
      "nobody may have their words changed without being told");
  }
});

test("PI-902: a finding that withholds nothing and changes nothing is a notice, not a modal", () => {
  assert.equal(interruptionLevel(verdict("redact", true), false), "notice");
  assert.equal(interruptionLevel(verdict("warn", true), false), "notice");
  assert.equal(interruptionLevel(verdict("allow", true), false), "notice");
});

test("PI-903: nothing found means nothing said", () => {
  assert.equal(interruptionLevel(verdict("allow", false), false), "none");
});

/* ── The same rule against the real scanner and the shipped default policy ─── */

test("PI-904: the React component that raised 9 of 16 modals in Edge now raises a notice", async () => {
  const state = await getState();
  const component = [
    "review this component:",
    "export function SearchBox({ onQuery }) {",
    '  const [value, setValue] = useState("");',
    "  return <input value={value} onChange={(e) => setValue(e.target.value)} />;",
    "}",
  ].join("\n");
  const result = scanPrompt(component, "https://claude.ai/chat", state, "paste");

  // The finding is real and is still recorded — this fix does not silence the detector.
  assert.equal(result.hasFindings, true, "the business-content rule still matches");
  assert.equal(result.action, "redact");
  // And it changes not one character of what the user wrote.
  const safe = safeFragmentText(result);
  assert.equal(safe, component, "nothing was redacted, so nothing was altered");
  assert.equal(interruptionLevel(result, safe !== component), "notice",
    "a match that alters nothing and withholds nothing must not take over the page");
});

test("PI-905: a leaked AWS key still stops the user dead", async () => {
  const state = await getState();
  const result = scanPrompt("deploy with AKIAIOSFODNN7EXAMPLE please", "https://claude.ai/chat", state, "paste");
  assert.equal(result.action, "block");
  const safe = safeFragmentText(result);
  assert.equal(interruptionLevel(result, safe !== "deploy with AKIAIOSFODNN7EXAMPLE please"), "decision");
  assert.equal(safe.includes("AKIAIOSFODNN7EXAMPLE"), false, "and the key never goes back into the page");
});

test("PI-906: India PII still asks for approval", async () => {
  const state = await getState();
  const result = scanPrompt("employee aadhaar 4321 8765 2109 needs onboarding", "https://claude.ai/chat", state, "paste");
  assert.equal(result.action, "require_approval");
  assert.equal(interruptionLevel(result, false), "decision");
});

/* ── The extension may not enforce more than the policy says ───────────────── */

test("PI-907: only an action that authorises altering text may alter the user's paste", () => {
  for (const action of ["redact", "rewrite", "block", "require_approval", "require_justification"] as const) {
    assert.equal(shouldSanitizeFragment(verdict(action, true)), true, `${action} substitutes the safe fragment`);
  }
  for (const action of ["allow", "log_only", "warn"] as const) {
    assert.equal(shouldSanitizeFragment(verdict(action, true)), false,
      `${action} does not authorise changing the user's words — the policy vocabulary separates it from redact/rewrite on purpose`);
  }
});

test("PI-908: the two developer pastes that were being rewritten under a warn verdict", async () => {
  const state = await getState();
  for (const text of [
    "curl http://10.4.12.9:8080/health returns nothing, what should I check",
    "clone this and tell me what the build step does: git@github.com:acme-internal/billing-service.git",
  ]) {
    const result = scanPrompt(text, "https://claude.ai/chat", state, "paste");
    assert.equal(result.action, "warn", `measured verdict for ${JSON.stringify(text.slice(0, 40))}`);
    assert.equal(result.hasFindings, true, "the finding is still made and still audited");
    // What used to land in the composer, and what lands there now.
    assert.notEqual(safeFragmentText(result), text, "the sanitizer would still have changed it");
    assert.equal(shouldSanitizeFragment(result), false);
    const inserted = shouldSanitizeFragment(result) ? safeFragmentText(result) : text;
    assert.equal(inserted, text, "the user's own text reaches the composer");
    assert.equal(interruptionLevel(result, inserted !== text), "notice", "and the page is not taken over");
  }
});

test("PI-909: a secret is still never written back into the page by this route", async () => {
  const state = await getState();
  for (const text of ["deploy with AKIAIOSFODNN7EXAMPLE please", "employee aadhaar 4321 8765 2109 needs onboarding"]) {
    const result = scanPrompt(text, "https://claude.ai/chat", state, "paste");
    assert.equal(shouldSanitizeFragment(result), true,
      "every action that withholds a submission still substitutes the sanitized fragment");
  }
});

test("PI-913: the paste path inserts what the kernel authorised, and judges alteration against that", () => {
  assert.match(SOURCE.paste, /const candidate = shouldSanitizeFragment\(result\) \? safeText : pasted;/,
    "the substitution decision belongs to the kernel, not to the paste listener");
  assert.match(SOURCE.paste, /releasePasteAnchor\(anchor, target\.element, inserted\)/);
  // v0.2.2: what is inserted is the kernel's choice MINUS any invisible smuggled payload, and the
  // alteration test compares against the same de-smuggled baseline. Comparing against the raw
  // clipboard string would count the removal of characters that render as nothing as an alteration
  // and escalate an ordinary paste to a full-screen modal.
  assert.match(SOURCE.paste, /const \{ clean: inserted, removed: hiddenRemoved \} = stripSmuggledPayload\(candidate\);/,
    "the inserted text must be de-smuggled, or a warn ships an instruction the user cannot see");
  assert.match(SOURCE.paste, /const visibleOriginal = stripSmuggledPayload\(pasted\)\.clean;/,
    "the alteration baseline must be the user's VISIBLE original");
  assert.match(SOURCE.paste, /interruptionLevel\(result, inserted !== visibleOriginal\)/,
    "comparing against safeText instead would report an alteration that never happened");
  // Every remediation swaps out of what is actually in the field.
  assert.equal(/swapPastedText\(target, safeText, pasted\)/.test(SOURCE.paste), false,
    "a swap keyed on the safe text is a no-op whenever the original was the text inserted");
});

/* ── The paste path's caret claim ─────────────────────────────────────────── */

test("PI-910: the paste path claims the caret before it awaits the scan", () => {
  const claimAt = SOURCE.paste.indexOf("claimPasteAnchor(target.element)");
  const scanAt = SOURCE.paste.indexOf("sendPasteScan(pasted)");
  assert.ok(claimAt > 0, "the paste path must claim an insertion point");
  assert.ok(scanAt > 0, "the paste path must scan");
  assert.ok(claimAt < scanAt,
    "the claim must be synchronous with the paste — deciding where to insert ~55 ms later is what " +
    "destroyed the words the user typed in the meantime");
});

test("PI-911: no verdict is written at the live caret any more", () => {
  const handler = SOURCE.paste.slice(0, SOURCE.paste.indexOf("function swapPastedText"));
  assert.equal(/insertTextAtCursor\(/.test(handler), false,
    "the handler must go through releasePasteAnchor; insertTextAtCursor survives only as its fallback");
  // v0.2.2: the clean-paste and approval-release exits now insert `clean` — the user's text with any
  // invisible smuggled payload taken out — and the findings exit inserts `inserted`. What matters is
  // unchanged: no exit may return without releasing the claim, or a zero-width placeholder is left
  // sitting in the user's prompt.
  for (const call of ["releasePasteAnchor(anchor, target.element, clean)", "releasePasteAnchor(anchor, target.element, inserted)"]) {
    assert.ok(handler.includes(call), `every exit path must release the claim: ${call}`);
  }
  assert.equal(/releasePasteAnchor\(anchor, target\.element, pasted\)/.test(handler), false,
    "no exit may insert the RAW clipboard text — that is the path that re-injects a hidden payload");
});

test("PI-912: the claim is released on every exit, so no placeholder is ever left behind", () => {
  const handler = SOURCE.paste.slice(SOURCE.paste.indexOf("sendPasteScan(pasted)"), SOURCE.paste.indexOf("showSoterOverlay({"));
  const releases = handler.match(/releasePasteAnchor\(/g) ?? [];
  const returns = handler.match(/\n\s+return;/g) ?? [];
  assert.ok(releases.length >= 3, `expected a release on each of the three early paths, found ${releases.length}`);
  assert.ok(releases.length >= returns.length,
    "an early return without a release would leave a zero-width placeholder in the user's prompt");
});

test("PI-914: the claim is a text node, because an empty inline element cannot hold the caret", () => {
  // Measured in Edge, frame by frame: with a `<span>` the claim was inserted in the right place and
  // the very next keystroke landed in FRONT of it ("before A<span …></span>"), so the paste was
  // written after the typing instead of before it. `setStartAfter` on an empty inline element is
  // normalised to the nearest text position, which is the wrong side of the claim.
  assert.match(SOURCE.paste, /const node = document\.createTextNode\(TEXT_ANCHOR\);/,
    "the contenteditable claim must be a text node with real offsets");
  assert.match(SOURCE.paste, /range\.setStart\(node, TEXT_ANCHOR\.length\);/,
    "the caret must sit INSIDE the claim, past its one character");
  assert.equal(/document\.createElement\("span"\)/.test(SOURCE.paste), false,
    "the span placeholder is what lost the race");
  assert.equal(/range\.setStartAfter\(/.test(SOURCE.paste), false,
    "a boundary position after an empty node is exactly what the editor normalises away");
  // `replaceData` is specified to shift live ranges by the length delta; assigning `.data` is not,
  // so the user's caret would be thrown to wherever the browser felt like putting it. It is the
  // fallback now — see PI-917 for why the primary path has to be an edit.
  assert.match(SOURCE.paste, /node\.replaceData\(index, TEXT_ANCHOR\.length, text\)/,
    "the substitution must preserve the caret the user has since moved");
});

test("PI-917: the paste is inserted as an edit, so Ctrl+Z removes the paste and not the user's typing", () => {
  // Measured in Edge: type "here is my question: ", paste, Ctrl+Z. With `replaceData` the browser's
  // undo stack had never seen the paste, so undo removed the last edit it HAD recorded — the typed
  // prefix — and left the pasted sentence behind. Without the extension the same three gestures
  // left "here is my question: ". The undo key destroyed the user's own words.
  assert.match(SOURCE.paste, /document\.execCommand\("insertText", false, text\)/,
    "only execCommand inserts into a contenteditable as an undoable edit");
  const release = SOURCE.paste.slice(SOURCE.paste.indexOf("function releasePasteAnchor("));
  assert.equal(release.match(/if \(insertTextAsEdit\(text\)\) \{/g)?.length, 2,
    "both the contenteditable and the value branch must try the edit before the direct mutation");
  assert.match(release, /range\.setStart\(node, index\);[\s\S]{0,120}range\.setEnd\(node, index \+ TEXT_ANCHOR\.length\);/,
    "the claim is selected and overwritten, which is what puts one entry on the undo stack");
  assert.match(release, /document\.activeElement/,
    "insertion-as-an-edit needs the field focused; a user who clicked away must not have it stolen back");
  assert.match(SOURCE.paste, /function insertTextAsEdit\(text: string\): boolean/);
  assert.match(SOURCE.paste, /return document\.execCommand/,
    "execCommand's return value must be honoured — a refused command has to fall through");
});

test("PI-921: the caret the user moved while the scan ran survives the insertion", () => {
  // The cost of insertion-as-an-edit: `replaceData` is specified to shift live ranges, an edit is
  // not — it leaves the caret at the end of what it inserted, which is BEHIND the keystrokes made
  // during the scan, so everything typed next landed in the middle of what was already written.
  // Measured in Edge: "…for a node service— and how does that affect rollback time?" against
  // "…for a node service — and how…" with the extension off. The space the user typed first had
  // been carried to the far end of their prompt.
  const release = SOURCE.paste.slice(SOURCE.paste.indexOf("function releasePasteAnchor("));
  assert.match(release, /const tail = charactersAfterCaret\(element, node, index \+ TEXT_ANCHOR\.length\);/,
    "the caret must be measured BEFORE the edit moves it");
  assert.match(release, /if \(insertTextAsEdit\(text\)\) \{\s*if \(tail !== null\) restoreCaretByTail\(element, tail\);/,
    "and restored only when the edit actually happened — the fallback preserves it by itself");
  // A (node, offset) pair does not survive the editing host splitting the node it inserts into,
  // which is exactly what it does for a multi-line paste. Characters-after-the-caret does, because
  // the insertion goes in front of them.
  assert.match(SOURCE.paste, /function charactersAfterCaret\(element: HTMLElement, anchor: Text, anchorEnd: number\): number \| null/);
  assert.match(SOURCE.paste, /return fromCaret <= fromAnchor \? fromCaret : null;/,
    "a caret that is not after the claim has nothing to preserve and must not be moved");
  // The same defect exists in a textarea, where the fix is arithmetic rather than a walk.
  assert.match(release, /const shift = \(at: number\) => \(at > index \? at \+ delta : at\);/);
  assert.match(release, /field\.setSelectionRange\(shift\(start\), shift\(end\)\);/,
    "the value branch must put the user's own selection back, shifted by what was inserted");
});

test("PI-922: 'Send as written' on a multi-line paste actually gives the text back", () => {
  // `innerText` reports a contenteditable's line breaks as CRLF on Windows; the string the extension
  // inserted uses LF. So `lastIndexOf` missed on EVERY multi-line paste and the swap silently did
  // nothing: the click was audited as an override and the redacted text stayed in the composer.
  // Measured in Edge on a pasted handler containing an internal URL. Windows is the store build's
  // platform, so this was the default outcome, not an edge case.
  const swap = SOURCE.paste.slice(SOURCE.paste.indexOf("function swapPastedText("));
  assert.match(swap, /const current = target\.getText\(\)\.replace\(\/\\r\\n\/g, "\\n"\);/,
    "the haystack must be newline-normalised");
  assert.match(swap, /const needle = from\.replace\(\/\\r\\n\/g, "\\n"\);/,
    "and so must the needle, or the offsets and the length come from different strings");
  assert.match(swap, /current\.slice\(index \+ needle\.length\)/,
    "the span is cut with the length of the string that was actually found");
  // A restore that cannot find its span is still a button the user pressed to get their words back.
  // "Their words" is the de-smuggled original: restoring must never put a hidden instruction back.
  assert.match(SOURCE.paste, /const restoreOriginal = \(\) => \{[\s\S]{0,400}navigator\.clipboard\?\.writeText\(visibleOriginal\)/,
    "a failed restore must hand the original over rather than do nothing");
  assert.equal(SOURCE.paste.match(/swapPastedText\(target, inserted, visibleOriginal\)/g)?.length, 1,
    "restoreOriginal must be the only path that puts the user's own text back");
});

/* ── The submit path may never swallow a message ──────────────────────────── */

test("PI-923: an invisible smuggled payload is stripped after the scan and before any replay", () => {
  // Both halves of the product rule on one gesture. A hidden "ignore all previous instructions"
  // reaches the model but never the user's eyes: blocking their message over characters they cannot
  // proofread interrupts work they meant to do, and sending it delivers an attack they never wrote.
  // So the payload is removed and the message goes. Order is the whole correctness argument.
  const scanAt = SOURCE.submit.indexOf("evaluateSubmitInterception(text,");
  const stripAt = SOURCE.submit.indexOf("stripSmuggledPayload(text)");
  const firstReplayAt = SOURCE.submit.indexOf("replay(event, replayBypass, adapter)");
  assert.ok(scanAt > 0 && stripAt > 0 && firstReplayAt > 0, "scan, strip and replay must all be present");
  assert.ok(scanAt < stripAt,
    "the strip must run AFTER the scan — stripping first would hide the payload from the detector " +
    "and the user would never be told an attack was carried in their text");
  assert.ok(stripAt < firstReplayAt,
    "the strip must run BEFORE any replay, including the fail-open scan-error path: the page sends " +
    "whatever the composer holds, so a later strip is no strip at all");
  assert.match(SOURCE.submit, /target\.setText\(smuggled\.clean\)/,
    "the composer itself must be rewritten — the page reads the field, not our local variable");
  // The notice may not contradict itself: something WAS changed.
  const noticeBranch = SOURCE.submit.slice(SOURCE.submit.indexOf('=== "notice"'), SOURCE.submit.indexOf("isFailClosedBlock(result)) approvals.purge()"));
  assert.match(noticeBranch, /smuggled\.removed === 0/,
    '"It was sent exactly as you wrote it" is false once a payload was stripped, so that notice ' +
    "must stay silent in that case — under-claiming is a false claim too");
});
test("PI-915: one Enter press is one submission", () => {
  // keydown and keyup are both hooked because sites differ in which they send on. Both ran the
  // whole path, so a single Enter scanned twice, audited twice and stacked two overlays.
  assert.match(SOURCE.submit, /let enterClaimedByKeyDown = false;/);
  const keyup = SOURCE.submit.slice(SOURCE.submit.indexOf('addEventListener("keyup"'));
  assert.match(keyup, /if \(enterClaimedByKeyDown\)/, "the keyup of a claimed press must not scan again");
  assert.match(keyup, /event\.preventDefault\(\);/,
    "it must still be cancelled — a keyup-submitting page may not slip past the dialog keydown raised");
  assert.match(keyup, /enterClaimedByKeyDown = false;/, "and the claim must be released for the next press");
});

test("PI-918: one pointer press on the send control is one submission", () => {
  // pointerdown, mousedown and click are three phases of ONE press, and all three are hooked because
  // pages submit on different ones. All three ran the whole path, so one click on Send produced two
  // synthetic replay clicks and the page's own send handler fired twice (measured in Edge:
  // pageDoSendClicks=2 for a single click). Enter had this dedup; the mouse did not.
  assert.match(SOURCE.submit, /let pointerGestureActive = false;/);
  const handler = SOURCE.submit.slice(SOURCE.submit.indexOf("const onPointerPhase ="), SOURCE.submit.indexOf('addEventListener("click", onPointerPhase'));
  assert.match(handler, /if \(pointerGestureActive\) \{/, "a later phase of the same press must not scan again");
  assert.match(handler, /event\.preventDefault\(\);/,
    "it must still be cancelled — a mousedown-submitting page may not run ahead of the pending verdict");
  assert.match(handler, /pointerGestureActive = true;/);
  // All three phases must go through the one deduplicated handler, not three independent copies.
  for (const phase of ["click", "mousedown", "pointerdown"]) {
    assert.match(SOURCE.submit, new RegExp(`addEventListener\\("${phase}", onPointerPhase, true\\)`),
      `${phase} must share the deduplicated handler`);
  }
  // And the claim has to be released once the decision resolves, or the next press is swallowed.
  assert.match(SOURCE.submit, /finally \{[\s\S]{0,240}pointerGestureActive = false;/);
});

test("PI-920: undo integration is paid for only where it is cheap, and its placeholder never survives an undo", () => {
  // Measured in Edge (harness/insert-cost.mjs, median of 7): an undo-integrated insert costs 0.9 ms
  // for a 90-char paste and 335 ms for the same 19,800 chars spread over 301 lines, while 19,800
  // chars on ONE line cost 3.7 ms. Line breaks are the cost, they grow superlinearly, and the thread
  // that pays is the one handling the user's typing — so the cap is on lines, not on length.
  assert.match(SOURCE.paste, /const UNDO_INTEGRATION_MAX_LINES = 100;/);
  assert.match(SOURCE.paste, /function undoIntegrationIsAffordable\(text: string\): boolean/);
  const release = SOURCE.paste.slice(SOURCE.paste.indexOf("function releasePasteAnchor("));
  assert.equal((release.match(/undoIntegrationIsAffordable\(text\)/g) ?? []).length, 2,
    "both the contenteditable and the value path must be gated on the same measured budget");
  // The cap must be counted without materialising an array per paste — this runs inside the gesture.
  assert.equal(/text\.split\("\\n"\)/.test(SOURCE.paste), false);

  // An undo restores the document to before the edit it undoes, and the claim was inserted before
  // that edit — so it comes back. Invisible, unnoticeable, and sent to the model with the prompt.
  assert.match(SOURCE.paste, /inputType !== "historyUndo"/);
  assert.match(SOURCE.paste, /function stripAnchorResidue\(element: HTMLElement\)/);
  const strip = SOURCE.paste.slice(SOURCE.paste.indexOf("function stripAnchorResidue("));
  assert.match(strip, /guard < 64/, "it runs on a user gesture, so it must be bounded");
  assert.match(strip, /replaceData\(node\.data\.indexOf\(TEXT_ANCHOR\), TEXT_ANCHOR\.length, ""\)/);
});

test("PI-919: Shift+Enter is a newline, not a submission, and is never intercepted", () => {
  // Every one of these composers uses Shift+Enter for a line break. It fires `beforeinput` with
  // inputType "insertLineBreak", and the submit path used to hook exactly that as a "last-resort
  // catch for form submissions". Measured in Edge: the newline was cancelled and never inserted, so
  // multi-line prompts could not be typed at all; and once replay() could reach the site's send
  // control, that same hook made Shift+Enter SEND the user's half-written message.
  assert.equal(/addEventListener\("beforeinput"/.test(SOURCE.submit), false,
    "a line break is not a submission — there is no text leaving the page to scan");
  assert.equal(/event\.inputType/.test(SOURCE.submit), false,
    "nothing in the submit path may branch on an input type any more");
  // The keyboard hooks that remain must bail out on a shifted Enter before doing anything at all.
  for (const phase of ["keydown", "keyup"]) {
    const hook = SOURCE.submit.slice(SOURCE.submit.indexOf(`addEventListener("${phase}"`));
    assert.match(hook.slice(0, 400), /if \(event\.key !== "Enter" \|\| event\.shiftKey/,
      `${phase} must return immediately on Shift+Enter`);
  }
  // And replay must no longer claim beforeinput as a keyboard submit, since nothing delivers it.
  const fn = SOURCE.submit.slice(SOURCE.submit.indexOf("function replay("));
  assert.equal(/beforeinput/.test(fn), false, "replay may not route a line break to the send control");
});

test("PI-916: a keyboard submit is replayed through the site's send control, whichever key phase delivered it", () => {
  // The overlay the user sees for an Enter press was the keyup one, and this branch was gated on
  // `keydown` — so "Send as written" ran the audit, called replay, and clicked the composer div.
  // Measured in Edge: onProceed fired, the page's send handler was never called, nothing was sent.
  const fn = SOURCE.submit.slice(SOURCE.submit.indexOf("function replay("));
  assert.match(fn, /const keyboardSubmit = event\.type === "keydown" \|\| event\.type === "keyup";/);
  assert.match(fn, /if \(keyboardSubmit\) \{/);
  assert.equal(/if \(event\.type === "keydown"\) \{/.test(fn), false,
    "gating the send-button lookup on keydown alone is the defect");
  assert.match(fn, /adapter\.isSubmitControl\(btn\)/, "the site's own send control is still what gets pressed");
  assert.equal(/console\.debug/.test(SOURCE.submit), false, "no diagnostics left in the shipped path");
});

test("PI-920: a scan that could not run never ends in silence", () => {
  const branch = SOURCE.submit.slice(
    SOURCE.submit.indexOf("if (!decision.response.ok)"),
    SOURCE.submit.indexOf("const result = decision.response.result;"),
  );
  assert.ok(branch.length > 0, "the failed-scan branch must exist");
  assert.ok(branch.includes("showCornerNotice"),
    "the user must be told that the check did not happen — this is where Enter used to do nothing");
  assert.ok(branch.includes("replay(event, replayBypass, adapter)"),
    "and unless the org asked to fail closed, their message must go through");
  assert.ok(branch.includes("failClosedOnScanError"),
    "an org that asked for 'no check, no send' still gets it, stated plainly rather than as silence");
});

test("PI-921: the submit path notices instead of interrupting when nothing changed", () => {
  assert.ok(SOURCE.submit.includes('interruptionLevel(result, safeFragmentText(result).trim() !== text) === "notice"'),
    "the submit path must compare against the footer-stripped text, or every redact verdict looks altered");
  const notice = SOURCE.submit.slice(SOURCE.submit.indexOf('=== "notice"'));
  const replayAt = notice.indexOf("replay(event, replayBypass, adapter)");
  const overlayAt = notice.indexOf("showSoterOverlay({");
  assert.ok(replayAt > 0 && replayAt < overlayAt, "a notice-level verdict must let the submission proceed");
});

test("PI-922: a warning offers the user a way to send their own words, and only where the kernel allows it", () => {
  assert.match(SOURCE.overlay, /data-action="proceed"/, "the warn branch must render a proceed button");
  const warnBranch = SOURCE.overlay.slice(SOURCE.overlay.indexOf("// default/warn"), SOURCE.overlay.indexOf("statusHtml = `<div class=\"status-badge info\""));
  assert.match(warnBranch, /remediationAffordances\(result\)\.canSubmitOriginal/,
    "whether the original text may be sent is the kernel's decision, not the overlay's");
  for (const [name, source] of [["submit", SOURCE.submit], ["paste", SOURCE.paste]] as const) {
    const handler = source.slice(source.indexOf("onProceed:"), source.indexOf("onProceed:") + 700);
    assert.match(handler, /remediationAffordances\(result\)\.canSubmitOriginal/,
      `${name}: the handler must re-ask, so an injected click on a stale overlay cannot proceed`);
    assert.match(handler, /SOTER_AUDIT_BYPASS/, `${name}: proceeding past a warning is audited`);
  }
  // A block must never grow this exit.
  const blockBranch = SOURCE.overlay.slice(SOURCE.overlay.indexOf('if (action === "block")'), SOURCE.overlay.indexOf('} else if (action === "require_approval")'));
  assert.equal(/data-action="proceed"/.test(blockBranch), false, "a block offers no way to send the original text");
});

/* ── The guard may not go dark in silence ─────────────────────────────────── */

test("PI-930: a policy response that is not a policy is refused", () => {
  assert.equal(looksLikePolicyBundle({ ok: true, destinations: [] }), false,
    "this exact body erased the working policy and took the whole guard down (probe A0)");
  assert.equal(looksLikePolicyBundle(null), false);
  assert.equal(looksLikePolicyBundle("<html>proxy error</html>"), false);
  assert.equal(looksLikePolicyBundle({ monitoredDomains: ["claude.ai"] }), false, "no thresholds means no verdicts");
  assert.equal(looksLikePolicyBundle({ riskThresholds: { block: 85 } }), false, "no domains means nothing is guarded");
  assert.equal(looksLikePolicyBundle({ monitoredDomains: ["claude.ai"], riskThresholds: { block: 85 } }), true);
});

test("PI-931: a refused bundle is an availability failure, not a tamper signal", () => {
  const sync = readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/background/policy-sync.ts"), "utf8");
  const branch = sync.slice(sync.indexOf("if (!looksLikePolicyBundle(policy))"), sync.indexOf("const verification"));
  assert.match(branch, /policySyncStatus: "error"/, "the failure must be visible in state");
  assert.match(branch, /policy: cached/, "the last known good policy keeps enforcing");
  assert.equal(/policyIntegrity:/.test(branch), false,
    'writing a tamper code here would fail closed and block every message the user sends — a broken ' +
    "endpoint must not become a page-wide block");
});

test("PI-932: the destination context cannot throw the guard into silence", () => {
  const fn = SOURCE.worker.slice(SOURCE.worker.indexOf("async function destinationContext"), SOURCE.worker.indexOf("async function getSourceApps"));
  assert.match(fn, /Array\.isArray\(state\.policy\?\.monitoredDomains\)/,
    "an unguarded .some() on a missing array is what made this reject");
  assert.match(fn, /Array\.isArray\(state\.policy\?\.destinations\)/);
  const dispatch = SOURCE.worker.slice(SOURCE.worker.indexOf('"SOTER_GET_DESTINATION_CONTEXT"'));
  assert.match(dispatch.slice(0, 600), /\.catch\(/,
    "and an unanswered port is what turned that rejection into an extension that protected nothing");
});

test("PI-933: a worker that cannot answer activates the guard instead of disabling it", () => {
  assert.match(SOURCE.content, /\{ active: true, unavailable: true, legacyMatch: true \}/,
    "the manifest only injects this script into guarded AI destinations, so a missing reply is not " +
    "evidence the page is unmonitored");
  assert.match(SOURCE.content, /installSubmitInterceptor\(adapter, context\.failClosedOnScanError === true\)/,
    "the fail-closed posture must reach the one path that needs it when state is unreachable");
});
