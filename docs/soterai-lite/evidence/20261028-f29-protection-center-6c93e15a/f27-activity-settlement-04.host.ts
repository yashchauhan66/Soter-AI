/** Prepared installed-runtime native API fixture. NOT EXECUTED.
 * No product imports: all behavior enters the exact packaged extension's
 * registered commands, real file watchers, real Memento and real SecretStorage.
 * API failure/held-promise and modal answers are scripted LOW-independence probes.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const {settledActivityReport}=require("./activity-settlement-fixture-04.cjs") as {settledActivityReport(read:()=>Promise<any>):Promise<any>};
const FLAG = "lite.selfHygiene", AUDIT = "soterai.auditLedger", SIGNING = "soterai.auditLedger.signingKey";
const ACTIVITY = "soterai.sentinelEvents", PRIVATE = "FAKE_ONLY_F27_NATIVE_PRIVATE_9e761c04";
const PAYLOAD = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nprivate_note=" + PRIVATE;
const PRIMARY = [
    "Default-off machine setting and telemetry off; no owned audit key or store writes",
    "Disabled actual programmatic audit command refuses without storing caller values",
    "Native restricted machine setting refuses repository override",
    "Explicit global opt-in itself creates no audit key or audit record",
    "Actual registered public egress command persists useful signed finite metadata",
    "Actual registered synthetic-secret egress command stores no caller text or previews",
    "Actual native storage rejection exposes a fixed audit error and preserves stored bytes",
    "Actual audit key await is invalidated by native opt-out then opt-in",
    "Actual audit queue recovers after rejected work without retaining rejected payload",
    "Actual registered audit status shows verified integrity for stored metadata",
    "Actual Sentinel command and native filesystem watcher persist finite metadata",
    "Actual Sentinel export opens a real value-free JSON document with positive events",
    "Actual Sentinel timeline renders public metadata without private paths or values",
    "Native activity storage rejection is reported incomplete without raw exception text",
    "Native opt-out stops actual Sentinel observations and export withholds old events",
    "Scripted cancel then explicit native disable stop the selected Sentinel preference",
    "Actual audit/activity state prepared for a fresh native host restart",
];
const RESTART = [
    "Fresh host retains prior audit bytes without creating another signing key",
    "Fresh actual Sentinel owner minimizes legacy synthetic stored events",
    "Fresh actual activity report exports only minimized legacy metadata",
    "Fresh actual audit status verifies the original retained signed metadata chain",
    "Explicit native flag withdrawal and activity clearing leave no active owned observation",
];
type Row = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; errorName?: string };
const restores: Array<() => void> = [];
const disposables: vscode.Disposable[] = [];
const webviews: vscode.WebviewPanel[] = [];
const reports: string[] = [], notices: string[] = [];
const activityWrites: unknown[] = [], auditWrites: unknown[] = [];
let root = "", phase: "primary" | "restart", auditKeyReads = 0, auditKeyStores = 0;
let activityFailures = 0;
let failAudit = false, failActivity = false, holdKey = false, keyEntered = false;
let releaseKey: (() => void) | undefined;
let approveDisable = false;
const sha = (raw: Uint8Array | string) => createHash("sha256").update(raw).digest("hex");
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
function valueFree(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    assert(!text.includes(PRIVATE), "Private synthetic fixture entered owned metadata.");
    assert(!text.includes("AKIAIOSFODNN7EXAMPLE"), "Synthetic credential entered owned metadata.");
    if (root) assert(!text.toLowerCase().includes(root.toLowerCase()), "Private owner path entered metadata.");
}
function patch(object: object, name: string, value: unknown): void {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => previous ? Object.defineProperty(object, name, previous) : Reflect.deleteProperty(object, name));
}
async function until(predicate: () => boolean, description: string): Promise<void> {
    const end = Date.now() + 15000;
    while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 20));
    assert(predicate(), description);
}
async function flag(value: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("soterai");
    if (config.inspect<boolean>(FLAG)?.globalValue === value) return;
    let acknowledge!: () => void;
    const event = new Promise<void>(done => { acknowledge = done; });
    const listener = vscode.workspace.onDidChangeConfiguration(change => {
        if (change.affectsConfiguration("soterai." + FLAG) && config.inspect<boolean>(FLAG)?.globalValue === value) acknowledge();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await config.update(FLAG, value, vscode.ConfigurationTarget.Global);
        await Promise.race([event, new Promise<never>((_done, reject) => { timer = setTimeout(() => reject(Error("Native flag acknowledgement unavailable.")), 15000); })]);
        assert.equal(config.inspect<boolean>(FLAG)?.globalValue, value);
    } finally { if (timer) clearTimeout(timer); listener.dispose(); }
}
export function setupDiagnostic(): object {
    return { status: "PREPARED_NATIVE_API_FIXTURE", phase, auditKeyReads, auditKeyStores,
        auditWriteCount: auditWrites.length, activityWriteCount: activityWrites.length, reports: reports.length,
        heldKey: keyEntered, syntheticOnly: true, productImports: false };
}
export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(process.platform, "win32"); assert.equal(vscode.env.remoteName, undefined);
    assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    for (const file of [root, context.globalStorageUri.fsPath, process.env.USERPROFILE!]) assert.match(resolve(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert(!within(root, context.globalStorageUri.fsPath));
    const selected = process.env.SOTERAI_LITE_F17_PHASE;
    assert(selected === "primary" || selected === "restart"); phase = selected;
    const originalUpdate = context.globalState.update;
    patch(context.globalState, "update", async (name: string, value: unknown) => {
        if (name === AUDIT) { valueFree(value); if (failAudit) throw Error(PRIVATE); }
        if (name === ACTIVITY) { valueFree(value); if (failActivity) { activityFailures++; throw Error(PRIVATE); } }
        await originalUpdate.call(context.globalState, name, value);
        if (name === AUDIT) auditWrites.push(value);
        if (name === ACTIVITY) activityWrites.push(value);
    });
    const originalGet = context.secrets.get, originalStore = context.secrets.store;
    patch(context.secrets, "get", async (name: string) => {
        if (name === SIGNING) auditKeyReads++;
        const result = await originalGet.call(context.secrets, name);
        if (name === SIGNING && holdKey) { keyEntered = true; await new Promise<void>(done => { releaseKey = done; }); }
        return result;
    });
    patch(context.secrets, "store", async (name: string, value: string) => {
        if (name === SIGNING) auditKeyStores++;
        return originalStore.call(context.secrets, name, value);
    });
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...args: unknown[]) => {
        const document = await Reflect.apply(open, vscode.workspace, args) as vscode.TextDocument;
        const input = args[0] as { content?: unknown } | undefined;
        if (input && typeof input.content === "string" && input.content.includes('"privacyMode": "metadata_only"')) {
            valueFree(document.getText()); reports.push(document.getText());
        }
        return document;
    });
    const createPanel = vscode.window.createWebviewPanel;
    patch(vscode.window, "createWebviewPanel", (...args: unknown[]) => {
        const panel = Reflect.apply(createPanel, vscode.window, args) as vscode.WebviewPanel;
        if (["soteraiEgressFirewall", "soteraiSentinelTimeline"].includes(String(args[0]))) webviews.push(panel);
        return panel;
    });
    const info = vscode.window.showInformationMessage;
    patch(vscode.window, "showInformationMessage", (message: string, ...args: unknown[]) => {
        // No native message UI is fabricated: record only owned fixed metadata,
        // then call the installed VS Code information-message API.
        if (message.startsWith("SoterAI AI Activity") || message.startsWith("AI Activity")) { valueFree(message); notices.push(message); }
        return Reflect.apply(info, vscode.window, [message, ...args]);
    });
    const warning = vscode.window.showWarningMessage;
    patch(vscode.window, "showWarningMessage", (message: string, ...args: unknown[]) => {
        if (message.startsWith("Disable AI Activity Sentinel monitoring?")) {
            valueFree([message, args]); return Promise.resolve(approveDisable ? "Confirm this change" : undefined);
        }
        if (message.startsWith("[SoterAI Sentinel]")) { valueFree(message); notices.push(message); }
        return Reflect.apply(warning, vscode.window, [message, ...args]);
    });
    if (phase === "primary") {
        assert.equal(context.globalState.get(AUDIT), undefined);
        assert.equal(context.globalState.get(ACTIVITY), undefined);
        assert.equal(await originalGet.call(context.secrets, SIGNING), undefined);
        await fs.mkdir(join(root, PRIVATE), { recursive: true });
    }
    // Keep original API only for the explicit synthetic legacy migration seed.
    legacySeed = value => originalUpdate.call(context.globalState, ACTIVITY, value);
}
let legacySeed: (value: unknown) => Thenable<void>;
export async function run(context: vscode.ExtensionContext): Promise<void> {
    const output = process.env.SOTERAI_LITE_F17_EVIDENCE; assert(output);
    const runtime = sha(await fs.readFile(join(context.extensionUri.fsPath, "dist", "extension.js")));
    assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const scopes = phase === "primary" ? PRIMARY : RESTART;
    const rows: Row[] = scopes.map((scope, index) => ({ id: `F27-${phase === "primary" ? "N" : "R"}${String(index + 1).padStart(2, "0")}`, scope, status: "NOT_RUN" }));
    let cursor = 0, driverFailure: string | undefined;
    let n14Stage="NOT_ENTERED",n14BeforeHash:string|undefined,n14AfterHash:string|undefined,n14Persistence:string|undefined,n14Failure:unknown;
    const check = async (work: () => Promise<void>) => {
        const row = rows[cursor++];
        try { await work(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; if(row.id==="F27-N14"){const e=error as {actual?:unknown;expected?:unknown};const safe=(v:unknown)=>typeof v==="string"&&["PENDING","INCOMPLETE","OBSERVED_API_UPDATE","UNVERIFIED"].includes(v)?{kind:"FINITE_STATUS",value:v}:typeof v==="string"?{kind:"STRING_HASH_ONLY",bytes:Buffer.byteLength(v),sha256:sha(v)}:{kind:typeof v};n14Failure={actual:safe(e.actual),expected:safe(e.expected)};} throw error; }
    };
    const auditState = () => context.globalState.get<any>(AUDIT);
    const activityState = () => context.globalState.get<any[]>(ACTIVITY, []);
    const egress = (text = PAYLOAD) => vscode.commands.executeCommand<any>("soterai.checkEgressPayload", { text });
    const activityExport = async () => {
        const count = reports.length; await vscode.commands.executeCommand("soterai.exportAIActivityReport");
        await until(() => reports.length > count, "Actual report document not opened.");
        return JSON.parse(reports.at(-1)!);
    };
    const eventFile = join(root, PRIVATE, ".env");
    const witnessedWrite = async (content: string) => {
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, PRIVATE + "/.env"));
        let finish!: () => void;
        const changed = new Promise<void>(done => { finish = done; });
        const onChange = watcher.onDidChange(finish), onCreate = watcher.onDidCreate(finish);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await fs.writeFile(eventFile, content);
            await Promise.race([changed, new Promise<never>((_done, reject) => { timer = setTimeout(() => reject(Error("Independent native file-event witness unavailable.")), 15000); })]);
        } finally { if (timer) clearTimeout(timer); onChange.dispose(); onCreate.dispose(); watcher.dispose(); }
    };
    const writeFileEvent = async (suffix: string) => {
        const count = activityWrites.length;
        await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=" + suffix + "\n");
        await until(() => activityWrites.length > count, "Actual file watcher did not persist an activity observation.");
    };
    const custody = join(dirname(root), "f27-native-restart-custody.json");
    try {
        if (phase === "primary") {
            await check(async () => {
                const config = vscode.workspace.getConfiguration("soterai");
                assert.equal(config.inspect<boolean>(FLAG)?.defaultValue, false); assert.equal(config.inspect<boolean>(FLAG)?.globalValue, undefined);
                assert.equal(config.get("telemetry.redactedEvents", "off"), "off");
                assert.equal(auditWrites.length, 0); assert.equal(auditKeyReads, 0); assert.equal(auditKeyStores, 0);
            });
            await check(async () => {
                await assert.rejects(Promise.resolve(egress()), (error: Error) => { valueFree(error.message); return error.message === "Owned audit sink is disabled."; });
                assert.equal(auditWrites.length, 0); assert.equal(auditKeyReads, 0); assert.equal(auditKeyStores, 0);
            });
            await check(async () => {
                const config = vscode.workspace.getConfiguration("soterai");
                await assert.rejects(Promise.resolve(config.update(FLAG, true, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
                assert.equal(config.inspect(FLAG)?.workspaceValue, undefined);
            });
            await check(async () => { await flag(true); assert.equal(auditWrites.length, 0); assert.equal(auditKeyStores, 0); });
            await check(async () => {
                const result = await egress("Public documentation example only."); assert.equal(result.decision, "ALLOW");
                assert.equal(auditKeyStores, 1); assert.equal(auditState().entries.length, 1);
                const entry = auditState().entries[0]; assert.equal(entry.eventType, "egress.programmatic"); assert.equal(entry.decision, "ALLOW");
                assert.match(entry.signature, /^[a-f0-9]{64}$/); valueFree(auditState());
            });
            await check(async () => {
                const result = await egress(); assert.notEqual(result.decision, "ALLOW");
                assert.equal(auditState().entries.length, 2); assert.equal(auditState().entries[1].redactedEvidence, ""); valueFree(auditState());
            });
            await check(async () => {
                const before = JSON.stringify(auditState()), count = auditWrites.length; failAudit = true;
                try { await assert.rejects(Promise.resolve(egress()), (error: Error) => { valueFree(error.message); return error.message === "Owned audit operation unavailable."; }); }
                finally { failAudit = false; }
                assert.equal(JSON.stringify(auditState()), before); assert.equal(auditWrites.length, count);
            });
            await check(async () => {
                const before = JSON.stringify(auditState()), count = auditWrites.length; holdKey = true; keyEntered = false;
                const pending = Promise.resolve(egress()).then(() => ({ rejected: false }), error => ({ rejected: true, error }));
                try { await until(() => keyEntered, "Native signing-key await not reached."); await flag(false); await flag(true); }
                finally { holdKey = false; releaseKey?.(); }
                const result = await pending; assert.equal(result.rejected, true); valueFree((result as any).error?.message);
                assert.equal(JSON.stringify(auditState()), before); assert.equal(auditWrites.length, count);
            });
            await check(async () => { const before = auditState().entries.length; await egress("Public after failure."); assert.equal(auditState().entries.length, before + 1); valueFree(auditWrites); });
            await check(async () => {
                const before = webviews.length; await vscode.commands.executeCommand("soterai.showEgressFirewallStatus");
                assert.equal(webviews.length, before + 1); const html = webviews.at(-1)!.webview.html; valueFree(html); assert(html.includes("VERIFIED"));
            });
            await check(async () => {
                await vscode.commands.executeCommand("soterai.enableAISentinel"); assert.equal(context.globalState.get("soterai.sentinel.enabledState"), true);
                await writeFileEvent("first"); assert(activityState().some(event => event.type === "protected_access"));
                valueFree(activityState()); assert(activityState().every(event => event.source === "sentinel" && event.filePath === undefined && event.redactedEvidence === "Observed activity metadata only."));
            });
            await check(async () => { const report = await activityExport(); assert.equal(report.privacyMode, "metadata_only"); assert(report.eventCount > 0); valueFree(report); });
            await check(async () => {
                const before = webviews.length; await vscode.commands.executeCommand("soterai.showAITimeline");
                assert.equal(webviews.length, before + 1); const html = webviews.at(-1)!.webview.html; valueFree(html); assert(html.includes("Observed activity metadata only."));
            });
            await check(async () => {
                const before = JSON.stringify(activityState()), failures = activityFailures; failActivity = true;
                await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=failed-write\n");
                await until(() => activityFailures > failures, "Actual owner did not attempt the scripted native storage rejection.");
                n14Stage="STATE_EQUALITY";n14BeforeHash=sha(before);n14AfterHash=sha(JSON.stringify(activityState()));assert.equal(JSON.stringify(activityState()), before);
                n14Stage="SETTLED_PERSISTENCE_EQUALITY";const report = await settledActivityReport(activityExport);n14Persistence=report.persistence; assert.equal(report.persistence, "INCOMPLETE"); valueFree(report); valueFree(notices);
            });
            await check(async () => {
                await flag(false); failActivity = false; const count = activityWrites.length;
                await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=withdrawn\n");
                // Independent real watcher proves the event occurred after withdrawal.
                const report = await activityExport(); assert.equal(report.eventCount, 0); assert.equal(activityWrites.length, count);
                await assert.rejects(Promise.resolve(egress()), (error: Error) => { valueFree(error.message); return error.message === "Owned audit sink is disabled."; });
            });
            await check(async () => {
                await flag(true); approveDisable = false; await vscode.commands.executeCommand("soterai.disableAISentinel");
                assert.equal(context.globalState.get("soterai.sentinel.enabledState"), true);
                approveDisable = true; await vscode.commands.executeCommand("soterai.disableAISentinel");
                assert.equal(context.globalState.get("soterai.sentinel.enabledState"), false); approveDisable = false;
            });
            await check(async () => {
                valueFree(auditState());
                // Deliberately seed only this fresh synthetic profile's owned legacy record
                // through its real native Memento API; the next real host must migrate it.
                await legacySeed([{ id: PRIVATE, timestamp: Date.now(), type: "protected_access", risk: "high", source: PRIVATE,
                    filePath: PRIVATE, decision: "monitor", redactedEvidence: PRIVATE }]);
                await fs.writeFile(custody, JSON.stringify({ auditSha256: sha(JSON.stringify(auditState())), entries: auditState().entries.length,
                    primaryRuntimeSha256: runtime, seededLegacyEvents: 1, flagOn: true, sentinelPreferenceEnabled: false }) + "\n", { flag: "wx" });
            });
        } else {
            const saved = JSON.parse(await fs.readFile(custody, "utf8"));
            await check(async () => { assert.equal(runtime, saved.primaryRuntimeSha256); assert.equal(sha(JSON.stringify(auditState())), saved.auditSha256); assert.equal(auditKeyStores, 0); assert.equal(auditWrites.length, 0); });
            await check(async () => { assert.equal(activityState().length, 1); valueFree(activityState()); assert.equal(activityState()[0].source, "sentinel"); assert.equal(activityState()[0].filePath, undefined); assert(activityWrites.length >= 1); });
            await check(async () => { const report = await activityExport(); assert.equal(report.eventCount, 1); valueFree(report); });
            await check(async () => { const before = webviews.length; await vscode.commands.executeCommand("soterai.showEgressFirewallStatus"); assert.equal(webviews.length, before + 1); const html = webviews.at(-1)!.webview.html; valueFree(html); assert(html.includes("VERIFIED")); assert.equal(auditKeyStores, 0); });
            await check(async () => {
                await flag(false); assert.equal((await activityExport()).eventCount, 0);
                const before = activityWrites.length;
                await vscode.commands.executeCommand("soterai.clearAIActivityEvents");
                await until(() => activityState().length === 0 && activityWrites.length > before, "Actual owned activity clear API completion not observed.");
                assert.equal(context.globalState.get("soterai.sentinel.enabledState"), false); valueFree(auditState()); valueFree(activityState()); valueFree(notices);
                assert.equal(sha(JSON.stringify(auditState())), saved.auditSha256);
            });
        }
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        holdKey = false; releaseKey?.(); failAudit = false; failActivity = false;
        for (const panel of webviews) try { panel.dispose(); } catch { /* Native API disposal is observational. */ }
        for (const disposable of disposables) disposable.dispose();
        for (const restore of restores.reverse()) restore();
    }
    await fs.writeFile(output, JSON.stringify({ phase, extensionBundleSha256: runtime, observations: rows,
        passed: rows.filter(row => row.status === "PASS").length, failed: rows.filter(row => row.status === "FAIL").length,
        notRun: rows.filter(row => row.status === "NOT_RUN").length, driverFailure, diagnostics: {...setupDiagnostic(),n14Stage,n14BeforeHash,n14AfterHash,n14Persistence,n14Failure},
        independence: "LOW_SCRIPTED_ACTUAL_NATIVE_APIS_NOT_HUMAN", auditExport: "NO_REGISTERED_EXPORT_COMMAND_COMPONENT_COVERAGE_ONLY",
        exclusions: ["Transient JS/native processing memory", "Arbitrary native crash dumps", "Other extensions and unmanaged processes", "Real agent or human independence", "Native broker/MCP runtime controls belong to separate exact-runtime fixtures"],
    }, null, 2) + "\n", { flag: "wx" });
}
