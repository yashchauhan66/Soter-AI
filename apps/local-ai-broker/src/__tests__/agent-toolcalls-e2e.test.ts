/**
 * Do AI CODING AGENTS still work through the broker?
 *
 * The user's real complaint: "when I use my extension, Claude / opencode don't
 * work properly." The most likely breaker is the message normalizer, which
 * flattens every message to { role, content } — and coding agents live on tool
 * calls (tool_use blocks, tool_calls, tool_result), none of which is plain
 * text content.
 *
 * This file replays the EXACT wire shapes Claude Code, Cline and opencode send,
 * through a real broker to a recording provider, and checks whether the tool
 * calls survive.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { BrokerServer } from "../BrokerServer";

const TOKEN = "test_local_broker_token_0123456789abcdef";

function startRecordingProvider(): Promise<{ server: Server; url: string; received: Array<{ body: string }> }> {
    const received: Array<{ body: string }> = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
            received.push({ body: Buffer.concat(chunks).toString("utf8") });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ id: "msg_ok", type: "message", role: "assistant", content: [{ type: "text", text: "Done." }], model: "claude-3-5-sonnet", stop_reason: "end_turn" }));
        });
    });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, received });
        });
    });
}

async function withRealBroker(options: Partial<ConstructorParameters<typeof BrokerServer>[0]>, run: (baseUrl: string) => Promise<void>): Promise<void> {
    const broker = new BrokerServer({ token: TOKEN, port: 0, ...options });
    const { url } = await broker.start();
    try { await run(url); } finally { await broker.stop(); }
}

function request(baseUrl: string, endpoint: string, init: RequestInit = {}, token = TOKEN): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${endpoint}`, { ...init, headers });
}

describe("Agent tool-call conversations through the broker (Claude Code / Cline / opencode)", () => {
    it("Claude Code (Anthropic): assistant tool_use + user tool_result SURVIVE the broker", async () => {
        const provider = await startRecordingProvider();
        try {
            await withRealBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                // Exact shape Claude Code sends after a tool call:
                // assistant with tool_use block, then user with tool_result.
                const conversation = {
                    model: "claude-3-5-sonnet",
                    max_tokens: 1024,
                    system: "You are a coding agent.",
                    messages: [
                        { role: "user", content: [{ type: "text", text: "list files" }] },
                        {
                            role: "assistant",
                            content: [
                                { type: "text", text: "I will list the files." },
                                { type: "tool_use", id: "toolu_01", name: "Bash", input: { command: "ls -la" } },
                            ],
                        },
                        {
                            role: "user",
                            content: [
                                { type: "tool_result", tool_use_id: "toolu_01", content: "src  package.json  README.md" },
                            ],
                        },
                    ],
                };
                const response = await request(brokerUrl, "/v1/ai/anthropic-compatible/messages", { method: "POST", body: JSON.stringify(conversation) });
                const wire = provider.received[0]?.body ?? "";

                assert.ok(response.status === 200 || response.status === 422 || response.status === 400,
                    `unexpected status ${response.status}: ${await response.text()}`);
                assert.ok(wire.includes("toolu_01"), "the tool_use id was stripped from what the provider received");
                assert.ok(wire.includes('"name":"Bash"') || wire.includes('"name": "Bash"'), "the tool name was stripped");
                assert.ok(wire.includes("tool_result"), "the tool_result block was stripped");
                assert.ok(wire.includes("ls -la"), "the tool arguments were stripped");
            });
        } finally {
            provider.server.close();
        }
    });

    it("Cline/opencode (OpenAI): assistant tool_calls with null content is NOT rejected", async () => {
        const provider = await startRecordingProvider();
        try {
            await withRealBroker({ openAIProviderUrl: `${provider.url}/v1/chat/completions`, providerApiKey: "k" }, async (brokerUrl) => {
                // Exact shape Cline and opencode send: assistant messages carry
                // tool_calls with content: null.
                const conversation = {
                    model: "gpt-4o",
                    messages: [
                        { role: "user", content: "list files" },
                        {
                            role: "assistant",
                            content: null,
                            tool_calls: [
                                { id: "call_01", type: "function", function: { name: "read_file", arguments: "{\"path\":\"src/index.ts\"}" } },
                            ],
                        },
                        { role: "tool", tool_call_id: "call_01", content: "export const x = 1;" },
                    ],
                };
                const response = await request(brokerUrl, "/v1/ai/openai-compatible/chat/completions", { method: "POST", body: JSON.stringify(conversation) });
                const text = await response.text();
                const wire = provider.received[0]?.body ?? "";

                assert.ok(response.status !== 400, `the broker rejected a normal tool-call conversation with 400: ${text.slice(0, 200)}`);
                assert.ok(wire.includes("call_01"), "the tool_call id was stripped from the provider payload");
                assert.ok(wire.includes("read_file"), "the tool name was stripped");
                assert.ok(wire.includes("src/index.ts"), "the tool arguments were stripped");
            });
        } finally {
            provider.server.close();
        }
    });

    it("streaming responses with tool_calls pass through byte-for-byte", async () => {
        // Streaming proxy must relay tool_call deltas unchanged. The provider
        // here streams a fake OpenAI chunk stream.
        const received: Array<{ body: string }> = [];
        const server = createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c as Buffer));
            req.on("end", () => {
                received.push({ body: Buffer.concat(chunks).toString("utf8") });
                res.setHeader("content-type", "text/event-stream; charset=utf-8");
                res.write('data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_s1","type":"function","function":{"name":"Bash","arguments":"{\\"command\\":"}}]}}}]}\n\n');
                res.write('data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ls -la\\"}"}}]}}]}\n\n');
                res.write("data: [DONE]\n\n");
                res.end();
            });
        });
        await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
        const providerUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        try {
            await withRealBroker({ openAIProviderUrl: `${providerUrl}/v1/chat/completions`, providerApiKey: "k" }, async (brokerUrl) => {
                const response = await request(brokerUrl, "/v1/ai/openai-compatible/chat/completions", {
                    method: "POST",
                    body: JSON.stringify({
                        model: "gpt-4o",
                        stream: true,
                        messages: [{ role: "user", content: "run ls -la" }],
                    }),
                });
                assert.strictEqual(response.status, 200);
                const text = await response.text();
                assert.ok(text.includes("call_s1"), "streaming tool_call id was dropped");
                assert.ok(text.includes('"name":"Bash"'), "streaming tool name was dropped");
                assert.ok(text.includes("ls -la"), "streaming tool arguments were dropped");
                assert.ok(text.includes("data: [DONE]"), "stream did not terminate with [DONE]");
            });
        } finally {
            server.close();
        }
    });
});
