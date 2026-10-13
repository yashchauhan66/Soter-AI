/** F01: actual loaded-extension commands, isolated synthetic files, scripted editor decisions. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const FLAG = "lite.restrictionSave";
const MARKER = ".synthetic-lite-f01-host";
const RECEIPT = ".lite-f01-save-receipt.json";
const fixtures: Record<string, string> = {
    "direct.txt": "Synthetic F01 direct private material.\n",
    "chosen.txt": "Synthetic F01 chosen private material.\n",
    "public.txt": "Public F01 control remains available.\n",
    "private-folder/child.txt": "Synthetic F01 folder private material.\n",
    "f01-glob/child.txt": "Synthetic F01 glob private material.\n",
    "selected.txt": "Public before.\nSynthetic private region amber violet meadow.\nPublic after.\n",
    "sensitive.txt": "Synthetic F01 sensitive material.\n",
    ".env.f01": "DATABASE_URL=synthetic_fixture_database\nPORT=9999\n",
    "off-ordinary.txt": "Public F01 flag-off ordinary control.\n",
    "off-sensitive.txt": "Public F01 flag-off sensitive control.\n",
    "off-glob/child.txt": "Public F01 flag-off glob control.\n",
    "off-region.txt": "Public F01 flag-off region control.\n",
};
type ResultStatus = "SAVED" | "FAILED" | "CANCELLED" | "UNAVAILABLE";
type Observation = { id: string; status: "PASS" | "FAIL" | "NOT_RUN"; scope: string; diagnostic?: string };
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export async function run(): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F01_PHASE;
    const output = process.env.SOTERAI_LITE_F01_EVIDENCE;
    const profile = process.env.SOTERAI_LITE_F01_PROFILE;
    assert.ok(phase === "save" || phase === "reload", "explicit save/reload phase required");
    assert.ok(output && isAbsolute(output), "new absolute evidence output required");
    assert.ok(profile && isAbsolute(profile), "launcher-declared isolated profile required");
    assert.equal(vscode.workspace.workspaceFolders?.length, 1, "exactly one synthetic workspace required");
    const folder = vscode.workspace.workspaceFolders![0];
    assert.equal(folder.uri.scheme, "file");
    const root = folder.uri.fsPath;
    assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
    assert.ok(vscode.workspace.isTrusted, "trusted isolated synthetic workspace required");
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    assert.ok(extension, "actual SoterAI installation required");
    const bundlePath = join(extension.extensionPath, "dist", "extension.js");
    const activationBundleSha256 = sha(await readFile(bundlePath));
    if (process.env.SOTERAI_LITE_F01_BUNDLE_SHA256) {
        assert.equal(activationBundleSha256, process.env.SOTERAI_LITE_F01_BUNDLE_SHA256);
    }
    await extension.activate();
    assert.ok(extension.isActive);
    assert.equal(sha(await readFile(bundlePath)), activationBundleSha256, "bundle changed during activation");
    const config = vscode.workspace.getConfiguration("soterai");
    const originalFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const api = vscode.window as unknown as Record<string, unknown>;
    const originals = new Map<string, unknown>();
    const messages: string[] = [];
    const commandStatuses: Array<{ command: string; observedStatus: string }> = [];
    let input: string | undefined;
    let cancelPicker = false;
    let pickerCalls = 0;
    let lastPreview: string | undefined;
    const observations: Observation[] = [
        { id: "F01-H01", status: "NOT_RUN", scope: "Save phase: direct and chosen file saves, sensitive save, withheld previews and public control." },
        { id: "F01-H02", status: "NOT_RUN", scope: "Save phase: missing synthetic file reports FAILED without a saved notification." },
        { id: "F01-H03", status: "NOT_RUN", scope: "Save phase: real folder, scripted glob and real selected-region saves report SAVED." },
        { id: "F01-H04", status: "NOT_RUN", scope: "Reload phase: same declared profile/workspace/bundle retains actual restrictions and public control." },
        { id: "F01-H05", status: "NOT_RUN", scope: "Flag-off withdraws new operations, retains prior denies/masking; explicit picker cancellation reports CANCELLED." },
    ];
    const check = async (id: string, action: () => Promise<void>) => {
        const entry = observations.find(item => item.id === id)!;
        try { await action(); entry.status = "PASS"; }
        catch (error) {
            entry.status = "FAIL";
            entry.diagnostic = error instanceof Error ? (error.name + ": " + error.message.split("\n")[0]).slice(0, 180) : "UnknownFailure";
        }
        console.log(`LITE_RESTRICTION_HOST ${phase} ${id} ${entry.status}`);
    };
    const patch = (name: string, value: unknown) => { originals.set(name, api[name]); api[name] = value; };
    const uri = (relative: string) => vscode.Uri.joinPath(folder.uri, relative);
    const status = async (command: string, expected: ResultStatus, target?: vscode.Uri) => {
        const result = await vscode.commands.executeCommand<unknown>(command, ...(target ? [target] : []));
        const value = result && typeof result === "object" && !Array.isArray(result) ? (result as { status?: unknown }).status : undefined;
        commandStatuses.push({ command, observedStatus: typeof value === "string" && ["SAVED", "FAILED", "CANCELLED", "UNAVAILABLE"].includes(value) ? value : "MISSING_OR_INVALID" });
        assert.deepEqual(result, { status: expected }, "command must return only typed save metadata");
    };
    const preview = async (relative: string) => {
        lastPreview = undefined;
        await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
        assert.equal(typeof lastPreview, "string", "registered preview command must show an actual virtual document");
        return lastPreview!;
    };
    const withheld = async (relative: string) => {
        const text = await preview(relative);
        assert.match(text, /AI-forbidden content omitted/);
        assert.ok(!text.includes(fixtures[relative].trim()));
    };
    const select = async (relative: string, text: string) => {
        const doc = await vscode.workspace.openTextDocument(uri(relative));
        const editor = await (originals.get("showTextDocument") as typeof vscode.window.showTextDocument)(doc, { preview: false });
        const start = doc.getText().indexOf(text);
        assert.ok(start >= 0);
        editor.selection = new vscode.Selection(doc.positionAt(start), doc.positionAt(start + text.length));
    };
    const retained = async () => {
        for (const relative of ["direct.txt", "chosen.txt", "private-folder/child.txt", "f01-glob/child.txt"]) await withheld(relative);
        const region = await preview("selected.txt");
        assert.ok(region.includes("Public before.") && region.includes("Public after."));
        assert.ok(!region.includes("Synthetic private region amber violet meadow."));
        assert.match(region, /AI-forbidden content omitted/);
        assert.equal(await preview("public.txt"), fixtures["public.txt"]);
        const sensitive = await vscode.commands.executeCommand<{ status: string; text?: string }>("soterai.readProjectFileSafely", uri("sensitive.txt"));
        assert.equal(sensitive?.status, "ALLOWED_ONCE");
        assert.match(sensitive?.text ?? "", /MASKED/);
        assert.ok(!sensitive?.text?.includes(fixtures["sensitive.txt"].trim()));
        const environment = await vscode.commands.executeCommand<{ status: string; text?: string }>("soterai.readProjectFileSafely", uri(".env.f01"));
        assert.equal(environment?.status, "ALLOWED_ONCE");
        assert.equal(environment?.text, "DATABASE_URL=[MASKED]\nPORT=[MASKED]");
    };
    try {
        patch("showInformationMessage", async (message: string) => { messages.push(message); return undefined; });
        patch("showErrorMessage", async () => undefined);
        patch("showWarningMessage", async (_message: string, ...items: unknown[]) => items.includes("Allow safe read once") ? "Allow safe read once" : undefined);
        patch("showInputBox", async () => input);
        patch("showWorkspaceFolderPick", async () => folder);
        patch("showOpenDialog", async () => { pickerCalls++; return cancelPicker ? undefined : [uri("chosen.txt")]; });
        patch("showTextDocument", async (document: vscode.TextDocument, ...options: unknown[]) => {
            if (document.uri.scheme === "soterai-redacted") lastPreview = document.getText();
            return (originals.get("showTextDocument") as (...args: unknown[]) => unknown)(document, ...options);
        });
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        assert.equal(vscode.workspace.getConfiguration("soterai").get(FLAG), true);
        if (phase === "save") {
            for (const [relative, text] of Object.entries(fixtures)) {
                await mkdir(dirname(join(root, relative)), { recursive: true });
                await writeFile(join(root, relative), text, { flag: "wx" });
            }
            await check("F01-H01", async () => {
                await status("soterai.blockFromAI", "SAVED", uri("direct.txt"));
                await status("soterai.restrictProjectFile", "SAVED", uri("chosen.txt"));
                await status("soterai.restrictSensitiveFile", "SAVED", uri("sensitive.txt"));
                await withheld("direct.txt"); await withheld("chosen.txt");
                assert.equal(await preview("public.txt"), fixtures["public.txt"]);
            });
            await check("F01-H02", async () => {
                const before = messages.length;
                await status("soterai.blockFromAI", "FAILED", uri("missing-synthetic-file.txt"));
                assert.ok(!messages.slice(before).some(message => /\bsaved\b/i.test(message)));
            });
            await check("F01-H03", async () => {
                await status("soterai.blockFromAI", "SAVED", uri("private-folder"));
                input = "f01-glob/**";
                await status("soterai.blockGlobFromAI", "SAVED", uri("public.txt"));
                input = undefined;
                await select("selected.txt", "Synthetic private region amber violet meadow.");
                await status("soterai.blockSelectionFromAI", "SAVED");
                await retained();
            });
        } else {
            await check("F01-H04", async () => {
                const saved = JSON.parse(await readFile(join(root, RECEIPT), "utf8")) as Record<string, unknown>;
                assert.equal(saved.schemaVersion, 1);
                assert.equal(saved.declaredProfilePath, resolve(profile));
                assert.equal(saved.workspace, root);
                assert.equal(saved.extensionBundleSha256, activationBundleSha256);
                for (const [relative, text] of Object.entries(fixtures)) assert.equal(await readFile(join(root, relative), "utf8"), text);
                await retained();
            });
        }
        await check("F01-H05", async () => {
            await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
            assert.equal(vscode.workspace.getConfiguration("soterai").get(FLAG), false);
            await status("soterai.blockFromAI", "UNAVAILABLE", uri("off-ordinary.txt"));
            await status("soterai.restrictProjectFile", "UNAVAILABLE", uri("off-ordinary.txt"));
            await status("soterai.restrictSensitiveFile", "UNAVAILABLE", uri("off-sensitive.txt"));
            input = "off-glob/**";
            await status("soterai.blockGlobFromAI", "UNAVAILABLE", uri("public.txt"));
            input = undefined;
            await select("off-region.txt", fixtures["off-region.txt"].trim());
            await status("soterai.blockSelectionFromAI", "UNAVAILABLE");
            for (const relative of ["off-ordinary.txt", "off-sensitive.txt", "off-glob/child.txt", "off-region.txt"]) assert.equal(await preview(relative), fixtures[relative]);
            await retained();
            await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
            const before = pickerCalls; cancelPicker = true;
            await status("soterai.restrictProjectFile", "CANCELLED");
            assert.ok(pickerCalls > before, "explicit picker cancellation must be exercised");
            cancelPicker = false;
        });
        if (phase === "save" && !observations.some(item => item.status === "FAIL")) {
            await writeFile(join(root, RECEIPT), JSON.stringify({ schemaVersion: 1, declaredProfilePath: resolve(profile),
                workspace: root, extensionBundleSha256: activationBundleSha256 }, null, 2) + "\n", { flag: "wx" });
        }
    } finally {
        for (const [name, value] of originals) api[name] = value;
        await config.update(FLAG, originalFlag, vscode.ConfigurationTarget.Global);
    }
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true,
        workspace: root, declaredProfilePath: resolve(profile), hostVersion: vscode.version, appName: vscode.env.appName,
        extensionPath: extension.extensionPath, extensionVersion: extension.packageJSON.version, extensionActive: extension.isActive,
        extensionBundleSha256: activationBundleSha256, currentInstalledBundleSha256: sha(await readFile(bundlePath)),
        hostProbeSha256: sha(await readFile(__filename)), observations, commandStatuses,
        passed: observations.filter(item => item.status === "PASS").length, failed: observations.filter(item => item.status === "FAIL").length,
        identityScope: "Installed bundle sampled before/after actual activation; no independent authenticated in-memory hash.",
        profileScope: "Launcher-declared isolated profile; compared across launches, launcher must verify actual --user-data-dir.",
        interactionScope: "Actual registered installed-extension commands and document providers; scripted UI decisions, independent human presence untested.",
        externalAgents: "NOT_TESTED", ordinaryTerminal: "NOT_TESTED", fullClaim: "BLOCKED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    assert.equal(result.currentInstalledBundleSha256, activationBundleSha256, "bundle changed during host run");
    if (result.failed) throw new Error("F01 host assertions failed; inspect scoped evidence.");
}
