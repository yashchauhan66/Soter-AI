/** F03: real registered commands/providers in a synthetic native developer window.
 * Scripted owner decisions share the extension API instance: independence LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const FLAG = "lite.policyDrift", RULES_KEY = "soterai.aiForbidden.v1", BASELINE_KEY = "soterai.lite.policyDrift.v1";
const MARKER = ".synthetic-lite-f03-host", RECEIPT = ".lite-f03-save-receipt.json";
const PRIVATE = "SYNTHETIC_F03_HOST_ORDINARY_PRIVATE_NOTE_20261014";
const SENSITIVE = "SYNTHETIC_F03_HOST_ENV_VALUE_NEVER_RELEASED_20261014";
const REGION = "SYNTHETIC_F03_HOST_REGION_ALWAYS_MASKED_20261014";
const SOURCE = "SYNTHETIC_F03_HOST_POLICY_COMMENT_NEVER_AUDIT_20261014";
const PUBLIC = "Useful F03 public control.\n";
const REGION_TEXT = `Useful before. ${REGION} Useful after.\n`;
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type AuditEntry = { id: string; at: number; mode: "ordinary" | "sensitive"; ruleDigest: string; revisionDigest: string; outcome: string };
type Envelope = { schemaVersion: number; manual: { paths: Array<{ kind: string; pattern: string; sensitive?: boolean }>; regions: unknown[] }; policy?: unknown; reviewAudit?: { schemaVersion: number; records: AuditEntry[] } };
type Observation = { id: string; status: "NOT_RUN" | "PASS" | "FAIL"; scope: string; diagnostic?: string };
type ReviewObservation = { command: string; selectedPattern: string; observedStatus: string; elapsedMs: number; inputCalls: number; nativeDiff: boolean; diffDocumentCount: number; finalActions: number };

// The launcher must pass the same context to actual.activate(context) and run(context).
// This inspects only this extension's policy metadata, never SQLite contents.
export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F03_PHASE, output = process.env.SOTERAI_LITE_F03_EVIDENCE;
    const profile = process.env.SOTERAI_LITE_F03_PROFILE;
    assert.ok(phase === "save" || phase === "reload", "explicit save/reload phase required");
    assert.ok(output && isAbsolute(output), "new absolute evidence output required");
    assert.ok(profile && isAbsolute(profile), "launcher-declared isolated profile required");
    assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile), "native process must use the isolated profile");
    assert.equal(context.extensionMode, vscode.ExtensionMode.Development, "normal persistent developer context required");
    assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    const folder = vscode.workspace.workspaceFolders![0], root = folder.uri.fsPath, rootKey = folder.uri.toString();
    assert.equal(folder.uri.scheme, "file");
    assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
    assert.ok(vscode.workspace.isTrusted);
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    assert.ok(extension);
    const bundle = join(extension.extensionPath, "dist", "extension.js"), runtime = sha(await readFile(bundle));
    assert.equal(runtime, process.env.SOTERAI_LITE_F03_BUNDLE_SHA256);
    assert.ok(extension.isActive, "bootstrap must activate the actual packaged runtime before this driver");

    const api = vscode.window as unknown as Record<string, unknown>, originals = new Map<string, unknown>();
    const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const messages: string[] = [], commandStatuses: Array<{ command: string; observedStatus: unknown }> = [];
    const reviews: ReviewObservation[] = [], observations: Observation[] = [];
    const reviewDocuments = new Map<string, string>();
    let selectedPattern = "ordinary.txt", cancelFolder = false, typed: "exact" | "wrong" | "cancel" = "exact";
    let inputCalls = 0, finalActions = 0, nativeDiff = false;
    let lastPreview: string | undefined, lastPreviewDocument: vscode.TextDocument | undefined;
    const uri = (relative: string) => vscode.Uri.joinPath(folder.uri, relative);
    const patch = (name: string, value: unknown) => { originals.set(name, api[name]); api[name] = value; };
    const write = async (relative: string, text: string) => {
        await mkdir(dirname(join(root, relative)), { recursive: true });
        await writeFile(join(root, relative), text, { flag: "wx" });
    };
    const envelope = () => {
        const value = context.workspaceState.get<Record<string, Envelope>>(RULES_KEY, {})[rootKey];
        assert.ok(value, "actual persistent root policy metadata required");
        return structuredClone(value);
    };
    const permanent = () => { const value = envelope(); return { manual: value.manual, policy: value.policy }; };
    const records = () => envelope().reviewAudit?.records ?? [];
    const noValues = (text: string) => {
        for (const marker of [PRIVATE, SENSITIVE, REGION, SOURCE]) assert.ok(!text.includes(marker), "source values must stay outside metadata/alerts");
    };
    const assertAudit = () => {
        const value = envelope();
        assert.equal(value.schemaVersion, 3); assert.equal(value.reviewAudit?.schemaVersion, 1);
        assert.ok(records().length > 0 && records().length <= 64);
        assert.ok(Buffer.byteLength(JSON.stringify(value.reviewAudit), "utf8") <= 32768);
        assert.ok(Buffer.byteLength(JSON.stringify(value), "utf8") <= 128 * 1024);
        for (const record of records()) {
            assert.match(record.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            assert.equal(record.outcome, "REVIEWED_SESSION");
            assert.match(record.ruleDigest, /^[0-9a-f]{64}$/); assert.match(record.revisionDigest, /^[0-9a-f]{64}$/);
        }
        noValues(JSON.stringify(value)); noValues(JSON.stringify(context.workspaceState.get(BASELINE_KEY)));
        noValues(messages.join("\n"));
    };
    const check = async (id: string, scope: string, action: () => Promise<void>) => {
        const row: Observation = { id, status: "NOT_RUN", scope }; observations.push(row);
        try { await action(); row.status = "PASS"; }
        catch (error) {
            row.status = "FAIL";
            let diagnostic = error instanceof Error ? error.name + ": " + error.message : "UnknownFailure";
            for (const marker of [PRIVATE, SENSITIVE, REGION, SOURCE]) diagnostic = diagnostic.replaceAll(marker, "[SYNTHETIC-CANARY-OMITTED]");
            row.diagnostic = diagnostic.slice(0, 12000);
        }
        console.log(`LITE_OWNER_REVIEW_HOST ${phase} ${id} ${row.status}`);
    };
    const status = async (command: string, expected: string, ...args: unknown[]) => {
        const result = await vscode.commands.executeCommand<{ status?: unknown }>(command, ...args);
        commandStatuses.push({ command, observedStatus: result?.status });
        assert.deepEqual(result, { status: expected });
    };
    const preview = async (relative: string) => {
        lastPreview = undefined;
        await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
        assert.equal(typeof lastPreview, "string");
        return lastPreview!;
    };
    const withheld = async (relative: string) => {
        const text = await preview(relative); assert.match(text, /AI-forbidden content omitted/); noValues(text);
    };
    const readEnvSafely = async () => {
        const result = await vscode.commands.executeCommand<{ status: string; text?: string }>("soterai.readProjectFileSafely", uri(".env.owner"));
        commandStatuses.push({ command: "soterai.readProjectFileSafely", observedStatus: result?.status });
        assert.equal(result.status, "ALLOWED_ONCE");
        assert.equal(result.text, "DATABASE_URL=[MASKED]\nPUBLIC_PORT=[MASKED]"); noValues(result.text);
    };
    const review = async (command: string, pattern: string, expected = "RELAXED_SESSION") => {
        selectedPattern = pattern; inputCalls = 0; finalActions = 0; nativeDiff = false; reviewDocuments.clear();
        const started = Date.now();
        await status(command, expected);
        const row: ReviewObservation = { command, selectedPattern: pattern, observedStatus: expected,
            elapsedMs: Date.now() - started, inputCalls, nativeDiff, diffDocumentCount: reviewDocuments.size, finalActions };
        reviews.push(row);
        if (expected === "RELAXED_SESSION") {
            assert.ok(row.elapsedMs >= 10000, "the actual runtime must enforce its real ten-second cooldown");
            assert.equal(row.inputCalls, 1); assert.equal(row.finalActions, 1); assert.ok(row.nativeDiff);
            assert.equal(row.diffDocumentCount, 2);
            const views = [...reviewDocuments.values()].map(text => { noValues(text); return JSON.parse(text); });
            assert.deepEqual(views[0].permanent, views[1].permanent);
            const after = views.find(value => value.session.reviewedSelector);
            assert.equal(after.session.reviewedSelector.pattern, pattern);
            assert.equal(after.session.lifetime, "this editor session");
            assert.equal(after.session.sensitiveTreatment, "retained");
            assert.equal(after.session.protectedRegions, "retained");
        }
    };
    const opened = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.uri.scheme === "soterai-owner-review") reviewDocuments.set(document.uri.toString(), document.getText());
    });
    try {
        patch("showInformationMessage", async (message: string) => { messages.push(message); return undefined; });
        patch("showErrorMessage", async (message: string) => { messages.push(message); return undefined; });
        patch("showWorkspaceFolderPick", async () => cancelFolder ? undefined : folder);
        patch("showQuickPick", async (items: Array<{ label: string }>) => items.find(item => item.label === `file: ${selectedPattern}`));
        patch("showInputBox", async (options: vscode.InputBoxOptions) => {
            inputCalls++; assert.match(options.prompt ?? "", /^Type exactly: RELAX SESSION [0-9a-f]{8}$/);
            if (typed === "cancel") return undefined;
            return typed === "wrong" ? "SYNTHETIC_WRONG_OWNER_CONFIRMATION" : options.prompt!.replace(/^Type exactly: /, "");
        });
        patch("showWarningMessage", async (message: string, ...items: unknown[]) => {
            messages.push(message);
            if (items.includes("Allow safe read once")) return "Allow safe read once";
            if (items.includes("Review session relaxation")) {
                for (let attempt = 0; attempt < 40; attempt++) {
                    nativeDiff = vscode.window.tabGroups.all.some(group => group.tabs.some(tab => {
                        const input = tab.input;
                        return input instanceof vscode.TabInputTextDiff && reviewDocuments.has(input.original.toString()) && reviewDocuments.has(input.modified.toString());
                    }));
                    if (nativeDiff) break;
                    await new Promise(done => setTimeout(done, 25));
                }
                return "Review session relaxation";
            }
            if (items.includes("Relax for this editor session")) { finalActions++; return "Relax for this editor session"; }
            return undefined;
        });
        patch("showTextDocument", async (document: vscode.TextDocument, ...args: unknown[]) => {
            if (document.uri.scheme === "soterai-redacted") { lastPreview = document.getText(); lastPreviewDocument = document; }
            return (originals.get("showTextDocument") as (...values: unknown[]) => unknown)(document, ...args);
        });
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        if (phase === "save") {
            for (const relative of ["ordinary.txt", "other-denied.txt"]) await write(relative, PRIVATE);
            await write("public.txt", PUBLIC); await write("region.txt", REGION_TEXT);
            await write(".env.owner", `# ${SENSITIVE}\nDATABASE_URL=${SENSITIVE}\nPUBLIC_PORT=8080\n`);
            for (const relative of ["ordinary.txt", "other-denied.txt"]) await status("soterai.blockFromAI", "SAVED", uri(relative));
            await status("soterai.restrictSensitiveFile", "SAVED", uri(".env.owner"));
            const regionDocument = await vscode.workspace.openTextDocument(uri("region.txt"));
            const editor = await vscode.window.showTextDocument(regionDocument);
            editor.selection = new vscode.Selection(regionDocument.positionAt(REGION_TEXT.indexOf(REGION)), regionDocument.positionAt(REGION_TEXT.indexOf(REGION) + REGION.length));
            await status("soterai.blockSelectionFromAI", "SAVED");
            // Capture permanence after the actual managed read has enrolled F02
            // defaults; pre-enrollment storage may still be the legacy envelope.
            assert.equal(await preview("public.txt"), PUBLIC);
            assert.equal(envelope().schemaVersion, 2);
            assert.ok(envelope().manual && envelope().policy);
            const accepted = permanent();
            await check("F03-H01", "Actual owner commands ignore supplied grants; picker cancel and wrong exact typing preserve denies/audit.", async () => {
                const registered = await vscode.commands.getCommands(true);
                assert.ok(registered.includes("soterai.manageAIRules") && registered.includes("soterai.reviewSensitiveAIRules"));
                cancelFolder = true;
                await status("soterai.manageAIRules", "CANCELLED", { root: rootKey, approved: true, challenge: "forged" });
                cancelFolder = false; typed = "wrong";
                await review("soterai.manageAIRules", "ordinary.txt", "FAILED"); typed = "exact";
                assert.equal(records().length, 0); assert.deepEqual(permanent(), accepted); await withheld("ordinary.txt");
            });
            await check("F03-H02", "Native metadata diff, exact typing and real cooldown produce an atomic v3 ordinary review audit.", async () => {
                await review("soterai.manageAIRules", "ordinary.txt");
                assert.deepEqual(permanent(), accepted); assert.equal(records().length, 1); assert.equal(records()[0].mode, "ordinary"); assertAudit();
            });
            await check("F03-H03", "Only the reviewed ordinary selector opens; other deny, credential default and protected region remain; public control opens.", async () => {
                assert.equal(await preview("ordinary.txt"), PRIVATE);
                await withheld("other-denied.txt"); await withheld(".env.owner");
                const region = await preview("region.txt");
                assert.ok(region.includes("Useful before.") && region.includes("Useful after.")); assert.match(region, /AI-forbidden content omitted/); noValues(region);
                assert.equal(await preview("public.txt"), PUBLIC); assert.deepEqual(permanent(), accepted);
            });
            await check("F03-H04", "Machine flag withdrawal ends current session access, refreshes an open view and cannot resurrect access on re-enable.", async () => {
                assert.equal(await preview("ordinary.txt"), PRIVATE); const existing = lastPreviewDocument!;
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
                await status("soterai.manageAIRules", "UNAVAILABLE"); await status("soterai.reviewSensitiveAIRules", "UNAVAILABLE");
                await withheld("ordinary.txt");
                for (let attempt = 0; attempt < 40 && existing.getText().includes(PRIVATE); attempt++) await new Promise(done => setTimeout(done, 50));
                assert.ok(!existing.getText().includes(PRIVATE)); assert.match(existing.getText(), /AI-forbidden content omitted/);
                await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                await withheld("ordinary.txt"); assert.deepEqual(permanent(), accepted); assertAudit();
            });
            await check("F03-H05", "Separate sensitive owner review retains stored sensitivity, default omission and exact value-masked env safe read.", async () => {
                await review("soterai.reviewSensitiveAIRules", ".env.owner");
                assert.deepEqual(permanent(), accepted); assert.equal(records().at(-1)?.mode, "sensitive");
                await withheld(".env.owner"); await readEnvSafely(); assertAudit();
            });
            await check("F03-H06", "Rejected actual-context audit persistence yields FAILED and no grant, saved notification or policy change.", async () => {
                const before = envelope(), messageCount = messages.length;
                const memento = context.workspaceState as unknown as Record<string, unknown>, original = memento.update;
                memento.update = async (key: string, value: unknown) => {
                    if (key === RULES_KEY) throw new Error("SYNTHETIC_F03_HOST_STORAGE_FAILURE");
                    return (original as (key: string, value: unknown) => Promise<void>).call(context.workspaceState, key, value);
                };
                try { await review("soterai.manageAIRules", "ordinary.txt", "FAILED"); }
                finally { memento.update = original; }
                assert.deepEqual(envelope(), before); assert.ok(!messages.slice(messageCount).some(message => /Session review saved/.test(message)));
                await withheld("ordinary.txt"); assertAudit();
            });
            await check("F03-H07", "Real source watcher/read drift restores a reviewed deny without copying source values into alerts or baseline.", async () => {
                await review("soterai.manageAIRules", "ordinary.txt"); assert.equal(await preview("ordinary.txt"), PRIVATE);
                await write(".aiignore", `# ${SOURCE}\n`);
                await withheld("ordinary.txt");
                for (let attempt = 0; attempt < 60 && !messages.some(message => /protection drift/.test(message)); attempt++) await new Promise(done => setTimeout(done, 50));
                assert.ok(messages.some(message => /protection drift/.test(message))); assert.deepEqual(permanent(), accepted); assertAudit();
            });
            await check("F03-H08", "Save phase leaves one reviewed ordinary grant active while permanent v3 rules/audit remain persisted for restart.", async () => {
                await review("soterai.manageAIRules", "ordinary.txt"); assert.equal(await preview("ordinary.txt"), PRIVATE);
                assert.deepEqual(permanent(), accepted); assertAudit();
                await write(RECEIPT, JSON.stringify({ runtime, profile: resolve(profile), workspace: root, permanent: accepted, audit: envelope().reviewAudit }));
            });
        } else {
            await check("F03-H09", "Native restart in the same profile/workspace/runtime keeps actual audit metadata and restores all permanent denies.", async () => {
                const receipt = JSON.parse(await readFile(join(root, RECEIPT), "utf8"));
                assert.equal(receipt.runtime, runtime); assert.equal(receipt.profile, resolve(profile)); assert.equal(receipt.workspace, root);
                assert.deepEqual(permanent(), receipt.permanent); assert.deepEqual(envelope().reviewAudit, receipt.audit); assertAudit();
                await withheld("ordinary.txt"); await withheld("other-denied.txt"); await withheld(".env.owner"); await readEnvSafely();
                assert.equal(await preview("public.txt"), PUBLIC);
                assert.ok(context.storageUri, "actual persistent workspace storage directory required");
                const database = await stat(join(dirname(context.storageUri.fsPath), "state.vscdb"));
                assert.ok(database.isFile() && database.size > 0, "persistent SQLite metadata must exist; contents are never read");
            });
            await check("F03-H10", "After restart machine withdrawal blocks new reviews, retains v3 audit/permanent denies and retains env masking.", async () => {
                const before = envelope();
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
                await status("soterai.manageAIRules", "UNAVAILABLE"); await status("soterai.reviewSensitiveAIRules", "UNAVAILABLE");
                await withheld("ordinary.txt"); await withheld(".env.owner"); await readEnvSafely(); assert.deepEqual(envelope(), before);
                await config.update(FLAG, true, vscode.ConfigurationTarget.Global); await withheld("ordinary.txt"); assertAudit();
            });
        }
    } finally {
        opened.dispose();
        for (const [name, value] of originals) api[name] = value;
        // Keep the successful save-phase flag on until the isolated window exits:
        // withdrawing it here would revoke the grant before the restart probe.
        if (phase === "reload" || observations.some(row => row.status === "FAIL")) {
            await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
        }
    }
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true,
        workspace: root, declaredProfilePath: resolve(profile), extensionMode: "Development", hostVersion: vscode.version,
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: sha(await readFile(bundle)), hostProbeSha256: sha(await readFile(__filename)),
        observations, commandStatuses, reviews, auditRecordCount: records().length,
        policyDriftFlagRetainedForRestart: phase === "save" && !observations.some(row => row.status === "FAIL"),
        passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length,
        identityScope: "Byte-identical packaged runtime in a normal isolated developer window with a test-only bootstrap and persistent Memento. SQLite metadata only; no clean-profile installed-VSIX or authenticated memory claim.",
        independence: "LOW", ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE", externalAgents: "NOT_TESTED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    assert.equal(result.currentDeveloperBundleSha256, runtime);
    if (result.failed) throw new Error("F03 native host assertions failed; inspect observations.");
}
