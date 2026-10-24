/** F13 actual packaged terminal/worker and affected safe-reader/vault task flows.
 * Native API captures delegate to VS Code. Scripted consent is LOW evidence. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { OutputResult } from "../../../../core/src/StreamingOutputRedactor";

const PROFILE_ID = "soterai.gitbash.checked", PROFILE_NAME = "SoterAI Git Bash (checked commands)";
const OWNERSHIP = "soterai.lite.gitBash.ownership.v1", PROFILE_RECEIPT = "soterai.lite.gitBash.profile.v1";
const RAW = "postgresql://native:synthetic-f13-password-Q8@f13-runtime.invalid/synthetic-db";
const OMITTED = "sk-proj-" + "SYNTHETIC_F13_NATIVE_OMITTED_PRIVATE_VALUE".repeat(2);
const BOM = "\ufeffregular-f13-private-directory-label-q83";
const SOURCE = `DATABASE_URL='${RAW}'\nAPI_KEY=${OMITTED}\nBOM_SECRET='${BOM}'\n`, MASK = "[REDACTED_SECRET_OUTPUT]";
const NOTE = "first public\nsecond public\nthird public\n";
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const STAGED_PREFIX = "Staged changes only; unstaged and untracked files are not inspected.\n";
const APP = String.raw`"use strict";
const fs = require("node:fs");
let parsed; try { parsed = new URL(process.env.DATABASE_URL); } catch {}
fs.writeFileSync(".synthetic-f13-app-proof.json", JSON.stringify({
 injected: !!parsed && parsed.protocol === "postgresql:" && parsed.hostname === "f13-runtime.invalid" && parsed.pathname === "/synthetic-db" && parsed.password.length > 12,
 excludedAbsent: process.env.API_KEY === undefined,
 ambientAbsent: process.env.SOTERAI_LITE_F13_AMBIENT === undefined
}), {flag:"wx"});
process.stdout.write(process.env.DATABASE_URL || "missing"); process.stderr.write("public app warning\n");
setTimeout(() => {}, 200);
`;
type Snapshot = { id: string; state: string; pid?: number; exitCode?: number };
type Status = { available: boolean; recovered: Snapshot[]; workers: Snapshot[]; terminals: number };
type CheckedPty = vscode.Pseudoterminal & { run(input: unknown): Promise<OutputResult> };
type TerminalRun = { pty: CheckedPty; terminal?: vscode.Terminal; writes: string[]; closed: boolean };
type TaskRun = { writes: string[]; closed: boolean; ended: boolean; execution?: vscode.TaskExecution };
type Observation = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; diagnostic?: string; subcheck?: string };
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const folder = () => { const value = vscode.workspace.workspaceFolders?.[0]; assert.ok(value); return value; };
const source = () => vscode.Uri.joinPath(folder().uri, ".env.f13");
const note = () => vscode.Uri.joinPath(folder().uri, "note.txt");
const app = () => vscode.Uri.joinPath(folder().uri, "public-f13-app.cjs");
const within = (root: string, file: string) => { const part = relative(resolve(root), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const noValues = (value: unknown) => { const text = typeof value === "string" ? value : JSON.stringify(value); for (const raw of [RAW, OMITTED, BOM, SOURCE]) assert.ok(!text.includes(raw), "Synthetic originals must not enter native output metadata."); };
const restores: (() => void)[] = [], listeners: vscode.Disposable[] = [], terminals: TerminalRun[] = [], tasks: TaskRun[] = [];
let contextOwned: vscode.ExtensionContext | undefined, provider: vscode.TerminalProfileProvider | undefined;
let setup: Record<string, unknown> = { phase: "initial" }, installed = false, leaked = false;
let sourceDocumentCalls = 0, sourceDocumentEvents = 0, diffCount = 0, safeReviews = 0;
let gitSetup: { version: string; finiteInvocations: number; actualCloseObserved: boolean } | undefined;
const nativeSubchecks: Record<string, string> = {};
let nativeLocationIdentity: { exact: boolean; platformEquivalent: boolean } | undefined;
let approveRead = true, approveProfile = true, inputAnswer = "", openQueue: vscode.Uri[][] = [];
let holdRead = false, releaseRead: ((choice: string | undefined) => void) | undefined;
const reviews: { action: string; modal: boolean; detailBytes: number }[] = [];
export function setupDiagnostic(): Record<string, unknown> { return { ...setup }; }
function replace(target: object, name: string, value: unknown): void {
    const own = Object.getOwnPropertyDescriptor(target, name);
    setup = { phase: "replace", name, own: !!own, frozen: Object.isFrozen(target), configurable: own?.configurable };
    Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
    restores.push(() => { if (own) Object.defineProperty(target, name, own); else Reflect.deleteProperty(target, name); });
}
function observe(value: unknown): void { try { noValues(value); } catch { leaked = true; } }
async function until(check: () => boolean | Promise<boolean>, label: string, ms = 10000): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await check()) return; await new Promise<void>(done => setTimeout(done, 20)); }
    throw new Error(label);
}
async function status(): Promise<Status> {
    const value = await vscode.commands.executeCommand<Status>("soterai.checkedGitBashStatus");
    assert.ok(value); noValues(value); assert.ok(Array.isArray(value.recovered) && Array.isArray(value.workers)); return value;
}
function withheld(result: OutputResult): void { assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); noValues(result); }
async function checked(run: TerminalRun, input: string): Promise<OutputResult> {
    const result = await run.pty.run(input); noValues(result); assert.equal(leaked, false); return result;
}
async function open(): Promise<TerminalRun> {
    const before = terminals.length, result = await vscode.commands.executeCommand("soterai.openCheckedGitBash", folder().uri);
    assert.deepEqual(result, { status: "OPENED" }); await until(() => terminals.length > before, "Native checked terminal creation missing."); return terminals[before];
}
async function finishTask(task: TaskRun): Promise<void> { await until(() => task.closed && task.ended, "Native affected task did not complete."); noValues(task.writes); }

/** Trusted fixture preparation only: fresh owned repo, fixed executable, empty
 * config/hooks/template, public exact file. No commits/history, timeout or kill. */
async function prepareGitFixture(): Promise<void> {
    const profile = process.env.SOTERAI_LITE_F13_PROFILE, temp = process.env.TEMP;
    assert.ok(profile && temp && within(profile, temp));
    const job = await mkdtemp(join(temp, "f13-native-git-setup-"));
    const hooks = join(job, "empty-hooks"), config = join(job, "empty.gitconfig");
    await mkdir(hooks); await writeFile(config, "", { flag: "wx" });
    const environment: NodeJS.ProcessEnv = {
        HOME: job, USERPROFILE: job, XDG_CONFIG_HOME: job, TEMP: job, TMP: job,
        GIT_CONFIG_SYSTEM: config, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1",
        GIT_NO_REPLACE_OBJECTS: "1", GIT_ATTR_NOSYSTEM: "1", GIT_PROTOCOL_FROM_USER: "0",
    };
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC"]) {
        const value = process.env[name]; if (value && isAbsolute(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value) && !value.startsWith("\\\\")) environment[name] = value;
    }
    const prefix = ["--no-pager", "--no-lazy-fetch", "--no-replace-objects", "-c", "core.hooksPath=" + hooks,
        "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.allow=never", "-c", "core.autocrlf=false"];
    let invocations = 0;
    const run = async (args: string[]): Promise<string> => await new Promise<string>((done, fail) => {
        const child = spawn(GIT, [...prefix, ...args], { cwd: folder().uri.fsPath, env: environment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout: Buffer[] = []; let size = 0, overflow = false, failed = false, outEnd = false, errEnd = false;
        child.stdout.on("data", (bytes: Buffer) => { size += bytes.length; if (size > 131072) overflow = true; else stdout.push(Buffer.from(bytes)); });
        child.stderr.on("data", (bytes: Buffer) => { size += bytes.length; if (size > 131072) overflow = true; });
        child.stdout.once("end", () => { outEnd = true; }); child.stderr.once("end", () => { errEnd = true; });
        child.on("error", () => { failed = true; }); child.stdout.on("error", () => { failed = true; }); child.stderr.on("error", () => { failed = true; });
        child.once("close", code => { invocations++; if (failed || overflow || !outEnd || !errEnd || code !== 0) fail(new Error("Synthetic Git setup failed after actual close.")); else done(Buffer.concat(stdout).toString("utf8")); });
    });
    const version = (await run(["--version"])).trim(); assert.equal(version, "git version 2.53.0.windows.1");
    await run(["init", "--initial-branch=main", "--object-format=sha1", "--template=" + hooks]);
    await writeFile(join(folder().uri.fsPath, "staged-public.txt"), "staged public line\n", { flag: "wx" });
    await run(["add", "--", "staged-public.txt"]);
    await writeFile(join(folder().uri.fsPath, "staged-public.txt"), "staged public line\nunstaged-content-sentinel-QK8\nsecond unstaged line\n");
    await writeFile(join(folder().uri.fsPath, "untracked-sentinel-QK8.txt"), "untracked public fixture\n", { flag: "wx" });
    gitSetup = { version, finiteInvocations: invocations, actualCloseObserved: true };
}

/** Capture registration and terminal events while delegating actual registration,
 * creation, tasks and command execution to the native VS Code APIs. */
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.equal(installed, false); installed = true; contextOwned = context;
    const profile = process.env.SOTERAI_LITE_F13_PROFILE; assert.ok(profile && isAbsolute(profile));
    assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile)); assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    assert.match(resolve(folder().uri.fsPath), /^D:\\/i); assert.match(resolve(profile), /^D:\\/i);
    assert.equal(readFileSync(join(folder().uri.fsPath, ".synthetic-lite-f13-host"), "utf8"), "synthetic-only-v1");
    assert.ok(within(profile, context.globalStorageUri.fsPath)); assert.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
    const openDocument = vscode.workspace.openTextDocument;
    replace(vscode.workspace, "openTextDocument", (...args: unknown[]) => {
        if (args[0] instanceof vscode.Uri && [source().toString(), note().toString()].includes(args[0].toString())) sourceDocumentCalls++;
        return Reflect.apply(openDocument as (...args: unknown[]) => unknown, vscode.workspace, args);
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if ([source().toString(), note().toString()].includes(document.uri.toString())) sourceDocumentEvents++; }));
    replace(vscode.window, "showOpenDialog", async () => openQueue.shift());
    replace(vscode.window, "showInputBox", async (options?: vscode.InputBoxOptions) => {
        if (options?.title === "Run a checked Git Bash command") { assert.equal(options.password, true); assert.equal(options.ignoreFocusOut, false); }
        return inputAnswer;
    });
    replace(vscode.window, "showQuickPick", async (items: readonly { label: string }[] | Thenable<readonly { label: string }[]>, options?: vscode.QuickPickOptions) => {
        const values = await items; return options?.canPickMany ? values.filter(value => value.label === "DATABASE_URL") : values[0];
    });
    replace(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
        noValues(message); const options = items[0] as vscode.MessageOptions; if (options?.detail) noValues(options.detail);
        const action = items.find(value => ["Migrate securely", "Run selected app", "Allow safe read once", "Create safe copy", "Use checked Git Bash profile", "Restore previous terminal profile"].includes(value as string));
        if (typeof action !== "string") return undefined; assert.equal(options?.modal, true);
        reviews.push({ action, modal: true, detailBytes: Buffer.byteLength(options.detail ?? "", "utf8") });
        if (action === "Allow safe read once") {
            safeReviews++; assert.match(message, /managed-read-terminal|integration-command/);
            if (holdRead) { holdRead = false; return new Promise<string | undefined>(done => { releaseRead = done; }); }
            return approveRead ? action : undefined;
        }
        if (["Use checked Git Bash profile", "Restore previous terminal profile"].includes(action) && !approveProfile) return undefined;
        return action;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message: string) => { noValues(message); return undefined; });
    const execute = vscode.commands.executeCommand;
    replace(vscode.commands, "executeCommand", (...args: unknown[]) => {
        if (args[0] === "vscode.diff") { diffCount++; for (const uri of args.slice(1, 3)) assert.ok(uri instanceof vscode.Uri && uri.scheme.startsWith("soterai-gitbash-profile-")); }
        return Reflect.apply(execute as (...args: unknown[]) => unknown, vscode.commands, args);
    });
    const register = vscode.window.registerTerminalProfileProvider;
    replace(vscode.window, "registerTerminalProfileProvider", (id: string, value: vscode.TerminalProfileProvider) => {
        if (id === PROFILE_ID) { assert.equal(provider, undefined); provider = value; }
        return register.call(vscode.window, id, value);
    });
    const create = vscode.window.createTerminal;
    replace(vscode.window, "createTerminal", (...args: unknown[]) => {
        const options = args[0] as vscode.ExtensionTerminalOptions | undefined;
        let run: TerminalRun | undefined;
        if (options?.name === PROFILE_NAME) {
            assert.ok(options.pty && typeof (options.pty as CheckedPty).run === "function");
            assert.deepEqual(Object.keys(options).sort(), ["name", "pty"]);
            run = { pty: options.pty as CheckedPty, writes: [], closed: false }; terminals.push(run);
            const captured = run;
            listeners.push(captured.pty.onDidWrite(text => { observe(text); captured.writes.push(text); }));
            if (captured.pty.onDidClose) listeners.push(captured.pty.onDidClose(() => { captured.closed = true; }));
        }
        const terminal = Reflect.apply(create as (...args: unknown[]) => vscode.Terminal, vscode.window, args);
        if (run) run.terminal = terminal; return terminal;
    });
    const executeTask = vscode.tasks.executeTask;
    replace(vscode.tasks, "executeTask", async (task: vscode.Task) => {
        if (task.definition.type !== "soterai-vault") return executeTask.call(vscode.tasks, task);
        assert.ok(task.execution instanceof vscode.CustomExecution); noValues(task.definition);
        const execution = task.execution as vscode.CustomExecution & { readonly callback: (definition: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal> };
        const callback = execution.callback; assert.equal(typeof callback, "function");
        const run: TaskRun = { writes: [], closed: false, ended: false };
        task.execution = new vscode.CustomExecution(async definition => {
            const pty = await callback.call(execution, definition); tasks.push(run);
            listeners.push(pty.onDidWrite(text => { observe(text); run.writes.push(text); }));
            if (pty.onDidClose) listeners.push(pty.onDidClose(() => { run.closed = true; })); return pty;
        });
        const result = await executeTask.call(vscode.tasks, task); run.execution = result; return result;
    });
    listeners.push(vscode.tasks.onDidEndTask(event => { const run = tasks.find(value => value.execution === event.execution); if (run) run.ended = true; }));
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const output = process.env.SOTERAI_LITE_F13_EVIDENCE, profile = process.env.SOTERAI_LITE_F13_PROFILE, phase = process.env.SOTERAI_LITE_F13_PHASE;
    if (!output || !isAbsolute(output) || !["primary", "restart"].includes(phase ?? "")) throw new Error("Absolute new F13 result and explicit phase required.");
    const scopes = phase === "primary" ? [
        "Packaged native activation contributes the checked profile, machine flag and five registered commands.",
        "Native private profile diff cancellation changes no setting or receipt.",
        "Native configure persists reviewed project-only profile, preserving unrelated workspace settings.",
        "The captured actual registered profile callback returns ExtensionTerminalOptions used by a real native terminal.",
        "Actual installed finite Git Bash returns reviewed version, Windows location and public directory names through the native PTY and completed registered output filter.",
        "Unsupported whole input and hidden native command arguments are refused without raw echo or caller command execution.",
        "Ordinary file consent denial withholds; fresh native one-time approval returns only the ordinary safe text.",
        "Actual vault migration plus checked file/env routes expose variable names and masks without original TextDocuments.",
        "Actual Bash stdin output containing three registered values and encoded forms is masked before native terminal publication.",
        "Approved head/tail/literal-search and reviewed exclusive copy use the actual safe reader and public results.",
        "Pending native safe-read approval revoked by Ctrl+C remains withheld after the scripted owner eventually approves.",
        "Cancellation of actual finite PS sleep retains live ownership until natural completion and withholds output.",
        "Machine withdrawal during actual finite PS sleep withholds, blocks admission and preserves ciphertext and source.",
        "Actual affected F09 native CustomExecution task still injects only selected fake value and masks completed output.",
        "Native profile restore removes its receipt, preserves unrelated settings and leaves managed safe reads/no-original-doc behavior intact.",
        "Actual pinned Git through the shared checked Git backend reports staged-only unborn-index metadata and excludes unstaged content/untracked filenames.",
    ] : [
        "Restart in the same isolated profile reports prior durable rows UNVERIFIED with no currently owned workers.",
        "Restart retains ciphertext/source bytes and completed profile restoration without original source documents.",
        "A deliberate fresh native terminal command owns a new worker id, distinct from recovered rows, and completes actual Git Bash.",
    ];
    const observations: Observation[] = scopes.map((scope, index) => ({ id: "F13-H" + String(index + (phase === "restart" ? 17 : 1)).padStart(2, "0"), scope, status: "NOT_RUN" }));
    let bundle = "", runtime = "", driverFailure: string | undefined, activeTerminal: TerminalRun | undefined, nativeTerminalsAfterClose: number | undefined;
    const config = vscode.workspace.getConfiguration("soterai"), terminalConfig = vscode.workspace.getConfiguration("terminal.integrated", folder().uri);
    const originalFlag = config.inspect<boolean>("lite.gitBashTerminal")?.globalValue;
    const priorPs = config.inspect<boolean>("lite.ps51Terminal")?.globalValue, priorCmd = config.inspect<boolean>("lite.cmdTerminal")?.globalValue;
    const check = async (index: number, action: () => Promise<void>) => {
        const row = observations[index - 1];
        try { await action(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id; if (nativeSubchecks[row.id]) row.subcheck = nativeSubchecks[row.id]; }
        console.log("LITE_GITBASH_HOST " + row.id + " " + row.status);
    };
    try {
        await config.update("lite.ps51Terminal", false, vscode.ConfigurationTarget.Global); await config.update("lite.cmdTerminal", false, vscode.ConfigurationTarget.Global);
        assert.equal(contextOwned, context); assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
        assert.equal(process.env.SOTERAI_LITE_F13_DRIVER_KIND, "native-bootstrap"); assert.ok(profile && isAbsolute(profile)); assert.ok(vscode.workspace.isTrusted);
        bundle = join(context.extensionUri.fsPath, "dist/extension.js"); runtime = sha(await readFile(bundle)); assert.equal(runtime, process.env.SOTERAI_LITE_F13_BUNDLE_SHA256);
        const ciphertext = join(context.globalStorageUri.fsPath, "soterai-vault.enc"), restartBinding = join(folder().uri.fsPath, ".synthetic-f13-restart-binding.json");
        if (phase === "restart") {
            await check(1, async () => { const current = await status(); assert.equal(current.available, true); assert.ok(current.recovered.length > 0); assert.ok(current.recovered.every(row => row.state === "UNVERIFIED")); assert.deepEqual(current.workers, []); assert.equal(current.terminals, 0); noValues(context.globalState.get(OWNERSHIP)); });
            await check(2, async () => { const binding = JSON.parse(await readFile(restartBinding, "utf8")); assert.equal(sha(await readFile(ciphertext)), binding.ciphertextSha256); assert.equal(sha(await readFile(source().fsPath)), binding.placeholderFileSha256); assert.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, binding.originalProfile ?? undefined); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0); });
            await check(3, async () => { const recovered = (await status()).recovered.map(row => row.id); activeTerminal = await open(); const result = await checked(activeTerminal, "version"); assert.equal(result.status, "COMPLETE"); assert.match(result.stdout.trim(), /^5\.2\.37/); const current = await status(); assert.equal(current.workers.length, 1); assert.ok(!recovered.includes(current.workers[0].id)); assert.equal(current.workers[0].state, "EXITED"); assert.equal(current.terminals, terminals.length); });
        } else {
            await config.update("lite.gitBashTerminal", true, vscode.ConfigurationTarget.Global);
            const prior = terminalConfig.inspect<string | null>("defaultProfile.windows")?.workspaceValue;
            assert.equal(prior, undefined, "Fresh isolated project must have no preexisting profile override.");
            await vscode.workspace.getConfiguration("files", folder().uri).update("trimTrailingWhitespace", true, vscode.ConfigurationTarget.Workspace);
            await writeFile(source().fsPath, SOURCE, { flag: "wx" }); await writeFile(note().fsPath, NOTE, { flag: "wx" }); await writeFile(app().fsPath, APP, { flag: "wx" });
            await check(1, async () => { const names = await vscode.commands.getCommands(true); for (const id of ["configureCheckedGitBash", "openCheckedGitBash", "runCheckedGitBash", "restoreCheckedGitBash", "checkedGitBashStatus"]) assert.ok(names.includes("soterai." + id)); assert.ok(provider); const packageJson = JSON.parse(await readFile(join(context.extensionUri.fsPath, "package.json"), "utf8")); assert.ok(packageJson.contributes.terminal.profiles.some((item: { id: string }) => item.id === PROFILE_ID)); assert.equal(packageJson.contributes.configuration.properties["soterai.lite.gitBashTerminal"].scope, "machine"); assert.equal((await status()).available, true); });
            await check(2, async () => { approveProfile = false; const before = diffCount; const result = await vscode.commands.executeCommand("soterai.configureCheckedGitBash", folder().uri); approveProfile = true; assert.deepEqual(result, { status: "CANCELLED" }); assert.equal(diffCount, before + 1); assert.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, prior); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined); });
            await check(3, async () => { const result = await vscode.commands.executeCommand("soterai.configureCheckedGitBash", folder().uri); assert.deepEqual(result, { status: "SAVED" }); assert.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, PROFILE_NAME); const receipt = context.workspaceState.get<{ phase: string }>(PROFILE_RECEIPT); assert.equal(receipt?.phase, "APPLIED"); assert.equal(vscode.workspace.getConfiguration("files", folder().uri).inspect("trimTrailingWhitespace")?.workspaceValue, true); });
            await check(4, async () => { assert.ok(provider); const token = new vscode.CancellationTokenSource(); try { const profileResult = await provider.provideTerminalProfile(token.token); assert.ok(profileResult instanceof vscode.TerminalProfile); const options = profileResult.options; assert.ok("pty" in options); assert.equal(options.name, PROFILE_NAME); const before = terminals.length; const terminal = vscode.window.createTerminal(options); terminal.show(); await until(() => terminals.length > before && terminals[before].writes.some(text => text.includes("Managed checks")), "Actual provider PTY did not open."); activeTerminal = terminals[before]; assert.equal((await status()).terminals, terminals.length); } finally { token.dispose(); } });
            await check(5, async () => {
                assert.ok(activeTerminal); nativeSubchecks["F13-H05"] = "VERSION"; const version = await checked(activeTerminal, "bash --version"); assert.equal(version.status, "COMPLETE"); assert.match(version.stdout, /^5\.2\.37/);
                nativeSubchecks["F13-H05"] = "LOCATION"; const location = await checked(activeTerminal, "pwd"); assert.equal(location.status, "COMPLETE"); const actual = resolve(location.stdout.trim()), expected = resolve(folder().uri.fsPath); nativeLocationIdentity = { exact: actual === expected, platformEquivalent: actual.toLowerCase() === expected.toLowerCase() }; assert.equal(nativeLocationIdentity.platformEquivalent, true);
                nativeSubchecks["F13-H05"] = "NAMES"; const listing = await checked(activeTerminal, "ls ."); assert.equal(listing.status, "COMPLETE"); assert.ok(listing.stdout.split("\n").includes("note.txt"));
                const current = await status(); assert.ok(current.workers.some(row => row.state === "EXITED" && row.exitCode === 0)); assert.ok(context.globalState.get<Snapshot[]>(OWNERSHIP)?.some(row => row.id === current.workers.at(-1)?.id));
            });
            await check(6, async () => { assert.ok(activeTerminal); const before = (await status()).workers.length; withheld(await checked(activeTerminal, "pwd; cat .env.f13")); assert.equal((await status()).workers.length, before); inputAnswer = "pwd; cat .env.f13"; const terminalCount = terminals.length; const result = await vscode.commands.executeCommand("soterai.runCheckedGitBash", { command: "echo '" + RAW + "'", env: { API_KEY: RAW } }); assert.deepEqual(result, { status: "RUN_REQUESTED" }); await until(() => terminals.length > terminalCount && terminals.at(-1)!.writes.some(text => /withheld/.test(text)), "Native hidden-input whole refusal missing."); assert.equal((await status()).workers.length, before); noValues(terminals.map(item => item.writes)); });
            await check(7, async () => { assert.ok(activeTerminal); const before = safeReviews; approveRead = false; withheld(await checked(activeTerminal, "cat note.txt")); approveRead = true; const result = await checked(activeTerminal, "cat note.txt"); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, NOTE); assert.equal(safeReviews, before + 2); });
            await check(8, async () => { assert.ok(activeTerminal); await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source()); const text = await readFile(source().fsPath, "utf8"); noValues(text); assert.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 3); const result = await checked(activeTerminal, "cat .env.f13"); assert.equal(result.status, "COMPLETE"); assert.ok(result.stdout.includes("DATABASE_URL=[MASKED]") && result.stdout.includes("API_KEY=[MASKED]")); const names = await checked(activeTerminal, "env"); assert.equal(names.status, "COMPLETE"); assert.match(names.stdout, /SystemRoot=\[MASKED\]/); assert.ok(!names.stdout.includes("Windows") && !names.stdout.includes("SOTERAI_LITE_F13_AMBIENT")); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0); });
            await check(9, async () => { assert.ok(activeTerminal); for (const value of [RAW, OMITTED, BOM, Buffer.from(RAW).toString("base64"), Buffer.from(RAW).toString("hex"), encodeURIComponent(RAW), JSON.stringify(RAW)]) { const result = await checked(activeTerminal, "echo '" + value + "'"); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, MASK); } });
            await check(10, async () => { assert.ok(activeTerminal); assert.equal((await checked(activeTerminal, "head -n 1 note.txt")).stdout, "first public\n"); assert.equal((await checked(activeTerminal, "tail -n 1 note.txt")).stdout, "third public\n"); assert.equal((await checked(activeTerminal, "grep second note.txt")).stdout, "second public\n"); assert.equal((await checked(activeTerminal, "rg -F -- second note.txt")).stdout, "second public\n"); for (const input of ["sed -n '1,2p' note.txt", "awk 'NR<=2' note.txt"]) assert.equal((await checked(activeTerminal, input)).stdout, "first public\nsecond public\n"); assert.equal((await checked(activeTerminal, "printenv SystemRoot")).stdout, "SystemRoot=[MASKED]\n"); const result = await checked(activeTerminal, "cp note.txt approved-copy.txt"); assert.equal(result.status, "COMPLETE"); assert.equal(await readFile(join(folder().uri.fsPath, "approved-copy.txt"), "utf8"), NOTE); withheld(await checked(activeTerminal, "cp note.txt approved-copy.txt")); for (const input of ["node -e anything", "python -c anything", "sed -i 'p' note.txt", "awk 'system(1)' note.txt"]) withheld(await checked(activeTerminal, input)); });
            await check(11, async () => { assert.ok(activeTerminal); holdRead = true; const result = activeTerminal.pty.run("cat note.txt"); await until(() => !!releaseRead, "Native safe-read approval did not become pending."); activeTerminal.pty.handleInput!("\x03"); releaseRead!("Allow safe read once"); releaseRead = undefined; withheld(await result); });
            await check(12, async () => { assert.ok(activeTerminal); const count = (await status()).workers.length, run = activeTerminal.pty.run("sleep 2"); await until(async () => (await status()).workers.length > count && (await status()).workers.some(row => row.state === "RUNNING"), "Actual finite PS worker readiness missing."); let done = false; void run.then(() => { done = true; }); activeTerminal.pty.handleInput!("\x03"); assert.equal(done, false); assert.ok((await status()).workers.some(row => ["RUNNING", "CANCEL_PENDING", "STOP_UNCONFIRMED"].includes(row.state))); withheld(await run); assert.ok((await status()).workers.some(row => row.state === "CANCELLED")); });
            await check(13, async () => { assert.ok(activeTerminal); const encrypted = sha(await readFile(ciphertext)), original = sha(await readFile(source().fsPath)), count = (await status()).workers.length; const run = activeTerminal.pty.run("sleep 2"); await until(async () => (await status()).workers.length > count && (await status()).workers.some(row => row.state === "RUNNING"), "Actual withdrawal worker readiness missing."); await config.update("lite.gitBashTerminal", false, vscode.ConfigurationTarget.Global); withheld(await run); assert.equal((await status()).available, false); assert.deepEqual(await vscode.commands.executeCommand("soterai.openCheckedGitBash", folder().uri), { status: "UNAVAILABLE" }); assert.equal(sha(await readFile(ciphertext)), encrypted); assert.equal(sha(await readFile(source().fsPath)), original); await config.update("lite.gitBashTerminal", true, vscode.ConfigurationTarget.Global); });
            await check(14, async () => { openQueue = [[app()], [source()]]; inputAnswer = "[]"; const configured = await vscode.commands.executeCommand<{ id: string; saved: boolean }>("soterai.configureVaultApp"); assert.ok(configured?.saved); const before = tasks.length; const result = await vscode.commands.executeCommand("soterai.runVaultApp", configured.id); assert.deepEqual(result, { descriptorId: configured.id, status: "TASK_REQUESTED" }); await until(() => tasks.length > before, "Native affected F09 task callback missing."); await finishTask(tasks[before]); assert.ok(tasks[before].writes.join("").includes(MASK)); assert.deepEqual(JSON.parse(await readFile(join(folder().uri.fsPath, ".synthetic-f13-app-proof.json"), "utf8")), { injected: true, excludedAbsent: true, ambientAbsent: true }); });
            await check(15, async () => { const result = await vscode.commands.executeCommand("soterai.restoreCheckedGitBash", folder().uri); assert.deepEqual(result, { status: "SAVED" }); assert.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, prior); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined); assert.equal(vscode.workspace.getConfiguration("files", folder().uri).inspect("trimTrailingWhitespace")?.workspaceValue, true); const read = await vscode.commands.executeCommand<{ text?: string }>("soterai.readProjectFileSafely", source()); assert.ok(read?.text?.includes("DATABASE_URL=[MASKED]")); noValues(read); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0); assert.equal(leaked, false); await writeFile(restartBinding, JSON.stringify({ ciphertextSha256: sha(await readFile(ciphertext)), placeholderFileSha256: sha(await readFile(source().fsPath)), originalProfile: prior ?? null }) + "\n", { flag: "wx" }); });
            await check(16, async () => { assert.ok(activeTerminal); await prepareGitFixture(); const metadata = await checked(activeTerminal, "git status"); assert.equal(metadata.status, "COMPLETE"); assert.ok(metadata.stdout.startsWith(STAGED_PREFIX)); assert.ok(metadata.stdout.includes("A\tstaged-public.txt")); const stat = await checked(activeTerminal, "git diff --stat"); assert.equal(stat.status, "COMPLETE"); assert.ok(stat.stdout.startsWith(STAGED_PREFIX)); assert.ok(stat.stdout.includes("staged-public.txt")); assert.match(stat.stdout, /1 file changed, 1 insertion\(\+\)/); for (const value of [metadata, stat]) { assert.ok(!value.stdout.includes("untracked-sentinel-QK8") && !value.stdout.includes("unstaged-content-sentinel-QK8")); } assert.equal((await status()).terminals, terminals.length); });
        }
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        if (releaseRead) { releaseRead(undefined); releaseRead = undefined; }
        approveRead = true; approveProfile = true;
        try { await config.update("lite.gitBashTerminal", originalFlag, vscode.ConfigurationTarget.Global); } catch { driverFailure = "IsolatedFlagRestoreFailure"; }
        try { await config.update("lite.ps51Terminal", priorPs, vscode.ConfigurationTarget.Global); await config.update("lite.cmdTerminal", priorCmd, vscode.ConfigurationTarget.Global); } catch { driverFailure = "IsolatedOtherShellFlagRestoreFailure"; }
        for (const terminal of terminals) terminal.pty.close();
        try { await until(() => terminals.every(terminal => terminal.closed) && tasks.every(task => task.closed), "Owned finite synthetic cleanup incomplete.", 6000); } catch { driverFailure = "OwnedSyntheticLifecycleIncomplete"; }
        try { nativeTerminalsAfterClose = (await status()).terminals; assert.equal(nativeTerminalsAfterClose, 0); } catch { driverFailure = "OwnedTerminalCountNotCleared"; }
        for (const listener of listeners.reverse()) listener.dispose(); for (const restore of restores.reverse()) restore();
    }
    const current = bundle ? sha(await readFile(bundle)) : ""; if (current !== runtime) driverFailure = "RuntimeIdentityChanged";
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true, workspace: folder().uri.fsPath, declaredProfilePath: resolve(profile ?? ""), hostVersion: vscode.version,
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: current, hostProbeSha256: sha(await readFile(__filename)), observations,
        passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length, notRun: observations.filter(row => row.status === "NOT_RUN").length,
        ...(driverFailure ? { driverFailure } : {}), reviews, diffCount, safeReviews, sourceDocumentCalls, sourceDocumentEvents, nativeTerminalsAfterClose, nativeSubchecks, ...(nativeLocationIdentity ? { nativeLocationIdentity } : {}), ...(gitSetup ? { gitSetup } : {}),
        terminalRuns: terminals.map(terminal => ({ closed: terminal.closed, outputBytes: Buffer.byteLength(terminal.writes.join(""), "utf8"), safe: !leaked })),
        taskRuns: tasks.map(task => ({ closed: task.closed, taskEnded: task.ended, outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"), safe: !leaked })),
        independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
        identityScope: "Unchanged packaged runtime, captured actual registered profile callback and real native PTY/Bash/task in two isolated native developer windows sharing one new profile.",
        notTested: ["Native profile picker UX", "Human usability/accessibility", "Clean installed-VSIX lifecycle", "Unmanaged terminals/native reads/uploads", "External agents", "OS confinement"],
    };
    noValues(result); await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || driverFailure) throw new Error("F13 native fixture failed/incomplete; inspect safe observations.");
}
