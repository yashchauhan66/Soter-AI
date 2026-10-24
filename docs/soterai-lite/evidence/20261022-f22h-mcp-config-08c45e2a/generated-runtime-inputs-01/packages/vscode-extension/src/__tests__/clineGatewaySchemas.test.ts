import assert from "node:assert/strict";
import { test } from "node:test";
import { GatewayBoundary } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const VALUE = "TEST_ONLY_F18_REGISTERED_GATEWAY_VALUE";
const tools = () => Array.from({ length: 10 }, (_, index) => ({ type: "function", function: { name: "public_tool_" + index, description: "Public synthetic tool", parameters: { type: "object", properties: { path: { type: "string", description: "Public relative path" }, text: { type: "string", description: "Public text" } }, required: ["path"], additionalProperties: false } } }));
const body = () => ({ model: "fixture", stream: true, messages: [{ role: "user", content: "Public tool request" }], tools: tools() });
const boundary = (enabled = true) => new GatewayBoundary({ values: [VALUE], version: 1, clineToolSchemas: enabled } as any);
test("F18 enabled schema profile preserves ordinary public requests and an empty tool list", () => {
    for (const request of [{ messages: [{ role: "user", content: "Public ordinary request" }] }, { messages: [{ role: "user", content: "Public ordinary request" }], tools: [] }]) assert.deepEqual(JSON.parse(boundary().prepareRequest("openai", request).canonical), request);
});
test("F18 bounded multi-tool schema public request passes only its explicit profile", () => {
    const request = body(); assert.deepEqual(JSON.parse(boundary().prepareRequest("openai", request).canonical), request);
    assert.throws(() => boundary(false).prepareRequest("openai", request));
});
test("F18 tool metadata remains inspected for raw/encoded values and ordered splits", () => {
    const sensitive = (error: unknown) => (error as { code?: string }).code === "gateway_sensitive";
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex")]) { const request = body(); request.tools[8].function.description = value; assert.throws(() => boundary().prepareRequest("openai", request), sensitive); }
    const request = body(); request.tools = [request.tools[0]]; request.tools[0].function.name = VALUE.slice(0, 16); request.tools[0].function.description = VALUE.slice(16); assert.throws(() => boundary().prepareRequest("openai", request), sensitive);
});
test("F18 schema profile keeps generic metadata, malformed definitions and resource bounds withheld", () => {
    for (const request of [
        { ...body(), metadata: Object.fromEntries(Array.from({ length: 33 }, (_, index) => ["field" + index, "public"])) },
        { ...body(), tools: [...tools(), ...tools(), ...tools(), ...tools()] },
        { ...body(), tools: [{ type: "unknown", function: { name: "public" } }] },
        { ...body(), tools: [{ type: "function", function: { name: "public", parameters: {}, raw: true } }] },
        { ...body(), tools: [{ type: "function", function: { name: "public", parameters: {}, description: "P".repeat(16385) } }] },
        { ...body(), tools: [{ type: "function", function: { name: "public", parameters: { properties: Object.fromEntries(Array.from({ length: 520 }, (_, index) => ["field" + index, { type: "string" }])) } } }] },
    ]) assert.throws(() => boundary().prepareRequest("openai", request));
});
