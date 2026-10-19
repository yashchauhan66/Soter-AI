/** Live host negative controls. Passing harness assertions can confirm a leak. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { observeReviewCanary, writeReviewEvidence } from "../../security/ReviewEvidence";

const execute = promisify(execFile);

export async function run(): Promise<void> {
    const root = await fs.realpath(process.env.SOTERAI_REVIEW_WORKSPACE!);
    assert.equal(await fs.readFile(path.join(root, ".synthetic-review-lab"), "utf8"), "synthetic-only-v1");
    assert.equal(vscode.workspace.workspaceFolders?.[0].uri.fsPath.toLowerCase(), root.toLowerCase());
    const evidence = process.env.SOTERAI_REVIEW_EVIDENCE!;
    assert.equal(process.env.SOTERAI_REVIEW_UNIQUE_EVIDENCE, "1", "unique evidence recording is required");
    assert.ok(path.isAbsolute(evidence), "per-run evidence path is required");
    const results: Array<{ attack: string; status: string; boundary: string; canarySha256?: string }> = [];
    const canary = () => "amber ridge " + randomBytes(8).toString("hex").match(/.{4}/g)!.join(" ");
    const report = (attack: string, leaked: boolean, boundary: string, value?: string) => results.push({ attack,
        status: leaked ? "LEAK_CONFIRMED" : "BLOCKED_SCOPED", boundary,
        canarySha256: value ? createHash("sha256").update(value).digest("hex") : undefined });
    const values = new Map([[".env", canary()], ["nested/private.txt", canary()], ["private.pem", canary()], ["selected.txt", canary()]]);
    await fs.mkdir(path.join(root, "nested"));
    for (const [relative, value] of values) await fs.writeFile(path.join(root, relative), relative === "private.pem"
        ? "-----BEGIN PRIVATE KEY-----\n" + value + "\n-----END PRIVATE KEY-----\n" : value);
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    assert.ok(extension, "development extension is missing");
    await extension.activate();
    assert.ok(extension.isActive);
    await writeReviewEvidence(evidence + ".activation.json", {
        runId: process.env.SOTERAI_REVIEW_RUN_ID, observedAt: new Date().toISOString(),
        exactOsBuild: process.env.SOTERAI_REVIEW_OS_BUILD, host: vscode.version,
        extension: extension.packageJSON.version, extensionActive: extension.isActive,
        extensionBundleSha256: createHash("sha256").update(await fs.readFile(path.join(extension.extensionPath, "dist", "extension.js"))).digest("hex"),
        hostProbeSha256: createHash("sha256").update(await fs.readFile(__filename)).digest("hex"),
        status: "ACTIVATED_NOT_GRADED", syntheticOnly: true,
    });
    await vscode.commands.executeCommand("soterai.enableProtectedWorkspace");
    const preview = async (relative: string) => {
        await vscode.commands.executeCommand("soterai.openRedactedPreview", vscode.Uri.file(path.join(root, relative)));
        assert.equal(vscode.window.activeTextEditor?.document.uri.scheme, "soterai-redacted");
        return vscode.window.activeTextEditor!.document.getText();
    };
    for (const relative of [".env", "nested", "private.pem"]) {
        await vscode.commands.executeCommand("soterai.blockFromAI", vscode.Uri.file(path.join(root, relative)));
    }
    const selection = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "selected.txt")));
    const editor = await vscode.window.showTextDocument(selection);
    editor.selection = new vscode.Selection(selection.positionAt(0), selection.positionAt(selection.getText().length));
    await vscode.commands.executeCommand("soterai.blockSelectionFromAI");
    for (const [relative, value] of values) {
        const redacted = await preview(relative);
        assert.ok(!redacted.includes(value), relative + " leaked through redacted preview");
        report(relative + " redacted preview", false, "actual SoterAI preview", value);
        assert.ok((await fs.readFile(path.join(root, relative), "utf8")).includes(value));
        report(relative + " direct filesystem read", true, "Node fs in actual extension host", value);
    }
    const raw = values.get(".env")!;
    await fs.link(path.join(root, ".env"), path.join(root, "hardlink.txt"));
    assert.ok((await fs.readFile(path.join(root, "hardlink.txt"), "utf8")).includes(raw));
    report("hardlink direct read", true, "unmanaged filesystem alias", raw);
    assert.ok(!(await preview("hardlink.txt")).includes(raw));
    report("hardlink redacted preview", false, "SoterAI path validation", raw);
    await fs.symlink(path.join(root, "nested"), path.join(root, "junction"), process.platform === "win32" ? "junction" : "dir");
    const nested = values.get("nested/private.txt")!;
    assert.ok((await fs.readFile(path.join(root, "junction/private.txt"), "utf8")).includes(nested));
    report("junction direct read", true, "unmanaged filesystem alias", nested);
    assert.ok(!(await preview("junction/private.txt")).includes(nested));
    report("junction redacted preview", false, "SoterAI path validation", nested);
    // Keep this unmarked prose below token/entropy thresholds: this is a
    // policy-integrity negative control, not a credential-detector test.
    const custom = "note " + randomBytes(4).toString("hex");
    await fs.writeFile(path.join(root, "custom.txt"), custom);
    assert.ok((await preview("custom.txt")).includes(custom), "negative control was unexpectedly withheld");
    await fs.writeFile(path.join(root, ".aiignore"), "custom.txt\n");
    assert.ok(!(await preview("custom.txt")).includes(custom));
    report("repository deny rule", false, "SoterAI preview", custom);
    await fs.writeFile(path.join(root, ".aiignore"), "");
    // The old harness expected removal to expose custom. Accepted-deny controls
    // now prove retention; record the actual result rather than require a leak.
    const retainedDeny = !observeReviewCanary(await preview("custom.txt"), custom);
    report("agent edits repository deny policy", !retainedDeny, "writable .aiignore; retained accepted deny", custom);
    const envResult = await execute(process.execPath, ["-e", "process.stdout.write(process.env.SOTERAI_SYNTHETIC_CANARY)"], {
        env: { SystemRoot: process.env.SystemRoot, ELECTRON_RUN_AS_NODE: "1", SOTERAI_SYNTHETIC_CANARY: raw }, windowsHide: true, timeout: 10_000,
    });
    assert.equal(envResult.stdout, raw);
    report("runtime environment and command output", true, "synthetic injected child environment; not the broker child", raw);
    const git = process.env.SOTERAI_REVIEW_GIT;
    if (git) {
        const hooks = path.join(root, "empty-hooks");
        await fs.mkdir(hooks);
        const gitRun = (args: string[]) => execute(git, ["-c", "core.hooksPath=" + hooks, "-c", "core.fsmonitor=false", "-c", "commit.gpgSign=false",
            "-c", "user.name=Synthetic Fixture", "-c", "user.email=fixture@example.invalid", ...args], {
            cwd: root, env: { SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_TERMINAL_PROMPT: "0" },
            windowsHide: true, timeout: 15_000,
        });
        await gitRun(["init", "--quiet", "--template=" + hooks]);
        await fs.writeFile(path.join(root, "history.txt"), custom);
        await gitRun(["add", "--", "history.txt"]);
        await gitRun(["commit", "--quiet", "-m", "Synthetic canary only"]);
        await fs.writeFile(path.join(root, "history.txt"), "Public replacement.");
        const old = await gitRun(["show", "HEAD:history.txt"]);
        assert.equal(old.stdout, custom);
        report("Git object after working-tree replacement", true, "unmanaged git show", custom);
    }
    let capture = "";
    const receiver = createServer((req, res) => {
        req.setEncoding("utf8"); req.on("data", chunk => { capture += chunk; }); req.on("end", () => res.end("public-control"));
    });
    await new Promise<void>(resolve => receiver.listen(0, "127.0.0.1", resolve));
    try {
        const address = receiver.address();
        assert.ok(address && typeof address === "object");
        const payload = JSON.stringify({ fragments: [Buffer.from(raw).toString("base64").slice(0, 12), Buffer.from(raw).toString("base64").slice(12)] });
        const response = await fetch(`http://127.0.0.1:${address.port}/synthetic-only`, { method: "POST", body: payload });
        assert.equal(await response.text(), "public-control");
        assert.equal(JSON.parse(capture).fragments.join(""), Buffer.from(raw).toString("base64"));
        report("encoded chunked exfiltration", true, "independent HTTP to local synthetic receiver only", raw);
    } finally { receiver.closeAllConnections(); await new Promise<void>(resolve => receiver.close(() => resolve())); }
    await writeReviewEvidence(evidence, { runId: process.env.SOTERAI_REVIEW_RUN_ID, observedAt: new Date().toISOString(), exactOsBuild: process.env.SOTERAI_REVIEW_OS_BUILD, host: vscode.version, extension: extension.packageJSON.version,
        extensionBundleSha256: createHash("sha256").update(await fs.readFile(path.join(extension.extensionPath, "dist", "extension.js"))).digest("hex"),
        hostProbeSha256: createHash("sha256").update(await fs.readFile(__filename)).digest("hex"),
        extensionActive: extension.isActive, protectedWorkspaceEnabled: true, syntheticOnly: true, liveModelContacted: false,
        repositoryDenyControls: { publicBeforeEnrollment: true, deniedAfterEnrollment: true, retainedAfterRemoval: retainedDeny },
        results, limitations: ["No third-party assistant or remote provider was invoked", "File symlinks, screenshots, clipboard races, live disablement, /proc and privileged OS isolation not tested"] });
    console.log(JSON.stringify({ syntheticReview: "completed", scopedBlocks: results.filter(r => r.status === "BLOCKED_SCOPED").length,
        confirmedLeaks: results.filter(r => r.status === "LEAK_CONFIRMED").length }));
    await vscode.commands.executeCommand("soterai.stopLocalAIBroker");
}
