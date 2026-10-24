import assert from "node:assert/strict";
import { test } from "node:test";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";

const ROOT = "file:///D:/synthetic-f24-domain";
const INPUT = { source: "dist/copied.txt", text: "API_KEY=SYNTHETIC_F24_DOMAIN_PRIVATE_27423\n", environment: false };
function fixture() {
    const state = new Map<string, unknown>(), secrets = new Map([[HYGIENE_LEDGER_KEY, Buffer.alloc(32, 24).toString("base64")]]);
    const ledger = new HygieneExposureLedger({ get<T>(k: string) { return state.get(k) as T | undefined; },
        async update(k: string, v: unknown) { state.set(k, structuredClone(v)); } },
    { async get(k: string) { return secrets.get(k); }, async store(k: string, v: string) { secrets.set(k, v); } });
    const artifact = () => Reflect.apply(ledger.createAnalyzer, ledger, [ROOT, "artifact-v1"]) as ReturnType<HygieneExposureLedger["createAnalyzer"]>;
    return { ledger, state, secrets, artifact };
}
test("F24 artifact references cannot collide with canonical current-file or history references", async () => {
    const f = fixture(), current = await f.ledger.createAnalyzer(ROOT), history = await f.ledger.createAnalyzer(ROOT, "history-v1"), artifact = await f.artifact();
    const a = current.analyze(INPUT), b = history.analyze(INPUT), c = artifact.analyze(INPUT);
    for (const field of ["fileRef", "revision"] as const) assert.equal(new Set([a[field], b[field], c[field]]).size, 3);
    for (const field of ["fileRef", "valueRef", "id"] as const) assert.equal(new Set([a.findings[0][field], b.findings[0][field], c.findings[0][field]]).size, 3);
    current.dispose(); history.dispose(); artifact.dispose();
});
test("F24 artifact observation retains a distinct exposure row and preserves current-file vaulted action", async () => {
    const f = fixture(), current = await f.ledger.createAnalyzer(ROOT), artifact = await f.artifact();
    const a = current.analyze(INPUT), b = artifact.analyze(INPUT);
    await f.ledger.record(ROOT, a.findings, "vaulted"); await f.ledger.record(ROOT, b.findings, "possible-project-exposure");
    const rows = (await f.ledger.view(ROOT)).rows; assert.equal(rows.length, 2);
    assert.equal(rows.find(r => r.fileRef === a.fileRef)?.lastAction, "vaulted");
    assert.equal(rows.find(r => r.fileRef === b.fileRef)?.lastAction, "possible-project-exposure");
    assert.ok(!JSON.stringify(rows).includes(INPUT.text.trim())); assert.ok(!JSON.stringify(rows).includes(INPUT.source));
    current.dispose(); artifact.dispose();
});
test("F24 artifact analyzer survives ordinary reuse but withdraws on key drift and disposal", async () => {
    const f = fixture(), first = await f.artifact(), before = first.analyze(INPUT); first.dispose();
    const second = await f.artifact(); assert.deepEqual(second.analyze(INPUT), before);
    f.secrets.set(HYGIENE_LEDGER_KEY, Buffer.alloc(32, 25).toString("base64"));
    assert.equal(await second.current(), false); assert.throws(() => second.analyze(INPUT));
    const g = fixture(), third = await g.artifact(); third.dispose(); assert.equal(await third.current(), false);
    assert.throws(() => third.analyze(INPUT));
});
