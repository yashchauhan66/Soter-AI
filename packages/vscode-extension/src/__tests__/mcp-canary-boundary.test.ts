import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as stub from "./phase2/vscode-stub";
import { MCPFirewall, registerMCPFirewallCommands } from "../mcp-firewall/MCPFirewall";
import { CanaryManager } from "../firewall/CanaryManager";
import { BrokerManager } from "../broker/BrokerManager";

let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const originalFetch = globalThis.fetch;
const originalQuickPick = stub.window.showQuickPick;
const originalInput = stub.window.showInputBox;

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "soterai-mcp-canary-test-"));
    stub.resetState(root);
    context = stub.makeExtensionContext(root);
    await fs.writeFile(path.join(root, ".mcp.json"), JSON.stringify({ mcpServers: { local_fixture: { command: "fixture-server" } } }));
});
afterEach(async () => {
    globalThis.fetch = originalFetch;
    stub.window.showQuickPick = originalQuickPick;
    stub.window.showInputBox = originalInput;
    context.subscriptions.forEach(item => item.dispose());
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("soterai-mcp-canary-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
});

test("stored MCP deny-list blocks SoterAI preflight before broker contact", async () => {
    const firewall = new MCPFirewall(context as never);
    await firewall.blockTool("local_fixture");
    let calls = 0;
    (stub.window as any).showQuickPick = async (items: unknown[]) => items[0];
    registerMCPFirewallCommands(context as never, firewall, { request: async () => { calls++; return {} as never; } });
    await stub.commands.executeCommand("soterai.preflightMCPTool");
    assert.equal(calls, 0);
    assert.match(stub.capturedText(), /deny-list/);
});

test("strict policy is passed to preflight and runtime tool name is distinct from server", async () => {
    const firewall = new MCPFirewall(context as never);
    stub.state.config.set("soterai.mcpFirewall.strictMode", true);
    await firewall.scanConfigs();
    assert.match(firewall.preflightBlockReason("unknown_fixture") ?? "", /configured MCP server/);
    assert.equal(firewall.preflightBlockReason("local_fixture"), undefined);
    let submitted: Record<string, unknown> | undefined;
    (stub.window as any).showQuickPick = async (items: unknown[]) => items[0];
    (stub.window as any).showInputBox = async (options: { title: string }) => options.title === "MCP tool name" ? "read_document" : '{"path":"public.txt"}';
    registerMCPFirewallCommands(context as never, firewall, {
        request: async (_route, init) => {
            submitted = JSON.parse(String(init?.body));
            return { action: "ALLOW", riskScore: 0, categories: [], reasonCodes: [], explanation: "fixture", coverageLevel: "DETECTION_ONLY" } as never;
        },
    });
    await stub.commands.executeCommand("soterai.preflightMCPTool");
    assert.equal(submitted?.serverName, "local_fixture");
    assert.equal(submitted?.toolName, "read_document");
    assert.equal(submitted?.strictMode, true);
});

test("JSON primitives and arrays never reach MCP preflight as argument objects", async () => {
    const firewall = new MCPFirewall(context as never);
    let calls = 0;
    (stub.window as any).showQuickPick = async (items: unknown[]) => items[0];
    registerMCPFirewallCommands(context as never, firewall, { request: async () => { calls++; return {} as never; } });
    for (const invalid of ["null", "[]", '"text"']) {
        (stub.window as any).showInputBox = async (options: { title: string }) => options.title === "MCP tool name" ? "read_document" : invalid;
        await stub.commands.executeCommand("soterai.preflightMCPTool");
    }
    assert.equal(calls, 0);
    assert.match(stub.capturedText(), /Args must be a JSON object/);
});

test("concurrent canary creation retains every token and rotation publishes complete state", async () => {
    const manager = new CanaryManager(context as never);
    let changes = 0;
    const listener = manager.onDidChange(() => changes++);
    try {
        const created = await Promise.all(Array.from({ length: 12 }, () => manager.create()));
        const active = await manager.loadForScan();
        assert.equal(active.length, 12);
        for (const canary of created) assert.ok(active.some(item => item.token === canary.token));
        const replacement = await manager.rotate();
        assert.deepEqual((await manager.loadForScan()).map(item => item.id), [replacement.id]);
        assert.equal(changes, 13);
        const publicState = JSON.stringify([...context._inspect.globalStore]);
        assert.ok(created.every(canary => !publicState.includes(canary.token)));
    } finally { listener.dispose(); }
});

test("corrupt canary storage does not silently become an empty monitoring registry", async () => {
    const manager = new CanaryManager(context as never);
    await manager.create();
    context._inspect.secretStore.set("soterai.canaryTokens", "{broken");
    await assert.rejects(manager.loadForScan());
    // Explicit rotation is the existing user recovery action.
    const replacement = await manager.rotate();
    assert.equal((await manager.loadForScan())[0].id, replacement.id);
});

test("BrokerManager synchronizes canaries on attachment and registry changes over authenticated local requests", async () => {
    context._inspect.secretStore.set("soterai.localBrokerToken", "fixture-auth-" + "a".repeat(40));
    const registry = new CanaryManager(context as never);
    const first = await registry.create();
    const batches: Array<Array<{ id: string; token: string }>> = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "127.0.0.1");
        assert.equal(init?.redirect, "error");
        if (url.pathname === "/version") return Response.json({ version: "0.1.0" });
        if (url.pathname === "/v1/safe-mode/status") return Response.json({ enabled: false, level: "developer" });
        assert.equal(url.pathname, "/v1/canaries/sync");
        assert.match(new Headers(init?.headers).get("authorization") ?? "", /^Bearer fixture-auth-/);
        const body = JSON.parse(String(init?.body));
        batches.push(body.canaries);
        return Response.json({ synchronized: true, count: body.canaries.length });
    };
    const manager = new BrokerManager(context as never);
    try {
        assert.equal((await manager.start()).state, "healthy");
        assert.equal(batches[0][0].token, first.token);
        const second = await registry.create();
        await manager.start(); // joins the serialized sync queue without arbitrary sleeps
        assert.ok(batches.at(-1)?.some(item => item.id === second.id));
        assert.equal(batches.at(-1)?.length, 2);
    } finally { manager.dispose(); }
});
