import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayBoundary, GatewayPolicyError } from "../../../../apps/local-ai-broker/src/GatewayBoundary";

const VALUE = "TEST_ONLY_F20C_REGISTERED_PRIVATE_VALUE";
const NAME = "mcp_soterai_safe_read_soterai_read_project_file_safely";
const provider = "gemini" as never;
const fixture = (n = 1): any => ({ ...JSON.parse(readFileSync(join(__dirname, `fixtures/gemini-cli-0.55.1-request-${n}.json`), "utf8")), model: "gemini-3.5-flash", stream: true });
const boundary = (enabled = true) => new GatewayBoundary({ version: 1, values: [VALUE], geminiGenerateContent: enabled } as never);
const code = (expected: string) => (error: unknown) => error instanceof GatewayPolicyError && error.code === expected;
const event = (parts: any[], terminal = true, extra: any = {}) => 'data: ' + JSON.stringify({ candidates: [{ content: { role: "model", parts }, ...(terminal ? { finishReason: "STOP" } : {}), index: 0 }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }, modelVersion: "gemini-3.5-flash", responseId: "public_response", ...extra }) + "\n\n";
const output = () => event([{ text: "PUBLIC_GEMINI_DONE" }]);

test("F20C native GenerateContent public and actual paired MCP request bodies retain exact canonical content", () => {
    for (const n of [1, 2]) { const body = fixture(n); assert.deepEqual(JSON.parse(boundary().prepareRequest(provider, body).canonical), body); }
});

test("F20C observed native denied safe-read result can complete as paired inspected error text", () => {
    const body = fixture(2), observed = JSON.parse(readFileSync(join(__dirname, "fixtures/gemini-cli-0.55.1-cancel-result.json"), "utf8"));
    body.contents[1].parts[0].functionCall.id = observed.functionResponse.id; body.contents[2].parts[0] = observed;
    assert.deepEqual(JSON.parse(boundary().prepareRequest(provider, body).canonical), body);
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64")]) {
        const changed = structuredClone(body); changed.contents[2].parts[0].functionResponse.response.error = value;
        assert.throws(() => boundary().prepareRequest(provider, changed), code("gateway_sensitive"));
    }
    for (const response of [{ error: "PUBLIC", output: "PUBLIC" }, { error: {} }, { error: "PUBLIC", original: "PUBLIC" }]) {
        const changed = structuredClone(body); changed.contents[2].parts[0].functionResponse.response = response;
        assert.throws(() => boundary().prepareRequest(provider, changed), code("gateway_schema_unsupported"));
    }
});
test("F20C Gemini capability mutation refuses while earlier provider schemas remain strict", () => {
    assert.throws(() => boundary(false).prepareRequest(provider, fixture()), code("gateway_policy_unknown"));
    assert.throws(() => boundary().prepareRequest("openai", fixture()), code("gateway_schema_unsupported"));
    assert.throws(() => boundary(false).inspectResponse(provider, [Buffer.from(output())], true), code("gateway_output_withheld"));
});
for (const carrier of ["system", "text", "arguments", "result", "description", "schema-description"])
    test("F20C registered original withheld in " + carrier, () => {
        const body = fixture(2);
        if (carrier === "system") body.systemInstruction.parts[0].text = VALUE;
        if (carrier === "text") body.contents[0].parts[0].text = VALUE;
        if (carrier === "arguments") body.contents[1].parts[0].functionCall.args.path = VALUE;
        if (carrier === "result") body.contents[2].parts[0].functionResponse.response.output = VALUE;
        if (carrier === "description") body.tools[0].functionDeclarations[0].description = VALUE;
        if (carrier === "schema-description") body.tools[0].functionDeclarations[0].parametersJsonSchema.properties.path.description = VALUE;
        assert.throws(() => boundary().prepareRequest(provider, body), code("gateway_sensitive"));
    });
test("F20C registered encoded and ordered split text carriers are withheld", () => {
    for (const value of [Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex"), [...VALUE].map(char => "%" + char.charCodeAt(0).toString(16)).join("")]) {
        const body = fixture(); body.contents[0].parts[0].text = value; assert.throws(() => boundary().prepareRequest(provider, body), code("gateway_sensitive"));
    }
    const body = fixture(); body.contents[0].parts = [{ text: VALUE.slice(0, 17) }, { text: VALUE.slice(17) }];
    assert.throws(() => boundary().prepareRequest(provider, body), code("gateway_sensitive"));
});
for (const [name, mutate] of Object.entries<Record<string, (body: any) => any>[string]>({
    "image": (b: any) => b.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: "PUBLIC" } }),
    "file": (b: any) => b.contents[0].parts.push({ fileData: { fileUri: "file:///PUBLIC" } }),
    "opaque signature": (b: any) => b.contents[1].parts[0].thoughtSignature = "opaque_base64_state",
    "unknown part": (b: any) => b.contents[0].parts[0].unknown = "PUBLIC",
    "server cache": (b: any) => b.cachedContent = "PUBLIC",
    "alternate tool": (b: any) => b.tools[0].functionDeclarations[0].name = "run_shell_command",
    "unknown arguments": (b: any) => b.contents[1].parts[0].functionCall.args.original = "PUBLIC",
    "orphan response": (b: any) => b.contents[2].parts[0].functionResponse.id = "unpaired",
    "duplicate call": (b: any) => b.contents.splice(2, 0, structuredClone(b.contents[1])),
    "unsupported result": (b: any) => b.contents[2].parts[0].functionResponse.response.blob = "PUBLIC",
    "missing stream": (b: any) => delete b.stream,
    "wrong model": (b: any) => b.model = "../override",
    "unknown generation": (b: any) => b.generationConfig.unknown = true,
    "nonfinite number": (b: any) => b.generationConfig.temperature = Infinity,
})) test("F20C unsupported request withheld: " + name, () => { const body = fixture(2); mutate(body); assert.throws(() => boundary().prepareRequest(provider, body), code("gateway_schema_unsupported")); });
test("F20C text budget remains32 while typed protocol/tool metadata remains separately bounded", () => {
    const body = fixture(); body.contents[0].parts = Array.from({ length: 33 }, () => ({ text: "Public" }));
    assert.throws(() => boundary().prepareRequest(provider, body), code("gateway_limit"));
});
test("F20C completed public text and safe-function SSE are accepted, complete-buffered", () => {
    for (const wire of [output(), event([{ functionCall: { name: NAME, args: { path: ".env" } } }]), event([{ text: "PUBLIC_" }], false) + event([{ text: "DONE" }])])
        assert.equal(boundary().inspectResponse(provider, [Buffer.from(wire)], true).wire, wire);
});
for (const carrier of ["text", "function-arguments", "metadata", "encoded", "split-deltas"])
    test("F20C output withheld before any release: " + carrier, () => {
        const wire = carrier === "function-arguments" ? event([{ functionCall: { name: NAME, args: { path: VALUE } } }])
            : carrier === "metadata" ? event([{ text: "PUBLIC" }], true, { responseId: VALUE })
            : carrier === "encoded" ? event([{ text: Buffer.from(VALUE).toString("base64") }])
            : carrier === "split-deltas" ? event([{ text: VALUE.slice(0, 17) }], false) + event([{ text: VALUE.slice(17) }])
            : event([{ text: VALUE }]);
        assert.throws(() => boundary().inspectResponse(provider, [Buffer.from(wire)], true), code("gateway_output_withheld"));
    });
test("F20C incomplete, error, unknown, opaque or trailing SSE is withheld", () => {
    const variants = [event([{ text: "PUBLIC" }], false), output().slice(0, -1), output() + output(), output() + "data: [DONE]\n\n", output().replace('"STOP"', '"MAX_TOKENS"'), event([{ text: "PUBLIC", thoughtSignature: "opaque" }]), event([{ inlineData: { data: "PUBLIC" } }]), event([{ functionCall: { name: "run_shell_command", args: {} } }]), 'data: {"error":{"message":"PUBLIC"}}\n\n'];
    for (const wire of variants) assert.throws(() => boundary().inspectResponse(provider, [Buffer.from(wire)], true), code("gateway_output_withheld"));
    assert.throws(() => boundary().inspectResponse(provider, [Buffer.from(output())], false), code("gateway_output_withheld"));
});
test("F20C gateway revocation withholds current Gemini input/output", () => {
    const b = boundary(); b.dispose(); assert.throws(() => b.prepareRequest(provider, fixture()));
    assert.throws(() => b.inspectResponse(provider, [Buffer.from(output())], true), code("gateway_output_withheld"));
});
test("F20C dangling event metadata after a complete Gemini or Codex stream is withheld", () => {
    const codex = readFileSync(join(__dirname, "fixtures/codex-cli-0.160.1-output-2.sse.txt"), "utf8");
    const b = new GatewayBoundary({ version: 1, values: [VALUE], geminiGenerateContent: true, codexResponses: true });
    assert.throws(() => b.inspectResponse(provider, [Buffer.from(output() + "event: trailing\n\n")], true), code("gateway_output_withheld"));
    assert.throws(() => b.inspectResponse("codex", [Buffer.from(codex + "event: response.created\n\n")], true), code("gateway_output_withheld"));
});
