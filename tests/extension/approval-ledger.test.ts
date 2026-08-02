/**
 * SS-7 / SS-12 adversarial tests for the release-grant primitives.
 *
 * The defect these replace was not "the bound was too high" — it was that an approval was a
 * permanent, unbounded, destination-agnostic bypass token consulted *before* any scan. So the
 * tests below are written as the four ways that token was abusable: keep it forever, spend it
 * twice, carry it to another origin, and hold it across a trust change. Plus the SS-12 case:
 * an armed replay token that the synthetic click never reached.
 *
 * A fake clock is injected everywhere. A test that proves an expiry by sleeping proves the
 * sleep, and a 120-second TTL is not sleepable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_MAX_ENTRIES,
  APPROVAL_TTL_MS,
  REPLAY_BYPASS_TTL_MS,
  approvalDigest,
  createApprovalLedger,
  createReplayBypass,
} from "../../apps/extension/src/lib/approval-ledger";

const ORIGIN = "https://chatgpt.com";
const OTHER_ORIGIN = "https://claude.ai";
const SECRET = "AKIAIOSFODNN7EXAMPLE is our production key";

/** A controllable clock: nothing in these tests waits on real time. */
function clock(start = 1_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => { at += ms; } };
}

/* ── The grant is one-time ────────────────────────────────────────────────── */

test("AL-701: a grant releases exactly once and is gone afterwards", async () => {
  const ledger = createApprovalLedger();
  assert.equal(await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" }), true);

  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "admin_approval");
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), null, "second use must re-scan");
  assert.equal(ledger.size(), 0);
});

test("AL-702: the authorising kind survives the round trip so a release can be audited", async () => {
  const ledger = createApprovalLedger();
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "self_justification" });
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "self_justification");
});

test("AL-703: an unrelated claim never consumes someone else's grant", async () => {
  const ledger = createApprovalLedger();
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });

  assert.equal(await ledger.consume({ text: `${SECRET} `, origin: ORIGIN }), null, "trailing space is different text");
  assert.equal(await ledger.consume({ text: SECRET.toUpperCase(), origin: ORIGIN }), null, "case must matter");
  assert.equal(await ledger.consume({ text: "", origin: ORIGIN }), null);
  // The real grant is still spendable: the ledger did not fail by rejecting everything.
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "admin_approval");
});

/* ── The grant is destination-bound ───────────────────────────────────────── */

test("AL-710: a grant issued on one origin does not release the same text on another", async () => {
  const ledger = createApprovalLedger();
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });

  assert.equal(await ledger.consume({ text: SECRET, origin: OTHER_ORIGIN }), null);
  assert.equal(await ledger.consume({ text: SECRET, origin: "http://chatgpt.com" }), null, "scheme is part of origin");
  assert.equal(await ledger.consume({ text: SECRET, origin: "https://chatgpt.com." }), null);
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "admin_approval");
});

test("AL-711: no (origin, text) pair can be re-spelled as another one", async () => {
  // Without the length prefix in the key material, origin `https://a` + text ` b` and
  // origin `https://a b` + text `` hash to the same string. That is a cross-origin release.
  const ledger = createApprovalLedger();
  await ledger.grant({ text: " b", origin: "https://a", kind: "admin_approval" });
  assert.equal(await ledger.consume({ text: "", origin: "https://a b" }), null, "key collision across origins");
  assert.equal(await ledger.consume({ text: " b", origin: "https://a" }), "admin_approval");

  const left = await approvalDigest("soter-approval-v1 9 https://a  b");
  const right = await approvalDigest("soter-approval-v1 11 https://a b ");
  assert.notEqual(left, right);
});

/* ── The grant expires ───────────────────────────────────────────────────── */

test("AL-720: a grant stops releasing once its TTL has passed", async () => {
  const time = clock();
  const ledger = createApprovalLedger({ now: time.now });
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });

  time.advance(APPROVAL_TTL_MS - 1);
  assert.equal(ledger.size(), 1, "still inside the window");

  time.advance(2);
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), null, "expired grant must not release");
  assert.equal(ledger.size(), 0, "expiry is swept, not merely ignored");
});

test("AL-721: the shipped TTL is a window, not a session", () => {
  assert.ok(APPROVAL_TTL_MS <= 5 * 60_000, `approval TTL ${APPROVAL_TTL_MS}ms is long enough to be a session token`);
  assert.ok(APPROVAL_TTL_MS >= 30_000, "too short to survive a legitimate re-render or second click");
});

test("AL-722: re-granting refreshes rather than accumulating", async () => {
  const time = clock();
  const ledger = createApprovalLedger({ now: time.now, ttlMs: 1_000 });
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });
  time.advance(900);
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });
  assert.equal(ledger.size(), 1, "the same (text, origin) is one entry");

  time.advance(200); // past the first grant, inside the second
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "admin_approval");
});

/* ── The ledger is bounded ───────────────────────────────────────────────── */

test("AL-730: the ledger evicts oldest-first and never grows past its cap", async () => {
  const time = clock();
  const ledger = createApprovalLedger({ now: time.now, maxEntries: 3 });
  for (const n of [1, 2, 3, 4]) {
    await ledger.grant({ text: `prompt-${n}`, origin: ORIGIN, kind: "admin_approval" });
    time.advance(1);
  }
  assert.equal(ledger.size(), 3, `cap not enforced (${ledger.size()} entries)`);
  assert.equal(await ledger.consume({ text: "prompt-1", origin: ORIGIN }), null, "oldest must be evicted");
  for (const n of [2, 3, 4]) {
    assert.equal(await ledger.consume({ text: `prompt-${n}`, origin: ORIGIN }), "admin_approval", `prompt-${n} lost`);
  }
});

test("AL-731: the shipped cap is small enough that a tab cannot bank grants", () => {
  assert.ok(APPROVAL_MAX_ENTRIES > 0 && APPROVAL_MAX_ENTRIES <= 16, `unexpected cap ${APPROVAL_MAX_ENTRIES}`);
});

test("AL-732: purge drops every live grant", async () => {
  const ledger = createApprovalLedger();
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });
  await ledger.grant({ text: "second", origin: ORIGIN, kind: "self_justification" });
  ledger.purge();
  assert.equal(ledger.size(), 0);
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), null);
});

/* ── Failure modes fail safe ─────────────────────────────────────────────── */

test("AL-740: a WebCrypto failure denies the release instead of granting one", async () => {
  const real = globalThis.crypto;
  const ledger = createApprovalLedger();
  await ledger.grant({ text: SECRET, origin: ORIGIN, kind: "admin_approval" });
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    assert.equal(await ledger.grant({ text: "x", origin: ORIGIN, kind: "admin_approval" }), false);
    assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), null, "must not release without a verified key");
  } finally {
    Object.defineProperty(globalThis, "crypto", { value: real, configurable: true });
  }
  // The ledger is usable again once WebCrypto is back — the failure was not sticky.
  assert.equal(await ledger.consume({ text: SECRET, origin: ORIGIN }), "admin_approval");
});

test("AL-741: the raw prompt is never part of a ledger key that could be read back", async () => {
  const digest = await approvalDigest(`soter-approval-v1 ${ORIGIN.length} ${ORIGIN} ${SECRET}`);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest.includes("AKIA"), false);
});

/* ── SS-12: the replay bypass token ──────────────────────────────────────── */

test("AL-750: an armed replay token is single-use", () => {
  const bypass = createReplayBypass<{ id: string }>();
  const button = { id: "send" };
  bypass.arm(button);
  assert.equal(bypass.consume(button), true);
  assert.equal(bypass.consume(button), false, "a second click must be scanned");
});

test("AL-751: an armed token the synthetic click never reached expires on its own", () => {
  // The pre-SS-12 hole: the site re-rendered the send button, the replay click never hit the
  // capture handler, and the element stayed armed for the lifetime of the tab.
  const time = clock();
  const bypass = createReplayBypass<{ id: string }>({ now: time.now });
  const button = { id: "send" };
  bypass.arm(button);
  time.advance(REPLAY_BYPASS_TTL_MS + 1);
  assert.equal(bypass.consume(button), false, "a stale armed element must not release the next real click");
});

test("AL-752: an element that was never armed is never released", () => {
  const bypass = createReplayBypass<{ id: string }>();
  assert.equal(bypass.consume({ id: "send" }), false);
});

test("AL-753: arming one element does not release a different one", () => {
  const bypass = createReplayBypass<{ id: string }>();
  const armed = { id: "send" };
  const other = { id: "send" }; // identical shape, different identity
  bypass.arm(armed);
  assert.equal(bypass.consume(other), false, "identity, not equality, must gate the bypass");
  assert.equal(bypass.consume(armed), true);
});

test("AL-754: the replay window is milliseconds, not seconds", () => {
  assert.ok(REPLAY_BYPASS_TTL_MS <= 5_000, `replay window ${REPLAY_BYPASS_TTL_MS}ms is too wide`);
});
