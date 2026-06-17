// SECURITY: Atomic rate limit + monthly metering.
// - Per-API-key RPM uses a fixed-window keyed by minute bucket.
// - Per-organization monthly metering uses a YYYY-MM bucket and is the
//   authoritative usage counter for plan enforcement.
// - The DB-backed UsageCounter remains as a per-day analytics aggregate.
//   Redis is the fast, atomic source for plan checks; DB is the slower,
//   queryable history.

import {
  AGENCY_LIMIT_PER_MONTH,
  ENTERPRISE_LIMIT_PER_MONTH,
  FREE_PLAN_LIMIT_PER_MONTH,
  PRO_LIMIT_PER_MONTH,
  STARTER_LIMIT_PER_MONTH,
  USAGE_WARNING_THRESHOLD,
} from "./guard/constants";
import { db } from "./db";
import { getRedis } from "./redis";

export const PLAN_LIMITS: Record<string, number> = {
  FREE: FREE_PLAN_LIMIT_PER_MONTH,
  DEMO: FREE_PLAN_LIMIT_PER_MONTH,
  STARTER: STARTER_LIMIT_PER_MONTH,
  PRO: PRO_LIMIT_PER_MONTH,
  AGENCY: AGENCY_LIMIT_PER_MONTH,
  ENTERPRISE: ENTERPRISE_LIMIT_PER_MONTH,
};

export function planLimit(plan: string) {
  return PLAN_LIMITS[plan] ?? FREE_PLAN_LIMIT_PER_MONTH;
}

function minuteBucketKey(identifier: string) {
  const minute = Math.floor(Date.now() / 60_000);
  return `crg:rl:${identifier}:m${minute}`;
}

function monthBucketKey(scope: string) {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `crg:meter:${scope}:${yyyymm}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRedisRateLimit(identifier: string, limit: number, windowMs = 60_000): Promise<RateLimitResult> {
  const redis = getRedis();
  const key = minuteBucketKey(identifier);
  const count = await redis.incrBy(key, 1);
  if (count === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  const ttl = await redis.ttl(key);
  const resetAt = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + windowMs;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

export async function checkRedisFixedWindowRateLimit(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const safeWindowMs = Math.max(1_000, windowMs);
  const bucket = Math.floor(now / safeWindowMs);
  const key = `crg:rl:${identifier}:w${safeWindowMs}:${bucket}`;
  const count = await redis.incrBy(key, 1);
  if (count === 1) {
    await redis.expire(key, Math.ceil(safeWindowMs / 1000));
  }
  const resetAt = (bucket + 1) * safeWindowMs;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

export interface MonthlyUsage {
  used: number;
  limit: number;
  remaining: number;
  warning: boolean;
  exceeded: boolean;
  ratio: number;
}

export async function recordMonthlyUsage(organizationId: string, projectId: string, plan: string, increment = 1, limitOverride?: number | null): Promise<MonthlyUsage> {
  const redis = getRedis();
  const orgKey = monthBucketKey(`org:${organizationId}`);
  const projectKey = monthBucketKey(`project:${projectId}`);
  const used = await redis.incrBy(orgKey, increment);
  if (used === increment) {
    // expire the bucket ~ 35 days into the future so it survives the calendar month
    await redis.expire(orgKey, 60 * 60 * 24 * 35);
  }
  const projectUsed = await redis.incrBy(projectKey, increment);
  if (projectUsed === increment) await redis.expire(projectKey, 60 * 60 * 24 * 35);

  const limit = limitOverride && limitOverride > 0 ? limitOverride : planLimit(plan);
  const ratio = limit > 0 ? used / limit : 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    warning: ratio >= USAGE_WARNING_THRESHOLD && used <= limit,
    exceeded: used > limit,
    ratio,
  };
}

export async function peekMonthlyUsage(organizationId: string, plan: string, limitOverride?: number | null): Promise<MonthlyUsage> {
  const redis = getRedis();
  const orgKey = monthBucketKey(`org:${organizationId}`);
  const used = (await redis.get<number>(orgKey)) ?? 0;
  const limit = limitOverride && limitOverride > 0 ? limitOverride : planLimit(plan);
  const ratio = limit > 0 ? used / limit : 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    warning: ratio >= USAGE_WARNING_THRESHOLD && used <= limit,
    exceeded: used > limit,
    ratio,
  };
}

/**
 * Backwards-compatible per-project monthly usage. Phase 2 callers used the
 * DB usage_counter aggregate. Phase 3 prefers Redis; the DB is still updated
 * (in lib/guard/persistence.ts) for analytics and for environments without
 * Redis.
 */
export async function checkMonthlyLimit(projectId: string, plan: string): Promise<MonthlyUsage & { allowed: boolean }> {
  // Try Redis first (project-scoped bucket).
  const redis = getRedis();
  const projectKey = monthBucketKey(`project:${projectId}`);
  const redisValue = await redis.get<number>(projectKey);
  let used: number;
  if (redisValue === null) {
    // Cold cache: derive from DB UsageCounter aggregate to avoid
    // under-reporting until the next request rehydrates Redis.
    const aggregate = await getMonthlyUsage(projectId);
    used = aggregate.requestCount;
  } else {
    used = redisValue;
  }
  const limit = planLimit(plan);
  const ratio = limit > 0 ? used / limit : 0;
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    warning: ratio >= USAGE_WARNING_THRESHOLD && used < limit,
    exceeded: used >= limit,
    ratio,
  };
}

export async function getMonthlyUsage(projectId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const aggregate = await db.usageCounter.aggregate({
    where: { projectId, date: { gte: monthStart } },
    _sum: { requestCount: true, blockedCount: true, redactedCount: true },
  });
  return {
    requestCount: aggregate._sum.requestCount ?? 0,
    blockedCount: aggregate._sum.blockedCount ?? 0,
    redactedCount: aggregate._sum.redactedCount ?? 0,
  };
}

// --- Legacy in-memory bucket retained for tests + as a generic helper ---

type Bucket = { count: number; resetAt: number };
const memBuckets = new Map<string, Bucket>();
let lastCleanup = 0;

function cleanupBuckets(now: number) {
  if (now - lastCleanup < 60_000 && memBuckets.size < 10_000) return;
  for (const [key, bucket] of memBuckets) if (bucket.resetAt <= now) memBuckets.delete(key);
  lastCleanup = now;
}

export function checkMemoryRateLimit(identifier: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  cleanupBuckets(now);
  const current = memBuckets.get(identifier);
  if (!current || current.resetAt <= now) {
    memBuckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function resetRateLimitBucketsForTests() {
  memBuckets.clear();
  lastCleanup = 0;
}
