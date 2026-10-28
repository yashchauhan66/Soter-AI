# F29 accessibility fixture preparation

This prepares the accessibility clauses already present in F29's work-card and IMPLEMENTATION-PLAN. It does not replace the existing order or waive a gate. Status: **PREPARED / NOT RUN / artifact unbound**. Same-lineage evidence, LOW independence.

## Locally available tooling

Installed Playwright 1.61.1 and axe-core 4.12.1 are available in this workspace. Installed Edge is `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, observed file version 157.0.4341.24. `accessibility-tooling-inventory-01.json` pins the exact executable, versioned DLL, installed tooling, and installed Code workbench/theme sources. This is static discovery only. Recheck pins immediately before an authorized browser/Code launch; an Edge auto-update invalidates these pins.

The existing root `playwright.config.ts` loads `.env`, requires a database, and launches the separate web application. `scripts/audit-rendered-contrast.mjs` can read `.env` and use credentials. `scripts/live-external-ai-cdp.mjs` targets a normal logged-in browser. None is an applicable F29 harness and none was run.

## Native tree gate

F29 registers three native `TreeView`s, not an extension HTML document: `soterai-protected-items`, `soterai-protection-activity`, and `soterai-protection-coverage`. A hand-built browser tree, screenshot converted to DOM, copied Code tree HTML, or duplicate product import cannot establish this gate. A headless Edge process cannot stand in for Code's desktop workbench IPC.

Use the exact new F29 VSIX and the existing isolated native owner, with a fresh synthetic D profile and fixed loopback-only renderer debugging endpoint. The owner must pin the endpoint to its actual child/profile/run identity before an observer attaches. Do not enumerate or attach to other Code windows, generic debug ports, or normal browser sessions. If no owned renderer is available, report this sub-gate NOT_RUN; extension API observations are narrower evidence.

The real renderer observer should first inspect the live workbench DOM, then discover and record the three exact view containers, actual `role=tree` / `role=treeitem` semantics, `aria-label`, expansion state, active descendant, and focused element. Discovering selectors from live DOM is required; this document does not invent a current vendor selector.

Use actual `page.keyboard.press` input to open the command palette, type the registered Protection Center command, press Enter, move among real rows with arrows/Home/End, activate a safe revoke action with Enter, open optional setup via keyboard and cancel with Escape, and return focus to the tree. Capture before/after focus and actual owner outcomes. No mouse input should occur in the keyboard-only phase. Calling `vscode.commands.executeCommand` from the host is a separate command-path check, not keyboard-only evidence.

For contrast, set only the isolated profile's built-in **Default High Contrast** theme, observe `window.activeColorTheme.kind`, and verify live workbench theme classes, visible text, focus indication, and actual native icons/labels. Also use Default High Contrast Light if a light contrast state is required. Save and restore only this test profile's prior values.

For reduced motion, set only the isolated profile's `workbench.reduceMotion` to `on`, await the actual setting/theme event, and inspect the live workbench reduced-motion class and computed animation/transition/scroll styles on the three native containers. Repeat keyboard navigation while enabled. A manifest, theme setting value, or static source witness alone is not a rendered-state PASS. OS accessibility settings must not be changed.

The same renderer may run axe-core against the live native view containers. Such a result is an **actual Code renderer axe check**, not the separate required **headless Edge** result, and vendor workbench findings must remain visible. Run full applicable WCAG2A/AA and WCAG2.1AA rule tags, preserve violations and incomplete/manual-review results, and do not disable a rule merely to obtain zero violations.

## Applicable headless Edge gate

Protection Center's `privacy` workflow opens the existing shipped Project Privacy webview, whose actual DOM is a relevant adjacent workflow. During the new exact-artifact host run, capture the exact `panel.webview.html` returned by the actual shipped registered `soterai.openProjectPrivacy` command, plus the actual host-applied VS Code theme CSS variable values. Preserve body/script/CSP bytes and a signed-by-test custody receipt binding HTML SHA, runtime SHA, VSIX SHA, run/profile ID, and scenario. Capture public/empty, unavailable/stale, and presentation-disabled states using existing synthetic inputs. Do not regenerate HTML from a duplicate imported class or substitute a hand-authored specimen.

A fresh standalone Edge profile can load those exact captured bodies through a bounded numeric-loopback fixture origin with all non-loopback requests blocked. Apply only the captured host theme variables as a separately recorded hosting layer; retain original HTML/CSP unmodified. Local axe injection should use the browser debugger evaluation channel so the production CSP is not relaxed. The page's `acquireVsCodeApi` host bridge is absent; declare its resulting script error and treat browser action dispatch as outside this snapshot gate. For actionable dynamic feedback, prefer capturing real host states rather than inventing a fake bridge. If a bridge is introduced for observation, it must have no command authority and the limitation must remain explicit.

Run installed axe-core in real headless Edge on each captured state with standard, forced-colors active, and prefers-reduced-motion reduce contexts. Preserve full axe results, rule/target counts, incomplete results, screenshots, computed media queries, exact HTML hashes, and console/network refusals. Require the expected actual page heading and state marker before running axe so an error page, redirected page, empty DOM, or CSP-blocked document cannot report a false clean result. Run meaningful Tab/Shift+Tab focus movement through real existing buttons/links; do not count host workflow execution from the snapshot.

This browser result establishes accessibility of the exact captured shipped webview states under the declared hosting layer. It cannot establish native TreeView keyboard behavior, Code-owned focus management, independent agents, human usability, or screen-reader operation. Those remain separate gates.

## Process ownership and no-signals rule

The installed Playwright `coreBundle.js` includes `taskkill /T /F` as the fallback for Playwright-owned launch/close failures. Therefore do not call Playwright `chromium.launch`, `_electron.launch`, `launchPersistentContext`, the test runner, or helper launchers that own a browser process under this task's no-signals restriction.

Use a direct pinned-executable child with an ordinary unique D profile, minimal explicit environment, hidden window, both pipes opened before launch, listeners attached immediately, and no cleanup/killing fallback. Attach installed Playwright using `connectOverCDP` to only that fresh owned numeric-loopback endpoint. On completion request the protocol-level `Browser.close` once, then await the **actual natural child close and both pipe EOF**. Preserve failures/timeouts and leave the known owner visible to the root if graceful close does not complete. Do not call `process.kill`, child `.kill`, `taskkill`, signal0, or rm/remove on retained profiles. Observational deadlines may mark INCOMPLETE but cannot terminate a process.

For the existing Code owner, browser transport disconnection must not close the native child. Let the accepted native owner close the actual test window normally after observer completion; use its original actual-close/both-EOF custody receipt. Read the exact installed CDP connection/close implementation before relying on a disconnect method. Do not assume a generic browser `.close()` has the same semantics across owned and attached processes.

No browser, Code, native driver, normal profile, database, network request, or accessibility test was launched by this preparation. Human screen-reader/usability outcomes still require the later specified human evidence; this document claims none.
