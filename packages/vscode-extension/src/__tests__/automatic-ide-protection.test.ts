import "./phase2/register.mjs";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as stub from "./phase2/vscode-stub";
import { AutomaticIDEProtection, type RoutingSetupResult, type SetupProgress } from "../protection/AutomaticIDEProtection";
import { ProtectionController } from "../protection/ProtectionController";
import { deriveProtectionState, type ProtectionRuntimeFacts } from "../protection/ProtectionState";
import { registerBrokerCommands } from "../broker/commands";

const facts: ProtectionRuntimeFacts = { enabled: true, workspaceTrusted: true, broker: "healthy", policy: "loaded",
    safeModeEnabled: true, protectedWorkspaceEnabled: true, sentinelEnabled: true, liveScanEnabled: true,
    mcpStrictModeEnabled: false, detectedAiTools: 1, protectedAiTools: 1 };
const snapshot = (extra: Partial<ProtectionRuntimeFacts> = {}) => ({ facts: { ...facts, ...extra }, descriptor: deriveProtectionState({ ...facts, ...extra }) });
const routed: RoutingSetupResult = { status: "applied", changedConfigs: 1, verifiedTools: 1, failedTools: 0, unsupportedConfigs: 0 };
function setup(route = async () => routed, refresh = async () => snapshot()) {
    stub.resetState("C:/synthetic-automatic-workspace");
    stub.state.config.set("soterai.mcpFirewall.strictMode", true);
    let controls = 0;
    const controller = { lockdown: { active: false }, enableFullProtection: async () => { controls++; return { snapshot: snapshot(), completed: [], limitations: [] }; } };
    const service = new AutomaticIDEProtection({ controller, routeTools: route, refresh });
    return { service, controller, controls: () => controls };
}

test("automatic setup sequences controls, routing and verified coverage and enables broker auto-start", async () => {
    const { service } = setup();
    const progress: SetupProgress[] = [];
    const result = await service.run(update => progress.push(update));
    assert.equal(result.status, "ready");
    assert.equal(result.changedConfigs, 1);
    assert.equal(stub.state.config.get("soterai.broker.autoStart"), true);
    assert.deepEqual(progress.map(item => `${item.stage}:${item.status}`), ["controls:running", "controls:complete", "routing:running", "routing:complete", "verification:running", "verification:complete"]);
    assert.match(result.summary, /supported managed paths/);
});

test("untrusted, absent workspace and lockdown refuse setup without any control or routing mutation", async () => {
    for (const mode of ["untrusted", "absent", "lockdown"]) {
        let routing = 0;
        const target = setup(async () => { routing++; return routed; });
        if (mode === "untrusted") stub.state.isTrusted = false;
        if (mode === "absent") stub.state.folders = [];
        if (mode === "lockdown") target.controller.lockdown.active = true;
        assert.equal((await target.service.run()).status, "attention");
        assert.equal(target.controls(), 0); assert.equal(routing, 0);
        assert.equal(stub.state.config.get("soterai.broker.autoStart"), undefined);
    }
});

test("cancelled or unavailable routing does not claim complete IDE protection", async () => {
    for (const status of ["cancelled", "unavailable", "failed"] as const) {
        const { service } = setup(async () => ({ ...routed, status, changedConfigs: 0 }));
        const result = await service.run();
        assert.equal(result.status, "attention");
        if (status === "cancelled") assert.match(result.summary, /cancelled/);
    }
    const { service } = setup(async () => routed, async () => snapshot({ detectedAiTools: 0, protectedAiTools: 0 }));
    assert.equal((await service.run()).status, "attention");
});

test("failed verification and errors remain incomplete without leaking exception data", async () => {
    const target = setup(async () => routed, async () => snapshot({ safeModeEnabled: false }));
    assert.equal((await target.service.run()).status, "failed");
    const failing = setup(async () => { throw new Error("synthetic-private-error-detail"); });
    const result = await failing.service.run();
    assert.equal(result.status, "failed"); assert.doesNotMatch(JSON.stringify(result), /synthetic-private-error-detail/);
});

test("palette and panel calls share one pending setup, and a later retry can run", async () => {
    let release!: () => void;
    const target = setup(async () => { await new Promise<void>(resolve => { release = resolve; }); return routed; });
    const first = target.service.run();
    const second = target.service.run();
    assert.equal(first, second);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(target.controls(), 1);
    release(); await first;
    const retry = target.service.run();
    await new Promise(resolve => setImmediate(resolve));
    release(); await retry;
    assert.equal(target.controls(), 2);
});

test("full-protection self-test rejects allowed or malformed scan responses", async () => {
    for (const reply of [{ decision: "allow", redacted: false }, {}]) {
        stub.resetState("C:/synthetic-automatic-workspace");
        const controller = new ProtectionController(stub.makeExtensionContext("synthetic-controller") as never, {
            brokerManager: { start: async () => ({ running: true, state: "healthy" }), request: async (path: string) => path === "/v1/scan" ? reply : {} } as never,
            workspaceGuard: { enable: async () => {} } as never, sentinel: { enable: async () => {} } as never,
            protectionState: { refresh: async () => snapshot() } as never, refreshViews: () => {},
        });
        await assert.rejects(controller.enableFullProtection(), /self-test/);
    }
});

test("AI routing keeps review, encrypted original backup and authenticated smoke requests", async () => {
    const tempRoot = path.resolve(os.tmpdir());
    const root = await fs.mkdtemp(path.join(tempRoot, "soterai-one-click-test-"));
    const home = path.join(root, "home");
    const workspace = path.join(root, "workspace");
    const configPath = path.join(home, ".continue", "config.json");
    const original = JSON.stringify({ baseURL: "https://synthetic-provider.example.test/v1" });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(configPath, original);
    stub.resetState(workspace);
    const context = stub.makeExtensionContext(path.join(root, "storage"));
    await context.secrets.store("soterai.localBrokerToken", "synthetic-local-broker-token");
    const requests: Array<{ url: string; headers?: Record<string, string> }> = [];
    const setupEvents: string[] = [];
    const mocks: Array<{ mock: { restore(): void } }> = [
        mock.method(os, "homedir", () => home),
        mock.method(globalThis, "fetch", async (url: string, options?: { headers?: Record<string, string> }) => {
            requests.push({ url, headers: options?.headers });
            return { status: 200, text: async () => "data: [DONE]\n\n" };
        }),
    ];
    registerBrokerCommands(context as never, { start: async () => { setupEvents.push("broker-start"); return { running: true, state: "healthy", url: "http://127.0.0.1:47321" }; } } as never, () => {});
    try {
        const cancelled = await stub.commands.executeCommand("soterai.secureAllAI") as RoutingSetupResult;
        assert.equal(cancelled.status, "cancelled");
        assert.equal(setupEvents.length, 0);
        assert.equal(await fs.readFile(configPath, "utf8"), original);
        mocks.push(mock.method(stub.window, "showInformationMessage", async (message: string) => {
            setupEvents.push(message.startsWith("Covers:") ? "coverage" : message.includes("Operational state:") ? "operational-result" : "setup-review");
            return message.startsWith("Covers:") ? "Review scoped setup" : "Secure Everything Now";
        }));
        const applied = await stub.commands.executeCommand("soterai.secureAllAI") as RoutingSetupResult;
        assert.equal(applied.status, "applied"); assert.equal(applied.changedConfigs, 1);
        assert.deepEqual(setupEvents.slice(0, 2), ["coverage", "broker-start"]);
        assert.ok(setupEvents.includes("operational-result"));
        assert.match(await fs.readFile(configPath, "utf8"), /127\.0\.0\.1:47321/);
        assert.ok(requests.some(item => item.headers?.authorization === "Bearer synthetic-local-broker-token"));
        const saved = context.globalState.get<Array<{ path: string; backupPath: string }>>("soterai.secureAllAI.backups")!;
        assert.equal(saved.length, 1);
        assert.match(saved[0].backupPath, /^[a-f0-9]{32}$/);
        const backups = await fs.readdir(path.join(root, "storage", "globalStorage", "config-backups"));
        const ciphertext = await fs.readFile(path.join(root, "storage", "globalStorage", "config-backups", backups[0]), "utf8");
        assert.doesNotMatch(ciphertext, /synthetic-provider/);
        // Re-running after a user changes the endpoint must retain the original restore handle.
        await fs.writeFile(configPath, JSON.stringify({ baseURL: "https://second-synthetic.example.test/v1" }));
        await stub.commands.executeCommand("soterai.secureAllAI");
        assert.equal(context.globalState.get<typeof saved>("soterai.secureAllAI.backups")![0].backupPath, saved[0].backupPath);
        assert.equal((await stub.commands.executeCommand("soterai.secureAllAI") as RoutingSetupResult).status, "unchanged");
        stub.state.config.set("soterai.hardening.coverageDisclosure", false);
        const eventCount = setupEvents.length;
        assert.equal((await stub.commands.executeCommand("soterai.secureAllAI") as RoutingSetupResult).status, "unavailable");
        assert.equal(setupEvents.length, eventCount);
    } finally {
        for (const item of mocks) item.mock.restore();
        context.subscriptions.forEach(item => item.dispose());
        if (!path.resolve(root).startsWith(tempRoot + path.sep)) throw new Error("Unexpected synthetic test path");
        await fs.rm(root, { recursive: true, force: true });
    }
});
