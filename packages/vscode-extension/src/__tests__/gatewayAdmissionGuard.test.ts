import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { randomUUID } from "node:crypto";
import * as stub from "./phase2/vscode-stub";
import { BrokerManager } from "../broker/BrokerManager";

async function fixture(t: any, model?: typeof fetch) {
    stub.resetState("D:/synthetic-admission-project");
    let generation = "", environment: NodeJS.ProcessEnv = {}, child: any;
    const replies = new EventEmitter();
    const manager = new BrokerManager(stub.makeExtensionContext("D:/synthetic-admission-profile") as never, {
        stopMs: 40,
        launch: ((_exe: unknown, _argv: unknown, options: { env: NodeJS.ProcessEnv }) => {
            environment = options.env;
            child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), connected: true,
                send(message: any, callback?: (error: Error | null) => void) {
                    callback?.(null); replies.emit(message.id, message.allowed);
                    if (message.type === "SOTERAI_BROKER_STOP") setImmediate(() => { child.stdout.end(); child.stderr.end(); child.emit("close", 0); });
                    return true;
                }, kill() { assert.fail("Synthetic fixture must not signal processes"); } });
            setImmediate(() => child.emit("message", { type: "SOTERAI_BROKER_READY", version: 1, session: environment.SOTERAI_BROKER_SESSION, port: 49159 }));
            return child;
        }) as never,
        fetchImpl: async (input, init) => {
            const route = new URL(String(input)).pathname;
            if (route === "/v1/ai/openai-compatible/chat/completions") return model ? model(input, init) : Response.json({ choices: [{ message: { content: "Public model response" } }] });
            if (route === "/v1/lifecycle/status") return Response.json({ session: environment.SOTERAI_BROKER_SESSION, version: "0.2.0", ready: true });
            if (route === "/v1/canaries/sync") return Response.json({ synchronized: true, count: 0 });
            if (route === "/v1/gateway/sync") { generation = JSON.parse(String(init?.body)).generation; return Response.json({ version: 1, synchronized: true, generation }); }
            if (route === "/v1/gateway/status") return Response.json({ version: 1, enabled: true, ready: true, generation,
                clineToolSchemas: true, claudeToolSchemas: true, codexResponses: true, geminiGenerateContent: true });
            return Response.json({ enabled: true, level: "strict" });
        },
    }, { async createGatewayRegistry(enabled) { return { available: enabled, async use(consume) { return consume([]); }, dispose() {} }; } });
    t.after(() => manager.dispose());
    await manager.start();
    return { manager, credentials: () => ({ token: environment.SOTERAI_BROKER_TOKEN, control: environment.SOTERAI_BROKER_CONTROL_TOKEN }), challenge: () => new Promise<boolean>((resolve, reject) => {
        const id = randomUUID(), timer = setTimeout(() => reject(Error("No synthetic guard reply")), 2000);
        replies.once(id, allowed => { clearTimeout(timer); resolve(allowed); });
        child.emit("message", { type: "SOTERAI_GATEWAY_GUARD_REQUEST", version: 1, session: environment.SOTERAI_BROKER_SESSION, generation, id });
    }) };
}

test("registered admission is checked through private IPC and a failed selection stays revoked", async t => {
    const f = await fixture(t); let current = true, calls = 0;
    const handle = f.manager.registerGatewayAdmissionGuard("cline", async () => { calls++; return current; });
    assert.equal(await f.challenge(), true); assert.equal(calls, 1);
    current = false; assert.equal(await f.challenge(), false);
    current = true;
    await f.manager.stop();
    await assert.rejects(f.manager.start());
    handle.dispose();
    assert.equal((await f.manager.start()).running, true);
});

test("removing a guard revokes the live broker before an in-flight positive decision returns", async t => {
    const f = await fixture(t); let release!: (value: boolean) => void, entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const handle = f.manager.registerGatewayAdmissionGuard("cline", () => { entered(); return new Promise<boolean>(resolve => { release = resolve; }); });
    const pending = f.challenge(); await started; handle.dispose(); release(true);
    assert.equal(await pending, false);
    assert.notEqual(f.manager.ownedSnapshot().state, "healthy");
});

test("admission timeout withdraws and cannot be revived by a late success", async t => {
    const f = await fixture(t); let release!: (value: boolean) => void;
    const handle = f.manager.registerGatewayAdmissionGuard("cline", () => new Promise<boolean>(resolve => { release = resolve; }));
    assert.equal(await f.challenge(), false); release(true);
    await f.manager.stop(); await assert.rejects(f.manager.start()); handle.dispose();
});

test("duplicate guard registration cannot replace an established approval", async t => {
    const f = await fixture(t), handle = f.manager.registerGatewayAdmissionGuard("cline", async () => true);
    assert.throws(() => f.manager.registerGatewayAdmissionGuard("cline", async () => true));
    assert.equal(await f.challenge(), true); handle.dispose();
});

const modelRequest = () => ({ model: "fixture", messages: [{ role: "user", content: "Public isolated task" }], tools: [] });

test("isolated model callback uses only the fixed data route and host-held client credential", async t => {
    let observed: { url: string; headers: Headers; body: any } | undefined, checks = 0;
    const f = await fixture(t, async (url, init) => {
        observed = { url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
        assert.equal(init?.redirect, "error");
        return Response.json({ choices: [{ message: { content: "Public model response" } }] });
    });
    const guard = f.manager.registerGatewayAdmissionGuard("isolated-test", async () => { checks++; return true; });
    const reply = await f.manager.requestIsolatedAgentModel(modelRequest());
    assert.deepEqual(JSON.parse(JSON.stringify(reply)), { choices: [{ message: { content: "Public model response" } }] });
    assert.equal(observed?.url, "http://127.0.0.1:49159/v1/ai/openai-compatible/chat/completions");
    assert.equal(observed?.headers.get("authorization"), "Bearer " + f.credentials().token);
    assert.notEqual(observed?.headers.get("authorization"), "Bearer " + f.credentials().control);
    assert.equal(observed?.body.stream, false); assert.equal(checks, 2); guard.dispose();
});

test("isolated requests reject destinations, auth fields and accessors before provider calls", async t => {
    let calls = 0, reads = 0;
    const f = await fixture(t, async () => { calls++; return Response.json({}); });
    for (const patch of [{ url: "https://unapproved.invalid" }, { headers: { authorization: "synthetic" } }, { stream: true }])
        await assert.rejects(f.manager.requestIsolatedAgentModel({ ...modelRequest(), ...patch }));
    const malicious = { ...modelRequest(), messages: [Object.defineProperty({}, "content", { get() { reads++; return "private"; } })] };
    await assert.rejects(f.manager.requestIsolatedAgentModel(malicious));
    assert.equal(calls, 0); assert.equal(reads, 0);
});

test("isolated model response is withheld after cancellation or registry withdrawal", async t => {
    let resolve!: (response: Response) => void, entered!: () => void;
    const started = new Promise<void>(done => { entered = done; });
    const f = await fixture(t, async () => { entered(); return new Promise<Response>(done => { resolve = done; }); });
    const controller = new AbortController(), pending = f.manager.requestIsolatedAgentModel(modelRequest(), controller.signal);
    await started; controller.abort(); await f.manager.stop(); resolve(Response.json({ private: "TEST_ONLY_WITHHELD_RESPONSE" }));
    await assert.rejects(pending, error => !String(error).includes("TEST_ONLY_WITHHELD_RESPONSE"));
});

test("oversized and non-JSON isolated model responses are refused with constant errors", async t => {
    let oversized = true;
    const f = await fixture(t, async () => oversized
        ? new Response("x".repeat(1048577), { headers: { "content-type": "application/json" } })
        : new Response("TEST_ONLY_PRIVATE_ERROR", { headers: { "content-type": "text/plain" } }));
    await assert.rejects(f.manager.requestIsolatedAgentModel(modelRequest())); oversized = false;
    await assert.rejects(f.manager.requestIsolatedAgentModel(modelRequest()), error => !String(error).includes("TEST_ONLY_PRIVATE_ERROR"));
});
