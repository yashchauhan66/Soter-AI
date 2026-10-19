import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayBoundary, GatewayPolicyError } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const tools = JSON.parse(readFileSync(join(__dirname, "fixtures/claude-tools-2.1.301-01.json"), "utf8"));
const secret = "TEST_ONLY_F19_PRIVATE_CONVERSATION_VALUE";
const counter = (value: unknown): number => typeof value === "string" ? 1 : Array.isArray(value) ? value.reduce((n, item) => n + counter(item), 0) : value && typeof value === "object" ? Object.values(value).reduce<number>((n, item) => n + counter(item), 0) : 0;
function conversation(): any {
    const messages: any[] = [{ role: "user", content: Array.from({ length: 8 }, (_, index) => ({ type: "text", text: "Public synthetic context " + index,
        ...(index === 7 ? { cache_control: { type: "ephemeral", scope: "global" } } : {}) })) }];
    const body: any = { model: "synthetic", messages, system: [{ type: "text", text: "Public system" }, { type: "text", text: "Public instructions", cache_control: { type: "ephemeral", scope: "global" } }],
        metadata: { user_id: "synthetic" }, thinking: { type: "disabled" }, output_config: { effort: "high" }, tool_choice: { type: "auto" }, tools };
    assert.equal(counter({ ...body, tools: undefined }), 30);
    delete messages[0].content[7].cache_control;
    messages.push({ role: "assistant", content: [{ type: "tool_use", id: "toolu_synthetic", name: "Read", input: { file_path: "D:/synthetic/project/public.txt" } }] });
    messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_synthetic", content: "Public synthetic file contents", cache_control: { type: "ephemeral", scope: "global" } }] });
    assert.equal(counter({ ...body, tools: undefined }), 39); return body;
}
const boundary = (enabled = true) => new GatewayBoundary({ values: [secret], version: 1, claudeToolSchemas: enabled });
test("F19-GT01 observed 30-to-39 string public native tool conversation remains inspected and usable", () => {
    const b = boundary(); try { const input = conversation(); assert.deepEqual(JSON.parse(b.prepareRequest("anthropic", input).canonical), input); } finally { b.dispose(); }
});
test("F19-GT02 native tool result, tool identifier and split public-text carriers retain exact matching", () => {
    for (const place of ["result", "id", "split"]) {
        const b = boundary(), input = conversation();
        if (place === "result") input.messages[2].content[0].content = secret;
        else if (place === "id") input.messages[1].content[0].id = secret;
        else { input.messages[0].content[0].text = secret.slice(0, 20); input.messages[0].content[1].text = secret.slice(20); }
        try { assert.throws(() => b.prepareRequest("anthropic", input), (error: unknown) => error instanceof GatewayPolicyError && error.code === "gateway_sensitive"); } finally { b.dispose(); }
    }
});
test("F19-GT03 33 ordinary content strings still exceed the original content budget", () => {
    const b = boundary(); try { assert.throws(() => b.prepareRequest("anthropic", { messages: [{ role: "user", content: Array.from({ length: 33 }, () => ({ type: "text", text: "Public" })) }], tools: [] }),
        (error: unknown) => error instanceof GatewayPolicyError && error.code === "gateway_limit"); } finally { b.dispose(); }
});
test("F19-GT04 only fixed validated protocol literals receive their separate bounded count", () => {
    const b = boundary();
    try {
        assert.doesNotThrow(() => b.prepareRequest("anthropic", { messages: Array.from({ length: 128 }, () => ({ role: "user", content: null })), tools: [] }));
        assert.throws(() => b.prepareRequest("anthropic", { messages: Array.from({ length: 129 }, () => ({ role: "user", content: null })), tools: [] }),
            (error: unknown) => error instanceof GatewayPolicyError && error.code === "gateway_limit");
        assert.throws(() => b.prepareRequest("anthropic", { messages: [{ role: "user", content: [{ type: "text", text: "Public", extra: secret }] }], tools: [] }));
    } finally { b.dispose(); }
});
test("F19-GT05 ordinary F16/F18 and disabled-Claude limits do not gain protocol-literal allowances", () => {
    const input = { messages: Array.from({ length: 33 }, () => ({ role: "user", content: null })), tools: [] };
    for (const provider of ["openai", "anthropic"] as const) {
        const b = boundary(false); try { assert.throws(() => b.prepareRequest(provider, input)); } finally { b.dispose(); }
    }
});
