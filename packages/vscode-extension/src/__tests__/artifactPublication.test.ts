import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import { registerPublicWorkspaceCommands } from "../project-privacy/publication/commands";

let root: string, source: string, context: ReturnType<typeof stub.makeExtensionContext>;
const secret = "sk-proj-" + "SYNTHETIC_ARTIFACT_ONLY_2975".repeat(3);
const escaped = [...secret].map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const dialog = stub.window as typeof stub.window & { showOpenDialog: (...args: unknown[]) => Promise<stub.Uri[] | undefined> };
const previousDialog = Object.getOwnPropertyDescriptor(stub.window, "showOpenDialog");
function artifactFlag(value: boolean) {
    stub.state.configInspect.set("soterai.lite.artifactScanner", { defaultValue: true, globalValue: value });
}

beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "soterai-f24-publication-unit-"));
    source = path.join(root, "source"); await mkdir(source);
    stub.resetState(source); context = stub.makeExtensionContext(source);
    initializeBoundaryState(context.workspaceState as never);
    stub.state.config.set("soterai.projectPrivacy.safePublication", true);
    artifactFlag(true);
    Object.defineProperty(stub.window, "showOpenDialog", { configurable: true, writable: true, value: async () => undefined });
    registerPublicWorkspaceCommands(context as never);
});
afterEach(() => {
    context.subscriptions.forEach(item => item.dispose()); mock.restoreAll();
    if (previousDialog) Object.defineProperty(stub.window, "showOpenDialog", previousDialog);
    else delete (stub.window as unknown as { showOpenDialog?: unknown }).showOpenDialog;
    // Synthetic sources, complete and incomplete outputs stay retained as evidence.
});
async function file(name: string, text: string) {
    await mkdir(path.dirname(path.join(source, name)), { recursive: true });
    await writeFile(path.join(source, name), text);
}
function select(names: string[]) {
    let calls = 0;
    mock.method(dialog, "showOpenDialog", async () => ++calls === 1
        ? names.map(name => stub.Uri.file(path.join(source, name))) : [stub.Uri.file(root)]);
    mock.method(stub.window, "showWarningMessage", async () => "Publish reviewed snapshot" as never);
}
const run = () => stub.commands.executeCommand("soterai.preparePublicWorkspace") as Promise<{ status: string; destination?: string }>;

test("F24 artifact flag off withdraws actual publication before selection or content", async () => {
    await file("dist/public.js", "export const greeting = 'Public asset';\n");
    select(["dist/public.js"]); artifactFlag(false);
    assert.deepEqual(await run(), { status: "UNAVAILABLE" });
    assert.deepEqual(await readdir(root), ["source"]);
});

test("F24 actual publication masks decoded static source credentials and keeps useful public code", async () => {
    const original = `export const greeting = 'Public asset'; const API_KEY = "${escaped}";\n`;
    await file("dist/bundle.js", original); select(["dist/bundle.js"]);
    const result = await run(); assert.equal(result.status, "PREPARED");
    const released = await readFile(path.join(result.destination!, "dist/bundle.js"), "utf8");
    assert.match(released, /Public asset/); assert.ok(!released.includes(secret)); assert.ok(!released.includes(escaped));
    assert.match(released, /SOTERAI_PROTECTED/); assert.equal(await readFile(path.join(source, "dist/bundle.js"), "utf8"), original);
    assert.ok(!JSON.stringify(stub.sinks).includes(secret));
});

test("F24 source map publication is withheld with original embedded source preserved", async () => {
    const original = JSON.stringify({ version: 3, sources: ["../private-original.ts"], names: [], mappings: "",
        sourcesContent: [`const API_KEY = '${secret}';`] });
    await file("dist/bundle.js.map", original); select(["dist/bundle.js.map"]);
    assert.deepEqual(await run(), { status: "FAILED" });
    assert.deepEqual(await readdir(root), ["source"]);
    assert.equal(await readFile(path.join(source, "dist/bundle.js.map"), "utf8"), original);
    assert.ok(!JSON.stringify(stub.sinks).includes(secret));
    assert.ok(!JSON.stringify(stub.sinks).includes("private-original.ts"));
});

test("F24 sourceMappingURL-bearing source is withheld without reference reads or output", async () => {
    const original = "export const publicAsset = true;\n//# sourceMappingURL=https://invalid.test/private.map\n";
    await file("dist/bundle.js", original); select(["dist/bundle.js"]);
    assert.deepEqual(await run(), { status: "FAILED" }); assert.deepEqual(await readdir(root), ["source"]);
    assert.equal(await readFile(path.join(source, "dist/bundle.js"), "utf8"), original);
});

test("F24 disabling artifact release during final owner review prevents actual output", async () => {
    await file("dist/public.js", "export const greeting = 'Public asset';\n"); select(["dist/public.js"]);
    mock.method(stub.window, "showWarningMessage", async () => {
        artifactFlag(false); return "Publish reviewed snapshot" as never;
    });
    assert.deepEqual(await run(), { status: "FAILED" }); assert.deepEqual(await readdir(root), ["source"]);
});

test("F24 harmless CSS release remains useful and originals unchanged", async () => {
    const original = ".public-control { color: #113355; padding: 1rem; }\n";
    await file("build/theme.css", original); select(["build/theme.css"]);
    const result = await run(); assert.equal(result.status, "PREPARED");
    assert.equal(await readFile(path.join(result.destination!, "build/theme.css"), "utf8"), original);
    assert.equal(await readFile(path.join(source, "build/theme.css"), "utf8"), original);
});
