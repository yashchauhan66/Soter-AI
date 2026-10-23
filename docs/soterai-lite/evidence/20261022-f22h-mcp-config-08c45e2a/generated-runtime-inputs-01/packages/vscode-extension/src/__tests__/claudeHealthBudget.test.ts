import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const CONTROL = "TEST_ONLY_F19_HEALTH_CONTROL_CREDENTIAL", DATA = "TEST_ONLY_F19_HEALTH_DATA_CLIENT_CREDENTIAL";
test("F19-R01 exact owner health endpoints do not consume provider request quota", async () => {
    const session = randomUUID(), broker = new BrokerServer({ token: DATA, controlToken: CONTROL, ownerSession: session, port: 0, claudeToolSchemas: true, rateLimitPerMinute: 2, livenessRateLimitPerMinute: 40 });
    const { url } = await broker.start();
    const headers = { authorization: "Bearer " + CONTROL, "x-soterai-session": session };
    try {
        for (let i = 0; i < 6; i++) for (const route of ["/v1/lifecycle/status", "/v1/gateway/status", "/v1/safe-mode/status"]) {
            const response = await fetch(url + route, { headers }); assert.equal(response.status, 200); await response.arrayBuffer();
        }
        const response = await fetch(url + "/v1/events/recent", { headers }); assert.equal(response.status, 200); await response.arrayBuffer();
        const next = await fetch(url + "/v1/events/recent", { headers }); assert.equal(next.status, 200); await next.arrayBuffer();
        assert.equal((await fetch(url + "/v1/events/recent", { headers })).status, 429);
    } finally { await broker.stop(); }
});
test("F19-R02 owner health remains authenticated/session-bound and separately metered", async () => {
    const session = randomUUID(), broker = new BrokerServer({ token: DATA, controlToken: CONTROL, ownerSession: session, port: 0, claudeToolSchemas: true, rateLimitPerMinute: 2, livenessRateLimitPerMinute: 6 });
    const { url } = await broker.start();
    try {
        assert.equal((await fetch(url + "/v1/lifecycle/status")).status, 401);
        assert.equal((await fetch(url + "/v1/lifecycle/status", { headers: { authorization: "Bearer " + DATA } })).status, 403);
        assert.equal((await fetch(url + "/v1/lifecycle/status", { headers: { authorization: "Bearer " + CONTROL, "x-soterai-session": randomUUID() } })).status, 403);
        const headers = { authorization: "Bearer " + CONTROL, "x-soterai-session": session };
        for (let i = 0; i < 3; i++) assert.equal((await fetch(url + "/v1/lifecycle/status", { headers })).status, 200);
        assert.equal((await fetch(url + "/v1/lifecycle/status", { headers })).status, 429);
    } finally { await broker.stop(); }
});
test("F19-R03 disabling the Claude profile preserves the previous health accounting", async () => {
    for (const claudeToolSchemas of [undefined, false]) {
        const session = randomUUID(), broker = new BrokerServer({ token: DATA, controlToken: CONTROL, ownerSession: session, port: 0, claudeToolSchemas, rateLimitPerMinute: 2, livenessRateLimitPerMinute: 40 });
        const { url } = await broker.start(), headers = { authorization: "Bearer " + CONTROL, "x-soterai-session": session };
        try {
            for (let i = 0; i < 2; i++) assert.equal((await fetch(url + "/v1/lifecycle/status", { headers })).status, 200);
            assert.equal((await fetch(url + "/v1/lifecycle/status", { headers })).status, 429);
        } finally { await broker.stop(); }
    }
});
