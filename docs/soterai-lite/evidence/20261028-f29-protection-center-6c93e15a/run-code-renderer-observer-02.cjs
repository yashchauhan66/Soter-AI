"use strict";
// ATTACH ONLY. Root owns the Code child, profile, listener and normal withdrawal.
const C = require("./accessibility-binding-01.cjs");
const { fs, path, assert, pin, readJson, dDirectory, writeJson, endpoint, admit, until, inside, sha } = C;
const IDS = ["soterai-protected-items", "soterai-protection-activity", "soterai-protection-coverage"];
const FOCUS = ["View: Focus on Protected items View", "View: Focus on Activity View", "View: Focus on Coverage View"];
const at = (value, field) => field.split(".").reduce((v, k) => v?.[k], value);
const outputName = "f29-renderer-observations-01.json";
async function main() {
    assert.equal(process.argv.length, 3, "Usage: node run-code-renderer-observer-01.cjs <bound JSON>");
    const { b, bindingPin } = admit(process.argv[2], "CODE_RENDERER");
    const gate = dDirectory(b.gateDirectory), profile = dDirectory(b.profile), workspace = dDirectory(b.workspace);
    assert(inside(profile, gate)); assert(!inside(workspace, gate));
    assert(Number.isSafeInteger(b.actualCodePid) && b.actualCodePid > 0);
    const origin = endpoint(b.endpoint), owner = JSON.parse(pin(b.ownerReceipt).raw.toString("utf8").replace(/^\uFEFF/, ""));
    assert.equal(at(owner, b.ownerPidField), b.actualCodePid, "Actual child owner PID mismatch.");
    const custody = JSON.parse(pin(b.listenerCustody).raw.toString("utf8").replace(/^\uFEFF/, ""));
    const listenerPid = at(custody, b.listenerPidField);
    assert(listenerPid === b.actualCodePid || Array.isArray(custody.codeProcessTreePids) && custody.codeProcessTreePids.includes(listenerPid), "CDP listener must belong to the witnessed owned Code tree.");
    assert.equal(custody.localAddress, "127.0.0.1"); assert.equal(Number(custody.localPort), Number(new URL(origin).port));
    assert.equal(path.resolve(custody.profile).toLowerCase(), profile.toLowerCase());
    assert.equal(custody.rootCodePid, b.actualCodePid);
    assert.equal(b.expectedThemeClass, "hc-black"); assert.equal(b.expectReducedMotion, true);
    assert(typeof b.targetTitleContains === "string" && b.targetTitleContains.length >= 8 && b.targetTitleContains.length <= 120);
    const readyFile = path.join(gate, "f29-renderer-ready.json"), doneFile = path.join(gate, "f29-renderer-done.json");
    assert(!fs.existsSync(doneFile) && !fs.existsSync(path.join(gate, outputName)), "Refuse duplicate observer results.");
    const startedAt = new Date().toISOString();
    const ready = await until(() => fs.existsSync(readyFile) && readJson(readyFile, 65536), 90000, "N06 actual owner readiness not observed");
    const readyRaw = fs.readFileSync(readyFile), readySha256 = sha(readyRaw);
    assert.equal(ready.schemaVersion, 1); assert.equal(ready.feature, "F29"); assert.equal(ready.stage, "N06_ACTUAL_PROJECT_PRIVACY_CAPTURE");
    assert.equal(ready.syntheticOnly, true); assert.equal(ready.signals, 0);
    assert.equal(path.resolve(ready.profile).toLowerCase(), profile.toLowerCase());
    assert.equal(path.resolve(ready.workspace).toLowerCase(), workspace.toLowerCase());
    assert.equal(path.resolve(ready.runRoot).toLowerCase(), gate.toLowerCase());
    assert(b.runtimes.some(row => row.sha256 === ready.loadedBundleSha256));
    assert(inside(gate, ready.html.path)); const html = pin(ready.html).raw.toString("utf8");
    assert(html.includes("Private secrets. Productive coding.") && html.includes("Full-protection claim:"));
    const result = { schemaVersion: 1, feature: "F29", status: "INCOMPLETE", independence: "LOW_SAME_LINEAGE", startedAt, bindingPin,
        readySha256, actualCodePid: b.actualCodePid, listenerPid, origin, signals: 0, childLaunched: false,
        inputMethod: "REAL_OWNED_RENDERER_KEYBOARD_ONLY_NO_MOUSE_NO_DOM_FOCUS", observations: [],
        nativeTreeKeyboard: "NOT_RUN", highContrast: "NOT_RUN", reducedMotion: "NOT_RUN", chooserEscape: "NOT_RUN",
        scope: "Actual owned Code renderer and exact shipped adjacent privacy webview. API-only native tests, Edge snapshot axe, human screen reader and usability are separate.",
        limitations: ["Synthetic isolated profile and same-lineage automation; no independent/human evidence.", "Initial isolated profile uses built-in high contrast and reduceMotion:on; no normal profile or OS setting was changed."] };
    let browser, page, failure;
    try {
        // connectOverCDP's installed browserProcess.close/kill both disconnect the
        // transport (coreBundle.js pin); no Playwright-owned process is created.
        const { chromium } = require("playwright");
        browser = await chromium.connectOverCDP(origin, { timeout: 15000, noDefaults: true, artifactsDir: gate });
        const pages = browser.contexts().flatMap(context => context.pages());
        const candidates = [];
        for (const candidate of pages) if (/^vscode-file:\/\/vscode-app\//.test(candidate.url()) && (await candidate.title()).includes(b.targetTitleContains)) candidates.push(candidate);
        assert.equal(candidates.length, 1, "One exact owned workbench renderer required; no arbitrary page fallback.");
        page = candidates[0]; page.setDefaultTimeout(8000);
        result.renderer = { url: page.url(), title: await page.title() };
        const snapshot = async () => page.evaluate(ids => {
            const active = document.activeElement;
            const describe = element => element ? { id: element.id, role: element.getAttribute("role"), ariaLabel: element.getAttribute("aria-label"), activeDescendant: element.getAttribute("aria-activedescendant"), text: (element.textContent || "").slice(0, 900) } : null;
            const views = ids.map(id => {
                const exact = document.getElementById(id);
                const candidates = [...document.querySelectorAll("[id]")].filter(element => element.id === id || element.id.startsWith(id + "."));
                const container = exact || candidates.find(element => element.querySelector('[role="tree"]')) || candidates.find(element => element.closest(".pane"))?.closest(".pane");
                if (!container) return { view: id, found: false, candidateIds: candidates.map(element => element.id).slice(0, 10) };
                const tree = container.getAttribute("role") === "tree" ? container : container.querySelector('[role="tree"]');
                const rect = container.getBoundingClientRect(), style = getComputedStyle(container);
                const activeId = tree?.getAttribute("aria-activedescendant") || active?.getAttribute("aria-activedescendant");
                const selected = activeId ? document.getElementById(activeId) : tree?.querySelector('[role="treeitem"][aria-selected="true"]');
                return { view: id, found: true, containerId: container.id, containerRole: container.getAttribute("role"), tree: describe(tree), visible: rect.width > 0 && rect.height > 0,
                    rowCount: tree?.querySelectorAll('[role="treeitem"]').length ?? 0, selected: describe(selected), focusWithin: !!active && (container.contains(active) || !!activeId && !!tree?.contains(document.getElementById(activeId))),
                    style: { color: style.color, backgroundColor: style.backgroundColor, outline: style.outline, animationDuration: style.animationDuration, transitionDuration: style.transitionDuration, scrollBehavior: style.scrollBehavior } };
            });
            return { at: Date.now(), bodyClass: document.body.className, workbenchClass: document.querySelector(".monaco-workbench")?.className,
                highContrast: !!document.querySelector(".hc-black"), reducedMotion: !!document.querySelector(".monaco-reduce-motion"),
                mediaReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, active: describe(active), views };
        }, IDS);
        const first = await snapshot(); result.observations.push({ phase: "initial-live-DOM-discovery", ...first });
        assert(first.highContrast && first.workbenchClass?.includes("hc-black"), "Actual high contrast workbench was not rendered.");
        assert(first.reducedMotion, "Actual native reduced-motion class was not rendered.");
        result.highContrast = "OBSERVED_ACTUAL_HC_BLACK_RENDERER"; result.reducedMotion = "OBSERVED_ACTUAL_MONACO_REDUCE_MOTION";
        // Capture only the real rendered privacy frame and actual host variables.
        const frame = await until(async () => {
            for (const candidate of page.frames()) {
                try { if (await candidate.title() === "Project privacy" && await candidate.locator("h1").first().textContent() === "Private secrets. Productive coding.") return candidate; } catch {}
            }
            return undefined;
        }, 10000, "Actual shipped Project Privacy webview frame not found");
        const variableNames = [...new Set([...html.matchAll(/var\((--vscode-[a-zA-Z0-9_-]+)/g)].map(match => match[1]))];
        assert(variableNames.length > 10 && variableNames.length < 512);
        const styles = await frame.evaluate(names => {
            const style = getComputedStyle(document.documentElement), variables = {};
            for (const name of names) variables[name] = style.getPropertyValue(name).trim();
            return { documentTitle: document.title, heading: document.querySelector("h1")?.textContent, bodyClass: document.body.className,
                color: getComputedStyle(document.body).color, background: getComputedStyle(document.body).backgroundColor, variables,
                csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") };
        }, variableNames);
        const originalCsp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
        assert(originalCsp && styles.csp === originalCsp, "Rendered frame CSP differs from exact owner-captured HTML.");
        assert(styles.variables["--vscode-foreground"] && styles.variables["--vscode-editor-background"], "Actual host theme CSS variables missing.");
        result.adjacentCapture = { html: ready.html, styles: writeJson(path.join(gate, "f29-project-privacy-theme-capture-01.json"), {
            schemaVersion: 1, feature: "F29", status: "ACTUAL_OWNED_CODE_WEBVIEW_THEME_CAPTURE", readySha256, html: ready.html,
            loadedBundleSha256: ready.loadedBundleSha256, rendererUrl: page.url(), frameUrl: frame.url(), ...styles,
            hostingLayer: "Actual host-computed CSS variables; HTML and production CSP remain separate unmodified bytes.", signals: 0 }) };
        const palette = async query => {
            await page.keyboard.press("Escape"); await page.keyboard.press("Control+Shift+P");
            await page.keyboard.type(query, { delay: 5 });
            await until(async () => { const widget = page.locator(".quick-input-widget"); if (!await widget.isVisible()) return false; const labels = (await widget.innerText()).replace(/\s+/g, " "); return labels.includes(query.replace(/\s+/g, " ")); }, 8000, "Actual command palette result not observed before Enter");
            await page.keyboard.press("Enter");
        };
        await palette("SoterAI: Open Protection Center");
        await until(async () => (await snapshot()).views[0].focusWithin, 8000, "Keyboard palette did not focus actual Protected items tree");
        for (let index = 0; index < IDS.length; index++) {
            if (index) await palette(FOCUS[index]);
            const focused = await until(async () => { const value = await snapshot(); return value.views[index].focusWithin && value; }, 8000, "Actual keyboard focus did not reach exact native view");
            assert(focused.views[index].tree?.role === "tree" && focused.views[index].rowCount > 0 && focused.views[index].visible);
            result.observations.push({ phase: "keyboard-focus", view: IDS[index], ...focused });
            for (const key of ["Home", "ArrowDown", "ArrowUp", "End", "Home"]) { await page.keyboard.press(key); const after = await snapshot(); assert(after.views[index].focusWithin); result.observations.push({ phase: "keyboard-navigation", view: IDS[index], key, ...after }); }
        }
        const selectByKeyboard = async (index, label) => {
            await palette(FOCUS[index]); await page.keyboard.press("Home");
            for (let n = 0; n < 40; n++) {
                const current = await snapshot();
                if (current.views[index].selected?.text.includes(label) || current.views[index].selected?.ariaLabel?.includes(label)) return current;
                await page.keyboard.press("ArrowDown");
            }
            throw new Error("Fixed safe action row not reached using actual arrow keys.");
        };
        result.observations.push({ phase: "safe-revoke-before-enter", ...(await selectByKeyboard(0, "Revoke managed reads and clear previews")) });
        await page.keyboard.press("Enter"); result.observations.push({ phase: "safe-revoke-after-enter", ...(await snapshot()) });
        result.observations.push({ phase: "workflow-before-enter", ...(await selectByKeyboard(2, "Review optional setup and restore")) });
        await page.keyboard.press("Enter");
        await until(async () => await page.locator(".quick-input-widget").isVisible() && (await page.locator(".quick-input-widget").innerText()).includes("Protection Center: optional setup and restore"), 8000, "Real optional workflow picker did not appear");
        const beforeEscape = await page.locator(".quick-input-widget").innerText(); await page.keyboard.press("Escape");
        await until(async () => !(await page.locator(".quick-input-widget").isVisible()), 8000, "Real Escape did not dismiss optional workflow picker");
        result.observations.push({ phase: "actual-picker-escape", pickerTitleObserved: beforeEscape.slice(0, 160), ...(await snapshot()) });
        result.chooserEscape = "OBSERVED_ACTUAL_QUICK_PICK_ENTER_AND_ESCAPE";
        await palette("SoterAI: Open Protection Center");
        await until(async () => (await snapshot()).views[0].focusWithin, 8000, "Keyboard return focus missing");
        const final = await snapshot(); assert(final.highContrast && final.reducedMotion);
        result.observations.push({ phase: "final-live-renderer", ...final });
        const screenshot = path.join(gate, "f29-code-native-high-contrast-motion-01.png"); await page.screenshot({ path: screenshot });
        const screenshotRaw = fs.readFileSync(screenshot); result.screenshot = { path: screenshot, bytes: screenshotRaw.length, sha256: sha(screenshotRaw) };
        result.nativeTreeKeyboard = "OBSERVED_ACTUAL_PALETTE_ARROWS_ENTER_ESCAPE_NO_MOUSE";
        result.status = "PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING";
    } catch (error) {
        failure = error; result.status = "FAIL_OR_INCOMPLETE_ACTUAL_RENDERER_OBSERVER"; result.error = String(error?.stack ?? error).slice(0, 3500);
    } finally {
        // Installed connectOverCDP has browserProcess.close=transport.closeAndWait.
        // No Browser.close protocol is sent to Code and root retains child custody.
        if (browser) try { await browser.close(); result.transport = "ATTACHED_CDP_TRANSPORT_DISCONNECTED_CODE_OWNER_RETAINED"; } catch (error) { result.disconnectError = String(error.message).slice(0, 400); failure ||= error; }
        result.finishedAt = new Date().toISOString();
        const observationsPin = writeJson(path.join(gate, outputName), result);
        writeJson(doneFile, { schemaVersion: 1, status: "OBSERVER_COMPLETED", readySha256, observationsPin, signals: 0 });
        console.log(JSON.stringify({ status: result.status, observationsPin, nativeChildClosure: "ROOT_NATIVE_OWNER_REQUIRED", signals: 0 }));
    }
    if (failure) process.exitCode = 1;
}
main().catch(error => { console.error(String(error?.stack ?? error).slice(0, 3500)); process.exitCode = 1; });
