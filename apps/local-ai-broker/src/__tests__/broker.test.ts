import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateCanary } from "@soterai/guard-core";
import { BrokerServer } from "../BrokerServer";

const TOKEN = "test_local_broker_token_0123456789abcdef";

async function withBroker(
    options: Partial<ConstructorParameters<typeof BrokerServer>[0]>,
    run: (baseUrl: string, broker: BrokerServer) => Promise<void>,
): Promise<void> {
    const broker = new BrokerServer({ token: TOKEN, port: 0, ...options });
    const { url } = await broker.start();
    try { await run(url, broker); } finally { await broker.stop(); }
}

function request(baseUrl: string, endpoint: string, init: RequestInit = {}, token = TOKEN): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${endpoint}`, { ...init, headers });
}

describe("Local AI Broker server", () => {
    it("binds to 127.0.0.1 and exposes unauthenticated health only", async () => {
        await withBroker({}, async (url, broker) => {
            assert.match(url, /^http:\/\/127\.0\.0\.1:/);
            assert.equal(broker.address().host, "127.0.0.1");
            const health = await request(url, "/health", {}, "");
            assert.equal(health.status, 200);
            assert.equal((await health.json() as { localOnly: boolean }).localOnly, true);
            assert.equal((await request(url, "/version", {}, "")).status, 401);
        });
    });

    it("rejects unauthenticated scans and accepts authenticated scans", async () => {
        await withBroker({}, async (url) => {
            const body = JSON.stringify({ content: "explain this TypeScript function" });
            assert.equal((await request(url, "/v1/scan", { method: "POST", body }, "")).status, 401);
            const response = await request(url, "/v1/scan", { method: "POST", body });
            assert.equal(response.status, 200);
            assert.equal((await response.json() as { decision: string }).decision, "allow");
        });
    });

    it("blocks a registered canary and never returns the token", async () => {
        const canary = await generateCanary();
        await withBroker({ canaries: [canary] }, async (url) => {
            const response = await request(url, "/v1/scan", { method: "POST", body: JSON.stringify({ content: `debug ${canary.token}` }) });
            const text = await response.text();
            assert.equal(response.status, 200);
            assert.equal(text.includes(canary.token), false);
            assert.equal((JSON.parse(text) as { decision: string }).decision, "block");
        });
    });

    it("enforces body limits, safe invalid JSON errors, and disabled CORS", async () => {
        await withBroker({ bodyLimitBytes: 100 }, async (url) => {
            assert.equal((await request(url, "/v1/scan", { method: "POST", body: JSON.stringify({ content: "x".repeat(200) }) })).status, 413);
            const invalid = await request(url, "/v1/scan", { method: "POST", body: "{" });
            assert.equal(invalid.status, 400);
            assert.equal((await invalid.json() as { error: { code: string } }).error.code, "invalid_json");
            const cors = await request(url, "/v1/scan", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" });
            assert.equal(cors.status, 403);
            assert.equal(cors.headers.get("access-control-allow-origin"), null);
        });
    });

    it("rotates its local auth token", async () => {
        await withBroker({}, async (url) => {
            const next = "replacement_local_broker_token_abcdef0123456789";
            assert.equal((await request(url, "/v1/auth/rotate", { method: "POST", body: JSON.stringify({ token: next }) })).status, 200);
            assert.equal((await request(url, "/version")).status, 401);
            assert.equal((await request(url, "/version", {}, next)).status, 200);
        });
    });

    it("enables Safe Mode and returns its local rule set", async () => {
        await withBroker({}, async (url) => {
            const enabled = await request(url, "/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: "strict" }) });
            assert.equal(enabled.status, 200);
            const status = await request(url, "/v1/safe-mode/status");
            const payload = await status.json() as { enabled: boolean; level: string; rules: string[] };
            assert.equal(payload.enabled, true);
            assert.equal(payload.level, "strict");
            assert.ok(payload.rules.length > 5);
        });
    });

    it("stores and exports sanitized memory events", async () => {
        const raw = "sk-proj-1234567890abcdefghijklmnopqrstuv";
        await withBroker({}, async (url) => {
            await request(url, "/v1/memory/session/start", { method: "POST", body: JSON.stringify({ sessionId: "session-1" }) });
            await request(url, "/v1/memory/session/event", { method: "POST", body: JSON.stringify({ sessionId: "session-1", event: { kind: "broker_request_scanned", decision: "redact", riskScore: 80, categories: ["ai_api_key"], redactedEvidence: raw } }) });
            const exported = await request(url, "/v1/events/export-redacted", { method: "POST" });
            const text = await exported.text();
            assert.equal(text.includes(raw), false);
            assert.match(text, /session-1/);
        });
    });
});

describe("OpenAI-compatible proxy", () => {
    it("forwards a safe request to a mocked provider and scans the response", async () => {
        let providerAuthorization = "";
        const fetchImpl: typeof fetch = async (_input, init) => {
            providerAuthorization = new Headers(init?.headers).get("authorization") ?? "";
            return new Response(JSON.stringify({ id: "chatcmpl_test", choices: [{ message: { role: "assistant", content: "Use a typed helper." } }] }), { status: 200, headers: { "content-type": "application/json" } });
        };
        await withBroker({ openAIProviderUrl: "https://provider.invalid/v1/chat/completions", fetchImpl }, async (url) => {
            const response = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { "x-soterai-provider-key": "provider-secret" }, body: JSON.stringify({ model: "mock", messages: [{ role: "user", content: "Write a typed helper" }] }) });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("x-soterai-response-decision"), "allow");
            assert.equal(providerAuthorization, "Bearer provider-secret");
        });
    });

    it("does not forward canary-bearing requests", async () => {
        const canary = await generateCanary();
        let calls = 0;
        const fetchImpl: typeof fetch = async () => { calls++; return new Response("{}"); };
        await withBroker({ openAIProviderUrl: "https://provider.invalid", providerApiKey: "local-key", fetchImpl, canaries: [canary] }, async (url) => {
            const response = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", body: JSON.stringify({ model: "mock", messages: [{ role: "user", content: canary.token }] }) });
            assert.equal(response.status, 422);
            assert.equal(calls, 0);
            assert.equal((await response.text()).includes(canary.token), false);
        });
    });

    it("blocks a mocked provider response that leaks a canary", async () => {
        const canary = await generateCanary();
        const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: canary.token } }] }), { status: 200, headers: { "content-type": "application/json" } });
        await withBroker({ openAIProviderUrl: "https://provider.invalid", providerApiKey: "local-key", fetchImpl, canaries: [canary] }, async (url) => {
            const response = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", body: JSON.stringify({ model: "mock", messages: [{ role: "user", content: "Say hello" }] }) });
            const text = await response.text();
            assert.equal(response.status, 422);
            assert.equal(text.includes(canary.token), false);
        });
    });

    it("never logs a provider key", async () => {
        const logs: string[] = [];
        const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { headers: { "content-type": "application/json" } });
        await withBroker({ openAIProviderUrl: "https://provider.invalid", fetchImpl, logger: (message, metadata) => logs.push(JSON.stringify({ message, metadata })) }, async (url) => {
            await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { "x-soterai-provider-key": "never-log-this-provider-key" }, body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }) });
            assert.equal(logs.join("\n").includes("never-log-this-provider-key"), false);
        });
    });

    it("flags a dangerous mocked provider response", async () => {
        const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "Run rm -rf / as root" } }] }), { headers: { "content-type": "application/json" } });
        await withBroker({ openAIProviderUrl: "https://provider.invalid", providerApiKey: "local-key", fetchImpl }, async (url) => {
            const response = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "How do I clean a temp folder?" }] }) });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("x-soterai-response-decision"), "warn");
        });
    });

    it("unlocks only the exact approved session and content hash", async () => {
        let calls = 0;
        const fetchImpl: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { headers: { "content-type": "application/json" } }); };
        await withBroker({ openAIProviderUrl: "https://provider.invalid", providerApiKey: "local-key", fetchImpl }, async (url) => {
            await request(url, "/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: "enterprise" }) });
            const content = "Contact user@example.com";
            const scan = await request(url, "/v1/scan", { method: "POST", body: JSON.stringify({ content }) });
            const { contentHash } = await scan.json() as { contentHash: string };
            await request(url, "/v1/approvals", { method: "POST", body: JSON.stringify({ sessionId: "approved-session", contentHash, scope: "once" }) });
            const approved = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { "x-soterai-session-id": "approved-session" }, body: JSON.stringify({ messages: [{ role: "user", content }] }) });
            assert.equal(approved.status, 200);
            const replay = await request(url, "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { "x-soterai-session-id": "approved-session" }, body: JSON.stringify({ messages: [{ role: "user", content }] }) });
            assert.equal(replay.status, 403);
            assert.equal(calls, 1);
        });
    });
});

describe("Anthropic-compatible proxy", () => {
    it("forwards and scans a mocked messages response", async () => {
        let apiKey = "";
        const fetchImpl: typeof fetch = async (_input, init) => {
            apiKey = new Headers(init?.headers).get("x-api-key") ?? "";
            return new Response(JSON.stringify({ content: [{ type: "text", text: "Use a narrow interface." }] }), { headers: { "content-type": "application/json" } });
        };
        await withBroker({ anthropicProviderUrl: "https://provider.invalid/v1/messages", fetchImpl }, async (url) => {
            const response = await request(url, "/v1/ai/anthropic-compatible/messages", { method: "POST", headers: { "x-soterai-provider-key": "anthropic-local-key" }, body: JSON.stringify({ model: "mock", max_tokens: 50, messages: [{ role: "user", content: "Design an interface" }] }) });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("x-soterai-response-decision"), "allow");
            assert.equal(apiKey, "anthropic-local-key");
        });
    });
});
