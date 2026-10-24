import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { CodexIdeAdapter } from "../adapters/CodexIdeAdapter";
for (const [key, value] of [["cliExecutable", "SYNTHETIC_OVERRIDE_DO_NOT_EXECUTE"], ["runCodexInWindowsSubsystemForLinux", true], ["useExperimentalLspMcpServer", true]] as const)
    test("F20B runtime preference drift immediately withdraws authority: " + key, async t => {
        const root = await mkdtemp(join(tmpdir(), "soterai-f20b-runtime-drift-")), project = join(root, "project"); await mkdir(project); stub.resetState(project);
        const context = stub.makeExtensionContext(join(root, "profile"));
        const manager = { async start() { return { running: true, url: "http://127.0.0.1:49155" }; }, ownedSnapshot() { return { state: "healthy", port: 49155, session: "b9999999-9999-4999-8999-999999999999" }; }, async status() { return { running: true }; }, async request() { return { version: 1, enabled: true, ready: true, codexResponses: true }; }, async getClientToken() { return "d".repeat(64); } };
        const adapter = new CodexIdeAdapter(context as never, { isEnabled: () => true } as never, manager as never); t.after(() => adapter.dispose());
        t.mock.method(adapter as any, "artifact", async () => undefined); t.mock.method(adapter as any, "artifactCurrent", async () => true);
        t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
        assert.equal((await adapter.configure() as any).status, "APPLIED");
        await stub.workspace.getConfiguration("chatgpt").update(key, value);
        assert.equal((adapter.status() as any).status, "UNAVAILABLE");
        assert.equal((await adapter.undo() as any).status, "RESTORED");
    });
