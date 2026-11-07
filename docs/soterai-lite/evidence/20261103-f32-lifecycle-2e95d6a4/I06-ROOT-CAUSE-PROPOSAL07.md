# F32 I06: probable root cause and the single extra06 attempt

6 November 2026. This document is the proposal the extra06 approval is bound to. It authorizes nothing by itself. Authority comes only from `installed-extra06-user-approval.json`, which pins this file, the extra06 runner, the frozen source proof and the exact current VSIX by SHA-256.

## Finding

The F32 launch contracts 01-03 never set `window.dialogStyle`. In the installed workbench bundle the setting is `"window.dialogStyle":{type:"string",enum:["native","custom"],default:"native"}`, and `useCustomDialog` is true only when the setting equals `"custom"`. With the default, extension modal messages (`showWarningMessage(..., { modal: true }, ...)`) are shown as OS message boxes outside the workbench DOM. Workspace trust always uses the custom dialog, which is why trust passed in extra05 while the renderer's `.monaco-dialog-box` locator never saw the I06 migration modal ([microsoft/vscode#140543](https://github.com/microsoft/vscode/issues/140543): extension dialogs follow `window.dialogStyle`).

This matches the retained extra05 facts:

- The renderer timed out about 15 s after `ui-2` was posted, which is the `WAIT_DIALOG_TEXT` budget.
- The vault and placeholder files were written during that window, so the visible OS box was answered outside the renderer. The window was visible (`windowsHide:false`).
- No F32 fixture contains `dialogStyle`.

Status: PROBABLE. A native run is the only confirmation.

## Fix (fixture only, product bytes unchanged)

- `installed-launch-contract-proposed-04.cjs`: contract 03 plus `'window.dialogStyle': 'custom'`. Controls E01 prove that nothing else changed.
- `installed-renderer-proposed-05.cjs`: renderer 04 plus a fixed `WAIT_DIALOG_TEXT` / `WAIT_DIALOG_CLOSE` phase code and one typed snapshot (booleans and small integers only) on modal failure. The dialog allow-list is identical (control E02).
- VSIX `e2ce3dc4...` (1,742,100 bytes), the 29 scoped source files and the 1,110 frozen inputs are unchanged and were re-pinned on 6 Nov.

## VS Code moved from 1.144.1 to 1.145.0 (a717861c07)

Ten of 180 receipt rows changed (Code.exe, code.cmd, package.json, product.json, cli.js, main.js, mainImpl.js, cliProcessMain.js, extensionHostProcess.js, workbench.desktop.main.js). Playwright 1.61.1, Node and system PowerShell are byte-identical. Everything pinned to 1.144.1 was rebuilt:

- `current-signature-observation-03.json`: Code.exe, PowerShell and Node are Authenticode Valid (6 Nov).
- `vendor-installed-size-qualification-03.json`: the real 1.145.0 CLI installed both exact VSIX files into a fresh synthetic root. The exact-serialization admission passed for 0.7.0 (size 3,668,082) and 0.6.3 (size 5,466,512). No GUI window, no product code executed.
- `current-vendor-review-02.json` and `current-package-qualification-02.json`: bound to receipt `public-vendor-observation-03.json` (SHA-256 `f810b833...`).
- `installed-owner-custody-proposed-05.ps1`, `native-owned-gui-phase-proposed-06.cjs`, `run-installed-lifecycle-proposed-06.cjs`, `prepare-installed-extra06-admission-proposed-01.cjs`: only the version, commit, Code.exe hash and size, extra06 names and a retention check for the failed extra05 changed (controls E05-E08).
- `installed-trust-static-controls-corrected-08.test.cjs`: the eight trust controls re-derived against the 1.145.0 bundle plus a direct test of `window.dialogStyle`. The 07 file read the removed 1.144.1 bundle and can no longer run.

Control results: `extra06-controls-02.txt`, 21 of 21 pass. `extra06-controls-01.txt` is the retained failed run that still pointed at the removed bundle.

## Terms of the extra06 attempt

One attempt. One fresh synthetic root on D:. No retry. `signalsRequested` 0. No normal profile, download, login, publish, push or tag. F26a stays skipped. The visible owned VS Code windows must not be touched by anyone during the run: a manual click or Enter would again produce the extra05 signature.

A pass of I06 does not pass F32. All 44 assertions and 59 observations across eight phases, including the genuine 0.6.3 upgrade, are still required. If the run fails, F32 stays INCOMPLETE with a better recorded cause. Original L6 HUMAN-ACTIONS STOP, human and independent evidence, and the rating gates remain binding.

## Approval source

The owner's messages of 6 Nov 2026 ("do which you went, you have all permission", "now continue kro or jo bhi issuse aaye usko khud fix kro", "ok continue kro mena sandbox off kr diya hai") and the owner's own disabling of the Kiro command sandbox, which was the only blocker for D: access. They are quoted verbatim in the approval file.
