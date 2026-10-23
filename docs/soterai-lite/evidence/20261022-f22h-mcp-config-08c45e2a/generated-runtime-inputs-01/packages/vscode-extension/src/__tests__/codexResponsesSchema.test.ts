import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayBoundary, GatewayPolicyError } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const VALUE = "TEST_ONLY_F20A_RESPONSES_REGISTERED_VALUE";
const route = "codex" as never;
const fixture = (n = 1): any => JSON.parse(readFileSync(join(__dirname, `fixtures/codex-cli-0.160.1-request-${n}.json`), "utf8"));
const output = (n = 2) => readFileSync(join(__dirname, `fixtures/codex-cli-0.160.1-output-${n}.sse.txt`), "utf8");
const boundary = (enabled = true) => new GatewayBoundary({ version: 1, values: [VALUE], codexResponses: enabled } as never);
const code = (expected: string) => (e: unknown) => e instanceof GatewayPolicyError && e.code === expected;
test("F20A Responses accepts actual pinned public request and replayed MCP result without changing body", () => {
    for (const n of [1, 2]) { const body = fixture(n); assert.deepEqual(JSON.parse(boundary().prepareRequest(route, body).canonical), body); }
});
test("F20A Responses remains capability-scoped and does not relax chat schemas", () => {
    assert.throws(() => boundary(false).prepareRequest(route, fixture()), code("gateway_policy_unknown"));
    assert.throws(() => boundary().prepareRequest("openai", fixture()), code("gateway_schema_unsupported"));
});
for (const carrier of ["instructions", "text", "arguments", "output", "metadata", "tool-description", "tool-parameters", "cache-key"])
    test("F20A Responses registered original withheld in " + carrier, () => {
        const body = fixture(2);
        if (carrier === "instructions") body.instructions = VALUE;
        if (carrier === "text") body.input[0].content[0].text = VALUE;
        if (carrier === "arguments") body.input.find((p: any) => p.type === "function_call").arguments = JSON.stringify({ path: VALUE });
        if (carrier === "output") body.input.find((p: any) => p.type === "function_call_output").output[0].text = VALUE;
        if (carrier === "metadata") body.client_metadata.session_id = VALUE;
        if (carrier === "tool-description") body.tools[0].description = VALUE;
        if (carrier === "tool-parameters") body.tools[0].parameters.properties[VALUE] = { type: "string" };
        if (carrier === "cache-key") body.prompt_cache_key = VALUE;
        assert.throws(() => boundary().prepareRequest(route, body), code("gateway_sensitive"));
    });
test("F20A Responses encoded and ordered split carriers are withheld", () => {
    for (const value of [Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex"), [...VALUE].map(c => "%" + c.charCodeAt(0).toString(16)).join("")]) {
        const body = fixture(); body.input[0].content[0].text = value; assert.throws(() => boundary().prepareRequest(route, body), code("gateway_sensitive"));
    }
    const body = fixture(); body.input = [{ type: "message", role: "user", content: [{ type: "input_text", text: VALUE.slice(0, 19) }, { type: "input_text", text: VALUE.slice(19) }] }];
    assert.throws(() => boundary().prepareRequest(route, body), code("gateway_sensitive"));
});
test("F20A Responses unknown routes, server state, images, encrypted replay and tools are refused", () => {
    const variants = [
        { previous_response_id: "resp_public" }, { background: true }, { store: true }, { stream: false }, { include: ["unknown"] },
        { input: [{ type: "message", role: "user", content: [{ type: "input_image", image_url: "http://127.0.0.1/image" }] }] },
        { input: [{ type: "reasoning", encrypted_content: "opaque" }] }, { tools: [{ type: "web_search" }] },
        { tools: [{ type: "function", name: "public", parameters: {}, unknown: true }] },
        { client_metadata: { raw: {} } }, { reasoning: { effort: "high", unknown: true } }, { tool_choice: { type: "function", name: "other" } },
    ];
    for (const extra of variants) assert.throws(() => boundary().prepareRequest(route, { ...fixture(), ...extra }), code("gateway_schema_unsupported"));
});
test("F20A Responses original numerical byte/string/content/tool limits remain bounded", () => {
    const tooMany = fixture(); tooMany.input = [{ type: "message", role: "user", content: Array.from({ length: 33 }, () => ({ type: "input_text", text: "Public" })) }];
    assert.throws(() => boundary().prepareRequest(route, tooMany), code("gateway_limit"));
    const huge = fixture(); huge.instructions = "P".repeat(131073); assert.throws(() => boundary().prepareRequest(route, huge), code("gateway_limit"));
    const tools = fixture(); tools.tools = Array.from({ length: 33 }, () => ({ type: "function", name: "public", parameters: {} }));
    assert.throws(() => boundary().prepareRequest(route, tools), code("gateway_schema_unsupported"));
});
test("F20A Responses accepts actual namespaced function call and completed text SSE", () => {
    for (const n of [1, 2]) { const wire = output(n), inspected = boundary().inspectResponse(route, [Buffer.from(wire)], true); assert.equal(inspected.wire, wire); }
});
test("F20A Responses output originals, escaped values and split deltas are withheld before release", () => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64"), [...VALUE].map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("")]) {
        const wire = output().replaceAll("F20_SYNTHETIC_DONE", value);
        assert.throws(() => boundary().inspectResponse(route, [Buffer.from(wire)], true), code("gateway_output_withheld"));
    }
    const event = (delta: string) => 'event: response.output_text.delta\ndata: ' + JSON.stringify({ type: "response.output_text.delta", item_id: "msg_f20", output_index: 0, content_index: 0, delta }) + '\n\n';
    const wire = output().replace('event: response.output_text.done', event(VALUE.slice(0, 19)) + event(VALUE.slice(19)) + 'event: response.output_text.done');
    assert.throws(() => boundary().inspectResponse(route, [Buffer.from(wire)], true), code("gateway_output_withheld"));
});
test("F20A Responses missing completion, failure, trailing event, mismatched framing and unknown item are withheld", () => {
    const variants = [output().replaceAll("response.completed", "response.failed"), output().slice(0, output().lastIndexOf("event: response.completed")), output() + 'data: [DONE]\n\n', output().replace('event: response.created', 'event: response.failed'), output().replaceAll('"type":"output_text"', '"type":"image"')];
    for (const wire of variants) assert.throws(() => boundary().inspectResponse(route, [Buffer.from(wire)], true), code("gateway_output_withheld"));
});
test("F20A Responses revocation withholds both input and output", () => {
    const b = boundary(); b.dispose(); assert.throws(() => b.prepareRequest(route, fixture())); assert.throws(() => b.inspectResponse(route, [Buffer.from(output())], true), code("gateway_output_withheld"));
});
