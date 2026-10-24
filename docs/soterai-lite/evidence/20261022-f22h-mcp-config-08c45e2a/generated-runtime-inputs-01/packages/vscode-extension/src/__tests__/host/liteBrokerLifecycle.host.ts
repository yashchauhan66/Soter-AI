/** F14 actual packaged manager/child in isolated native developer windows. LOW. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import * as childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { BrokerManager, BrokerStatus } from "../../broker/BrokerManager";
type Run = { child: childProcess.ChildProcess; env: NodeJS.ProcessEnv; argv: string[]; closed: boolean; out: boolean; err: boolean };
const runs: Run[] = [], restores: (() => void)[] = [];
let captured: vscode.ExtensionContext | undefined;
let setup: Record<string, unknown> = { phase: "initial" };
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
function patch(object: object, name: string, value: unknown): void { const descriptor = Object.getOwnPropertyDescriptor(object, name); setup = { phase: "patch", name, frozen: Object.isFrozen(object), configurable: descriptor?.configurable, writable: descriptor?.writable }; Object.defineProperty(object, name, { configurable: true, writable: true, value }); restores.push(() => { if (descriptor) Object.defineProperty(object, name, descriptor); else Reflect.deleteProperty(object, name); }); }
function noTokens(value: unknown): void { const text = JSON.stringify(value); for (const run of runs) for (const key of ["SOTERAI_BROKER_TOKEN", "SOTERAI_BROKER_CONTROL_TOKEN", "SOTERAI_PROVIDER_API_KEY"]) if (run.env[key]) assert.ok(!text.includes(run.env[key]!), "Native report contains private auth"); }
async function until(check: () => boolean | Promise<boolean>, ms = 10000): Promise<void> { const end = Date.now() + ms; while (Date.now() < end) { if (await check()) return; await new Promise<void>(done => setTimeout(done, 25)); } throw Error("Native lifecycle condition unavailable"); }
export function setupDiagnostic() { return { contextCaptured: !!captured, childCount: runs.length, ...setup }; }
export function beforeActivate(context: vscode.ExtensionContext): void {
    captured = context; assert.match(resolve(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
    const original = childProcess.spawn;
    // This namespace is a CommonJS live module in the native compiled probe.
    patch(require("node:child_process"), "spawn", function(executable: string, argv: string[], options: childProcess.SpawnOptions) {
        const child = Reflect.apply(original, childProcess, [executable, argv, options]) as childProcess.ChildProcess;
        if (argv?.length === 1 && /[\\/]dist[\\/]local-ai-broker\.js$/.test(argv[0])) {
            const row: Run = { child, env: { ...options.env }, argv: [...argv], closed: false, out: false, err: false }; runs.push(row);
            child.once("close", () => { row.closed = true; }); child.stdout?.once("end", () => { row.out = true; }); child.stderr?.once("end", () => { row.err = true; });
        }
        return child;
    });
    for (const name of ["showInformationMessage", "showWarningMessage", "showErrorMessage"]) patch(vscode.window, name, async (message: unknown) => { noTokens(message); return undefined; });
    setup = { phase: "harness-installed" };
}
function manager(context: vscode.ExtensionContext): BrokerManager { const found = context.subscriptions.find(value => typeof (value as BrokerManager).ownedSnapshot === "function") as BrokerManager | undefined; assert.ok(found); return found; }
function http(run: Run, url: string, route: string, token = run.env.SOTERAI_BROKER_CONTROL_TOKEN!, session: string | undefined = run.env.SOTERAI_BROKER_SESSION) { return fetch(url + route, { headers: { authorization: `Bearer ${token}`, ...(session ? { "x-soterai-session": session } : {}) } }); }
async function stopped(current: BrokerManager): Promise<void> { await current.stop(); await until(() => runs.every(row => row.closed && row.out && row.err)); assert.equal(current.ownedSnapshot().state, "stopped"); }

async function peer(context: vscode.ExtensionContext, root: string): Promise<void> {
    const current = manager(context), status = await current.start();
    await writeFile(join(root, "peer-ready.json"), JSON.stringify({ url: status.url, session: current.ownedSnapshot().session, hostVersion: vscode.version }) + "\n", { flag: "wx" });
    try { await until(async () => { try { await readFile(join(root, "peer-stop.json")); return true; } catch { return false; } }, 40000); }
    finally { await stopped(current); }
    await writeFile(join(root, "peer-closed.json"), JSON.stringify({ status: "PASS", closed: runs.every(row => row.closed && row.out && row.err), hostVersion: vscode.version }) + "\n", { flag: "wx" });
}
async function concurrentPeer(context: vscode.ExtensionContext, current: BrokerManager, root: string): Promise<void> {
    const profile = join(root, "peer-profile"), extensions = join(root, "peer-extensions"), workspace = vscode.workspace.workspaceFolders![0].uri.fsPath;
    await mkdir(join(profile, "User"), { recursive: true }); await mkdir(join(profile, "Temp")); await mkdir(extensions);
    const ownProfile = process.env.SOTERAI_LITE_F14_PROFILE!;
    // Current isolated fixture settings only, never the normal profile.
    await writeFile(join(profile, "User/settings.json"), await readFile(join(ownProfile, "User/settings.json")), { flag: "wx" });
    const env: NodeJS.ProcessEnv = {};
    for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { USERPROFILE: profile, APPDATA: join(profile, "AppData/Roaming"), LOCALAPPDATA: join(profile, "AppData/Local"), TEMP: join(profile, "Temp"), TMP: join(profile, "Temp"),
        SOTERAI_LITE_F14_PROFILE: profile, SOTERAI_LITE_F14_PHASE: "peer", SOTERAI_LITE_F14_PEER_ROOT: root, SOTERAI_LITE_F14_EVIDENCE: join(root, "peer-results.json"), SOTERAI_LITE_F14_BUNDLE_SHA256: process.env.SOTERAI_LITE_F14_BUNDLE_SHA256, SOTERAI_LITE_F14_DRIVER_KIND: "native-bootstrap" });
    const child = childProcess.spawn(process.execPath, [`--extensionDevelopmentPath=${context.extensionUri.fsPath}`, `--user-data-dir=${profile}`, `--extensions-dir=${extensions}`, "--new-window", "--disable-extensions", "--disable-extension=vscode.git", "--disable-extension=vscode.github-authentication", "--disable-extension=vscode.microsoft-authentication", "--disable-workspace-trust", "--disable-gpu", "--disable-updates", "--skip-welcome", "--skip-release-notes", workspace], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", () => undefined); child.stderr?.on("data", () => undefined);
    let closed = false; child.once("close", () => { closed = true; });
    try {
        await until(async () => { try { await readFile(join(root, "peer-ready.json")); return true; } catch { return false; } }, 30000);
        const remote = JSON.parse(await readFile(join(root, "peer-ready.json"), "utf8"));
        assert.notEqual(remote.url, current.url); assert.notEqual(remote.session, current.ownedSnapshot().session);
        assert.equal((await http(runs.at(-1)!, remote.url, "/version")).status, 401);
        assert.equal((await current.status()).running, true);
    } finally { await writeFile(join(root, "peer-stop.json"), "{}\n", { flag: "wx" }); }
    await until(async () => { try { await readFile(join(root, "peer-closed.json")); return closed; } catch { return false; } }, 20000);
    assert.equal(JSON.parse(await readFile(join(root, "peer-closed.json"), "utf8")).closed, true);
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(captured, context); const phase = process.env.SOTERAI_LITE_F14_PHASE!, output = process.env.SOTERAI_LITE_F14_EVIDENCE!;
    if (phase === "peer") { try { await peer(context, process.env.SOTERAI_LITE_F14_PEER_ROOT!); } finally { for (const restore of restores.reverse()) restore(); } return; }
    const profile = process.env.SOTERAI_LITE_F14_PROFILE!, root = dirname(profile), current = manager(context), config = vscode.workspace.getConfiguration("soterai");
    const originalFlag = config.inspect<boolean>("lite.gatewayLifecycle")?.globalValue;
    const runtime = sha(await readFile(join(context.extensionUri.fsPath, "dist/extension.js")));
    assert.equal(runtime, process.env.SOTERAI_LITE_F14_BUNDLE_SHA256); assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
    const count = phase === "primary" ? 16 : 3, offset = phase === "primary" ? 0 : 16;
    const observations = Array.from({ length: count }, (_, i) => ({ id: "F14-H" + String(offset + i + 1).padStart(2, "0"), status: "NOT_RUN", scope: "Actual owned broker lifecycle" }));
    const check = async (index: number, action: () => Promise<void>) => { const row = observations[index - 1]; try { await action(); row.status = "PASS"; } catch { row.status = "FAIL"; } };
    let driverFailure: string | undefined, firstRun: Run | undefined, firstUrl = "";
    try {
        if (phase === "primary") {
            await check(1, async () => { const pkg = JSON.parse(await readFile(join(context.extensionUri.fsPath, "package.json"), "utf8")); assert.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayLifecycle"].scope, "machine"); assert.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayLifecycle")); });
            await check(2, async () => { assert.equal((await current.status()).running, false); assert.equal(runs.length, 0); assert.equal(current.memorySessionId, undefined); });
            await check(3, async () => { const held = createServer(); let owned = false; await new Promise<void>((done, reject) => { held.once("error", (e: NodeJS.ErrnoException) => e.code === "EADDRINUSE" ? done() : reject(e)); held.listen(47321, "127.0.0.1", () => { owned = true; done(); }); }); try { const s = await vscode.commands.executeCommand<BrokerStatus>("soterai.startLocalAIBroker"); assert.equal(s?.running, true); assert.notEqual(current.port, 47321); firstUrl = current.url; firstRun = runs.at(-1); assert.ok(firstRun); } finally { if (owned) await new Promise<void>(done => held.close(() => done())); } });
            await check(4, async () => { assert.ok(firstRun); assert.equal(firstRun.argv.length, 1); assert.equal(firstRun.env.SOTERAI_BROKER_PORT, "0"); assert.notEqual(firstRun.env.SOTERAI_BROKER_TOKEN, firstRun.env.SOTERAI_BROKER_CONTROL_TOKEN); noTokens(current.ownedSnapshot()); });
            await check(5, async () => { const before = runs.length; assert.equal((await current.start()).running, true); assert.equal(runs.length, before); });
            await check(6, async () => { assert.ok(firstRun); assert.equal((await http(firstRun, current.url, "/version", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 200); assert.equal((await http(firstRun, current.url, "/v1/lifecycle/status", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 403); assert.equal((await http(firstRun, current.url, "/version", firstRun.env.SOTERAI_BROKER_CONTROL_TOKEN, "wrong-window")).status, 403); });
            await check(7, async () => { assert.deepEqual((await current.status()).safeMode, { enabled: true, level: "strict", ...((await current.status()).safeMode ?? {}) }); assert.equal((await current.status()).safeMode?.enabled, true); assert.equal((await current.status()).safeMode?.level, "strict"); });
            await check(8, async () => { const result = await current.request<{ decision: string }>("/v1/scan", { method: "POST", body: JSON.stringify({ content: "Public arithmetic example 2 plus 2." }) }); assert.equal(result.decision, "allow"); });
            await check(9, async () => { const result = await current.request<{ decision: string }>("/v1/scan", { method: "POST", body: JSON.stringify({ content: "OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnopqrstuv" }) }); assert.notEqual(result.decision, "allow"); });
            await check(10, async () => { const before = current.ownedSnapshot().session; await current.restart(); assert.notEqual(current.ownedSnapshot().session, before); assert.ok(firstRun?.closed && firstRun.out && firstRun.err); });
            await check(11, async () => concurrentPeer(context, current, root));
            await check(12, async () => { assert.ok(firstRun); const active = runs.at(-1)!; assert.notEqual(active.env.SOTERAI_BROKER_TOKEN, firstRun.env.SOTERAI_BROKER_TOKEN); assert.equal((await http(active, current.url, "/version", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 401); });
            await check(13, async () => { await config.update("lite.gatewayLifecycle", false, vscode.ConfigurationTarget.Global); await stopped(current); await assert.rejects(current.start()); assert.equal(context.globalState.get("soterai.safeMode"), undefined); await config.update("lite.gatewayLifecycle", true, vscode.ConfigurationTarget.Global); await current.start(); });
            await check(14, async () => { const before = current.ownedSnapshot().session; const registry = Reflect.get(current, "canaries") as { rotate(): Promise<unknown> }; assert.equal(typeof registry.rotate, "function"); await registry.rotate(); await stopped(current); await current.start(); assert.notEqual(current.ownedSnapshot().session, before); });
            await check(15, async () => { await context.globalState.update("soterai.safeMode", { enabled: true, level: "enterprise" }); await current.restart(); assert.equal((await current.status()).safeMode?.level, "enterprise"); });
            await check(16, async () => { await stopped(current); noTokens(runs.map(row => ({ closed: row.closed, out: row.out, err: row.err }))); await writeFile(join(root, "restart-binding.json"), JSON.stringify({ priorSession: firstRun?.env.SOTERAI_BROKER_SESSION, priorUrl: firstUrl, savedMode: context.globalState.get("soterai.safeMode") }) + "\n", { flag: "wx" }); });
        } else {
            await check(1, async () => { const prior = JSON.parse(await readFile(join(root, "restart-binding.json"), "utf8")); assert.equal(current.ownedSnapshot().state, "stopped"); assert.equal(runs.length, 0); assert.equal(current.memorySessionId, undefined); assert.equal((await current.status()).running, false); assert.ok(prior.priorSession); });
            await check(2, async () => { const prior = JSON.parse(await readFile(join(root, "restart-binding.json"), "utf8")); await current.start(); assert.notEqual(current.ownedSnapshot().session, prior.priorSession); assert.equal((await current.status()).safeMode?.level, "enterprise"); assert.deepEqual(context.globalState.get("soterai.safeMode"), prior.savedMode); });
            await check(3, async () => { await stopped(current); assert.ok(runs.length > 0); assert.equal(context.globalState.get<{ level: string }>("soterai.safeMode")?.level, "enterprise"); });
        }
    } catch { driverFailure = "NativeLifecycleDriverFailure"; }
    finally {
        try { await stopped(current); await config.update("lite.gatewayLifecycle", originalFlag, vscode.ConfigurationTarget.Global); } catch { driverFailure = "NativeOwnedShutdownUnconfirmed"; }
        for (const restore of restores.reverse()) restore();
    }
    const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime, currentDeveloperBundleSha256: sha(await readFile(join(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await readFile(__filename)), observations,
        passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length, notRun: observations.filter(row => row.status === "NOT_RUN").length,
        ...(driverFailure ? { driverFailure } : {}), childRuns: runs.map(row => ({ closed: row.closed, stdoutEOF: row.out, stderrEOF: row.err, safe: true })), sourceDocumentCalls: 0, sourceDocumentEvents: 0, independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", observedAt: new Date().toISOString(), notTested: ["Clean installed-VSIX lifecycle", "Independent human/tool routes", "Unmanaged traffic", "OS confinement"] };
    noTokens(result); await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || driverFailure) throw Error("F14 native lifecycle incomplete");
}
