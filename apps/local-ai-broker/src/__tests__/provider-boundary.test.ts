import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { BrokerServer } from "../BrokerServer";
import { validateProviderTarget, readProviderBody, MAX_PROVIDER_RESPONSE_BYTES } from "../ProviderTarget";

const TOKEN = "boundary-test-auth-token-73921-abcdefghijklmnopqrstuvwxyz";
const ROUTE = "/v1/ai/openai-compatible/chat/completions";
const FAKE = "sk-proj-" + "FakeBoundary73921".repeat(4);
const input = (stream = false) => ({ model: "fixture", stream, messages: [{ role: "user", content: "Say hello." }] });
const frame = (text: string) => "data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\r\n\r\n";

async function withBroker(options: Partial<ConstructorParameters<typeof BrokerServer>[0]>, run: (url: string) => Promise<void>) {
    const broker = new BrokerServer({ token: TOKEN, port: 0, ...options });
    const { url } = await broker.start();
    try { await run(url); } finally { await broker.stop(); }
}
function post(url: string, body: unknown) {
    return fetch(url + ROUTE, { method: "POST", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function listen(server: Server): Promise<string> {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    return "http://127.0.0.1:" + (server.address() as AddressInfo).port;
}
async function close(server: Server) {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test("provider destinations require HTTPS or explicit loopback HTTP and reject URL credentials", () => {
    for (const target of ["https://provider.invalid/v1", "http://127.0.0.1:7777/v1", "http://[::1]:7777/v1"]) {
        assert.equal(validateProviderTarget(target), new URL(target).href);
    }
    for (const target of ["http://provider.invalid", "http://localhost:7777", "file:///key", "https://user:pass@provider.invalid", "https://provider.invalid/#fragment"]) {
        assert.throws(() => new BrokerServer({ token: TOKEN, openAIProviderUrl: target }));
    }
});

test("redirect responses never forward body or provider authorization to a second destination", async () => {
    let arrivals = 0;
    const receiver = createServer((_req, res) => { arrivals++; res.end("{}"); });
    const receiverUrl = await listen(receiver);
    let redirects = 0;
    const redirector = createServer((req, res) => {
        req.resume();
        redirects++;
        res.writeHead(307, { location: receiverUrl });
        res.end();
    });
    const redirectUrl = await listen(redirector);
    try {
        await withBroker({ openAIProviderUrl: redirectUrl, providerApiKey: "fake-test-provider-key" }, async url => {
            for (const stream of [false, true]) {
                const response = await post(url, input(stream));
                assert.equal(response.status, 502);
                assert.match(await response.text(), /provider_error/);
            }
        });
        assert.equal(redirects, 2);
        assert.equal(arrivals, 0);
    } finally { await close(redirector); await close(receiver); }
});

test("responses block recognized raw and encoded credentials in content or passthrough fields", async () => {
    for (const providerBody of [
        { choices: [{ message: { content: FAKE } }] },
        { choices: [{ message: { content: Buffer.from(FAKE).toString("base64") } }] },
        { choices: [{ message: { content: "Hello." } }], metadata: { trace: FAKE } },
    ]) {
        let calls = 0;
        await withBroker({
            openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
            fetchImpl: async () => { calls++; return Response.json(providerBody); },
        }, async url => {
            const response = await post(url, input());
            assert.equal(response.status, 422);
            const body = await response.text();
            assert.match(body, /unsafe_provider_response/);
            assert.ok(!body.includes(FAKE));
        });
        assert.equal(calls, 1);
    }
});

test("a canary in non-message request metadata is stopped at the final wire gate", async () => {
    const token = "ONLY-LOCAL-FIXTURE-MEMO-73921-ABCD";
    let calls = 0;
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        canaries: [{ id: "fixture", token, hash: "0".repeat(64), redactedPreview: "fixture-[redacted]" }],
        fetchImpl: async () => { calls++; return Response.json({ choices: [] }); },
    }, async url => {
        const response = await post(url, { ...input(), metadata: { note: token } });
        assert.equal(response.status, 422);
        assert.match(await response.text(), /egress_secret_blocked/);
    });
    assert.equal(calls, 0);
});

test("an encoded credential beyond the detector's first candidate batch cannot leave via metadata", async () => {
    const harmless = Array.from({ length: 50 }, (_, i) => Buffer.from("Ordinary fixture text number " + i).toString("base64"));
    let calls = 0;
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => { calls++; return Response.json({ choices: [] }); },
    }, async url => {
        const response = await post(url, { ...input(), metadata: [...harmless, Buffer.from(FAKE).toString("base64")] });
        assert.equal(response.status, 422);
        assert.match(await response.text(), /egress_secret_blocked/);
    });
    assert.equal(calls, 0);
});

test("split SSE credentials release neither prefix nor suffix, including CRLF frames", async () => {
    const prefix = FAKE.slice(0, 12);
    const suffix = FAKE.slice(12);
    let calls = 0;
    let chunk = 0;
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => {
            calls++;
            return new Response(new ReadableStream<Uint8Array>({
                async pull(controller) {
                    if (chunk++ === 0) controller.enqueue(new TextEncoder().encode(frame(prefix)));
                    else {
                        await new Promise(resolve => setTimeout(resolve, 40));
                        controller.enqueue(new TextEncoder().encode(frame(suffix) + "data: [DONE]\r\n\r\n"));
                        controller.close();
                    }
                },
            }), { headers: { "content-type": "text/event-stream" } });
        },
    }, async url => {
        const response = await post(url, input(true));
        const text = await response.text();
        assert.equal(response.headers.get("x-soterai-response-decision"), "block");
        assert.match(text, /unsafe_provider_response/);
        assert.ok(!text.includes(prefix));
        assert.ok(!text.includes(suffix));
    });
    assert.equal(calls, 1);
});

test("a final unterminated event cannot leak metadata after earlier clean text", async () => {
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => new Response(frame("Hello.") + 'data: {"metadata":"' + FAKE + '"}', { headers: { "content-type": "text/event-stream" } }),
    }, async url => {
        const response = await post(url, input(true));
        const text = await response.text();
        assert.match(text, /unsafe_provider_response/);
        assert.ok(!text.includes(FAKE));
        assert.ok(!text.includes("Hello."));
    });
});

test("provider bodies are bounded even without a Content-Length header", async () => {
    await assert.rejects(readProviderBody(new Response("x".repeat(MAX_PROVIDER_RESPONSE_BYTES + 1))), /scan limit/);
    assert.equal(await readProviderBody(new Response('{"ok":true}')), '{"ok":true}');
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => new Response("x".repeat(MAX_PROVIDER_RESPONSE_BYTES + 1), { headers: { "content-type": "text/event-stream" } }),
    }, async url => {
        const response = await post(url, input(true));
        assert.equal(response.headers.get("x-soterai-response-decision"), "block");
        assert.match(await response.text(), /unsafe_provider_response/);
    });
});

test("incomplete or invalid UTF-8 streams fail closed", async () => {
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => new Response(new Uint8Array([0xc0, 0xaf]), { headers: { "content-type": "text/event-stream" } }),
    }, async url => {
        const response = await post(url, input(true));
        assert.equal(response.headers.get("x-soterai-response-decision"), "block");
        assert.match(await response.text(), /unsafe_provider_response/);
    });
});

test("clean SSE content still reaches the client after validation", async () => {
    await withBroker({
        openAIProviderUrl: "https://provider.invalid/v1", providerApiKey: "fake-test-provider-key",
        fetchImpl: async () => new Response(frame("Hello.") + "data: [DONE]\r\n\r\n", { headers: { "content-type": "text/event-stream" } }),
    }, async url => {
        const response = await post(url, input(true));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-soterai-response-decision"), "allow");
        assert.match(await response.text(), /Hello\./);
    });
});
