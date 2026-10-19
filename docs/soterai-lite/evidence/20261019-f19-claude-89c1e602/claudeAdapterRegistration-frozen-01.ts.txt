import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as stub from "./phase2/vscode-stub";
import { registerClaudeAdapter, claudeAdapterEnabled } from "../adapters/ClaudeAdapter";
const commands = ["soterai.configurePinnedClaude", "soterai.restorePinnedClaude", "soterai.claudeAdapterStatus"];
test("F19-C09 canonical and Lite manifests expose all three registered owner commands", () => {
    for (const directory of ["vscode-extension", "soterai-lite"]) {
        const manifest = JSON.parse(readFileSync(join(__dirname, "../../../", directory, "package.json"), "utf8"));
        for (const command of commands) {
            assert.equal(manifest.contributes.commands.filter((entry: { command: string }) => entry.command === command).length, 1);
            assert.equal(manifest.contributes.menus.commandPalette.filter((entry: { command: string }) => entry.command === command).length, 1);
        }
        const flag = manifest.contributes.configuration.properties["soterai.lite.claudeAdapter"];
        assert.equal(flag.default, true); assert.equal(flag.scope, "machine");
        assert.ok(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.claudeAdapter"));
    }
});
test("F19-C10 activation shares the actual trusted reader and broker manager", () => {
    const source = readFileSync(join(__dirname, "../extension.ts"), "utf8");
    assert.match(source, /import\s+\{\s*registerClaudeAdapter\s*\}\s+from\s+["']\.\/adapters\/ClaudeAdapter["']/);
    assert.match(source, /registerClaudeAdapter\(context,\s*brokerManager,\s*managedReader\)/);
});
test("F19-C11 registration performs no setup; arbitrary command arguments confer no authority", async () => {
    stub.resetState("D:/synthetic/f19-registration"); let calls = 0;
    const context = stub.makeExtensionContext("D:/synthetic/f19-registration-private");
    registerClaudeAdapter(context as never, { start: async () => { calls++; throw Error("unexpected"); } } as never, { isEnabled: () => false } as never);
    try {
        for (const command of commands) assert.equal(stub.registeredCommands.has(command), true);
        const result = await stub.commands.executeCommand("soterai.configurePinnedClaude", { approved: true, raw: true, endpoint: "https://synthetic.invalid" }) as { status: string };
        assert.equal(result.status, "UNAVAILABLE"); assert.equal(calls, 0);
    } finally { for (const item of context.subscriptions) item.dispose(); }
});
test("F19-C12 machine owner disable cannot be overridden by project values", () => {
    stub.resetState("D:/synthetic/f19-registration");
    stub.state.configInspect.set("soterai.lite.claudeAdapter", { defaultValue: true, globalValue: false, workspaceValue: true });
    assert.equal(claudeAdapterEnabled(), false);
    stub.state.configInspect.set("soterai.lite.claudeAdapter", { defaultValue: true, globalValue: true, workspaceValue: false });
    assert.equal(claudeAdapterEnabled(), true);
});
