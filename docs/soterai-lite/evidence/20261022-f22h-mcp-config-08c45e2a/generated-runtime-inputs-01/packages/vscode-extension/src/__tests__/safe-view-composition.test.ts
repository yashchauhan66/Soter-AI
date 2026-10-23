import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { buildSafeFileView } from "../project-privacy/SafeFileView";
import { ProjectFileAccess } from "../project-privacy/ProjectFileAccess";
import { BoundarySnapshot, initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { documentDigest, OMITTED } from "../ai-boundary/policy";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";

const privateName = "TEST_ONLY_PRIVATE_VALUE_LINE_20261012";
let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const uri = (rel: string) => stub.Uri.file(join(root, rel));
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-composition-"));
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: () => new stub.Disposable() });
});
afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose()); mock.restoreAll();
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("soterai-composition-"));
    await rm(target, { recursive: true, force: true });
});

for (const quote of ["'", '"', "`"] ) {
    test(`protected ${quote} syntax cannot reinterpret multiline value data as schema names`, () => {
        const original = `MULTI=${quote}first\n${privateName}=value\nlast${quote}\nPUBLIC=7`;
        const replaced = `${OMITTED}\n${privateName}=value\nlast${quote}\nPUBLIC=7`;
        const view = buildSafeFileView(".env", replaced, true, original);
        assert.equal(view.kind, "sensitive-summary");
        assert.equal(view.fieldCount, 0);
        assert.ok(!JSON.stringify(view).includes(privateName));
        assert.ok(!JSON.stringify(view).includes("PUBLIC"));
        assert.equal(buildSafeFileView(".env", original, true, original).text, "MULTI=[MASKED]\nPUBLIC=[MASKED]");
    });
}

test("an ordinary protected region preserves approved adjacent public text", () => {
    assert.equal(buildSafeFileView("public.txt", `Public ${OMITTED} end.`, false, `Public ${privateName} end.`).text,
        `Public ${OMITTED} end.`);
});

test("the approval service builds the conservative view from original and region snapshots", async () => {
    let seen = "";
    const original = `MULTI="first\n${privateName}=value\nlast"`;
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0,
        capture: async () => ({ workspace: "synthetic", relativePath: ".env", fileIdentity: "file-1", policyRevision: "policy-1",
            content: original, regionView: `${OMITTED}\n${privateName}=value\nlast"`, sensitive: true }),
        confirm: async receipt => { seen = JSON.stringify(receipt); return true; } });
    const result = await access.request(".env", "integration-command");
    assert.equal(result.status, "ALLOWED_ONCE");
    assert.ok(!JSON.stringify(result).includes(privateName));
    assert.ok(!seen.includes(privateName));
    assert.match(JSON.stringify(result), /schema withheld/);
});

test("actual adapter withholds dotenv names when a protected region changes quote syntax", async () => {
    const original = `MULTI="first\n${privateName}=value\nlast"\nPUBLIC=7`;
    await writeFile(join(root, ".env"), original);
    await updateRules(stub.state.folders[0].uri.toString(), () => ({ paths: [], regions: [{ path: ".env",
        digest: documentDigest(original), start: 0, end: original.indexOf("\n") }] }));
    registerProjectPrivacyCommands(context as never);
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri(".env"));
    assert.equal((result as { status: string }).status, "ALLOWED_ONCE");
    assert.ok(!JSON.stringify(result).includes(privateName));
    assert.ok(!stub.capturedText().includes(privateName));
});

test("custom project sensitive classification never receives an ordinary approved view", async () => {
    await mkdir(join(root, ".soterai"));
    await writeFile(join(root, ".soterai/policy.json"), JSON.stringify({ sensitivePaths: ["private.txt"], aiContext: { sensitivePathAction: "redact" } }));
    await writeFile(join(root, "private.txt"), privateName);
    await writeFile(join(root, "public.txt"), "Working public control.");
    registerProjectPrivacyCommands(context as never);
    mock.method(stub.window, "showWarningMessage", async () => "Allow safe read once");
    const result = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("private.txt"));
    assert.equal((result as { status: string }).status, "ALLOWED_ONCE");
    assert.match(JSON.stringify(result), /MASKED/);
    assert.ok(!JSON.stringify(result).includes(privateName));
    const control = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")) as { text: string };
    assert.equal(control.text, "Working public control.");
    assert.equal((await BoundarySnapshot.load()).isSensitive(uri("PRIVATE.TXT") as never), true);
});

test("composition rollback withdraws safe reads while keeping the parent privacy flag enabled", async () => {
    await writeFile(join(root, "public.txt"), "Public control.");
    registerProjectPrivacyCommands(context as never);
    stub.state.config.set("soterai.projectPrivacy.safeViewComposition", false);
    assert.deepEqual(await stub.commands.executeCommand("soterai.readProjectFileSafely", uri("public.txt")), { status: "UNAVAILABLE" });
    assert.equal(stub.workspace.getConfiguration("soterai").get("projectPrivacy.enabled", true), true);
});
