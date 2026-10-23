import { test } from "node:test";
import assert from "node:assert/strict";
const ROOT = "file:///D:/synthetic-f21-project", VALUE = "TEST_ONLY_F21_PRIVATE_LEDGER_VALUE_5aa75109";
async function fixture() {
    const { HygieneExposureLedger } = await import("../hygiene/HygieneExposureLedger"), state = new Map<string, unknown>(), secrets = new Map<string, string>();
    const storage = { get<T>(key: string) { return state.get(key) as T | undefined; }, async update(key: string, value: unknown) { state.set(key, structuredClone(value)); } };
    const secretStorage = { async get(key: string) { return secrets.get(key); }, async store(key: string, value: string) { secrets.set(key, value); } };
    const ledger = new HygieneExposureLedger(storage, secretStorage); return { ledger, state, secrets, storage, secretStorage };
}
async function finding(ledger: any) { return (await ledger.analyze(ROOT, { source: ".env", text: "API_KEY=" + VALUE, environment: true })).findings[0]; }
test("F21 no IO/key creation in constructor or empty read, no original/root/path in stored/exported metadata", async () => {
    const f = await fixture(); assert.equal(f.state.size, 0); assert.equal(f.secrets.size, 0); assert.equal((await f.ledger.view(ROOT)).rows.length, 0); assert.equal(f.secrets.size, 0);
    const row = await finding(f.ledger); await f.ledger.record(ROOT, [row], "possible-project-exposure"); const view = await f.ledger.view(ROOT);
    assert.equal(view.rows.length, 1); assert.equal(view.rows[0].lastAction, "possible-project-exposure");
    const serialized = JSON.stringify([...f.state.values()]) + JSON.stringify(view); for (const raw of [VALUE, ROOT, ".env", "API_KEY"]) assert(!serialized.includes(raw));
    assert.equal(f.secrets.size, 1); assert(!serialized.includes([...f.secrets.values()][0])); assert.match(view.assessment, /possible|unverified/i);
});
test("F21 repeated observations deduplicate, root scope isolates and distinct owner reports never become confirmed AI reads", async () => {
    const f = await fixture(), row = await finding(f.ledger); await f.ledger.record(ROOT, [row], "possible-project-exposure"); await f.ledger.record(ROOT, [row], "owner-reported-possible-exposure");
    const view = await f.ledger.view(ROOT); assert.equal(view.rows.length, 1); assert.equal(view.rows[0].observations, 2); assert.equal(view.rows[0].lastAction, "owner-reported-possible-exposure");
    assert.equal((await f.ledger.view(ROOT + "-other")).rows.length, 0); assert(!JSON.stringify(view).includes('"confirmed"'));
});
test("F21 corrupt state, unknown fields and lost/replaced key preserve prior bytes and refuse", async () => {
    for (const variant of ["unknown", "lost", "changed"]) { const f = await fixture(), row = await finding(f.ledger); await f.ledger.record(ROOT, [row], "possible-project-exposure");
        if (variant === "unknown") { const [key, value] = [...f.state.entries()][0]; f.state.set(key, { ...(value as object), raw: VALUE }); }
        if (variant === "lost") f.secrets.clear(); if (variant === "changed") for (const key of f.secrets.keys()) f.secrets.set(key, Buffer.alloc(32, 99).toString("base64"));
        const before = JSON.stringify([...f.state]); await assert.rejects(f.ledger.view(ROOT), e => !String(e).includes(VALUE)); await assert.rejects(f.ledger.record(ROOT, [row], "possible-project-exposure")); assert.equal(JSON.stringify([...f.state]), before);
    }
});
test("F21 capacity is bounded256 without truncation or partial persistence", async () => {
    const f = await fixture(), rows = [];
    for (let n = 0; n < 256; n++) rows.push((await f.ledger.analyze(ROOT, { source: ".env", text: "API_KEY=F21_CAPACITY_" + n + "_" + "R".repeat(24), environment: true })).findings[0]);
    await f.ledger.record(ROOT, rows, "possible-project-exposure"); const before = JSON.stringify([...f.state]);
    const extra = (await f.ledger.analyze(ROOT, { source: "second/.env", text: "API_KEY=" + VALUE, environment: true })).findings[0]; await assert.rejects(f.ledger.record(ROOT, [extra], "possible-project-exposure")); assert.equal(JSON.stringify([...f.state]), before); assert.equal((await f.ledger.view(ROOT)).rows.length, 256);
});
test("F21 concurrent owner observations serialize without losing existing metadata", async () => {
    const f = await fixture(), a = await finding(f.ledger), b = (await f.ledger.analyze(ROOT, { source: "second/.env", text: "API_KEY=F21_OTHER_SYNTHETIC_VALUE_9eeae771", environment: true })).findings[0];
    await Promise.all([f.ledger.record(ROOT, [a], "possible-project-exposure"), f.ledger.record(ROOT, [b], "vaulted")]); assert.equal((await f.ledger.view(ROOT)).rows.length, 2);
});
test("F21 key/state persistence failure releases no raw exception and never overwrites existing ledger", async () => {
    const f = await fixture(), row = await finding(f.ledger); await f.ledger.record(ROOT, [row], "possible-project-exposure"); const before = JSON.stringify([...f.state]);
    f.storage.update = async () => { throw Error(VALUE); }; await assert.rejects(f.ledger.record(ROOT, [row], "restored-after-owner-disclosure"), e => !String(e).includes(VALUE)); assert.equal(JSON.stringify([...f.state]), before);
});

test("F21 backwards clock refuses an update without corrupting preserved chronological metadata", async () => {
    const f = await fixture(), row = await finding(f.ledger); await f.ledger.record(ROOT, [row], "possible-project-exposure");
    const [name, raw] = [...f.state.entries()][0], state = structuredClone(raw) as any;
    state.rows[0].firstSeen = state.rows[0].lastSeen = "2099-01-01T00:00:00.000Z"; f.state.set(name, state);
    const before = JSON.stringify([...f.state]); await assert.rejects(f.ledger.record(ROOT, [row], "vaulted")); assert.equal(JSON.stringify([...f.state]), before); assert.equal((await f.ledger.view(ROOT)).rows.length, 1);
});

test("F21 private synchronous analysis lease revokes on key drift/disposal without exposing its key", async () => {
    const f = await fixture(), lease = await f.ledger.createAnalyzer(ROOT);
    const result = lease.analyze({ source: ".env", text: "API_KEY=" + VALUE, environment: true }); assert.equal(result.findings.length, 1); assert(!(result as any).then); assert.equal(await lease.current(), true);
    assert(!JSON.stringify(lease).includes([...f.secrets.values()][0])); for (const name of f.secrets.keys()) f.secrets.set(name, Buffer.alloc(32, 44).toString("base64"));
    assert.equal(await lease.current(), false); assert.throws(() => lease.analyze({ source: ".env", text: "API_KEY=" + VALUE, environment: true }));
    const g = await fixture(), disposed = await g.ledger.createAnalyzer(ROOT); disposed.dispose(); assert.equal(await disposed.current(), false); assert.throws(() => disposed.analyze({ source: ".env", text: "API_KEY=" + VALUE, environment: true }));
});
