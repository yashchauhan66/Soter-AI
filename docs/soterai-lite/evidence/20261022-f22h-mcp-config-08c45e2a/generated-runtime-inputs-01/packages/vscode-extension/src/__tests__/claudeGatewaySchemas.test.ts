import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayBoundary } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const VALUE = "TEST_ONLY_F19_REGISTERED_TOOL_METADATA";
const nativeTools = () => JSON.parse(readFileSync(join(__dirname, "fixtures/claude-tools-2.1.301-01.json"), "utf8"));
const body = () => ({ model: "claude-sonnet-4-6", max_tokens: 4096, stream: true, system: [{ type: "text", text: "Public synthetic system" }], messages: [{ role: "user", content: [{ type: "text", text: "Public synthetic request" }] }], thinking: { type: "disabled" }, output_config: { effort: "high" }, tools: nativeTools() });
const boundary = (enabled = true) => new GatewayBoundary({ values: [VALUE], version: 1, claudeToolSchemas: enabled } as any);
const sensitive = (error: unknown) => (error as { code?: string }).code === "gateway_sensitive";
test("F19 actual default26 Claude tools and manual text controls pass only their declared protocol profile", () => {
    const request = body(); assert.deepEqual(JSON.parse(boundary().prepareRequest("anthropic", request).canonical), request);
    assert.throws(() => boundary(false).prepareRequest("anthropic", request));
    assert.throws(() => new GatewayBoundary({ values: [VALUE], version: 1, clineToolSchemas: true }).prepareRequest("anthropic", request));
});
test("F19 registered originals and encodings in native schema metadata are withheld", () => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex")]) {
        const request = body(); request.tools[1].description = value;
        assert.throws(() => boundary().prepareRequest("anthropic", request), sensitive);
    }
    const request = body(); request.tools = [request.tools[0]]; request.tools[0].name = VALUE.slice(0, 16); request.tools[0].description = VALUE.slice(16);
    assert.throws(() => boundary().prepareRequest("anthropic", request), sensitive);
});
test("F19 ordinary metadata remains inspected and bounded", () => {
    assert.throws(() => boundary().prepareRequest("anthropic", { ...body(), metadata: { user_id: VALUE } }), sensitive);
    assert.throws(() => boundary().prepareRequest("anthropic", { ...body(), metadata: Object.fromEntries(Array.from({ length: 33 }, (_, i) => ["field" + i, "public"])) }));
});
test("F19 unsupported model controls, tool definitions, images and resource overflow remain withheld", () => {
    for (const request of [
        { ...body(), thinking: { type: "adaptive" } },
        { ...body(), output_config: { effort: "high", raw: true } },
        { ...body(), safeguards: [] },
        { ...body(), context_management: {} },
        { ...body(), tools: [...nativeTools(), ...nativeTools()] },
        { ...body(), tools: [{ name: "public", description: "P".repeat(16385), input_schema: {} }] },
        { ...body(), tools: [{ name: "public", input_schema: {}, raw: true }] },
        { ...body(), tools: [{ name: "public", input_schema: [] }] },
        { ...body(), tools: [{ name: "public", input_schema: { properties: Object.fromEntries(Array.from({ length: 520 }, (_, i) => ["field" + i, { type: "string" }])) } }] },
        { ...body(), messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", data: "AA==" } }] }] },
    ]) assert.throws(() => boundary().prepareRequest("anthropic", request));
});
test("F19 profile supports empty/ordinary Anthropic tool lists without relaxing the OpenAI profile", () => {
    const request = { ...body(), tools: [] }; assert.deepEqual(JSON.parse(boundary().prepareRequest("anthropic", request).canonical), request);
    const openai = { messages: [{ role: "user", content: "Public" }], tools: Array.from({ length: 10 }, (_, i) => ({ type: "function", function: { name: "public_" + i, parameters: { type: "object", properties: { path: { type: "string" } } } } })) };
    assert.throws(() => boundary().prepareRequest("openai", openai));
});
