"use strict";
// Root executes only after binding review. Direct child ownership, no launcher,
// no process signals, no deletion, and no Playwright-owned launch/kill fallback.
const C = require("./accessibility-binding-01.cjs");
const { fs, path, assert, pin, readJson, dDirectory, newDirectory, writeJson, admit, until, inside, sha } = C;
const { spawn } = require("node:child_process");
const http = require("node:http");
const crypto = require("node:crypto");
async function main() {
    assert.equal(process.argv.length, 3, "Usage: node run-edge-axe-capture-01.cjs <bound JSON>");
    const { b, inventory, bindingPin } = admit(process.argv[2], "EDGE_AXE_CAPTURE");
    const parent = dDirectory(b.profileParent);
    const ownerReady = JSON.parse(pin(b.nativeReady).raw.toString("utf8"));
    const codeObservations = JSON.parse(pin(b.codeObservations).raw.toString("utf8"));
    assert.equal(ownerReady.schemaVersion, 1); assert.equal(ownerReady.feature, "F29"); assert.equal(ownerReady.syntheticOnly, true); assert.equal(ownerReady.signals, 0);
    assert.equal(codeObservations.status, "PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING");
    assert.equal(codeObservations.readySha256, b.nativeReady.sha256); assert.equal(codeObservations.signals, 0);
    assert(b.runtimes.some(row => row.sha256 === ownerReady.loadedBundleSha256));
    const html = pin(b.captureHtml).raw, styles = JSON.parse(pin(b.captureTheme).raw.toString("utf8"));
    assert.equal(b.captureHtml.sha256, ownerReady.html.sha256);
    assert(["ACTUAL_OWNED_CODE_WEBVIEW_THEME_CAPTURE","ACTUAL_OWNED_CODE_WORKBENCH_THEME_CAPTURE"].includes(styles.status)); assert.equal(styles.readySha256, b.nativeReady.sha256);
    assert.equal(styles.html.sha256, b.captureHtml.sha256); assert.equal(styles.loadedBundleSha256, ownerReady.loadedBundleSha256);
    assert.equal(styles.heading, "Private secrets. Productive coding."); assert.equal(styles.documentTitle, "Project privacy");
    const text = html.toString("utf8"); assert(text.includes(styles.heading) && text.includes("Full-protection claim:"));
    assert(text.includes(`content="${styles.csp}"`), "Original owner CSP required unchanged.");
    const variables = styles.variables; assert(variables && Object.keys(variables).length > 10 && Object.keys(variables).length < 512);
    for (const [name, value] of Object.entries(variables)) {
        assert(/^--vscode-[A-Za-z0-9_-]+$/.test(name) && typeof value === "string" && value.length < 2048);
        assert(!/url\s*\(|expression\s*\(|[\u0000-\u001f\u007f]/i.test(value), "Theme layer cannot contain network or executable CSS.");
    }
    const executable = inventory.pins.find(row => /[/\\]msedge\.exe$/i.test(row.path)); assert(executable);
    const axePin = inventory.pins.find(row => /[/\\]axe\.min\.js$/i.test(row.path)); assert(axePin);
    const axeSource = pin(axePin).raw.toString("utf8"); assert(axeSource.length < 1024 * 1024);
    const run = newDirectory(parent, `f29-edge-axe-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
    const profile = newDirectory(run, "edge-profile"), user = newDirectory(run, "user"), temp = newDirectory(run, "temp");
    const local = newDirectory(user, "local"), roaming = newDirectory(user, "roaming");
    const result = { schemaVersion: 1, feature: "F29", status: "INCOMPLETE", independence: "LOW_SAME_LINEAGE", bindingPin, run, profile,
        exactCapturedHtml: b.captureHtml, actualThemeCapture: b.captureTheme, nativeReady: b.nativeReady, codeObservations: b.codeObservations,
        startedAt: new Date().toISOString(), browser: "EXACT_PINNED_INSTALLED_EDGE_HEADLESS_DIRECT_CHILD", signals: 0, phases: [],
        deniedRequests: [], consoleErrors: [], protocolCloseRequests: 0,
        scope: "Installed axe in real headless Edge on exact actual-shipped adjacent Project Privacy capture and actual Code host theme variables (webview or explicitly labeled workbench capture). Separate from native TreeViews and actual host action execution.",
        limitations: ["Production HTML/CSP retained; separately recorded actual host CSS-variable layer applied by debugger.", "No acquireVsCodeApi bridge is fabricated; absent bridge can produce a recorded script error. Browser Tab checks do not execute extension workflows.", "Axe incomplete/manual-review findings are retained and do not establish human screen-reader or usability evidence.", "Same-lineage automation, synthetic isolated profile only."] };
    const routePath = `/capture/${b.captureHtml.sha256}.html`;
    let origin, child, browser, cdp, failure, childResult, closeTimer, outFd, errFd, serverClosed = false;
    let outEnded = false, errEnded = false, actualClosed = false, ioError, stdoutBytes = 0, stderrBytes = 0;
    const server = http.createServer((request, response) => {
        const host = request.headers.host;
        if (request.method === "GET" && request.url === routePath && host === new URL(origin).host) {
            response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": html.length, "cache-control": "no-store" }); response.end(html);
        } else {
            if (result.deniedRequests.length < 100) result.deniedRequests.push({ method: request.method, url: String(request.url).slice(0, 400), host: String(host).slice(0, 200), source: "LOOPBACK_HTTP_AND_REFUSAL_PROXY" });
            response.writeHead(403, { "content-type": "text/plain", "connection": "close" }); response.end("Synthetic fixture permits only the pinned loopback capture.");
        }
    });
    server.on("connect", (request, socket) => {
        if (result.deniedRequests.length < 100) result.deniedRequests.push({ method: "CONNECT", url: String(request.url).slice(0, 400), source: "LOOPBACK_REFUSAL_PROXY_NO_EXTERNAL_CONNECT" });
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    origin = `http://127.0.0.1:${server.address().port}`; result.captureOrigin = origin;
    const args = ["--headless=new", `--user-data-dir=${profile}`, "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
        "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-breakpad", "--disable-crash-reporter",
        "--disable-features=MediaRouter,OptimizationHints,msEdgeSidebarV2,msEdgeWallet,msEdgeShoppingIntegration",
        `--proxy-server=${origin}`, "--proxy-bypass-list=127.0.0.1;localhost;[::1]", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "about:blank"];
    const env = { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: path.dirname(process.execPath), USERPROFILE: user, APPDATA: roaming, LOCALAPPDATA: local, TEMP: temp, TMP: temp, HOMEDRIVE: "D:", HOMEPATH: user.slice(2) };
    // Preopen both pipes before spawning. Every listener is installed before any
    // post-spawn receipt I/O; I/O failure cannot discard actual child custody.
    outFd = fs.openSync(path.join(run, "edge-stdout.bin"), "wx"); errFd = fs.openSync(path.join(run, "edge-stderr.bin"), "wx");
    let finish;
    const childClosedAndEof = new Promise(resolve => { finish = resolve; });
    const maybeFinish = () => { if (actualClosed && outEnded && errEnded) finish(childResult); };
    const retainIoError = error => { ioError ||= String(error?.message ?? error).slice(0, 500); };
    try {
        child = spawn(executable.path, args, { cwd: run, env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
        child.stdout.on("data", bytes => { stdoutBytes += bytes.length; try { fs.writeSync(outFd, bytes); } catch (error) { retainIoError(error); } });
        child.stderr.on("data", bytes => { stderrBytes += bytes.length; try { fs.writeSync(errFd, bytes); } catch (error) { retainIoError(error); } });
        child.stdout.once("end", () => { outEnded = true; maybeFinish(); }); child.stderr.once("end", () => { errEnded = true; maybeFinish(); });
        child.stdout.on("error", retainIoError); child.stderr.on("error", retainIoError);
        child.once("error", error => { result.spawnError = String(error.message).slice(0, 500); });
        child.once("close", (exitCode, signal) => {
            actualClosed = true; childResult = { pid: child.pid ?? null, exitCode, signal, observedAt: new Date().toISOString() }; maybeFinish();
        });
        result.childPid = child.pid ?? null;
        writeJson(path.join(run, "edge-owned-start-01.json"), { schemaVersion: 1, status: "STARTED_NOT_COMPLETED", executable, args, pid: child.pid ?? null, profile, run, bindingPin, signals: 0 });
        const active = await until(() => {
            if (actualClosed) throw new Error("Owned Edge closed before CDP readiness.");
            const filename = path.join(profile, "DevToolsActivePort"); if (!fs.existsSync(filename)) return;
            C.ordinaryFile(filename, 4096); const raw = fs.readFileSync(filename, "utf8"), lines = raw.trim().split(/\r?\n/);
            if (!/^\d+$/.test(lines[0]) || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(lines[1] ?? "")) return;
            const port = Number(lines[0]); assert(port >= 1024 && port <= 65535);
            return { endpoint: `ws://127.0.0.1:${port}${lines[1]}`, pin: { path: filename, bytes: Buffer.byteLength(raw), sha256: sha(raw) } };
        }, 20000, "Fresh owned Edge DevToolsActivePort not observed");
        result.devtools = active;
        const { chromium } = require("playwright");
        browser = await chromium.connectOverCDP(active.endpoint, { timeout: 15000, noDefaults: true, artifactsDir: run });
        cdp = await browser.newBrowserCDPSession();
        const contexts = browser.contexts(); assert.equal(contexts.length, 1);
        const context = contexts[0];
        await context.route("**/*", async route => {
            const url = new URL(route.request().url());
            if (url.origin === origin && url.pathname === routePath && route.request().method() === "GET") await route.continue();
            else { if (result.deniedRequests.length < 100) result.deniedRequests.push({ url: url.href.slice(0, 400), source: "BROWSER_CONTEXT_NONFIXTURE_REQUEST_ABORTED" }); await route.abort("blockedbyclient"); }
        });
        const pages = context.pages(); assert(pages.every(page => page.url() === "about:blank"));
        const page = pages[0] ?? await context.newPage(); page.setDefaultTimeout(10000); await page.setViewportSize({ width: 1366, height: 900 });
        page.on("pageerror", error => { if (result.consoleErrors.length < 50) result.consoleErrors.push(String(error.message).slice(0, 500)); });
        page.on("download", () => { result.unexpectedDownload = true; });
        for (const mode of [{ id: "standard", forcedColors: "none", reducedMotion: "no-preference" }, { id: "forced-colors", forcedColors: "active", reducedMotion: "no-preference" }, { id: "reduced-motion", forcedColors: "none", reducedMotion: "reduce" }]) {
            await page.emulateMedia({ forcedColors: mode.forcedColors, reducedMotion: mode.reducedMotion });
            const response = await page.goto(origin + routePath, { waitUntil: "networkidle", timeout: 15000 }); assert(response && response.status() === 200); assert.equal(page.url(), origin + routePath);
            assert.equal(await page.title(), "Project privacy"); assert.equal(await page.locator("h1").textContent(), styles.heading);
            assert((await page.locator("body").innerText()).includes("Full-protection claim:"));
            // Actual captured host theme is a recorded hosting layer. Neither
            // production CSP nor captured HTML is rewritten for this browser.
            await page.evaluate(values => { for (const [name, value] of Object.entries(values)) if (value) document.documentElement.style.setProperty(name, value); }, variables);
            const observed = await page.evaluate(() => ({ forcedColors: matchMedia("(forced-colors: active)").matches, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
                csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"), bodyColor: getComputedStyle(document.body).color,
                bodyBackground: getComputedStyle(document.body).backgroundColor, controls: document.querySelectorAll("a[href],button,input,select,summary").length,
                animation: [...document.querySelectorAll("body,button,a,summary")].slice(0, 100).map(element => ({ tag: element.tagName, animationDuration: getComputedStyle(element).animationDuration, transitionDuration: getComputedStyle(element).transitionDuration })) }));
            assert.equal(observed.csp, styles.csp); assert.equal(observed.forcedColors, mode.forcedColors === "active"); assert.equal(observed.reducedMotion, mode.reducedMotion === "reduce"); assert(observed.controls >= 8);
            await page.evaluate(axeSource);
            const axe = await page.evaluate(async () => {
                if (!window.axe || window.axe.version !== "4.12.1") throw new Error("Exact installed axe did not initialize.");
                return await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations", "passes", "incomplete", "inapplicable"] });
            });
            assert(axe.passes.length > 0 && axe.testEngine.version === "4.12.1", "Empty or wrong-engine axe run cannot pass.");
            const axePin = writeJson(path.join(run, `edge-axe-${mode.id}-01.json`), axe);
            const focus = [];
            for (const key of [...Array(8).fill("Tab"), ...Array(4).fill("Shift+Tab")]) {
                await page.keyboard.press(key);
                focus.push(await page.evaluate(key => { const element = document.activeElement, rect = element?.getBoundingClientRect(), style = element && getComputedStyle(element); return { key, tag: element?.tagName, id: element?.id, text: element?.textContent?.slice(0, 200), visible: !!rect && rect.width > 0 && rect.height > 0, outline: style?.outline, href: element?.getAttribute("href") }; }, key));
            }
            assert(focus.some(row => row.visible && row.tag !== "BODY")); assert(new Set(focus.filter(row => row.tag !== "BODY").map(row => `${row.tag}/${row.id}/${row.text}`)).size >= 3, "Real Tab movement among existing controls required.");
            const screenshot = path.join(run, `edge-${mode.id}-01.png`); await page.screenshot({ path: screenshot, fullPage: true }); const screenshotRaw = fs.readFileSync(screenshot);
            result.phases.push({ id: mode.id, observed, axe: axePin, violations: axe.violations.length, incomplete: axe.incomplete.length, passes: axe.passes.length, inapplicable: axe.inapplicable.length,
                keyboard: focus, screenshot: { path: screenshot, bytes: screenshotRaw.length, sha256: sha(screenshotRaw) } });
            console.log(JSON.stringify({ phase: mode.id, violations: axe.violations.length, incomplete: axe.incomplete.length, passes: axe.passes.length }));
        }
        assert(!result.unexpectedDownload, "Unexpected download observed.");
        if (result.phases.some(phase => phase.violations > 0)) throw new Error("Actual axe violations retained; no accessibility PASS.");
    } catch (error) {
        failure = error; result.error = String(error?.stack ?? error).slice(0, 3500);
    } finally {
        if (cdp && !actualClosed) {
            result.protocolCloseRequests++;
            try { await cdp.send("Browser.close"); } catch (error) { result.protocolCloseError = String(error.message).slice(0, 400); }
        }
        if (browser) try { await browser.close(); } catch (error) { result.transportCloseError = String(error.message).slice(0, 400); }
        if (child) {
            // Observation only. Keep draining/owning the known child after a
            // deadline; a timeout never requests a signal or deletes a profile.
            closeTimer = setTimeout(() => { result.naturalClosureDeadlineExceeded = true; try { writeJson(path.join(run, "edge-close-timeout-01.json"), { status: "INCOMPLETE_KNOWN_CHILD_RETAINED_NO_SIGNALS", pid: child.pid ?? null, actualClosed, outEnded, errEnded, signals: 0 }); } catch (error) { retainIoError(error); } }, 60000);
            await childClosedAndEof; clearTimeout(closeTimer);
            try { fs.closeSync(outFd); fs.closeSync(errFd); } catch (error) { retainIoError(error); }
            result.childClosure = { ...childResult, stdoutEof: outEnded, stderrEof: errEnded, stdoutBytes, stderrBytes, ioError: ioError ?? null, signals: 0 };
            writeJson(path.join(run, "edge-owned-close-01.json"), result.childClosure);
        } else {
            if (outFd !== undefined) fs.closeSync(outFd); if (errFd !== undefined) fs.closeSync(errFd);
        }
        await new Promise(resolve => server.close(() => { serverClosed = true; resolve(); }));
        result.serverClosedNormally = serverClosed;
        const closure = result.childClosure;
        const clean = !failure && result.phases.length === 3 && result.phases.every(phase => phase.violations === 0) && closure?.exitCode === 0 && closure.signal === null && closure.stdoutEof && closure.stderrEof && !ioError && !result.naturalClosureDeadlineExceeded;
        result.status = clean ? "PASS_SCOPED_REAL_HEADLESS_EDGE_AXE_CAPTURE_MANUAL_REVIEW_REMAINS" : "FAIL_OR_INCOMPLETE_REAL_HEADLESS_EDGE_CAPTURE";
        result.finishedAt = new Date().toISOString();
        const resultPin = writeJson(path.join(run, "edge-axe-summary-01.json"), result);
        console.log(JSON.stringify({ status: result.status, run, resultPin, signals: 0 }));
        if (!clean) process.exitCode = 1;
    }
}
main().catch(error => { console.error(String(error?.stack ?? error).slice(0, 3500)); process.exitCode = 1; });
