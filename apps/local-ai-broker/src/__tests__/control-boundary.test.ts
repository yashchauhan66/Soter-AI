import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { BrokerServer } from "../BrokerServer";
import { generateCanary } from "@soterai/guard-core";

const DATA = "synthetic-client-" + randomBytes(32).toString("hex");
const CONTROL = "synthetic-controller-" + randomBytes(32).toString("hex");
const ROUTE = "/v1/ai/openai-compatible/chat/completions";

async function fixture(run: (url: string, wires: string[]) => Promise<void>) {
    const wires: string[] = [];
    // Spread permits running this regression against the pre-fix constructor.
    const broker = new BrokerServer({ token: DATA, port: 0, ...{ controlToken: CONTROL },
        openAIProviderUrl: "https://fixture.invalid/v1", providerApiKey: "synthetic-provider-auth",
        fetchImpl: async (_url, init) => {
            wires.push(String(init?.body));
            return Response.json({ choices: [{ message: { content: "Public control response." } }] });
        },
    });
    const { url } = await broker.start();
    try { await run(url, wires); } finally { await broker.stop(); }
}

function request(url: string, endpoint: string, token: string, body?: unknown) {
    return fetch(url + endpoint, { method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

test("AI client credential cannot change policy, mint approvals, clear canaries or execute commands", async () => {
    await fixture(async url => {
        for (const [endpoint, body] of [
            ["/v1/safe-mode/disable", {}],
            ["/v1/safe-mode/enable", { level: "developer" }],
            ["/v1/canaries/sync", { canaries: [] }],
            ["/v1/approvals", { sessionId: "attacker", contentHash: "a".repeat(64), scope: "once" }],
            ["/v1/approvals/clear", {}],
            ["/v1/auth/rotate", { token: DATA }],
            ["/v1/terminal/execute", { command: "git status --short" }],
            ["/v1/memory/session/clear", {}],
            ["/v1/checkpoint/create", {}],
        ] as const) {
            const response = await request(url, endpoint, DATA, body);
            assert.equal(response.status, 403, endpoint);
            assert.match(await response.text(), /control_auth_required/);
        }
        for (const endpoint of ["/v1/events/recent", "/v1/approvals", "/v1/memory/session/other-user"]) {
            assert.equal((await request(url, endpoint, DATA)).status, 403, endpoint);
        }
    });
});

test("clearing the registry with a client token cannot enable canary exfiltration", async () => {
    await fixture(async (url, wires) => {
        const canary = await generateCanary();
        const token = canary.token;
        assert.equal((await request(url, "/v1/canaries/sync", CONTROL, { canaries: [canary] })).status, 200);
        assert.equal((await request(url, "/v1/canaries/sync", DATA, { canaries: [] })).status, 403);
        assert.equal((await request(url,"/v1/gateway/sync",CONTROL,{version:1,generation:randomUUID(),mode:{enabled:false,level:"developer"},values:[]})).status,200);
        const response = await request(url, ROUTE, DATA, { messages: [{ role: "user", content: "Summarize this memo: " + token }] });
        assert.equal(response.status, 422);
        assert.equal(wires.length, 0, "synthetic canary reached provider transport");
    });
});

test("a separate controller can manage policy while the AI client can only use documented data routes", async () => {
    await fixture(async (url, wires) => {
        assert.equal((await request(url, "/v1/safe-mode/enable", CONTROL, { level: "strict" })).status, 200);
        assert.equal((await request(url, "/v1/safe-mode/status", DATA)).status, 200);
        assert.equal((await request(url, "/v1/safe-mode/disable", CONTROL, {})).status, 200);
        assert.equal((await request(url, ROUTE, DATA, { messages: [{ role: "user", content: "Say hello." }] })).status, 200);
        assert.equal(wires.length, 1);
        assert.equal((await request(url, "/v1/scan", DATA, { content: "Public control text." })).status, 200);
        assert.equal((await request(url, "/v1/safe-mode/disable", "wrong", {})).status, 401);
    });
});

test("omitting a controller disables management rather than reusing the AI client token", async () => {
    const broker = new BrokerServer({ token: DATA, port: 0 });
    const { url } = await broker.start();
    try {
        assert.equal((await request(url, "/v1/safe-mode/disable", DATA, {})).status, 403);
        assert.equal((await request(url, "/version", DATA)).status, 200);
    } finally { await broker.stop(); }
});

test("controller and client credentials must be distinct", () => {
    assert.throws(() => new BrokerServer({ token: DATA, ...{ controlToken: DATA } }), /distinct/);
});
