/**
 * WIRE-EGRESS INVARIANT — what actually leaves the broker on the socket.
 *
 * Every other broker test asserts on a *decision object*. This file asserts on
 * the BYTES the provider received. That difference is the whole point: the scan
 * runs on a flattened copy of the request, but the body that is forwarded is
 * rebuilt from the ORIGINAL fields. Any field the rebuild copies straight
 * through is scanned-but-never-redacted, and the broker still stamps
 * `x-soterai-request-decision: redact` on the response.
 *
 * The invariant these tests pin down:
 *   No high-risk secret class may appear in the serialized outbound body,
 *   whatever route, decision, or field carried it.
 *
 * Every credential below is SYNTHETIC — correct shape, random value, never a
 * real key.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { BrokerServer } from "../BrokerServer";

const TOKEN = "test_local_broker_token_0123456789abcdef";

/** Synthetic, same-shape-only credentials. */
const SK48 = `sk-${"Qv7mTb2LxK9dR4hZ8sN6pW3yJ1cF5gA0uE7iO2rY4tXn"}`;
const GHP = `ghp_${"Xk9mQ2vR7tW4yZ6nC1pL8sD3fG5hJ8bV"}`;

interface Recorder { server: Server; url: string; received: string[] }

function startRecordingProvider(streaming = false): Promise<Recorder> {
    const received: string[] = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
            received.push(Buffer.concat(chunks).toString("utf8"));
            if (streaming) {
                res.setHeader("content-type", "text/event-stream");
                res.write(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Done." } })}\n\n`);
                res.write("data: [DONE]\n\n");
                res.end();
                return;
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({
                id: "msg_ok", type: "message", role: "assistant",
                content: [{ type: "text", text: "Done." }],
                choices: [{ message: { role: "assistant", content: "Done." } }],
                model: "test-model", stop_reason: "end_turn",
            }));
        });
    });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, received });
        });
    });
}

async function withBroker(
    options: Partial<ConstructorParameters<typeof BrokerServer>[0]>,
    run: (baseUrl: string) => Promise<void>,
): Promise<void> {
    const broker = new BrokerServer({ token: TOKEN, port: 0, ...options });
    const { url } = await broker.start();
    try { await run(url); } finally { await broker.stop(); }
}

function post(baseUrl: string, endpoint: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

/** Assert the secret never reached the provider, and say where it did if it did. */
function assertNoSecretOnWire(received: string[], secret: string, label: string): void {
    const leaked = received.filter((b) => b.includes(secret));
    assert.equal(
        leaked.length, 0,
        `${label}: the raw secret reached the provider in ${leaked.length}/${received.length} outbound body(ies). ` +
        `The broker forwarded a field it scanned but never redacted.`,
    );
}

/**
 * A "no secret on the wire" assertion passes trivially when nothing was sent at
 * all — a 404, a misrouted path, a broker that refused for an unrelated reason.
 * These two helpers force each test to state WHICH outcome it expects, so a
 * silently-not-forwarded request can never be mistaken for a working guard.
 */
function assertRedactedAndForwarded(received: string[], secret: string, label: string): void {
    assert.equal(received.length, 1, `${label}: expected exactly one forwarded body, got ${received.length}`);
    assertNoSecretOnWire(received, secret, label);
    assert.ok(
        received[0].includes("[REDACTED_"),
        `${label}: body was forwarded without the secret but also without a redaction placeholder — ` +
        "the field was probably dropped rather than redacted",
    );
}

async function assertBlockedAtEgress(res: Response, received: string[], label: string): Promise<void> {
    assert.equal(received.length, 0, `${label}: the provider was called despite the egress block`);
    assert.equal(res.status, 422, `${label}: expected 422, got ${res.status}`);
    const body = await res.json() as { error?: { code?: string; details?: { survivingSecretClasses?: string[] } } };
    assert.equal(body.error?.code, "egress_secret_blocked", `${label}: wrong error code ${body.error?.code}`);
    assert.ok(
        (body.error?.details?.survivingSecretClasses ?? []).length > 0,
        `${label}: the block did not name the surviving secret class`,
    );
}

describe("Wire egress invariant: no raw secret may leave the broker", () => {
    it("Anthropic: a secret in `system` must not reach the provider", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/anthropic-compatible/messages", {
                    model: "test-model",
                    max_tokens: 64,
                    system: `You are a coding agent. Deploy key: ${SK48}`,
                    messages: [{ role: "user", content: "refactor this function" }],
                });
                // The request is forwardable (decision=redact), so the provider
                // was called — that is exactly the leak window.
                assert.ok(res.status < 400 || res.status === 422, `unexpected broker status ${res.status}`);
                assertRedactedAndForwarded(provider.received, SK48, "anthropic system field");
            });
        } finally { provider.server.close(); }
    });

    it("Anthropic streaming: a secret in `system` must not reach the provider", async () => {
        const provider = await startRecordingProvider(true);
        try {
            await withBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/anthropic-compatible/messages", {
                    model: "test-model",
                    max_tokens: 64,
                    stream: true,
                    system: `Internal runbook. Token: ${GHP}`,
                    messages: [{ role: "user", content: "summarise the runbook" }],
                });
                await res.text();
                assertRedactedAndForwarded(provider.received, GHP, "anthropic streaming system field");
            });
        } finally { provider.server.close(); }
    });

    it("OpenAI: a secret in tool_calls[].function.arguments must not reach the provider", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ openAIProviderUrl: `${provider.url}/v1/chat/completions`, providerApiKey: "k" }, async (brokerUrl) => {
                await post(brokerUrl, "/v1/ai/openai-compatible/chat/completions", {
                    model: "test-model",
                    messages: [
                        { role: "user", content: "deploy the service" },
                        {
                            role: "assistant",
                            content: null,
                            tool_calls: [{
                                id: "call_1", type: "function",
                                // normalizeMessages DOES scan these args, so they
                                // drive the redact decision — but nothing redacts them.
                                function: { name: "deploy", arguments: JSON.stringify({ api_key: SK48 }) },
                            }],
                        },
                    ],
                });
                assertRedactedAndForwarded(provider.received, SK48, "openai tool_calls arguments");
            });
        } finally { provider.server.close(); }
    });

    it("A secret in an unscanned passthrough field is BLOCKED at the wire", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/anthropic-compatible/messages", {
                    model: "test-model",
                    max_tokens: 64,
                    // `{ ...body }` copies every unknown key straight to the wire.
                    // We cannot safely rewrite a field of unknown shape, so the
                    // honest answer is to refuse the request, not to forward it.
                    metadata: { deploy_token: GHP },
                    messages: [{ role: "user", content: "hello" }],
                });
                await assertBlockedAtEgress(res, provider.received, "unscanned metadata field");
            });
        } finally { provider.server.close(); }
    });

    it("The egress guard is wired on the OpenAI route too, not just Anthropic", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ openAIProviderUrl: `${provider.url}/v1/chat/completions`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/openai-compatible/chat/completions", {
                    model: "test-model",
                    metadata: { deploy_token: GHP },
                    messages: [{ role: "user", content: "hello" }],
                });
                await assertBlockedAtEgress(res, provider.received, "openai passthrough field");
            });
        } finally { provider.server.close(); }
    });

    it("HONESTY: whenever the response says `redact`, the wire must actually be redacted", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/anthropic-compatible/messages", {
                    model: "test-model",
                    max_tokens: 64,
                    system: `key=${SK48}`,
                    messages: [{ role: "user", content: "hi" }],
                });
                const claimed = res.headers.get("x-soterai-request-decision");
                assert.equal(claimed, "redact", `expected a redact decision, got ${claimed}`);
                // The header is a claim about what was done. Check it against
                // the bytes, not against the decision object that produced it.
                assertRedactedAndForwarded(provider.received, SK48, `claimed decision "${claimed}"`);
            });
        } finally { provider.server.close(); }
    });

    it("CONTROL: a clean request still reaches the provider unchanged", async () => {
        const provider = await startRecordingProvider();
        try {
            await withBroker({ anthropicProviderUrl: `${provider.url}/v1/messages`, providerApiKey: "k" }, async (brokerUrl) => {
                const res = await post(brokerUrl, "/v1/ai/anthropic-compatible/messages", {
                    model: "test-model",
                    max_tokens: 64,
                    system: "You are a helpful coding assistant.",
                    messages: [{ role: "user", content: "explain this loop" }],
                });
                assert.equal(res.status, 200, "a clean request must not be blocked");
                assert.equal(provider.received.length, 1, "the clean request must be forwarded");
                const sent = JSON.parse(provider.received[0]) as Record<string, unknown>;
                assert.equal(sent.system, "You are a helpful coding assistant.", "clean system prompt was altered");
                assert.equal(sent.model, "test-model", "clean model field was altered");
            });
        } finally { provider.server.close(); }
    });
});
