import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadReliability, READ_RELIABILITY_LIMITS } from "../security/ReadReliability";

test("F28-B01: eight leases cap unfinished work, including logically cancelled work", async () => {
    const owner = new ReadReliability({ enabled: () => true, now: () => 0 });
    const leases = Array.from({ length: 8 }, () => owner.begin());
    const expired = leases.map(item => item.expired.catch(() => "expired"));
    assert.throws(() => owner.begin()); owner.withdraw(); await Promise.all(expired);
    assert.equal(owner.status().activeReads, 8); assert.throws(() => owner.begin());
    leases[0].release(); const next = owner.begin(); void next.expired.catch(() => undefined);
    assert.equal(owner.status().activeReads, 8); next.release(); leases.forEach(item => item.release());
    assert.equal(owner.status().activeReads, 0); owner.dispose();
});
test("F28-B02: flag withdrawal invalidates active work and re-enable needs a fresh lease", async () => {
    let enabled = true;
    const owner = new ReadReliability({ enabled: () => enabled, now: () => 0 }), lease = owner.begin();
    const expired = lease.expired.catch(() => "expired"); enabled = false; owner.withdraw();
    assert.throws(() => lease.check()); assert.equal(await expired, "expired"); assert.throws(() => owner.begin());
    enabled = true; assert.throws(() => lease.check()); lease.release();
    const fresh = owner.begin(); void fresh.expired.catch(() => undefined); fresh.check(); fresh.release(); owner.dispose();
});
for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, READ_RELIABILITY_LIMITS.readMilliseconds]) {
    test(`F28-B03: elapsed clock ${String(value)} withholds`, () => {
        let now = 0; const owner = new ReadReliability({ enabled: () => true, now: () => now }), lease = owner.begin();
        void lease.expired.catch(() => undefined); now = value; assert.throws(() => lease.check()); lease.release(); owner.dispose();
    });
}
test("F28-B04: an elapsed clock cannot move backwards even while still after its start", () => {
    let now = 0; const owner = new ReadReliability({ enabled: () => true, now: () => now }), lease = owner.begin();
    void lease.expired.catch(() => undefined); now = 2; lease.check(); now = 1; assert.throws(() => lease.check()); lease.release(); owner.dispose();
});
test("F28-B05: owned timer expires even when a test clock stalls", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const owner = new ReadReliability({ enabled: () => true, now: () => 0 }), lease = owner.begin();
    const result = lease.expired.catch(() => "expired"); t.mock.timers.tick(READ_RELIABILITY_LIMITS.readMilliseconds);
    assert.equal(await result, "expired"); assert.throws(() => lease.check()); assert.equal(owner.status().activeReads, 1);
    lease.release(); owner.dispose();
});
test("F28-B06: unconfirmed handle closure degrades the owner and never refunds its slot", async () => {
    const owner = new ReadReliability({ enabled: () => true, now: () => 0 }), lease = owner.begin();
    const expired = lease.expired.catch(() => undefined); lease.closureFailed(); await expired;
    assert.equal(owner.status().status, "DEGRADED"); assert.equal(owner.status().activeReads, 1); assert.throws(() => owner.begin()); owner.dispose();
});
test("F28-B07: startup budget breach withdraws reads with a truthful degraded status", () => {
    let now = 0; const owner = new ReadReliability({ enabled: () => true, now: () => now });
    const started = owner.startupClock(); now = READ_RELIABILITY_LIMITS.startupMilliseconds;
    owner.finishStartup(started); assert.equal(owner.status().status, "DEGRADED"); assert.throws(() => owner.begin()); owner.dispose();
});
test("F28-B08: independent windows own independent resource and withdrawal state", () => {
    const a = new ReadReliability({ enabled: () => true, now: () => 0 }), b = new ReadReliability({ enabled: () => true, now: () => 0 });
    const leases = Array.from({ length: 8 }, () => a.begin()); leases.forEach(l => void l.expired.catch(() => undefined));
    assert.throws(() => a.begin()); const other = b.begin(); void other.expired.catch(() => undefined); other.check();
    a.dispose(); other.check(); leases.forEach(l => l.release()); other.release(); b.dispose();
});
