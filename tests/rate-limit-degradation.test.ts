// Regression guard for the launch blocker found on 2026-08-03: an unreachable
// Redis made every rate-limited route (credentials sign-in, /api/guard/analyze)
// hang forever instead of answering, because the limiter awaited a store that
// never settled and never recovered. The limiter must now stay responsive and
// keep counting in-process when the distributed store is unusable.
import test from "node:test";
import assert from "node:assert/strict";
import { checkRedisFixedWindowRateLimit, checkRedisRateLimit } from "../lib/rateLimit";
import { createMemoryRedis, type RedisLike } from "../lib/redis";

function unreachableRedis(): RedisLike {
  const fail = () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
  return {
    incrBy: fail,
    expire: fail,
    get: fail,
    set: fail,
    ttl: fail,
    del: fail,
  } as unknown as RedisLike;
}

function countingRedis() {
  const inner = createMemoryRedis();
  let calls = 0;
  const wrapped: RedisLike = {
    async incrBy(key, value) {
      calls += 1;
      return inner.incrBy(key, value);
    },
    expire: (key, seconds) => inner.expire(key, seconds),
    get: (key) => inner.get(key),
    set: (key, value, opts) => inner.set(key, value, opts),
    ttl: (key) => inner.ttl(key),
    del: (...keys) => inner.del(...keys),
  };
  return { redis: wrapped, calls: () => calls };
}

test("fixed-window limiter still enforces its limit when Redis is unreachable", async () => {
  const id = `degrade-fixed-${Date.now()}`;
  const redis = unreachableRedis();
  const first = await checkRedisFixedWindowRateLimit(id, 2, 60_000, redis);
  const second = await checkRedisFixedWindowRateLimit(id, 2, 60_000, redis);
  const third = await checkRedisFixedWindowRateLimit(id, 2, 60_000, redis);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false, "third call must be denied by the in-process fallback");
  assert.ok(third.resetAt > Date.now(), "resetAt must stay in the future so Retry-After is valid");
});
