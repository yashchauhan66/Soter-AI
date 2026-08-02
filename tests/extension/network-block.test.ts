/**
 * SS-9 adversarial tests for the network-layer deny window.
 *
 * This is the control that turns a `block` verdict from advisory into enforced against the
 * page's *own* `fetch()`, so the tests are written as the two questions a reviewer should ask
 * of anything that blocks network traffic: does it deny what it claims to, and can it deny
 * anything else? The second question takes up the larger half of the file — a rule that
 * outlives its window, escapes its tab, or catches the extension's own audit POST is a bug
 * with a wider blast radius than the hole it closes.
 *
 * `chrome.declarativeNetRequest` is injected (`DnrSessionRuleSurface`), so the whole rule
 * lifecycle runs here with no browser at all: every rule object that would reach Chrome is
 * inspected directly, the clock and both timers are fake, and each failure path is driven by
 * making the fake API reject. That a real Chromium *honours* these rules is a separate claim
 * and is proved separately, against a packaged extension, by RT-712 and RT-713.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NETWORK_BLOCK_MAX_ACTIVE,
  NETWORK_BLOCK_METHODS,
  NETWORK_BLOCK_RESOURCE_TYPES,
  NETWORK_BLOCK_RULE_ID_MAX,
  NETWORK_BLOCK_RULE_ID_MIN,
  NETWORK_BLOCK_TTL_MS,
  chromeDnrSessionRules,
  createNetworkBlockGuard,
  type DnrSessionRuleSurface,
  type NetworkBlockRule,
} from "../../apps/extension/src/background/network-block";

const DESTINATION = "https://chatgpt.com/c/abc-123?model=x";
const TAB = 42;

interface Update {
  addRules?: NetworkBlockRule[];
  removeRuleIds?: number[];
}

/** A fake DNR surface, a fake clock and fake timers, with scriptable failures. */
function lab(options: { dnr?: boolean; fail?: "add" | "remove" | "list" } = {}) {
  const updates: Update[] = [];
  const installed = new Set<number>();
  const events: string[] = [];
  const sweepRequests: number[] = [];
  const timers = new Map<number, { dueAt: number; run: () => void }>();
  let nextHandle = 1;
  let clock = 1_000;

  const dnr: DnrSessionRuleSurface = {
    async updateSessionRules(update) {
      updates.push(update);
      const isAdd = Boolean(update.addRules?.length);
      if (options.fail === "add" && isAdd) throw new Error("QUOTA_EXCEEDED");
      if (options.fail === "remove" && !isAdd) throw new Error("no such rule");
      for (const id of update.removeRuleIds ?? []) installed.delete(id);
      for (const rule of update.addRules ?? []) installed.add(rule.id);
    },
    async getSessionRules() {
      if (options.fail === "list") throw new Error("declarativeNetRequest unavailable");
      return [...installed].map((id) => ({ id }));
    },
  };

  const guard = createNetworkBlockGuard({
    dnr: options.dnr === false ? null : dnr,
    now: () => clock,
    setTimer: (run, ms) => {
      const handle = nextHandle;
      nextHandle += 1;
      timers.set(handle, { dueAt: clock + ms, run });
      return handle;
    },
    clearTimer: (handle) => void timers.delete(handle as number),
    scheduleSweep: (delayMs) => sweepRequests.push(delayMs),
    onEvent: (message) => events.push(message),
  });

  return {
    guard,
    updates,
    installed,
    events,
    sweepRequests,
    advance: (ms: number) => { clock += ms; },
    pendingTimers: () => timers.size,
    /** Fire every timer whose deadline has passed, then let its async removal settle. */
    async runDueTimers() {
      for (const [handle, timer] of [...timers]) {
        if (timer.dueAt <= clock) {
          timers.delete(handle);
          timer.run();
        }
      }
      await new Promise((resolve) => setImmediate(resolve));
    },
    addedRules: () => updates.flatMap((update) => update.addRules ?? []),
    /** Ids in removal-only calls — an install carries a defensive removal of its own id. */
    removals: () => updates.filter((u) => !u.addRules?.length).flatMap((u) => u.removeRuleIds ?? []),
  };
}

/* ── What the rule denies, and what it must leave alone ───────────────────── */

test("NB-701: an armed rule denies one tab's mutating requests to one host", async () => {
  const env = lab();
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION });
  assert.equal(outcome.applied, true);
  assert.equal(outcome.host, "chatgpt.com");

  const [rule, ...extra] = env.addedRules();
  assert.ok(rule, "a rule must have been handed to the DNR API");
  assert.deepEqual(extra, [], "one verdict must install exactly one rule");
  assert.deepEqual(rule.action, { type: "block" });
  assert.deepEqual(rule.condition.tabIds, [TAB], "an unscoped rule would apply to every tab");
  assert.equal(rule.condition.urlFilter, "||chatgpt.com/", "host-anchored: the page POSTs to a path we never saw");
  assert.deepEqual(rule.condition.initiatorDomains, ["chatgpt.com"]);
  assert.deepEqual(rule.condition.requestMethods, [...NETWORK_BLOCK_METHODS]);
  assert.equal(rule.condition.requestMethods.includes("get"), false, "the page's own GETs must keep working");
  assert.deepEqual(rule.condition.resourceTypes, [...NETWORK_BLOCK_RESOURCE_TYPES]);
  assert.equal(rule.condition.resourceTypes.includes("main_frame"), false, "navigation must never be denied");
  assert.ok(rule.id >= NETWORK_BLOCK_RULE_ID_MIN && rule.id <= NETWORK_BLOCK_RULE_ID_MAX, `id ${rule.id} out of range`);
});

test("NB-702: the resource types cover the ways a page sends a body, and claim nothing more", () => {
  const types: string[] = [...NETWORK_BLOCK_RESOURCE_TYPES];
  assert.ok(types.includes("xmlhttprequest"), "page fetch() and XHR");
  assert.ok(types.includes("ping"), "navigator.sendBeacon is a POST with no fetch involved");
  assert.ok(types.includes("other"), "requests Chromium does not otherwise classify");
  // A rule carrying `requestMethods` cannot match a handshake, and DNR does not see frames on
  // an established connection at all, so listing this would be a claim the control cannot keep.
  assert.equal(types.includes("websocket"), false, "websocket coverage would be a false claim");
});

test("NB-703: installing a rule also clears that id, so a stale rule cannot survive id reuse", async () => {
  const env = lab();
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION });
  assert.deepEqual(env.updates[0].removeRuleIds, [outcome.ruleId]);
});

test("NB-704: no tab means no rule, so the worker's own audit POSTs can never be denied", async () => {
  // Service-worker-initiated requests report tab id −1. A rule always names a real tab, and
  // arming without one is refused outright rather than widened to every tab.
  for (const tabId of [undefined, -1]) {
    const env = lab();
    const outcome = await env.guard.arm({ tabId, url: DESTINATION });
    assert.equal(outcome.applied, false);
    assert.equal(outcome.reason, "no_tab");
    assert.deepEqual(env.addedRules(), [], `tabId ${String(tabId)} must install nothing`);
    assert.equal(env.guard.activeCount(), 0);
  }
});

/* ── The window closes, by two independent mechanisms ─────────────────────── */

test("NB-710: the deny window closes itself when its timer fires", async () => {
  const env = lab();
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  assert.equal(env.guard.activeCount(), 1);
  assert.equal(env.installed.has(outcome.ruleId!), true);

  env.advance(1_000);
  await env.runDueTimers();
  assert.equal(env.guard.activeCount(), 0, "the rule must remove itself");
  assert.equal(env.installed.has(outcome.ruleId!), false, "and must actually be removed from the browser");
  assert.deepEqual(env.removals(), [outcome.ruleId]);
});

test("NB-711: a rule whose owning worker died is removed by the sweep, not left behind", async () => {
  // The in-process timer dies with the service worker. The alarm-driven sweep is what closes
  // the window in that case, and it must close only the window that actually expired.
  const env = lab();
  const short = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  const long = await env.guard.arm({ tabId: 7, url: "https://claude.ai/chat", ttlMs: 9_000 });

  env.advance(1_000);
  assert.equal(await env.guard.sweep(), 1, "only the expired rule may be swept");
  assert.deepEqual(env.guard.activeRuleIds(), [long.ruleId]);
  assert.equal(env.installed.has(short.ruleId!), false);
  assert.equal(env.installed.has(long.ruleId!), true, "an unexpired window must survive the sweep");
});

test("NB-712: the platform is asked to wake us up, so the timer is not the only way out", async () => {
  const env = lab();
  await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  assert.deepEqual(env.sweepRequests, [1_000]);
});

test("NB-713: the shipped TTL is a replay window, not a lockout", () => {
  assert.ok(NETWORK_BLOCK_TTL_MS <= 10_000, `TTL ${NETWORK_BLOCK_TTL_MS}ms would break a site the user still needs`);
  assert.ok(NETWORK_BLOCK_TTL_MS >= 500, `TTL ${NETWORK_BLOCK_TTL_MS}ms is too short to cover the replay it exists for`);
});

/* ── The bounds: id range, concurrency cap, id reuse ──────────────────────── */

test("NB-720: the concurrency cap is enforced and every id stays inside the reserved range", async () => {
  const env = lab();
  const ids: number[] = [];
  for (let i = 0; i < NETWORK_BLOCK_MAX_ACTIVE; i += 1) {
    const outcome = await env.guard.arm({ tabId: 100 + i, url: `https://host-${i}.example.com/chat` });
    assert.equal(outcome.applied, true, `arm ${i} should have succeeded`);
    ids.push(outcome.ruleId!);
  }
  const overflow = await env.guard.arm({ tabId: 999, url: DESTINATION });
  assert.equal(overflow.applied, false);
  assert.equal(overflow.reason, "cap_reached");
  assert.equal(new Set(ids).size, ids.length, "no id may be handed out twice");
  for (const id of ids) assert.ok(id >= NETWORK_BLOCK_RULE_ID_MIN && id <= NETWORK_BLOCK_RULE_ID_MAX, `id ${id}`);
  assert.equal(env.guard.activeCount(), NETWORK_BLOCK_MAX_ACTIVE);
  assert.ok(NETWORK_BLOCK_MAX_ACTIVE <= 16, `cap ${NETWORK_BLOCK_MAX_ACTIVE} is large enough to break a browsing session`);
  assert.ok(
    NETWORK_BLOCK_MAX_ACTIVE <= NETWORK_BLOCK_RULE_ID_MAX - NETWORK_BLOCK_RULE_ID_MIN + 1,
    "the cap must fit inside the reserved id range",
  );
});

test("NB-721: a freed id carries no stale timer that would close the next window early", async () => {
  // The bug this pins: sweep removes rule 9000 but leaves its timer armed; the next verdict
  // reuses id 9000, the old timer fires, and the new deny window ends after milliseconds.
  const env = lab();
  const first = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  env.advance(1_000);
  assert.equal(await env.guard.sweep(), 1);
  assert.equal(env.pendingTimers(), 0, "sweeping must cancel the timer that owned the rule");

  const second = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  assert.equal(second.ruleId, first.ruleId, "the reserved range must be reusable");
  assert.equal(env.pendingTimers(), 1, "exactly one timer may own an id");
});

test("NB-722: the cap bounds concurrency, not the tab's lifetime", async () => {
  const env = lab();
  for (let i = 0; i < NETWORK_BLOCK_MAX_ACTIVE; i += 1) {
    await env.guard.arm({ tabId: 100 + i, url: `https://host-${i}.example.com/chat`, ttlMs: 1_000 });
  }
  env.advance(1_000);
  // No timer ran (worker death), so the cap is only recoverable if `arm` sweeps first.
  const next = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  assert.equal(next.applied, true, "a tab must not be permanently unable to arm a new window");
  assert.equal(env.guard.activeCount(), 1);
});

/* ── Every refusal is explicit, and no refusal installs anything ──────────── */

test("NB-730: the managed kill switch is checked before anything else happens", async () => {
  const env = lab();
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION, enabled: false });
  assert.deepEqual(outcome, { applied: false, reason: "disabled" });
  assert.deepEqual(env.updates, [], "a disabled layer must not touch the DNR API at all");
});

test("NB-731: a browser without session rules is an honest no-op, not a silent claim", async () => {
  const env = lab({ dnr: false });
  assert.deepEqual(await env.guard.arm({ tabId: TAB, url: DESTINATION }), { applied: false, reason: "unsupported" });
  assert.equal(await env.guard.sweep(), 0);
  assert.equal(await env.guard.reclaimOrphans(), 0);
  assert.equal(env.guard.activeCount(), 0);
});

test("NB-732: only http(s) destinations can be scoped, and the rest are refused", async () => {
  const env = lab();
  for (const url of [
    "chrome-extension://abcdefghijklmnop/popup.html",
    "file:///C:/tmp/prompt.html",
    "data:text/html,<p>hi</p>",
    "wss://chatgpt.com/socket",
    "not a url",
    "",
  ]) {
    const outcome = await env.guard.arm({ tabId: TAB, url });
    assert.equal(outcome.applied, false, `${url} must not arm a rule`);
    assert.equal(outcome.reason, "unsupported_url", `${url} produced ${outcome.reason}`);
  }
  assert.deepEqual(env.addedRules(), []);
});

test("NB-733: a rejected install reports the failure and pins nothing", async () => {
  const env = lab({ fail: "add" });
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION });
  assert.equal(outcome.applied, false);
  assert.equal(outcome.reason, "dnr_error");
  assert.equal(outcome.host, "chatgpt.com", "the host is still reported so the audit trail is complete");
  assert.equal(env.guard.activeCount(), 0, "a rule that was never installed must not consume its id");
  assert.equal(env.pendingTimers(), 0, "and must not schedule the removal of a rule that does not exist");
  assert.ok(env.events.some((message) => message.includes("could not install rule")), "the failure must be reported");
});

test("NB-734: a removal the browser rejects still drops the local record", async () => {
  // Keeping the record would pin the id for ever *and* hide the rule from the orphan sweep,
  // which is the only mechanism left that can clear it.
  const env = lab({ fail: "remove" });
  const outcome = await env.guard.arm({ tabId: TAB, url: DESTINATION, ttlMs: 1_000 });
  env.advance(1_000);
  assert.equal(await env.guard.sweep(), 0, "a failed removal must not be reported as a removal");
  assert.equal(env.guard.activeCount(), 0, "the guard must not pin a rule it can no longer account for");
  assert.equal(env.installed.has(outcome.ruleId!), true, "the browser still has it — reclaim is what clears it");
  assert.ok(env.events.some((message) => message.includes("failed to remove rules")));
});

/* ── Nothing outlives the worker that created it ──────────────────────────── */

test("NB-740: a dead generation's rules are reclaimed, and ids we do not own are untouched", async () => {
  const env = lab();
  // Left behind by a previous service-worker generation, whose timers are gone with it.
  env.installed.add(NETWORK_BLOCK_RULE_ID_MIN + 1);
  env.installed.add(NETWORK_BLOCK_RULE_ID_MAX);
  // Ids outside the reserved range belong to something else and are not ours to remove.
  env.installed.add(1);
  env.installed.add(NETWORK_BLOCK_RULE_ID_MAX + 1);
  const live = await env.guard.arm({ tabId: TAB, url: DESTINATION });

  assert.equal(await env.guard.reclaimOrphans(), 2);
  assert.equal(env.installed.has(NETWORK_BLOCK_RULE_ID_MIN + 1), false);
  assert.equal(env.installed.has(NETWORK_BLOCK_RULE_ID_MAX), false);
  assert.equal(env.installed.has(1), true, "an id outside the reserved range must never be removed");
  assert.equal(env.installed.has(NETWORK_BLOCK_RULE_ID_MAX + 1), true);
  assert.equal(env.installed.has(live.ruleId!), true, "this generation's own live rule is not an orphan");
  assert.deepEqual(env.guard.activeRuleIds(), [live.ruleId]);
});

test("NB-741: a reclaim that cannot list the rules fails quietly instead of throwing", async () => {
  const env = lab({ fail: "list" });
  assert.equal(await env.guard.reclaimOrphans(), 0);
  assert.ok(env.events.some((message) => message.includes("orphan reclaim failed")));
});

test("NB-750: the live adapter reports unsupported rather than half-wiring a partial API", () => {
  const scope = globalThis as Record<string, unknown>;
  const real = scope.chrome;
  try {
    delete scope.chrome;
    assert.equal(chromeDnrSessionRules(), null, "no chrome global at all");
    scope.chrome = {};
    assert.equal(chromeDnrSessionRules(), null, "no declarativeNetRequest");
    scope.chrome = { declarativeNetRequest: { updateSessionRules() {} } };
    assert.equal(chromeDnrSessionRules(), null, "writable but not readable back, so orphans could never be reclaimed");
    scope.chrome = { declarativeNetRequest: { getSessionRules() {} } };
    assert.equal(chromeDnrSessionRules(), null, "readable but not writable");
    const both = { updateSessionRules() {}, getSessionRules() {} };
    scope.chrome = { declarativeNetRequest: both };
    assert.equal(chromeDnrSessionRules(), both, "a complete API must be adopted");
  } finally {
    if (real === undefined) delete scope.chrome;
    else scope.chrome = real;
  }
});

/* ── The caller is part of the control ────────────────────────────────────── */

test("NB-760: the worker arms only on a block verdict for a sending gesture, using the sender's tab", () => {
  const worker = readFileSync("apps/extension/src/background/service-worker.ts", "utf8");
  const armAt = worker.indexOf("networkBlock.arm(");
  assert.ok(armAt > 0, "the guard must have a wired caller");

  const condition = worker.slice(Math.max(0, armAt - 400), armAt);
  assert.match(condition, /result\.action === "block"/, "no deny window without a block verdict");
  assert.match(condition, /"submit"|"file_upload"/, "a paste or a context-menu scan sends nothing to deny");
  assert.match(worker, /disableNetworkLayerEnforcement !== true/, "the managed kill switch must reach the guard");
  // The tab id must come from the message *sender*. A content script that could name a tab
  // would be able to deny a different tab's traffic from the page it already controls.
  assert.match(worker, /from\?\.tab\?\.id/);
  assert.equal(/tabId:\s*(Number\()?payload\./.test(worker), false, "a tab id from the payload is page-controlled");
  assert.match(worker, /networkBlock\.reclaimOrphans\(\)/, "every worker start must reclaim a dead generation's rules");
});

test("NB-761: the only action this module can take is a block", () => {
  // A redirect or a header rewrite would send or alter the very request being denied, which is
  // a materially different and much larger power than refusing it.
  const source = readFileSync("apps/extension/src/background/network-block.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  assert.match(source, /type:\s*"block"/);
  for (const forbidden of [
    "redirect",
    "modifyHeaders",
    "allowAllRequests",
    "updateDynamicRules",
    "updateStaticRules",
    "updateEnabledRulesets",
  ]) {
    assert.equal(source.includes(forbidden), false, `network-block.ts must not use ${forbidden}`);
  }
});
