import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { analyzeHygieneText, type HygieneInput } from "../hygiene/HygieneAnalysis";
import type { HygieneExposureLedger } from "../hygiene/HygieneExposureLedger";

// F23 test-first history-domain regression. Storage, keys, paths and contents
// are synthetic in-memory fixtures; no VS Code, filesystem or Git is used.
const ROOT = "file:///D:/synthetic-f23-ledger-project";
const OTHER_ROOT = "file:///D:/synthetic-f23-ledger-other";
const PRIVATE = "TEST_ONLY_F23_LEDGER_PRIVATE_e1b904a6";
const PROFILE_KEY = Buffer.alloc(32, 23);
const SOURCE = "history-v1/0123456789abcdef0123456789abcdef01234567/.env";
const INPUT: HygieneInput = { source: SOURCE, text: "API_KEY=" + PRIVATE + "\n", environment: true };
type Analyzer = Awaited<ReturnType<HygieneExposureLedger["createAnalyzer"]>>;

async function fixture() {
    const { HygieneExposureLedger, HYGIENE_LEDGER_KEY } = await import("../hygiene/HygieneExposureLedger");
    const state = new Map<string, unknown>(), secrets = new Map([[HYGIENE_LEDGER_KEY, PROFILE_KEY.toString("base64")]]);
    const storage = {
        get<T>(key: string) { return state.get(key) as T | undefined; },
        async update(key: string, value: unknown) { state.set(key, structuredClone(value)); },
    };
    const secretStorage = {
        async get(key: string) { return secrets.get(key); },
        async store(key: string, value: string) { secrets.set(key, value); },
    };
    return { ledger: new HygieneExposureLedger(storage, secretStorage), state, secrets };
}

// Reflect.apply deliberately supplies the new optional runtime argument while
// the unchanged one-argument baseline remains typecheckable. Unsupported values
// must reject at runtime rather than silently selecting the current-file domain.
function analyzer(ledger: HygieneExposureLedger, root: string, domain: unknown): Promise<Analyzer> {
    return Reflect.apply(ledger.createAnalyzer, ledger, [root, domain]) as Promise<Analyzer>;
}
function valueFree(value: unknown): void {
    const serialized = JSON.stringify(value);
    for (const raw of [PRIVATE, SOURCE, ROOT, PROFILE_KEY.toString("base64"), "API_KEY"]) assert(!serialized.includes(raw));
}

test("F23 historical and current files cannot collide through a valid history-prefixed repository path", async () => {
    const f = await fixture(), current = await f.ledger.createAnalyzer(ROOT), history = await analyzer(f.ledger, ROOT, "history-v1");
    const a = current.analyze(INPUT), b = history.analyze(INPUT);
    assert.equal(a.findings.length, 1); assert.equal(b.findings.length, 1);
    assert.notEqual(b.fileRef, a.fileRef); assert.notEqual(b.revision, a.revision);
    for (const field of ["fileRef", "valueRef", "id"] as const) assert.notEqual(b.findings[0][field], a.findings[0][field], field);
    valueFree(a); valueFree(b); current.dispose(); history.dispose();
});

test("F23 historical exposure preserves a separate current-file ledger row and its last action", async () => {
    const f = await fixture(), current = await f.ledger.createAnalyzer(ROOT), history = await analyzer(f.ledger, ROOT, "history-v1");
    const a = current.analyze(INPUT).findings[0], b = history.analyze(INPUT).findings[0];
    await f.ledger.record(ROOT, [a], "vaulted");
    await f.ledger.record(ROOT, [b], "possible-project-exposure");
    const view = await f.ledger.view(ROOT); assert.equal(view.rows.length, 2);
    assert.equal(view.rows.find(row => row.fileRef === a.fileRef)?.lastAction, "vaulted");
    assert.equal(view.rows.find(row => row.fileRef === b.fileRef)?.lastAction, "possible-project-exposure");
    assert(view.rows.every(row => row.observations === 1)); valueFree(view); valueFree([...f.state.values()]);
    current.dispose(); history.dispose();
});

test("F23 the same history domain remains stable across analyzer leases and repeated observations", async () => {
    const f = await fixture(), first = await analyzer(f.ledger, ROOT, "history-v1");
    const before = first.analyze(INPUT); first.dispose();
    const second = await analyzer(f.ledger, ROOT, "history-v1"), after = second.analyze(INPUT);
    assert.deepEqual(after, before); assert.equal(await second.current(), true);
    await f.ledger.record(ROOT, before.findings, "possible-project-exposure");
    await f.ledger.record(ROOT, after.findings, "possible-project-exposure");
    const view = await f.ledger.view(ROOT); assert.equal(view.rows.length, 1); assert.equal(view.rows[0].observations, 2);
    valueFree(view); second.dispose();
});

test("F23 history-domain references remain isolated between roots using the same profile key", async () => {
    const f = await fixture(), first = await analyzer(f.ledger, ROOT, "history-v1"), other = await analyzer(f.ledger, OTHER_ROOT, "history-v1");
    const a = first.analyze(INPUT), b = other.analyze(INPUT);
    assert.equal(a.findings.length, 1); assert.equal(b.findings.length, 1);
    for (const field of ["fileRef", "valueRef", "id"] as const) assert.notEqual(a.findings[0][field], b.findings[0][field], field);
    await f.ledger.record(ROOT, a.findings, "possible-project-exposure");
    await f.ledger.record(OTHER_ROOT, b.findings, "possible-project-exposure");
    assert.equal((await f.ledger.view(ROOT)).rows.length, 1); assert.equal((await f.ledger.view(OTHER_ROOT)).rows.length, 1);
    valueFree(a); valueFree(b); first.dispose(); other.dispose();
});

test("F23 an omitted or undefined analyzer domain preserves the exact existing canonical output", async () => {
    const f = await fixture(), current = await f.ledger.createAnalyzer(ROOT), explicit = await analyzer(f.ledger, ROOT, undefined);
    const rootKey = createHmac("sha256", PROFILE_KEY).update("analysis-root\0" + ROOT).digest();
    const expected = analyzeHygieneText(INPUT, rootKey);
    assert.deepEqual(current.analyze(INPUT), expected); assert.deepEqual(explicit.analyze(INPUT), expected);
    assert.deepEqual(await f.ledger.analyze(ROOT, INPUT), expected);
    rootKey.fill(0); current.dispose(); explicit.dispose();
});

test("F23 unsupported analyzer domains reject generically without changing retained key or ledger metadata", async () => {
    const f = await fixture();
    const beforeState = JSON.stringify([...f.state]), beforeSecrets = JSON.stringify([...f.secrets]);
    for (const domain of ["", "history-v2", "file", "history-v1\0suffix", PRIVATE]) {
        await assert.rejects(analyzer(f.ledger, ROOT, domain), error => !String(error).includes(PRIVATE) && !String(error).includes(SOURCE));
        assert.equal(JSON.stringify([...f.state]), beforeState); assert.equal(JSON.stringify([...f.secrets]), beforeSecrets);
    }
});

test("F23 history-domain leases withdraw on key drift or disposal without reverting to a current-file key", async () => {
    const f = await fixture(), history = await analyzer(f.ledger, ROOT, "history-v1");
    assert.equal(history.analyze(INPUT).findings.length, 1);
    for (const name of f.secrets.keys()) f.secrets.set(name, Buffer.alloc(32, 44).toString("base64"));
    assert.equal(await history.current(), false); assert.throws(() => history.analyze(INPUT), error => !String(error).includes(PRIVATE));
    const g = await fixture(), disposed = await analyzer(g.ledger, ROOT, "history-v1"); disposed.dispose();
    assert.equal(await disposed.current(), false); assert.throws(() => disposed.analyze(INPUT), error => !String(error).includes(PRIVATE));
});
