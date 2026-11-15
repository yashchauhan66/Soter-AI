import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import * as stub from "./phase2/vscode-stub";
import { BrokerManager } from "../broker/BrokerManager";
import { clineSessionSelection } from "../adapters/ClineSessionPolicy";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
import { createGatewayParentGuard } from "../../../../apps/local-ai-broker/src/GatewayParentGuard";

// Actual loopback HTTP broker/control requests and private IPC contract, with
// an in-process child and recorded provider fetch. No external provider or IDE.
async function fixture(t: any, duringProvider?: (change: (patch: object) => void) => void) {
    stub.resetState("D:/synthetic-cline-gateway-project");
    stub.state.config.set("soterai.broker.openAIProviderUrl", "https://provider.invalid/v1/chat/completions");
    const context = stub.makeExtensionContext("D:/synthetic-cline-gateway-storage");
    context._inspect.secretStore.set("soterai.providerApiKey", "TEST_ONLY_CLINE_PROVIDER_CREDENTIAL");
    let state = { planModeApiProvider: "openai", actModeApiProvider: "openai", planModeOpenAiModelId: "fixture", actModeOpenAiModelId: "fixture", mode: "act" };
    const approved = clineSessionSelection(state)!;
    const change = (patch: object) => { state = { ...state, ...patch }; };
    const wires: string[] = [];
    let broker!: BrokerServer;
    const manager = new BrokerManager(context as never, {
        stopMs: 1000,
        launch: ((_exe: unknown, _args: unknown, options: { env: NodeJS.ProcessEnv }) => {
            const env = options.env, session = env.SOTERAI_BROKER_SESSION!;
            const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), connected: true,
                send(message: any, callback?: (error: Error | null) => void) {
                    callback?.(null);
                    if (message.type === "SOTERAI_BROKER_STOP") void broker.stop().then(() => {
                        child.connected = false; channel.connected = false; channel.emit("disconnect");
                        child.stdout.end(); child.stderr.end(); child.emit("close", 0);
                    });
                    else channel.emit("message", message);
                    return true;
                }, kill() { assert.fail("No process signaling in synthetic fixture"); } });
            const channel = Object.assign(new EventEmitter(), { connected: true,
                send(message: unknown, callback?: (error: Error | null) => void) { callback?.(null); child.emit("message", message); return true; } });
            broker = new BrokerServer({ token: env.SOTERAI_BROKER_TOKEN!, controlToken: env.SOTERAI_BROKER_CONTROL_TOKEN!, ownerSession: session,
                port: 0, requireCanarySync: true, requireGatewaySync: true, gatewayPolicy: true, clineToolSchemas: true,
                claudeToolSchemas: true, codexResponses: true, geminiGenerateContent: true,
                providerApiKey: env.SOTERAI_PROVIDER_API_KEY, openAIProviderUrl: env.SOTERAI_OPENAI_PROVIDER_URL,
                gatewayGuard: createGatewayParentGuard(session, channel as never),
                fetchImpl: async (_url, init) => {
                    wires.push(String(init?.body)); duringProvider?.(change);
                    return Response.json({ choices: [{ message: { content: "PUBLIC_RESPONSE_MUST_BE_WITHHELD_ON_DRIFT" } }] });
                } });
            void broker.start().then(({ port }) => child.emit("message", { type: "SOTERAI_BROKER_READY", version: 1, session, port }));
            return child;
        }) as never,
    }, { async createGatewayRegistry(enabled) { return { available: enabled, async use(consume) { return consume([]); }, dispose() {} }; } });
    t.after(async () => { await manager.stop(); manager.dispose(); await broker?.stop(); });
    const started = await manager.start(), token = await manager.getClientToken();
    manager.registerGatewayAdmissionGuard("cline", async () => clineSessionSelection(state)?.fingerprint === approved.fingerprint);
    const post = async (body: object = { model: "fixture", messages: [{ role: "user", content: "Public task" }] }) => {
        try {
            const response = await fetch(started.url + "/v1/ai/openai-compatible/chat/completions", {
                method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });
            return { status: response.status, text: await response.text() };
        } catch { return { status: 0, text: "" }; }
    };
    return { manager, wires, change, post };
}

test("current Cline selection completes a useful gateway request through actual IPC admission", async t => {
    const f = await fixture(t), response = await f.post();
    assert.equal(response.status, 200); assert.equal(f.wires.length, 1);
    assert.match(response.text, /PUBLIC_RESPONSE_MUST_BE_WITHHELD_ON_DRIFT/);
});

test("provider fallback sends zero provider requests and a retry cannot revive the old session", async t => {
    const f = await fixture(t); f.change({ actModeApiProvider: "cline" });
    assert.notEqual((await f.post()).status, 200); assert.equal(f.wires.length, 0);
    f.change({ actModeApiProvider: "openai" });
    assert.notEqual((await f.post()).status, 200); assert.equal(f.wires.length, 0);
});

test("mode drift during provider execution withholds the complete response", async t => {
    const f = await fixture(t, change => change({ mode: "plan" })), response = await f.post();
    assert.equal(f.wires.length, 1); assert.notEqual(response.status, 200);
    assert.ok(!response.text.includes("PUBLIC_RESPONSE_MUST_BE_WITHHELD_ON_DRIFT"));
});

test("unsupported native attachment shape never bypasses gateway schema admission", async t => {
    const f = await fixture(t);
    const response = await f.post({ model: "fixture", messages: [{ role: "user", content: [{ type: "file", file: { file_id: "unreviewed-native-attachment" } }] }] });
    assert.notEqual(response.status, 200); assert.equal(f.wires.length, 0);
});
