/** F04: exact native API arguments and actual packaged commands in an isolated
 * synthetic developer window. Owner decisions are scripted; independence LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const FLAG = "lite.safeConsent", RULES_KEY = "soterai.aiForbidden.v1";
const MARKER = ".synthetic-lite-f04-host", RECEIPT = ".lite-f04-save-receipt.json";
const PRIVATE = "SYNTHETIC_F04_HOST_PRIVATE_COMMENT_NEVER_RELEASED_20261014";
const URL = "postgresql://synthetic:fake-only@f04-host.invalid/private-database";
const KEY = "sk-proj-" + "SYNTHETIC_F04_HOST_FAKE_CREDENTIAL".repeat(3);
const REGION = "SYNTHETIC_F04_HOST_PROTECTED_REGION_NEVER_RELEASED_20261014";
const SPOOF = "SYNTHETIC_F04_HOST_CALLER_SUPPLIED_DESTINATION";
const PUBLIC = "Useful F04 native public control.\n";
const ORDINARY = `Useful ordinary operation note. API_KEY=${KEY}\n`;
const ENV_TEXT = `# ${PRIVATE}\nDATABASE_URL=${URL}\nAPI_KEY=${KEY}\nPUBLIC_PORT=8080\nMULTI="first\n${PRIVATE}=inside-value\nlast"\n`;
const ENV_SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPUBLIC_PORT=[MASKED]\nMULTI=[MASKED]";
const REGION_TEXT = `Useful before. ${REGION} Useful after.\n`;
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type ReadResult = { status: string; kind?: string; text?: string };
type Observation = { id: string; status: "NOT_RUN" | "PASS" | "FAIL"; scope: string; diagnostic?: string };
type Envelope = { schemaVersion: number; manual: { paths: Array<{ kind: string; pattern: string; sensitive?: boolean }>; regions: unknown[] }; policy?: unknown; reviewAudit?: unknown };
type Modal = { message: string; options: vscode.MessageOptions; actions: unknown[] };

// The bootstrap must pass the context used by actual.activate(context).
export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F04_PHASE, output = process.env.SOTERAI_LITE_F04_EVIDENCE;
    const profile = process.env.SOTERAI_LITE_F04_PROFILE;
    if (!output || !isAbsolute(output)) throw new Error("F04 requires an absolute new evidence output.");
    const scopes = phase === "reload" ? [
        ["F04-H09", "Same native profile/workspace/runtime retains policy metadata and a withdrawn machine flag; saved denies still withhold."],
        ["F04-H10", "After reload, re-enabling consent still requires exact masked approval and never removes the permanent ordinary deny."],
    ] : [
        ["F04-H01", "Cold synthetic policy enrollment reaches exact ordinary-file consent without creating a TextDocument before approval."],
        ["F04-H02", "Native modal detail exactly matches env/sensitive/protected-region output and contains no original sensitive values."],
        ["F04-H03", "Cancel and fabricated command arguments grant nothing and cannot set the destination, output, route or expiry."],
        ["F04-H04", "A real unanswered native modal expires after at least 60 seconds; its late response cannot release text."],
        ["F04-H05", "Explicit revoke resolves a pending read promptly; its late answer cannot grant or disturb a newer busy request."],
        ["F04-H06", "Machine withdrawal clears a real open approved view and withholds reads while restriction commands remain usable."],
        ["F04-H07", "Binary input and safe output above the 16 KiB UTF-8 limit reach no modal; the exact limit remains readable."],
        ["F04-H08", "Actual persistent policy and machine withdrawal are saved with runtime identity for the native restart probe."],
    ];
    const observations: Observation[] = scopes.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
    const commandStatuses: Array<{ command: string; status: unknown }> = [];
    const modalMetadata: Array<{ surface: string; modal: boolean; previewBytes: number; previewDigest: string; outputMatched?: boolean }> = [];
    const messages: string[] = [], patches: Array<{ target: Record<string, unknown>; name: string; original: unknown }> = [];
    let root = "", rootKey = "", runtime = "", bundle = "", driverFailure: string | undefined;
    let config: vscode.WorkspaceConfiguration | undefined, oldFlag: boolean | undefined;
    let documentListener: vscode.Disposable | undefined;
    let documentCalls = 0, ownedDocumentEvents = 0, lastApproved: vscode.TextDocument | undefined, lastRedacted: vscode.TextDocument | undefined;
    let decision: (modal: Modal) => Promise<string | undefined> = async () => "Allow safe read once";
    let modalCount = 0;
    const sanitize = (error: unknown) => {
        let text = error instanceof Error ? `${error.name}: ${error.message}` : "UnknownFailure";
        for (const marker of [PRIVATE, URL, KEY, REGION, SPOOF]) text = text.replaceAll(marker, "[SYNTHETIC-CANARY-OMITTED]");
        return text.slice(0, 12000);
    };
    const noValues = (text: string) => {
        for (const marker of [PRIVATE, URL, KEY, REGION]) assert.ok(!text.includes(marker), "Original sensitive values must remain withheld.");
    };
    const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
    const waitUntil = async (predicate: () => boolean, description: string, timeout = 5000) => {
        const deadline = performance.now() + timeout;
        while (!predicate() && performance.now() < deadline) await wait(20);
        assert.ok(predicate(), description);
    };
    const bounded = async <T>(work: Promise<T>, ms = 3000): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { return await Promise.race([work, new Promise<T>((_done, reject) => {
            timer = setTimeout(() => reject(new Error("Native operation did not resolve within its scoped fixture deadline.")), ms);
        })]); } finally { if (timer) clearTimeout(timer); }
    };
    const patch = (target: object, name: string, value: unknown) => {
        const record = target as Record<string, unknown>;
        patches.push({ target: record, name, original: record[name] }); record[name] = value;
    };
    const check = async (id: string, action: () => Promise<void>) => {
        const row = observations.find(item => item.id === id)!;
        try { await action(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.diagnostic = sanitize(error); }
        console.log(`LITE_SAFE_CONSENT_HOST ${phase} ${id} ${row.status}`);
    };
    try {
        assert.ok(phase === "save" || phase === "reload", "Explicit save/reload phase required.");
        assert.ok(profile && isAbsolute(profile), "Launcher-declared isolated profile required.");
        assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile), "Native process must use its isolated profile.");
        assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
        assert.equal(vscode.workspace.workspaceFolders?.length, 1);
        const folder = vscode.workspace.workspaceFolders![0]; root = folder.uri.fsPath; rootKey = folder.uri.toString();
        assert.equal(folder.uri.scheme, "file"); assert.ok(vscode.workspace.isTrusted);
        assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
        const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard"); assert.ok(extension && extension.isActive);
        bundle = join(extension.extensionPath, "dist", "extension.js"); runtime = sha(await readFile(bundle));
        assert.equal(runtime, process.env.SOTERAI_LITE_F04_BUNDLE_SHA256);
        config = vscode.workspace.getConfiguration("soterai"); oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
        const uri = (relative: string) => vscode.Uri.joinPath(folder.uri, relative);
        const write = async (relative: string, text: string) => {
            await mkdir(dirname(join(root, relative)), { recursive: true }); await writeFile(join(root, relative), text, { flag: "wx" });
        };
        const envelope = (): Envelope => {
            const value = context.workspaceState.get<Record<string, Envelope>>(RULES_KEY, {})[rootKey];
            assert.ok(value, "Actual persistent policy metadata required."); return structuredClone(value);
        };
        const status = async (command: string, expected: string, ...args: unknown[]) => {
            const result = await vscode.commands.executeCommand<{ status?: unknown }>(command, ...args);
            commandStatuses.push({ command, status: result?.status }); assert.deepEqual(result, { status: expected });
        };
        const read = async (relative: string, ...extra: unknown[]): Promise<ReadResult> => {
            const result = await vscode.commands.executeCommand<ReadResult>("soterai.readProjectFileSafely", uri(relative), ...extra);
            commandStatuses.push({ command: "soterai.readProjectFileSafely", status: result?.status }); return result;
        };
        const approve = async (relative: string, surface: "integration-command" | "safe-preview" = "integration-command") => {
            const index = modalMetadata.length;
            const result = surface === "safe-preview"
                ? await vscode.commands.executeCommand<ReadResult>("soterai.reviewSafeFileAccess", uri(relative)) : await read(relative);
            assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(typeof result.text, "string");
            const metadata = modalMetadata[index]; assert.ok(metadata && metadata.modal);
            assert.equal(metadata.previewDigest, sha(result.text!)); assert.equal(metadata.previewBytes, Buffer.byteLength(result.text!, "utf8"));
            assert.equal(metadata.surface, surface); metadata.outputMatched = true; noValues(result.text!); return result;
        };
        const withheld = async (relative: string) => {
            lastRedacted = undefined; await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
            const document = lastRedacted as vscode.TextDocument | undefined;
            assert.ok(document); assert.match(document.getText(), /AI-forbidden content omitted/); noValues(document.getText());
        };
        const pending = async (relative: string) => {
            let finish!: (value: string | undefined) => void;
            const beforeCalls = documentCalls, beforeEvents = ownedDocumentEvents;
            decision = () => new Promise(done => { finish = done; });
            const work = read(relative);
            try { await waitUntil(() => !!finish, "The actual native modal must be reached before release."); }
            catch (error) { await status("soterai.revokeProjectReads", "REVOKED"); finish?.(undefined); await bounded(work); throw error; }
            assert.equal(documentCalls, beforeCalls, "No TextDocument may be opened by the safe reader before approval.");
            assert.equal(ownedDocumentEvents, beforeEvents, "No owned safe TextDocument may appear before approval.");
            return { work, finish, beforeCalls, beforeEvents };
        };
        patch(vscode.window, "showInformationMessage", async (message: string) => { messages.push(message); return undefined; });
        patch(vscode.window, "showErrorMessage", async (message: string) => { messages.push(message); return undefined; });
        patch(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
            const options = items[0] as vscode.MessageOptions;
            if (items.includes("Allow safe read once")) {
                modalCount++; assert.equal(options?.modal, true); assert.equal(typeof options.detail, "string");
                noValues(message); noValues(options.detail!);
                const surface = /Route: ([^.]+)\./.exec(message)?.[1] ?? "UNKNOWN";
                modalMetadata.push({ surface, modal: options.modal === true, previewBytes: Buffer.byteLength(options.detail!, "utf8"), previewDigest: sha(options.detail!) });
                return decision({ message, options, actions: items.slice(1) });
            }
            messages.push(message); return undefined;
        });
        const originalOpen = vscode.workspace.openTextDocument;
        patch(vscode.workspace, "openTextDocument", async (...args: unknown[]) => {
            documentCalls++; return (originalOpen as (...args: unknown[]) => unknown)(...args);
        });
        const originalShow = vscode.window.showTextDocument;
        patch(vscode.window, "showTextDocument", async (document: vscode.TextDocument, ...args: unknown[]) => {
            if (document.uri.scheme === "soterai-approved") lastApproved = document;
            if (document.uri.scheme === "soterai-redacted") lastRedacted = document;
            return (originalShow as (...args: unknown[]) => unknown)(document, ...args);
        });
        documentListener = vscode.workspace.onDidOpenTextDocument(document => {
            if (document.uri.scheme === "soterai-approved" || document.uri.scheme === "untitled") ownedDocumentEvents++;
        });
        if (phase === "save") {
            await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
            await write("ordinary.txt", ORDINARY); await write("public.txt", PUBLIC); await write(".env.host", ENV_TEXT);
            await write("private.pem", PRIVATE + URL); await write("region.txt", REGION_TEXT);
            await write("flag-denied.txt", "Flag-off ordinary restriction control.\n");
            await write("flag-sensitive.txt", PRIVATE);
            await write("binary.txt", "Binary\0" + PRIVATE); await write("large-safe.txt", "界".repeat(5462));
            await write("exact-limit.txt", "A".repeat(16384)); await write(".aiignore", "ordinary.txt\n");
            await check("F04-H01", async () => {
                const prior = context.workspaceState.get<Record<string, Envelope>>(RULES_KEY, {})[rootKey];
                assert.ok(!prior?.manual?.paths?.length && !prior?.manual?.regions?.length, "Cold reset is limited to fresh synthetic defaults before any manual protection.");
                await context.workspaceState.update(RULES_KEY, {});
                const held = await pending("ordinary.txt");
                try { held.finish("Allow safe read once"); const result = await held.work;
                    assert.equal(result.status, "ALLOWED_ONCE"); assert.match(result.text!, /Useful ordinary operation note/); noValues(result.text!);
                    const metadata = modalMetadata.at(-1)!; assert.equal(metadata.previewDigest, sha(result.text!)); metadata.outputMatched = true;
                } finally { held.finish(undefined); decision = async () => "Allow safe read once"; }
                await status("soterai.blockFromAI", "SAVED", uri("ordinary.txt")); await withheld("ordinary.txt");
                assert.ok(envelope().manual.paths.some(rule => rule.pattern === "ordinary.txt"));
            });
            await check("F04-H02", async () => {
                const env = await approve(".env.host"); assert.equal(env.kind, "environment-schema"); assert.equal(env.text, ENV_SAFE);
                const sensitive = await approve("private.pem"); assert.equal(sensitive.kind, "sensitive-summary"); assert.match(sensitive.text!, /MASKED/);
                const regionDocument = await vscode.workspace.openTextDocument(uri("region.txt"));
                const editor = await vscode.window.showTextDocument(regionDocument);
                editor.selection = new vscode.Selection(regionDocument.positionAt(REGION_TEXT.indexOf(REGION)), regionDocument.positionAt(REGION_TEXT.indexOf(REGION) + REGION.length));
                await status("soterai.blockSelectionFromAI", "SAVED");
                const region = await approve("region.txt"); assert.match(region.text!, /Useful before\./); assert.match(region.text!, /Useful after\./);
                assert.match(region.text!, /AI-forbidden content omitted/); await withheld(".env.host");
            });
            await check("F04-H03", async () => {
                const before = modalCount, beforeDocuments = documentCalls;
                decision = async () => undefined;
                const forged = { approved: true, raw: true, recipient: SPOOF, safeText: SPOOF, surface: SPOOF, timeout: 0, expiresAt: Infinity };
                assert.deepEqual(await read("public.txt", forged), { status: "DENIED" });
                assert.equal(modalCount, before + 1); assert.equal(documentCalls, beforeDocuments);
                assert.deepEqual(await vscode.commands.executeCommand("soterai.readProjectFileSafely", { uri: uri("public.txt"), ...forged }), { status: "DENIED" });
                assert.equal(modalCount, before + 1);
                decision = async modal => { assert.ok(!JSON.stringify(modal).includes(SPOOF)); return "Allow safe read once"; };
                const result = await read("public.txt", forged); assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, PUBLIC);
                assert.equal(modalMetadata.at(-1)!.surface, "integration-command"); assert.equal(modalMetadata.at(-1)!.previewDigest, sha(PUBLIC));
                modalMetadata.at(-1)!.outputMatched = true; decision = async () => "Allow safe read once";
            });
            await check("F04-H04", async () => {
                const started = performance.now(), held = await pending("public.txt");
                try {
                    const result = await bounded(held.work, 65000); const elapsedMs = performance.now() - started;
                    assert.deepEqual(result, { status: "EXPIRED" }); assert.ok(elapsedMs >= 60000, "The real fixed deadline must elapse before an unanswered modal expires.");
                    commandStatuses.push({ command: "real-unanswered-modal-deadline", status: { result: result.status, elapsedMs } });
                    held.finish("Allow safe read once"); await wait(100);
                    assert.equal(documentCalls, held.beforeCalls); assert.equal(ownedDocumentEvents, held.beforeEvents);
                    decision = async () => "Allow safe read once"; assert.equal((await approve("public.txt")).text, PUBLIC);
                } finally { held.finish(undefined); await status("soterai.revokeProjectReads", "REVOKED"); decision = async () => "Allow safe read once"; }
            });
            await check("F04-H05", async () => {
                const older = await pending("public.txt"); let newer: Awaited<ReturnType<typeof pending>> | undefined;
                try {
                    await status("soterai.revokeProjectReads", "REVOKED"); assert.deepEqual(await bounded(older.work), { status: "EXPIRED" });
                    newer = await pending("public.txt"); let newerResolved = false; void newer.work.then(() => { newerResolved = true; });
                    older.finish("Allow safe read once"); await wait(100);
                    assert.equal(newerResolved, false); assert.deepEqual(await read("public.txt"), { status: "BUSY" });
                    newer.finish("Allow safe read once"); const result = await bounded(newer.work); assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, PUBLIC);
                    modalMetadata.at(-1)!.outputMatched = modalMetadata.at(-1)!.previewDigest === sha(PUBLIC);
                    assert.equal(documentCalls, newer.beforeCalls); assert.equal(ownedDocumentEvents, newer.beforeEvents);
                } finally { older.finish(undefined); newer?.finish(undefined); await status("soterai.revokeProjectReads", "REVOKED"); decision = async () => "Allow safe read once"; }
            });
            await check("F04-H06", async () => {
                const result = await approve("public.txt", "safe-preview"); assert.ok(lastApproved); const existing = lastApproved;
                assert.equal(existing.getText(), result.text);
                await config!.update(FLAG, false, vscode.ConfigurationTarget.Global);
                assert.deepEqual(await read("public.txt"), { status: "UNAVAILABLE" });
                await waitUntil(() => /AI-forbidden content omitted/.test(existing.getText()), "Flag withdrawal must refresh the actual open approved document.");
                await status("soterai.restrictProjectFile", "SAVED", uri("flag-denied.txt"));
                await status("soterai.restrictSensitiveFile", "SAVED", uri("flag-sensitive.txt"));
                await withheld("ordinary.txt"); await withheld("flag-denied.txt"); await withheld("flag-sensitive.txt");
                await config!.update(FLAG, true, vscode.ConfigurationTarget.Global); await withheld("ordinary.txt");
            });
            await check("F04-H07", async () => {
                const before = modalCount;
                for (const relative of ["binary.txt", "large-safe.txt"]) assert.deepEqual(await read(relative), { status: "UNAVAILABLE" });
                assert.equal(modalCount, before);
                const limit = await approve("exact-limit.txt"); assert.equal(Buffer.byteLength(limit.text!, "utf8"), 16384);
            });
            await check("F04-H08", async () => {
                const stored = envelope(); assert.ok(stored.manual.paths.some(rule => rule.pattern === "ordinary.txt"));
                assert.ok(stored.manual.paths.some(rule => rule.pattern === "flag-sensitive.txt" && rule.sensitive === true));
                noValues(JSON.stringify(stored)); noValues(messages.join("\n"));
                await config!.update(FLAG, false, vscode.ConfigurationTarget.Global);
                assert.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" });
                await write(RECEIPT, JSON.stringify({ schemaVersion: 1, runtime, profile: resolve(profile), workspace: root,
                    safeConsentGlobalValue: config!.inspect<boolean>(FLAG)?.globalValue, policy: stored, reviewAudit: stored.reviewAudit ?? null }));
                assert.equal(config!.inspect<boolean>(FLAG)?.globalValue, false);
            });
        } else {
            await check("F04-H09", async () => {
                const receipt = JSON.parse(await readFile(join(root, RECEIPT), "utf8"));
                assert.equal(receipt.runtime, runtime); assert.equal(receipt.profile, resolve(profile)); assert.equal(receipt.workspace, root);
                assert.equal(config!.inspect<boolean>(FLAG)?.globalValue, receipt.safeConsentGlobalValue); assert.equal(receipt.safeConsentGlobalValue, false);
                assert.deepEqual(envelope(), receipt.policy); assert.deepEqual(envelope().reviewAudit ?? null, receipt.reviewAudit);
                const before = modalCount; assert.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" }); assert.equal(modalCount, before);
                await withheld("ordinary.txt"); await withheld("flag-denied.txt"); await withheld("flag-sensitive.txt"); await withheld(".env.host");
                assert.ok(context.storageUri); const database = await stat(join(dirname(context.storageUri.fsPath), "state.vscdb"));
                assert.ok(database.isFile() && database.size > 0, "Persistent SQLite metadata exists; contents are never read.");
            });
            await check("F04-H10", async () => {
                const stored = envelope(); await config!.update(FLAG, true, vscode.ConfigurationTarget.Global);
                assert.equal((await approve(".env.host")).text, ENV_SAFE);
                const ordinary = await approve("ordinary.txt"); assert.match(ordinary.text!, /Useful ordinary operation note/); noValues(ordinary.text!);
                await withheld("ordinary.txt"); assert.deepEqual(envelope(), stored);
                await config!.update(FLAG, false, vscode.ConfigurationTarget.Global); assert.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" });
            });
        }
    } catch (error) { driverFailure = sanitize(error); }
    finally {
        documentListener?.dispose();
        for (const item of patches.reverse()) item.target[item.name] = item.original;
        if (config && (phase === "reload" || driverFailure || observations.some(row => row.status !== "PASS"))) {
            try { await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); }
            catch (error) { driverFailure = driverFailure ?? sanitize(error); }
        }
    }
    let currentRuntime: string | undefined, hostProbeSha256: string | undefined;
    try { if (bundle) currentRuntime = sha(await readFile(bundle)); }
    catch (error) { driverFailure = driverFailure ?? sanitize(error); }
    try { hostProbeSha256 = sha(await readFile(__filename)); }
    catch (error) { driverFailure = driverFailure ?? sanitize(error); }
    if (currentRuntime && runtime && currentRuntime !== runtime) driverFailure = driverFailure ?? "Packaged runtime changed during this host probe.";
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true, workspace: root,
        declaredProfilePath: profile ? resolve(profile) : undefined, extensionMode: "Development", hostVersion: vscode.version,
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: currentRuntime, hostProbeSha256,
        observations, commandStatuses, modalMetadata, documentCalls, ownedDocumentEvents, driverFailure,
        safeConsentFlagRetainedForRestart: phase === "save" && !driverFailure && observations.every(row => row.status === "PASS"),
        passed: observations.filter(row => row.status === "PASS").length,
        failed: observations.filter(row => row.status === "FAIL").length + (driverFailure ? 1 : 0),
        notRun: observations.filter(row => row.status === "NOT_RUN").length,
        identityScope: "Byte-identical packaged runtime in an isolated persistent developer window with a test-only bootstrap and actual Memento. SQLite stat only; no clean-profile installed-VSIX or authenticated memory claim.",
        consentScope: "Exact native modal API arguments and returned safe-output digest; no rendered modal usability or human owner-presence proof.",
        independence: "LOW", ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE", externalAgents: "NOT_TESTED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F04 native host incomplete or failed; inspect retained observations.");
}
