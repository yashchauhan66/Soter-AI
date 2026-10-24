/** Functional product verification in an isolated real editor, using synthetic fixtures only. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

export async function run(): Promise<void> {
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    assert.ok(extension);
    await extension.activate();
    assert.ok(extension.isActive);
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder && folder.uri.scheme === "file");
    assert.equal(await readFile(join(folder.uri.fsPath, ".synthetic-privacy-host"), "utf8"), "synthetic-only-v1");
    const output = process.env.SOTERAI_PRIVACY_HOST_EVIDENCE;
    assert.ok(output, "explicit isolated evidence output is required");
    const hash = createHash("sha256").update(await readFile(join(extension.extensionPath, "dist/extension.js"))).digest("hex");
    assert.equal(hash, process.env.SOTERAI_PRIVACY_BUNDLE_SHA256, "the frozen launch bundle must match activation");
    if (process.env.SOTERAI_PRIVACY_SHOW === "1") {
        const api = vscode.window as unknown as Record<string, unknown>;
        const create = api.createWebviewPanel;
        let visible: vscode.WebviewPanel | undefined;
        api.createWebviewPanel = (...args: unknown[]) => {
            const panel = (create as (...values: unknown[]) => vscode.WebviewPanel)(...args);
            if (args[0] === "soteraiProjectPrivacy") visible = panel;
            return panel;
        };
        try { await vscode.commands.executeCommand("soterai.openProjectPrivacy"); }
        finally { api.createWebviewPanel = create; }
        for (let i = 0; i < 400 && !visible?.webview.html.includes("Evidence: MATCHED"); i++)
            await new Promise<void>(done => setTimeout(done, 25));
        assert.ok(visible);
        assert.ok(visible.webview.html.includes("Evidence: MATCHED"));
        assert.ok(visible.webview.html.includes(hash));
        assert.ok(visible.webview.html.includes("Full claim: BLOCKED"));
        await writeFile(join(folder.uri.fsPath, "privacy-dashboard-rendered.html"), visible.webview.html);
        await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), status: "UI_READY",
            extensionBundleSha256: hash, evidence: "MATCHED", fullClaim: "BLOCKED",
            scope: "Actual webview in a separate synthetic review editor; not a completed host test." }, null, 2));
        // Keep only this explicitly requested review window available for the owner.
        await new Promise<void>(() => {});
        return;
    }
    const observations: Array<{ id: string; status: "PASS" | "FAIL"; scope: string; diagnostic?: string }> = [];
    const check = async (id: string, scope: string, fn: () => Promise<void>) => {
        try { await fn(); observations.push({ id, status: "PASS", scope }); console.log(`PRIVACY_HOST PASS ${id}`); }
        catch (error) {
            const diagnostic = (error instanceof Error ? error.message : "Functional assertion failed.")
                .replaceAll(fakeValue, "[SYNTHETIC REDACTED]").slice(0, 400);
            observations.push({ id, status: "FAIL", scope, diagnostic }); console.log(`PRIVACY_HOST FAIL ${id}: ${diagnostic}`);
        }
    };
    const fakeValue = "SYNTHETIC_ONLY_HOST_PRIVATE_VALUE_20261012";
    const envUri = vscode.Uri.joinPath(folder.uri, ".env");
    const publicUri = vscode.Uri.joinPath(folder.uri, "public.ts");
    const sensitiveUri = vscode.Uri.joinPath(folder.uri, "private.txt");
    await writeFile(envUri.fsPath, `DATABASE_URL=${fakeValue}\nPORT=3000`);
    await writeFile(publicUri.fsPath, "export const greeting = 'Public test control';\n");
    await writeFile(sensitiveUri.fsPath, fakeValue);
    const windowApi = vscode.window as unknown as Record<string, unknown>;
    const originalWarning = windowApi.showWarningMessage;
    const originalPanel = windowApi.createWebviewPanel;
    let approve = true;
    let privacyPanel: vscode.WebviewPanel | undefined;
    let modalCount = 0;
    windowApi.showWarningMessage = async (...args: unknown[]) => {
        if ((args[1] as { modal?: boolean } | undefined)?.modal) modalCount++;
        return approve ? args.includes("Publish reviewed snapshot") ? "Publish reviewed snapshot" : "Allow safe read once" : undefined;
    };
    windowApi.createWebviewPanel = (...args: unknown[]) => {
        const panel = (originalPanel as (...values: unknown[]) => vscode.WebviewPanel)(...args);
        if (args[0] === "soteraiProjectPrivacy") privacyPanel = panel;
        return panel;
    };
    try {
        await check("H01", "Actual activation and registered privacy/publication commands", async () => {
            const commands = await vscode.commands.getCommands(true);
            for (const id of ["soterai.openProjectPrivacy", "soterai.readProjectFileSafely", "soterai.preparePublicWorkspace", "soterai.previewDevelopmentContract"])
                assert.ok(commands.includes(id));
        });
        await check("H02", "Public saved file through the actual registered reader", async () => {
            const result = await vscode.commands.executeCommand<{ status: string; text: string }>("soterai.readProjectFileSafely", publicUri);
            assert.equal(result?.status, "ALLOWED_ONCE");
            assert.equal(result?.text, "export const greeting = 'Public test control';\n");
        });
        await check("H03", "Names-only dotenv response through actual reader; scripted native review", async () => {
            const result = await vscode.commands.executeCommand<{ status: string; text: string }>("soterai.readProjectFileSafely", envUri);
            assert.equal(result?.status, "ALLOWED_ONCE");
            assert.equal(result?.text, "DATABASE_URL=[MASKED]\nPORT=[MASKED]");
            assert.ok(!JSON.stringify(result).includes(fakeValue));
        });
        await check("H04", "Cancellation releases no response content", async () => {
            approve = false;
            const result = await vscode.commands.executeCommand("soterai.readProjectFileSafely", envUri);
            assert.deepEqual(result, { status: "DENIED" });
            approve = true;
        });
        await check("H05", "Actual sensitive persistence and always-masked approved view", async () => {
            const saved = await vscode.commands.executeCommand<{ status: string }>("soterai.restrictSensitiveFile", sensitiveUri);
            assert.equal(saved?.status, "SAVED");
            const result = await vscode.commands.executeCommand<{ status: string; text: string }>("soterai.readProjectFileSafely", sensitiveUri);
            assert.equal(result?.status, "ALLOWED_ONCE");
            assert.match(result?.text ?? "", /MASKED/);
            assert.ok(!JSON.stringify(result).includes(fakeValue));
        });
        await check("H06", "Actual rollback flag withholds reader and retains parent masking flag", async () => {
            const config = vscode.workspace.getConfiguration("soterai");
            await config.update("projectPrivacy.safeViewComposition", false, vscode.ConfigurationTarget.Global);
            assert.deepEqual(await vscode.commands.executeCommand("soterai.readProjectFileSafely", publicUri), { status: "UNAVAILABLE" });
            assert.equal(config.get("projectPrivacy.enabled", true), true);
            await config.update("projectPrivacy.safeViewComposition", true, vscode.ConfigurationTarget.Global);
        });
        await check("H07", "Actual dashboard webview creation, scoped coverage and metadata-only HTML", async () => {
            await vscode.commands.executeCommand("soterai.openProjectPrivacy");
            for (let i = 0; i < 200 && !privacyPanel?.webview.html.includes("Saved restrictions"); i++)
                await new Promise<void>(done => setTimeout(done, 25));
            assert.ok(privacyPanel);
            const html = privacyPanel.webview.html;
            assert.match(html, /Covers/); assert.match(html, /Does not cover/);
            assert.match(html, /BLOCKED/); assert.match(html, /NOT_TESTED|NOT TESTED/);
            assert.ok(!html.includes(fakeValue));
            assert.match(html, /Verification|verification|Evidence|evidence/);
            await writeFile(join(folder.uri.fsPath, "privacy-dashboard-rendered.html"), html);
        });
        await check("H08", "Actual optional loopback synthetic runtime; start, canned response and stop", async () => {
            await vscode.workspace.getConfiguration("soterai").update("projectPrivacy.syntheticRuntime", true, vscode.ConfigurationTarget.Global);
            const result = await vscode.commands.executeCommand<{ status: string; url: string }>("soterai.startSyntheticPreview");
            assert.equal(result?.status, "STARTED");
            assert.match(result?.url ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);
            const text = await (await fetch(result!.url + "/api/users")).text();
            assert.ok(text.includes("Synthetic Developer")); assert.ok(!text.includes(fakeValue));
            assert.deepEqual(await vscode.commands.executeCommand("soterai.stopSyntheticPreview"), { status: "STOPPED" });
        });
        const originalDialog = windowApi.showOpenDialog;
        const originalPick = windowApi.showQuickPick;
        const outputParent = process.env.SOTERAI_PRIVACY_PUBLIC_PARENT;
        assert.ok(outputParent);
        windowApi.showOpenDialog = async (options: { canSelectFolders?: boolean }) => options.canSelectFolders
            ? [vscode.Uri.file(outputParent)] : [publicUri, envUri];
        windowApi.showQuickPick = async (items: Array<{ label: string }>, options: { canPickMany?: boolean }) => options.canPickMany
            ? items : items.find(item => item.label.includes("Local development")) ?? items[0];
        try {
            await check("H09", "Actual selected public export, approved names and synthetic config", async () => {
                await vscode.workspace.getConfiguration("soterai").update("projectPrivacy.safePublication", true, vscode.ConfigurationTarget.Global);
                const result = await vscode.commands.executeCommand<{ status: string; destination: string }>("soterai.preparePublicWorkspace");
                assert.equal(result?.status, "PREPARED");
                const manifest = JSON.parse(await readFile(join(result!.destination, "soterai-publication-manifest.json"), "utf8"));
                assert.equal(manifest.isolation, "NO ISOLATION");
                assert.ok(!JSON.stringify(manifest).includes(fakeValue));
                const configuration = await readFile(join(result!.destination, ".env.example"), "utf8");
                assert.ok(configuration.includes("DATABASE_URL=")); assert.ok(!configuration.includes(fakeValue));
                assert.equal(await readFile(join(result!.destination, "public.ts"), "utf8"), "export const greeting = 'Public test control';\n");
                assert.equal(await readFile(sensitiveUri.fsPath, "utf8"), fakeValue);
            });
            await check("H10", "Cancelled actual export leaves no new output directory", async () => {
                const before = await readdir(outputParent);
                approve = false;
                try { assert.deepEqual(await vscode.commands.executeCommand("soterai.preparePublicWorkspace"), { status: "CANCELLED" }); }
                finally { approve = true; }
                assert.deepEqual(await readdir(outputParent), before);
            });
        } finally { windowApi.showOpenDialog = originalDialog; windowApi.showQuickPick = originalPick; }
    } finally {
        windowApi.showWarningMessage = originalWarning;
        windowApi.createWebviewPanel = originalPanel;
    }
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), hostVersion: vscode.version,
        extensionVersion: extension.packageJSON.version, extensionBundleSha256: hash, extensionActive: extension.isActive,
        syntheticOnly: true, modalDriver: "scripted responses to real registered command calls; independent presence not tested",
        actualWebviewCreated: Boolean(privacyPanel), modalCount, observations,
        runtimeConfiguration: Object.fromEntries(["projectPrivacy.enabled", "projectPrivacy.atomicSensitivePolicy",
            "projectPrivacy.safeViewComposition", "hardening.addOnlyPolicy"].map(key => [key, vscode.workspace.getConfiguration("soterai").get(key)])),
        workspaceTrusted: vscode.workspace.isTrusted,
        passed: observations.filter(item => item.status === "PASS").length, failed: observations.filter(item => item.status === "FAIL").length,
        clineLive: "NOT_TESTED", osIsolation: "NOT_TESTED", fullClaim: "BLOCKED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ privacyHost: "completed", passed: result.passed, failed: result.failed, fullClaim: "BLOCKED" }));
    if (result.failed) throw new Error("Functional privacy host assertions failed; inspect scoped evidence.");
}
