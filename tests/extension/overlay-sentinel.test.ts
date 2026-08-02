/**
 * SS-6 adversarial tests for the enforcement overlay's tamper watchdog.
 *
 * Written from the page's side. A hostile page has three moves against a security overlay —
 * remove the host node, neutralise it with inline style, or paint over it by appending its own
 * maximum-`z-index` element after ours — and one meta-move: do any of them in a loop until the
 * watchdog gives up or the audit endpoint drowns. Each test below is one of those.
 *
 * The DOM wiring (MutationObserver on `documentElement` + the attribute filter on the host +
 * the 500 ms ticker) cannot be tested here: `tests/extension` runs under `tsx --test` with no
 * DOM library. It is proved in a real browser by RT-710. What is proved here is the decision
 * logic those observers drive — which outcome each state produces, in what order, and where the
 * bounds are — because that is where a bypass would actually live.
 *
 * The load-bearing honesty point, asserted in SD-740: budget exhaustion is a *safe* outcome.
 * The submit gesture was already cancelled by `preventDefault()` before the overlay existed and
 * the network-layer deny window (SS-9) is armed by the background worker, so a page that wins
 * the repair race gets an invisible verdict, never a released submission.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SENTINEL_MAX_ACTIONS,
  SENTINEL_MAX_TAMPER_REPORTS,
  SENTINEL_WINDOW_MS,
  createOverlaySentinel,
  type SentinelHooks,
  type SentinelOutcome,
} from "../../apps/extension/src/content/overlay-sentinel";

/** A scriptable stand-in for the overlay host, plus a call log and a fake clock. */
function harness(initial: { mounted?: boolean; intact?: boolean } = {}) {
  const state = { mounted: initial.mounted ?? true, intact: initial.intact ?? true, at: 0 };
  const calls: string[] = [];
  const reports: string[] = [];
  const hooks: SentinelHooks = {
    isMounted: () => state.mounted,
    isIntact: () => state.intact,
    restoreIntegrity: () => {
      calls.push("restoreIntegrity");
      state.intact = true;
    },
    remount: () => {
      calls.push("remount");
      state.mounted = true;
      state.intact = true;
    },
    now: () => state.at,
    onTamper: (detail) => reports.push(detail),
  };
  return {
    hooks,
    calls,
    reports,
    /** The page removes the overlay host from the document. */
    remove: () => { state.mounted = false; state.intact = false; },
    /** The page keeps the host but neutralises it (display:none, z-index, attribute strip). */
    neutralise: () => { state.intact = false; },
    advance: (ms: number) => { state.at += ms; },
    at: () => state.at,
  };
}

/* ── The three tamper shapes ─────────────────────────────────────────────── */

test("SD-701: an untouched overlay costs nothing", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  for (let i = 0; i < 50; i += 1) assert.equal(sentinel.check(), "none");
  assert.deepEqual(page.calls, [], "a quiet page must never trigger a repair");
  assert.deepEqual(page.reports, [], "and must never generate an audit event");
  assert.deepEqual(sentinel.stats(), { remounts: 0, restores: 0, reports: 0, stopped: false });
});

test("SD-702: removing the host re-mounts it", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  page.remove();
  assert.equal(sentinel.check(), "remounted");
  assert.deepEqual(page.calls, ["remount"]);
  assert.equal(sentinel.stats().remounts, 1);
  // And the overlay is healthy again, so the next tick is free.
  assert.equal(sentinel.check(), "none");
});

test("SD-703: neutralising the host restores its integrity without a re-mount", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  page.neutralise();
  assert.equal(sentinel.check(), "restored");
  assert.deepEqual(page.calls, ["restoreIntegrity"], "a present host must be repaired in place, not rebuilt");
  assert.equal(sentinel.stats().remounts, 0);
  assert.equal(sentinel.stats().restores, 1);
});

test("SD-704: removal is diagnosed before integrity, so a removed host is never merely 'restored'", () => {
  // `restoreIntegrity()` on a detached node would silently do nothing and report success.
  const page = harness({ mounted: false, intact: true });
  const sentinel = createOverlaySentinel(page.hooks);
  assert.equal(sentinel.check(), "remounted");
  assert.deepEqual(page.calls, ["remount"]);
});

test("SD-705: an alternating remove / neutralise attack is repaired on every tick", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  const outcomes: SentinelOutcome[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i % 2 === 0) page.remove();
    else page.neutralise();
    outcomes.push(sentinel.check());
    page.advance(100);
  }
  assert.deepEqual(outcomes, ["remounted", "restored", "remounted", "restored", "remounted", "restored"]);
  assert.equal(sentinel.stats().remounts, 3);
  assert.equal(sentinel.stats().restores, 3);
});

/* ── The bounds ──────────────────────────────────────────────────────────── */

test("SD-710: the repair budget is shared across both repair kinds", () => {
  // Per-kind budgets are bypassable: the page alternates shapes and each budget stays half
  // spent for ever. One budget over both kinds is what actually bounds the loop.
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks, { maxActions: 4, windowMs: 10_000 });
  const outcomes: SentinelOutcome[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (i % 2 === 0) page.remove();
    else page.neutralise();
    outcomes.push(sentinel.check());
  }
  assert.deepEqual(outcomes, ["remounted", "restored", "remounted", "restored", "budget_exhausted", "stopped"]);
  assert.equal(page.calls.length, 4, "no repair may happen after the budget is spent");
});

test("SD-711: exhaustion is terminal — the watchdog does not silently re-arm", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks, { maxActions: 1, windowMs: 1_000 });
  page.remove();
  assert.equal(sentinel.check(), "remounted");
  page.remove();
  assert.equal(sentinel.check(), "budget_exhausted");
  // Long past the window: a spent watchdog stays stood down rather than resuming the loop.
  page.advance(60_000);
  page.remove();
  assert.equal(sentinel.check(), "stopped");
  assert.equal(sentinel.stats().stopped, true);
});

test("SD-712: the budget window slides, so slow legitimate churn is not treated as an attack", () => {
  // A site that re-renders its composer every few seconds must not exhaust the budget.
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks, { maxActions: 3, windowMs: 1_000 });
  for (let i = 0; i < 10; i += 1) {
    page.remove();
    assert.equal(sentinel.check(), "remounted", `tick ${i} should still repair`);
    page.advance(2_000); // one repair per window
  }
  assert.equal(sentinel.stats().stopped, false);
  assert.equal(sentinel.stats().remounts, 10);
});

test("SD-713: the shipped budget tolerates real churn but still bounds a tight loop", () => {
  assert.ok(SENTINEL_MAX_ACTIONS >= 5, `budget ${SENTINEL_MAX_ACTIONS} is too tight for a re-rendering site`);
  assert.ok(SENTINEL_MAX_ACTIONS <= 100, `budget ${SENTINEL_MAX_ACTIONS} does not bound a loop`);
  assert.ok(SENTINEL_WINDOW_MS >= 1_000 && SENTINEL_WINDOW_MS <= 60_000, `window ${SENTINEL_WINDOW_MS}ms`);
});

/* ── The audit channel cannot be used as an amplifier ─────────────────────── */

test("SD-720: tamper reports are capped so a repair loop cannot flood the audit endpoint", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks, { maxActions: 50, windowMs: 60_000, maxTamperReports: 2 });
  for (let i = 0; i < 20; i += 1) {
    page.remove();
    sentinel.check();
  }
  assert.equal(page.reports.length, 2, `report cap not enforced (${page.reports.length} reports)`);
  assert.equal(sentinel.stats().remounts, 20, "capping the reports must not cap the repairs");
  assert.ok(SENTINEL_MAX_TAMPER_REPORTS <= 5, `shipped report cap ${SENTINEL_MAX_TAMPER_REPORTS} is an amplifier`);
});

test("SD-721: the first report names the tamper shape, and no report carries prompt text", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  page.remove();
  sentinel.check();
  page.neutralise();
  sentinel.check();
  assert.match(page.reports[0], /removed from the page/);
  assert.match(page.reports[1], /integrity was restored/);
  for (const report of page.reports) {
    assert.ok(report.length < 200, "a tamper report is a label, not a payload");
  }
});

test("SD-722: exhaustion is itself auditable when the cap has room", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks, { maxActions: 1, windowMs: 1_000, maxTamperReports: 5 });
  page.remove();
  sentinel.check();
  page.remove();
  assert.equal(sentinel.check(), "budget_exhausted");
  assert.match(page.reports.at(-1)!, /budget exhausted/);
});

/* ── A missing audit hook is not a crash, and a dismiss is not an attack ──── */

test("SD-730: the sentinel works with no audit hook wired", () => {
  const page = harness();
  const { onTamper: _drop, ...rest } = page.hooks;
  const sentinel = createOverlaySentinel(rest as SentinelHooks);
  page.remove();
  assert.equal(sentinel.check(), "remounted");
  assert.equal(sentinel.stats().reports, 1, "the report is still counted against the cap");
});

test("SD-731: a legitimate dismiss stands the watchdog down for good", () => {
  const page = harness();
  const sentinel = createOverlaySentinel(page.hooks);
  sentinel.stop();
  page.remove();
  assert.equal(sentinel.check(), "stopped");
  assert.deepEqual(page.calls, [], "closing the overlay must not fight the page that closed it");
});

/* ── Honest scope: the watchdog is not the enforcement ───────────────────── */

test("SD-740: the overlay is the explanation, not the control that stops the submission", () => {
  // If losing the overlay released the prompt, budget exhaustion would be a bypass rather than
  // a safe stand-down. These two files are where that claim has to be true.
  const interceptor = readFileSync("apps/extension/src/content/submit-interceptor.ts", "utf8");
  const preventAt = interceptor.indexOf("event.preventDefault()");
  // The *call*, not the import — an `import { showSoterOverlay }` line sits at the top of the
  // file and would make this ordering assertion pass for the wrong reason.
  const overlayAt = interceptor.indexOf("showSoterOverlay({");
  assert.ok(preventAt > 0, "the interceptor must cancel the gesture");
  assert.ok(overlayAt > 0, "the interceptor must render a verdict");
  assert.ok(preventAt < overlayAt, "the gesture must already be cancelled before any overlay exists");
  assert.match(interceptor, /stopImmediatePropagation\(\)/, "other listeners must not resume the submit");

  const worker = readFileSync("apps/extension/src/background/service-worker.ts", "utf8");
  assert.match(worker, /networkBlock\.arm\(/, "the network-layer window is armed off the DOM entirely");
});

test("SD-741: the sentinel logic holds no DOM or chrome reference of its own", () => {
  // Everything is expressed through injected hooks, which is what makes SS-6 unit-testable at
  // all — and also means the sentinel cannot be a second, untested path into the page.
  const source = readFileSync("apps/extension/src/content/overlay-sentinel.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  for (const forbidden of ["document", "window.", "chrome.", "shadowRoot", "querySelector"]) {
    assert.equal(source.includes(forbidden), false, `overlay-sentinel.ts must not reference ${forbidden}`);
  }
});
