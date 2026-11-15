import assert from "node:assert/strict";
import { test } from "node:test";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FilesystemCheckpointStore } from "../../../../apps/local-ai-broker/src/CheckpointStore";

const TOKEN = "f27_synthetic_broker_auth_8c16e402_0123456789";
const CONTROL = "f27_synthetic_broker_control_8c16e402_0123456789";
const CANARY = "F27_SYNTHETIC_BROKER_VALUE_8c16e402";

test("F27 actual loopback broker diagnostics keep public status while omitting request path and auth", async () => {
    const logs: unknown[] = [];
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: true,
        logger: (code, metadata) => logs.push({ code, metadata }) });
    try {
        const address = await broker.start();
        const response = await fetch(`${address.url}/${CANARY}`, { headers: { authorization: `Bearer ${TOKEN}` } });
        assert.equal(response.status, 403); await response.text(); // Unknown routes require control authority.
        assert(logs.length >= 2);
        const output = JSON.stringify(logs);
        assert(output.includes("broker_started")); assert(output.includes("request_failed"));
        assert.equal(output.includes(CANARY), false); assert.equal(output.includes(TOKEN), false);
        assert.equal(output.includes(CONTROL), false);
    } finally { await broker.stop(); }
});

test("F27 default-off actual broker diagnostic sink withholds success and error emissions", async () => {
    let calls = 0;
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, logger: () => { calls++; } });
    try {
        const address = await broker.start();
        const response = await fetch(`${address.url}/${CANARY}`, { headers: { authorization: `Bearer ${TOKEN}` } });
        assert.equal(response.status, 403); await response.text(); assert.equal(calls, 0);
    } finally { await broker.stop(); }
});

test("F27 actual broker callback exceptions do not escape startup or request failure", async () => {
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: true,
        logger: () => { throw new Error(CANARY); } });
    try {
        const address = await broker.start();
        const response = await fetch(`${address.url}/not-found`, { headers: { authorization: `Bearer ${TOKEN}` } });
        assert.equal(response.status, 403); assert.equal((await response.text()).includes(CANARY), false);
    } finally { await broker.stop(); }
});

for (const enabled of [false, true]) test(`F27 nested checkpoint diagnostic boundary obeys owner flag ${enabled}`, async () => {
    const fixture = await mkdtemp(join(tmpdir(), "soterai-f27-checkpoint-")), logs: unknown[] = [];
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: enabled,
        checkpoint: { root: join(fixture, "root"), snapshotRoot: join(fixture, "snapshots"), secret: TOKEN,
            logger: (...args) => { logs.push(args); } } });
    const store = (broker as unknown as { checkpoints: FilesystemCheckpointStore }).checkpoints;
    await store.createCheckpoint({ id: CANARY, owner: { tenantId: "synthetic", actorId: "synthetic" }, paths: ["missing-synthetic.txt"] });
    assert.equal(logs.length, enabled ? 1 : 0);
    assert.equal(JSON.stringify(logs).includes(CANARY), false);
    assert.equal(JSON.stringify(logs).includes(TOKEN), false);
    // Isolated synthetic metadata/snapshots are retained; no process or real-file control.
});

test("F27 nested checkpoint logger exceptions cannot escape to owned crash reporting", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "soterai-f27-checkpoint-"));
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: true,
        checkpoint: { root: join(fixture, "root"), snapshotRoot: join(fixture, "snapshots"), secret: TOKEN,
            logger: () => { throw new Error(CANARY); } } });
    const store = (broker as unknown as { checkpoints: FilesystemCheckpointStore }).checkpoints;
    await assert.doesNotReject(store.createCheckpoint({ id: CANARY, owner: { tenantId: "synthetic", actorId: "synthetic" }, paths: ["missing-synthetic.txt"] }));
});

for (const enabled of [false, true]) test(`F27 broker retained activity metadata obeys owner flag ${enabled}`, () => {
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: enabled });
    const owner = broker as unknown as { record(input: unknown): void; events: unknown[] };
    owner.record({ eventType: "broker_request_scanned", decision: "block", riskScore: 90, categories: [CANARY], sessionId: CANARY, contentHash: CANARY, redactedEvidence: CANARY });
    assert.equal(owner.events.length, enabled ? 1 : 0);
    assert.equal(JSON.stringify(owner.events).includes(CANARY), false);
});

test("F27 actual loopback memory inspector owns IDs and withholds caller metadata on export", async () => {
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: true });
    try {
        const address = await broker.start();
        const post = (route: string, body: unknown) => fetch(address.url + route, { method: "POST", headers: { authorization: `Bearer ${CONTROL}`, "content-type": "application/json" }, body: JSON.stringify(body) });
        const started = await post("/v1/memory/session/start", { sessionId: CANARY, tool: CANARY, provider: CANARY });
        assert.equal(started.status, 201);
        const { session } = await started.json() as { session: { sessionId: string } };
        assert.notEqual(session.sessionId, CANARY, "Caller labels cannot become retained owner IDs");
        const response = await post("/v1/memory/session/event", { sessionId: session.sessionId, event: { eventId: CANARY, timestamp: CANARY, kind: "broker_request_scanned", decision: "block", riskScore: 90, categories: [CANARY], redactedEvidence: CANARY, requestHash: CANARY, responseHash: CANARY, filePaths: [CANARY], model: CANARY, provider: CANARY } });
        assert.equal(response.status, 201); assert.equal((await response.text()).includes(CANARY), false);
        const exported = await post("/v1/events/export-redacted", {}), text = await exported.text();
        assert.equal(exported.status, 200); assert.equal(text.includes(CANARY), false);
        assert.match(text, /broker_request_scanned/); assert.match(text, /"riskScore":90/);
    } finally { await broker.stop(); }
});

test("F27 default-off loopback memory inspector refuses retention and labels withheld export", async () => {
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0 });
    try {
        const address = await broker.start();
        const post = (route: string) => fetch(address.url + route, { method: "POST", headers: { authorization: `Bearer ${CONTROL}`, "content-type": "application/json" }, body: JSON.stringify({ sessionId: CANARY }) });
        const started = await post("/v1/memory/session/start"); assert.equal(started.status, 503); assert.equal((await started.text()).includes(CANARY), false);
        const exported = await post("/v1/events/export-redacted"); assert.equal(exported.status, 200);
        assert.deepEqual(await exported.json(), { withheld: true, events: [], memory: { sessions: [] } });
    } finally { await broker.stop(); }
});

test("F27 memory events cannot auto-create caller-named sessions", async () => {
    const broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, selfHygiene: true });
    try {
        const address = await broker.start();
        const response = await fetch(address.url + "/v1/memory/session/event", { method: "POST", headers: { authorization: `Bearer ${CONTROL}`, "content-type": "application/json" }, body: JSON.stringify({ sessionId: CANARY, event: { kind: "broker_request_scanned", decision: "block", riskScore: 90 } }) });
        assert.equal(response.status, 404); assert.equal((await response.text()).includes(CANARY), false);
        const exported = await fetch(address.url + "/v1/events/export-redacted", { method: "POST", headers: { authorization: `Bearer ${CONTROL}`, "content-type": "application/json" }, body: "{}" });
        assert.equal((await exported.text()).includes(CANARY), false);
    } finally { await broker.stop(); }
});
