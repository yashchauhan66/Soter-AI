/**
 * Extension API rate limiting for Soter.
 *
 * Scope: organization, employee, device token, IP fallback
 * Limits by endpoint type:
 * - enrollment: 5 per hour per IP
 * - policy sync: 60 per hour per organization
 * - heartbeat: 120 per hour per device (normal volume ~12/hr)
 * - scan: 600 per hour per employee
 * - audit-log: 600 per hour per employee
 * - approval-request: 30 per hour per employee
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  name: string;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  enrollment: { windowMs: 60 * 60 * 1000, maxRequests: 5, name: "Extension enrollment" },
  "policy-sync": { windowMs: 60 * 60 * 1000, maxRequests: 60, name: "Policy sync" },
  heartbeat: { windowMs: 60 * 60 * 1000, maxRequests: 120, name: "Heartbeat" },
  scan: { windowMs: 60 * 60 * 1000, maxRequests: 600, name: "Scan" },
  "audit-log": { windowMs: 60 * 60 * 1000, maxRequests: 600, name: "Audit log" },
  "approval-request": { windowMs: 60 * 60 * 1000, maxRequests: 30, name: "Approval request" },
  "admin-approval": { windowMs: 60 * 60 * 1000, maxRequests: 120, name: "Admin approval actions" },
  "approval-status": { windowMs: 60 * 60 * 1000, maxRequests: 60, name: "Approval status polling" },
  "emergency-lockdown": { windowMs: 60 * 60 * 1000, maxRequests: 10, name: "Emergency lockdown toggle" },
  // AI data security endpoints (Fingerprint Vault / Data Lineage / File Content Scanner)
  "file-scan-event": { windowMs: 60 * 60 * 1000, maxRequests: 600, name: "File scan event" },
  "lineage-event": { windowMs: 60 * 60 * 1000, maxRequests: 600, name: "Data lineage event" },
  "fingerprint-match": { windowMs: 60 * 60 * 1000, maxRequests: 600, name: "Fingerprint match" },
  "fingerprint-bundle": { windowMs: 60 * 60 * 1000, maxRequests: 120, name: "Fingerprint bundle sync" },
  "source-apps": { windowMs: 60 * 60 * 1000, maxRequests: 120, name: "Source app sync" },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// In-memory store for rate limiting (used when Redis is not available)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(endpoint: string, organizationId: string, employeeId?: string, deviceToken?: string, ip?: string): string {
  const parts = [`soter:ratelimit:${endpoint}:org:${organizationId}`];
  if (employeeId) parts.push(`emp:${employeeId}`);
  if (deviceToken) parts.push(`dev:${deviceToken}`);
  if (ip) parts.push(`ip:${ip}`);
  return parts.join(":");
}

/**
 * Check rate limit using in-memory store.
 * For production, this should use Redis @upstash/redis.
 */
export async function checkRateLimit(
  endpoint: string,
  organizationId: string,
  options?: {
    employeeId?: string;
    deviceToken?: string;
    ip?: string;
  }
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint];
  if (!config) {
    // Unknown endpoint, allow with conservative rate
    return { allowed: true, remaining: 10, resetAt: Date.now() + 60000 };
  }

  const key = getRateLimitKey(endpoint, organizationId, options?.employeeId, options?.deviceToken, options?.ip);
  const now = Date.now();

  // Try Redis first if available
  try {
    const { Redis } = await import("@upstash/redis");
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const result = await checkRedisRateLimit(redis, key, config);
      if (result) return result;
    }
  } catch {
    // Redis not available, use in-memory fallback
  }

  // In-memory fallback
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

async function checkRedisRateLimit(
  redis: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number>; ttl: (key: string) => Promise<number> },
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  try {
    const count = await redis.incr(key);
    const ttlSeconds = Math.ceil(config.windowMs / 1000);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, config.maxRequests - count);
    return {
      allowed: count <= config.maxRequests,
      remaining,
      resetAt: Date.now() + ttl * 1000,
      retryAfter: count > config.maxRequests ? ttl : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get the default rate limit configuration for display.
 */
export function getRateLimitConfig(): Record<string, { maxRequests: number; window: string; name: string }> {
  return Object.fromEntries(
    Object.entries(RATE_LIMITS).map(([key, config]) => [
      key,
      {
        maxRequests: config.maxRequests,
        window: `${config.windowMs / 60000} minutes`,
        name: config.name,
      },
    ])
  );
}

export { RATE_LIMITS };
