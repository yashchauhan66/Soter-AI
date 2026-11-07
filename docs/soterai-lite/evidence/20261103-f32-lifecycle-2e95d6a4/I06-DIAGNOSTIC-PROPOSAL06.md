# F32 I06 modal handshake: root cause analysis and extra06 proposal

INERT. No native round is approved or executed by this document. Normal rounds 1-3 and the single extra05 attempt are consumed, and extra05 carries "no retry". Any further launch needs a fresh, explicit user approval bound to this proposal. Product source (29 scoped files) and the exact VSIX `e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649` were re-hashed on 5 Nov 2026 and match `full-inputs-04.json` byte for byte. Nothing here changes them.

## What extra05 established

Read from the retained receipts under `retained-native-extra05-01/` and the retained synthetic run root on D:.

- **Trust handshake works.** `primary-trust-before.json` `isTrusted:false`, `primary-trust-choice.json` records the real keyboard choice, `primary-trust-after.json` `isTrusted:true`. The extra05 visible-GUI change resolved the trust blocker from rounds 1-3.
- **Onboarding works.** `primary-ui-1.json.done.json`: 33031 ms, 9 keyboard actions, walkthrough visible, real tree Enter on "Verify my setup".
- **Product activated.** `exthost.log`: `soterai.soterai-ide-guard` activated at 13:22:08 local.
- **The failure is stage I06**, the `ui-2` migration modal. Observer: `until()` timeout at line 25, waiting 90 s for `primary-ui-2.json.done.json`. Renderer: `until()` timeout at line 14, stage `NATIVE_PRODUCT_UI`, 15.2 s after `ui-2` was posted (07:52:34.4Z to 07:52:49.6Z).

## Finding that changes the diagnosis

The migration **did complete on disk** during the same window:

| UTC | File |
|---|---|
| 07:52:47.316 | `vault-generation-d7e71675-...enc` written |
| 07:52:47.726 | `soterai-vault.enc` written |
| 07:52:48.025 | `workspace-primary/.env` rewritten (now `API_KEY=[SOTERAI_PROTECTED_..._0]`) |
| 07:52:48.278 | `workspace-primary/.env.example` written |
| 07:52:48.411 | `vault-source-...json` written |
| 07:52:49.649 | renderer exits with failure |

So the product ran `soterai.migrateSecretsToVault`, produced a migration plan, and received a "Migrate securely" confirmation. The extension is not the cause. The renderer never recorded seeing or answering the dialog, so the fixture's renderer wait and what actually happened on screen disagree.

The renderer has two bounded waits per modal, both ending in the shared `until()` helper: dialog text (15 s) and dialog close (8 s). Because the failure reports the helper's line, not the caller's, **the retained receipts cannot say which wait expired.** The 15.2 s gap fits the first wait, but the vault write finished 2 s before the renderer failed. I did not find a single confirmed cause and do not claim one.

Candidate explanations, none proven:

1. The dialog text was visible but `dialog.innerText()` did not contain the expected string (for example, extra whitespace or the detail JSON altering matching), so the first wait expired while the real modal was answered another way.
2. The visible window was answered by something other than the renderer. Extra05 deliberately ran Code with `windowsHide:false` (`guiVisibility: EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE`), so a manual click or Enter in that window would produce exactly this signature: the product's own "Migrate securely" modal confirmed, vault written, renderer never recording it. The receipts cannot tell a manual keypress from a fixture keypress. The owner can say whether anyone touched the window during that run.
3. The dialog closed faster than the second wait polled, or a locator race. Timing makes this less likely: the second wait has an 8 s budget, and the renderer failed only 2.3 s after the vault write.

Ruled out by the evidence: the startup auto-scan prompt. `AutoVaultMigration.start()` returns immediately when the workspace is untrusted, and the product activated at 13:22:08 local while trust was only granted at about 13:22:29. Product source also has no handler that restarts the scan on trust grant, and its watchers are only registered after that early return.

## Proposed change (fixture only)

`installed-renderer-proposed-05.cjs` is a copy of renderer 04 (`7e92c3f2...`, untouched) with two additions, +44 / -11 lines:

- It records a fixed phase code, `WAIT_DIALOG_TEXT` or `WAIT_DIALOG_CLOSE`, so the failing wait is identified without parsing stack frames.
- On a modal failure it records one typed snapshot: `documentFocused`, `visibleDialogCount` (capped at 9), `expectedIndex`, `expectedTextPresent`, `matchedAllowedIndex` (index into the five frozen dialogs, or -1), `quickInputVisible`. Booleans and small integers only. No dialog text, titles, DOM, paths, stacks or values are stored, and the snapshot is best-effort so it cannot mask the original error.

It does not click, type, grant trust, mock, or intercept anything beyond what 04 already does. Allow-list, keyboard-only button focus and bounds are unchanged.

New file: `installed-renderer-proposed-05.cjs`, 20374 bytes, SHA256 `75f2c76f9a35796cd86bde0ebcff259fe3f1bf93c87b33f75e2e4913ee50b205`. `node --check` exit 0. Nothing was imported or run.

## What is not done yet

- Admission is not wired to renderer 05. `prepare-installed-extra05-admission-proposed-01.cjs` pins renderer 04 by name, and the visible-GUI control test requires `installed-renderer-proposed-04.cjs`. A successor admission script (extra06) and an updated control test are required, and the existing 18 controls must be re-run before any approval request.
- A diagnostic cannot make F32 pass. If extra06 runs and fails, F32 stays INCOMPLETE with a better recorded cause. A run that passes I06 still has to complete the remaining phases (restart, upgrade from 0.6.3, untrusted, disabled, uninstalled) before any F32 gate is claimed.
- If candidate 2 (manual interaction) is the cause, no fixture change is needed. The fix is to leave the owned window untouched for the run. Renderer 05 would still record the snapshot, which distinguishes the cases.

## Approval needed from the owner before any launch

Same shape as extra05: one fresh synthetic D: root, maxAttempts 1, no retry, signalsRequested 0, no normal profile, no download/login/publish/push/tag, F26a still skipped. Approval must name this document and the final admission/runner hashes. None exists today. Original L6 HUMAN-ACTIONS and STOP, human and independent evidence, and the rating gates remain binding.
