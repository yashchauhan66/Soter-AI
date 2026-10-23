import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import * as stub from "./phase2/vscode-stub";
import { ClineAdapter } from "../adapters/ClineAdapter";
import { managedEmptyStoreIdentity } from "../terminal/ManagedOutputBinding";

test("F18 fresh ticket storage preserves the captured empty vault identity through cancelled setup", async t => {
    const root = await mkdtemp(join(tmpdir(), "soterai-f18-lifecycle-")), workspace = join(root, "project"), profile = join(root, "profile");
    await mkdir(workspace); await mkdir(profile); stub.resetState(workspace);
    const context = stub.makeExtensionContext(profile), session = randomUUID();
    let captured: string | undefined;
    const current = () => captured !== undefined && managedEmptyStoreIdentity(context.globalStorageUri.fsPath) === captured;
    const manager = {
        start: async () => { captured = managedEmptyStoreIdentity(context.globalStorageUri.fsPath); return { running: true, url: "http://127.0.0.1:12345" }; },
        ownedSnapshot: () => ({ state: current() ? "healthy" : "stopping", session, port: 12345 }),
        getClientToken: async () => { if (!current()) throw Error("Empty vault storage identity changed"); return "TEST_ONLY_F18_EPHEMERAL_TOKEN"; },
    };
    const paths = { providers: join(profile, "providers.json"), mcp: join(profile, "mcp.json"), globals: join(profile, "globals.json"), hook: join(workspace, ".clinerules/hooks/PreToolUse.ps1"), taskHook: join(workspace, ".clinerules/hooks/TaskStart.ps1") };
    const original = JSON.stringify({ version: 1, modes: {}, providers: { "openai-compatible": { settings: { provider: "openai-compatible", model: "fixture", apiKey: "TEST_ONLY_F18_OLD" } } } });
    await writeFile(paths.providers, original); await writeFile(paths.mcp, '{"mcpServers":{}}'); await writeFile(paths.globals, '{}');
    const adapter = new ClineAdapter(context as never, manager as never, { isEnabled: () => true } as never);
    t.after(() => adapter.dispose());
    // Artifact/prerequisite fixtures are synthetic; storage and DPAPI paths are actual.
    t.mock.method(adapter as any, "artifact", async () => undefined);
    t.mock.method(adapter as any, "eligible", async () => true);
    t.mock.method(adapter as any, "paths", () => paths);
    t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await adapter.configure() as { status: string }).status, "CANCELLED");
    assert.equal(current(), true);
    assert.equal(await readFile(paths.providers, "utf8"), original);
});
