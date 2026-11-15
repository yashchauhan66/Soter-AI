import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
import { GatewayPolicy } from "../../../../apps/local-ai-broker/src/GatewayPolicy";
import { createApprovalGrant, scanBrokerRequest, type ApprovalStore } from "../../../guard-core/src/index";

const password = "BlueMango7!", session = "synthetic-p0-approved";
const chat = (content: unknown = "Useful public arithmetic") => ({ model: "synthetic", messages: [{ role: "user", content }] });
type Internals = { gateway: GatewayPolicy; safeMode: { enabled: boolean; level: "developer" | "strict" | "enterprise" }; approvals: ApprovalStore };

/** Real scanner, approval and gateway path; fake HTTP objects and upstream.
 * HTTP auth/listen behavior remains covered by the existing wire suites. */
async function forward(body: Record<string, unknown>, options: { level?: Internals["safeMode"]["level"]; approve?: string; provider?: "openai" | "anthropic"; values?: string[] } = {}) {
    const wires: string[] = [], responseParts: string[] = [];
    const broker = new BrokerServer({ token: "synthetic-p0-client-" + "c".repeat(40), controlToken: "synthetic-p0-control-" + "d".repeat(40),
        providerApiKey: "synthetic-p0-provider-credential", openAIProviderUrl: "http://127.0.0.1:1", anthropicProviderUrl: "http://127.0.0.1:1",
        registeredValues: options.values ?? [], gatewayPolicy: true,
        fetchImpl: async (_url, request) => {
            wires.push(String(request?.body));
            return new Response(JSON.stringify({ choices: [{ message: { content: "Public response" } }], content: [{ type: "text", text: "Public response" }] }),
                { headers: { "content-type": "application/json" } });
        } });
    const internal = broker as unknown as Internals;
    if (options.level) internal.safeMode = { enabled: true, level: options.level };
    if (options.approve) {
        const scan = await scanBrokerRequest([{ role: "user", content: options.approve }], { safeMode: internal.safeMode });
        internal.approvals.add(await createApprovalGrant({ sessionId: session, contentHash: scan.contentHash, decision: "approval_required", scope: "once" }));
    }
    const req = Object.assign(new EventEmitter(), { url: "/v1/ai/openai-compatible/chat/completions", headers: { "x-soterai-session-id": session },
        rawHeaders: [], aborted: false, destroyed: false, complete: true });
    const headers = new Map<string, unknown>();
    const res = Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false, headersSent: false,
        setHeader(name: string, value: unknown) { headers.set(name, value); },
        end(value: unknown) { responseParts.push(String(value)); this.writableEnded = true; } });
    let error = "";
    try { await internal.gateway.proxy(options.provider ?? "openai", body, req as unknown as IncomingMessage, res as unknown as ServerResponse); }
    catch (value) { error = String(value); }
    finally { internal.gateway.dispose(); }
    assert.ok(!error.includes(password), "errors must not echo the fixture value");
    return { wires, headers, error, responseParts };
}

for (const level of ["developer", "strict"] as const) {
    for (const content of [`DB_PASSWORD=${password}`, JSON.stringify({ DB_PASSWORD: password }), `db.passwd : '${password}'`]) {
        test(`P0 ${level}: detected assignment never reaches upstream (${content.length} chars)`, async () => {
            const result = await forward(chat(content), { level });
            assert.equal(result.wires.length, 1, "supported message should retain useful sanitized forwarding");
            assert.ok(!result.wires[0].includes(password));
            assert.equal(result.headers.get("x-soterai-request-decision"), "redact");
        });
    }
}

test("P0 enterprise approval permits safe content without releasing the recognized password", async () => {
    const content = `DB_PASSWORD=${password}`;
    assert.equal((await forward(chat(content), { level: "enterprise" })).wires.length, 0);
    const result = await forward(chat(content), { level: "enterprise", approve: content });
    assert.equal(result.wires.length, 1);
    assert.ok(!result.wires[0].includes(password));
});

for (const body of [
    { ...chat(), metadata: { DB_PASSWORD: password } },
    { ...chat(), tools: [{ type: "function", function: { name: "public_tool", description: `DB_PASSWORD=${password}` } }] },
    { model: "synthetic", messages: [{ role: "assistant", content: [{ type: "tool_use", id: "public_id", name: "public_tool", input: { DB_PASSWORD: password } }] }] },
    { model: "synthetic", messages: [{ role: "user", content: [{ type: "tool_result", tool_use_id: "public_id", content: [{ type: "text", text: `DB_PASSWORD=${password}` }] }] }] },
]) {
    test("P0 final metadata/tool structure cannot silently carry an unredacted assignment", async () => {
        const provider = (body.messages[0].content as Array<{ type?: string }>)?.[0]?.type ? "anthropic" : "openai";
        const result = await forward(body, { provider });
        assert.equal(result.wires.length, 0, "unsupported safe transformation must withhold the whole request");
    });
}

test("P0 JSON tool arguments preserve syntax and identifiers after redaction", async () => {
    const argumentsText = JSON.stringify({ DB_PASSWORD: password, query: "SELECT public_data" });
    const body = { model: "synthetic", messages: [{ role: "assistant", content: null,
        tool_calls: [{ id: "public_id", type: "function", function: { name: "public_tool", arguments: argumentsText } }] }] };
    const result = await forward(body);
    assert.equal(result.wires.length, 1);
    const message = JSON.parse(result.wires[0]).messages[0];
    assert.equal(message.tool_calls[0].id, "public_id");
    const args = JSON.parse(message.tool_calls[0].function.arguments);
    assert.equal(args.query, "SELECT public_data");
    assert.equal(args.DB_PASSWORD, "[REDACTED_SECRET]");
});

test("P0 nested escaped JSON argument values are inspected semantically before forwarding", async () => {
    const escaped = [...password].map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    const body = { ...chat(), metadata: { inner: '{"DB_PASSWORD":"' + escaped + '"}' } };
    assert.equal((await forward(body)).wires.length, 0);
});

test("P0 public and registered controls retain their behavior", async () => {
    const body = { ...chat(), metadata: { public_id: "4b8b72a0-512f-4bdb-a2a5-54a756301237" } };
    const result = await forward(body);
    assert.deepEqual(JSON.parse(result.wires[0]), body);
    assert.equal((await forward(chat(password), { values: [password] })).wires.length, 0);
});

test("P0 a later request transformation cannot introduce a secret or emit an allowed audit event", async () => {
    const events: string[] = [];
    let calls = 0;
    const policy = new GatewayPolicy({ token: "synthetic-transform-client-" + "c".repeat(32), providerApiKey: "synthetic-transform-key",
        openAIProviderUrl: "http://127.0.0.1:1", fetchImpl: async () => { calls++; return new Response("{}"); } },
        () => ({ enabled: true, level: "strict" }), () => false, event => events.push(event),
        { request: async body => ({ body: { ...body, metadata: { DB_PASSWORD: password } }, decision: "allow" }) });
    const req = Object.assign(new EventEmitter(), { url: "/v1/ai/openai-compatible/chat/completions", headers: {}, rawHeaders: [], aborted: false, destroyed: false, complete: true });
    const res = Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false, headersSent: false, setHeader() {}, end() {} });
    try {
        await assert.rejects(policy.proxy("openai", chat(), req as unknown as IncomingMessage, res as unknown as ServerResponse));
        assert.equal(calls, 0);
        assert.ok(!events.includes("request_allowed"));
    } finally { policy.dispose(); }
});

test("P0 formerly valid tool argument JSON is withheld if a safety-net redaction breaks its syntax", async () => {
    const args = JSON.stringify({ DB_PASSWORD: "api_key=Abc93zyQ14Rk56Tu!More", query: "PUBLIC" });
    const body = { model: "synthetic", messages: [{ role: "assistant", content: null,
        tool_calls: [{ id: "public_id", type: "function", function: { name: "public_tool", arguments: args } }] }] };
    const result = await forward(body);
    assert.equal(result.wires.length, 0);
});
