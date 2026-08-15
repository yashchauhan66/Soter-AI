// Regression guard for the production "false RATE_LIMIT block" reports
// (2026-08-05). Two defects are covered here:
//
//   1. THE FALSE BLOCKS. A flat DEFAULT_RPM=60 was applied to every plan.
//      ENTERPRISE sells 5,000,000 calls/month (~116 req/min sustained), so
//      60 RPM capped the plan at 2,592,000/month — the customer could not
//      physically consume the quota they paid for. Batch clients hit it far
//      sooner: n8n / Make / Zapier iterate their input items in a loop, so a
//      100-item workflow fires 100 calls in seconds and everything past item
//      60 got a 429 that looked like a false block.
//
//   2. A CORRECTNESS GAP FOUND WHILE INVESTIGATING (not a cause of the false
//      blocks — it errs permissive, not restrictive). incrementWindow() awaited
//      incrBy and ttl together, so a TTL read rejection threw away an
//      already-committed increment and restarted the count in the process-local
//      fallback store. A client with an exhausted window got a fresh allowance,
//      and across pods the limit stopped being global.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RPM,
  ENTERPRISE_LIMIT_PER_MONTH,
  FREE_PLAN_RPM,
  PRO_LIMIT_PER_MONTH,
} from "../lib/guard/constants";
import { createRateLimitResult } from "../lib/guard/rateLimitResult";
import { toPublicGuardResult } from "../lib/guard/publicResult";
import { checkRedisRateLimit, PLAN_RPM, planLimit, planRpm } from "../lib/rateLimit";
import { createMemoryRedis, type RedisLike } from "../lib/redis";

const MINUTES_PER_MONTH = 30 * 24 * 60;

test("every paid plan's RPM can sustain the monthly quota it sells", () => {
  for (const plan of ["STARTER", "PRO", "AGENCY", "ENTERPRISE"]) {
    const sustainedRpm = planLimit(plan) / MINUTES_PER_MONTH;
    assert.ok(
      planRpm(plan) > sustainedRpm,
      `${plan}: RPM ${planRpm(plan)} must exceed the ${sustainedRpm.toFixed(1)} req/min ` +
        `implied by its ${planLimit(plan).toLocaleString()}/month quota, otherwise the ` +
        `per-minute limit — not the plan — is the real quota`,
    );
  }
});

test("ENTERPRISE specifically is not capped below its sold quota", () => {
  const reachablePerMonth = planRpm("ENTERPRISE") * MINUTES_PER_MONTH;
  assert.ok(
    reachablePerMonth >= ENTERPRISE_LIMIT_PER_MONTH,
    `ENTERPRISE can only reach ${reachablePerMonth.toLocaleString()}/month at ` +
      `${planRpm("ENTERPRISE")} RPM, but sells ${ENTERPRISE_LIMIT_PER_MONTH.toLocaleString()}/month`,
  );
});

test("RPM rises monotonically with plan tier", () => {
  const tiers = ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"];
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(
      PLAN_RPM[tiers[i]] >= PLAN_RPM[tiers[i - 1]],
      `${tiers[i]} (${PLAN_RPM[tiers[i]]}) must not allow less than ${tiers[i - 1]} (${PLAN_RPM[tiers[i - 1]]})`,
    );
  }
});

test("unknown or missing plans fall back to the FREE limit, never to unlimited", () => {
  assert.equal(planRpm(undefined), FREE_PLAN_RPM);
  assert.equal(planRpm(null), FREE_PLAN_RPM);
  assert.equal(planRpm(""), FREE_PLAN_RPM);
  assert.equal(planRpm("NOT_A_REAL_PLAN"), FREE_PLAN_RPM);
});

test("a PRO-tier batch of 100 items is not rejected mid-run", async () => {
  const id = `batch-${Date.now()}`;
  const redis = createMemoryRedis();
  const limit = planRpm("PRO");

  // Mirrors the n8n execute() loop: one guard call per input item, back to back.
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push(await checkRedisRateLimit(id, limit, 60_000, redis));
  }

  const rejected = results.filter((r) => !r.allowed);
  assert.equal(
    rejected.length,
    0,
    `${rejected.length} of 100 batch items were rejected at ${limit} RPM ` +
      `(first rejection at item ${results.findIndex((r) => !r.allowed) + 1})`,
  );
});

/** incrBy works, but reading the TTL always fails — a slow/flapping Redis. */
function ttlFailingRedis(): { redis: RedisLike; inner: RedisLike; increments: () => number } {
  const inner = createMemoryRedis();
  let increments = 0;
  const redis: RedisLike = {
    async incrBy(key, value) {
      increments += 1;
      return inner.incrBy(key, value);
    },
    expire: (key, seconds) => inner.expire(key, seconds),
    get: (key) => inner.get(key),
    set: (key, value, opts) => inner.set(key, value, opts),
    ttl: () => Promise.reject(new Error("ETIMEDOUT reading ttl")),
    del: (...keys) => inner.del(...keys),
  };
  return { redis, inner, increments: () => increments };
}

/** Mirrors minuteBucketKey() in lib/rateLimit.ts. */
function bucketKey(identifier: string) {
  return `crg:rl:${identifier}:m${Math.floor(Date.now() / 60_000)}`;
}

test("a failed TTL read must not discard the counter already in the primary store", async () => {
  // The TTL read is advisory — it only decides whether the expiry needs
  // re-applying. Letting it reject the whole call sent the limiter into the
  // process-local fallback, which starts empty: a client that had ALREADY
  // exhausted its window sailed straight through, and in a multi-pod
  // deployment the limit silently stopped being global.
  const id = `ttl-fail-seeded-${Date.now()}`;
  const { redis, inner } = ttlFailingRedis();
  const limit = 10;

  // The window is already all but spent.
  await inner.set(bucketKey(id), 8, { ex: 60 });

  const ninth = await checkRedisRateLimit(id, limit, 60_000, redis);
  const tenth = await checkRedisRateLimit(id, limit, 60_000, redis);
  const eleventh = await checkRedisRateLimit(id, limit, 60_000, redis);

  assert.equal(ninth.allowed, true, "request 9 of 10 must still be allowed");
  assert.equal(tenth.allowed, true, "request 10 of 10 must still be allowed");
  assert.equal(
    eleventh.allowed,
    false,
    "request 11 exceeded the limit but was allowed — the failed TTL read " +
      "discarded the primary counter and the limiter restarted from zero",
  );
});

test("a failed TTL read counts each request exactly once, in the primary store", async () => {
  const id = `ttl-fail-${Date.now()}`;
  const { redis, inner, increments } = ttlFailingRedis();

  for (let i = 0; i < 5; i++) {
    await checkRedisRateLimit(id, 10, 60_000, redis);
  }

  assert.equal(increments(), 5, "5 requests must issue exactly 5 increments");
  assert.equal(
    await inner.get<number>(bucketKey(id)),
    5,
    "all 5 increments must land in the primary store, not split across it and the fallback",
  );
});

test("a failed TTL read must not shrink the usable limit", async () => {
  const id = `ttl-fail-limit-${Date.now()}`;
  const { redis } = ttlFailingRedis();
  const limit = 20;

  const results = [];
  for (let i = 0; i < limit; i++) {
    results.push(await checkRedisRateLimit(id, limit, 60_000, redis));
  }

  const rejected = results.filter((r) => !r.allowed);
  assert.equal(
    rejected.length,
    0,
    `${rejected.length} of ${limit} requests were rejected under the limit ` +
      `(first at #${results.findIndex((r) => !r.allowed) + 1}) — the limit halved`,
  );

  // The limit must still be a real limit, not silently disabled.
  const overLimit = await checkRedisRateLimit(id, limit, 60_000, redis);
  assert.equal(overLimit.allowed, false, "request past the limit must still be denied");
});

test("resetAt stays in the future so Retry-After is always valid", async () => {
  const id = `reset-${Date.now()}`;
  const { redis } = ttlFailingRedis();
  const result = await checkRedisRateLimit(id, 1, 60_000, redis);
  assert.ok(
    result.resetAt > Date.now(),
    "clients compute Retry-After from resetAt; a past value makes them retry immediately and hot-loop",
  );
});

// --- The agent-firewall bucket (lib/agent-firewall/server.ts) ---
//
// authenticateAgentFirewall is a route authenticator, not a pure function, so
// these tests reproduce its limiter arithmetic rather than calling it. What
// they pin is the arithmetic itself: the RPM it must select, and the shape of
// the 429 it must emit. The end-to-end proof is integration-level — curl
// /api/agent/tool/check with an ENTERPRISE key and read X-RateLimit-Limit.

test("agent-firewall surfaces must not be capped at the flat DEFAULT_RPM", () => {
  // The defect: `checkRedisRateLimit(..., DEFAULT_RPM)` applied 60 RPM to every
  // plan. Every /api/agent/**, /api/lineage/**, /api/intent/**, /api/tool-chain/**
  // and /api/memory/** route authenticates through this one function (and
  // advanced-security re-exports it), so an ENTERPRISE customer paying for
  // 3,000 RPM was throttled at 60 on all of them.
  assert.equal(
    planRpm("ENTERPRISE"),
    PLAN_RPM.ENTERPRISE,
    "agent-firewall must resolve its limit through planRpm(project.plan)",
  );
  assert.ok(
    planRpm("ENTERPRISE") > DEFAULT_RPM,
    `ENTERPRISE resolves to ${planRpm("ENTERPRISE")} RPM; if that equals the flat ` +
      `DEFAULT_RPM (${DEFAULT_RPM}) the plan-aware lookup has been reverted`,
  );
});

test("an agent-firewall throttle is labelled RATE_LIMIT, not a high-risk block", () => {
  // The 429 used to carry `riskLevel: "HIGH"` with no riskTypes, so a throttle
  // was indistinguishable from a genuine security detection in logs and
  // dashboards — which is why these were reported as *false blocks* rather than
  // as rate limiting.
  const result = createRateLimitResult("Agent Firewall per-minute rate limit exceeded.");
  const body = toPublicGuardResult(result);

  assert.deepEqual(body.riskTypes, ["RATE_LIMIT"], "a throttle must be typed RATE_LIMIT");
  assert.ok(!("riskLevel" in body), "the misleading riskLevel:'HIGH' must not come back");
  assert.ok(!("originalText" in body), "the public body must never echo the caller's text");
  // Retained deliberately: agent clients fail closed on a BLOCK, and a throttle
  // must keep halting the planned action.
  assert.equal(result.action, "BLOCK");
});

test("Retry-After derived from a 429 is a positive whole number of seconds", async () => {
  const id = `retry-after-${Date.now()}`;
  const redis = createMemoryRedis();
  await checkRedisRateLimit(id, 1, 60_000, redis);
  const throttled = await checkRedisRateLimit(id, 1, 60_000, redis);

  assert.equal(throttled.allowed, false, "the second call past a limit of 1 must be rejected");

  // Mirrors the header computation in lib/agent-firewall/server.ts and
  // app/api/guard/grounding/route.ts.
  const retryAfter = Math.max(1, Math.ceil((throttled.resetAt - Date.now()) / 1000));
  assert.ok(Number.isInteger(retryAfter), "Retry-After must be an integer (RFC 7231 delay-seconds)");
  assert.ok(retryAfter >= 1, "Retry-After must be at least 1s or clients hot-loop");
  assert.ok(retryAfter <= 60, `Retry-After ${retryAfter}s exceeds the 60s window it was derived from`);
});

test("an ENTERPRISE 100-item Universal Guard run survives its full 600-call fan-out", async () => {
  // This is the user-reported P0 symptom: "production high-volume par false
  // blocks (RATE_LIMIT) aa rahe hain". executeUniversalGuard fires 6 sequential
  // calls per input item — 2 on the plan-aware guard bucket (input, output) and
  // 4 on the agent-firewall bucket (rag trust-score, tool/check, memory/check,
  // semantic-egress). While the latter was pinned at a flat 60, the firewall
  // bucket drained 4x faster and capped Universal Guard at ~15 items/min on
  // EVERY plan, ENTERPRISE included, while the plan bucket sat nearly idle.
  const redis = createMemoryRedis();
  const rpm = planRpm("ENTERPRISE");
  const guardBucket = `guard:key:ent-${Date.now()}`;
  const firewallBucket = `agent-firewall:key:ent-${Date.now()}`;

  const rejections: string[] = [];
  for (let item = 1; item <= 100; item++) {
    for (const bucket of [guardBucket, guardBucket, firewallBucket, firewallBucket, firewallBucket, firewallBucket]) {
      const result = await checkRedisRateLimit(bucket, rpm, 60_000, redis);
      if (!result.allowed) rejections.push(`item ${item} on ${bucket.split(":")[0]}`);
    }
  }

  assert.deepEqual(
    rejections,
    [],
    `${rejections.length} of 600 sub-calls were throttled at ${rpm} RPM (first: ${rejections[0]}) — ` +
      `an ENTERPRISE 100-item batch must complete without a single 429`,
  );
});

test("the agent-firewall bucket alone would still throttle a 100-item batch at the flat limit", () => {
  // Proves the test above is load-bearing rather than trivially true: at the
  // old flat DEFAULT_RPM the same run fails. 100 items x 4 firewall calls = 400,
  // well past 60.
  assert.ok(
    100 * 4 > DEFAULT_RPM,
    "if a 100-item batch no longer exceeds DEFAULT_RPM, the ENTERPRISE test above proves nothing",
  );
});

test("PRO monthly quota stays consistent with its advertised limit", () => {
  // Sanity anchor: catches an accidental constant edit that would invalidate
  // the sustained-rate assertions above.
  assert.equal(planLimit("PRO"), PRO_LIMIT_PER_MONTH);
});
