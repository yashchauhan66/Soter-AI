// SECURITY: Redis client used for distributed rate limits and monthly usage
// metering. Falls back to in-memory if Upstash credentials are not configured;
// the fallback prints a one-time warning so operators notice in non-production
// environments.

import { Redis } from "@upstash/redis";

export interface RedisLike {
  incrBy(key: string, value: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: string | number, opts?: { ex?: number }): Promise<unknown>;
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<unknown>;
}

let warned = false;
let cached: RedisLike | null = null;

function cleanEnvValue(value: string | undefined) {
  if (!value) return value;
  let cleaned = value.trim();
  while (cleaned.length >= 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      cleaned = cleaned.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return cleaned;
}
class MemoryRedis implements RedisLike {
  private store = new Map<string, { value: string | number; expireAt: number }>();
  private now() { return Date.now(); }
  private getEntry(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }
  async incrBy(key: string, by: number) {
    const entry = this.getEntry(key);
    if (!entry) {
      this.store.set(key, { value: by, expireAt: 0 });
      return by;
    }
    const current = typeof entry.value === 'number' ? entry.value : 0;
    const next = current + by;
    entry.value = next;
    return next;
  }
  async expire(key: string, seconds: number) {
    const entry = this.getEntry(key);
    if (entry) entry.expireAt = this.now() + seconds * 1000;
    return 1;
  }
  async get<T = unknown>(key: string) {
    const entry = this.getEntry(key);
    return (entry ? (entry.value as unknown as T) : null);
  }
  async ttl(key: string) {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (!entry.expireAt) return -1;
    return Math.max(0, Math.floor((entry.expireAt - this.now()) / 1000));
  }
  async set(key: string, value: string | number, opts?: { ex?: number }) {
    const expireAt = opts?.ex ? this.now() + opts.ex * 1000 : 0;
    this.store.set(key, { value, expireAt });
    return "OK";
  }

  async del(...keys: string[]) {
    for (const key of keys) this.store.delete(key);
    return keys.length;
  }
}

/**
 * Creates an isolated in-memory Redis-compatible store.
 *
 * Keeping this as a factory (instead of sharing the process-wide fallback)
 * lets tests and local tools exercise Redis-backed logic without inheriting
 * credentials that another module may have loaded from an environment file.
 */
export function createMemoryRedis(): RedisLike {
  return new MemoryRedis();
}

let fallback: RedisLike | null = null;

/**
 * Process-local store used when the configured Redis is unreachable. Shared so
 * every degraded caller lands in the same buckets — per-instance rather than
 * distributed, but a degraded limit is far better than no limit, and far better
 * than a request that never returns.
 */
export function getFallbackRedis(): RedisLike {
  if (!fallback) fallback = createMemoryRedis();
  return fallback;
}

// A dead Redis must degrade, never hang. Previously `createClient().connect()`
// retried forever and the pending promise was memoised, so one unreachable Redis
// wedged every rate-limited route: /api/auth/callback/credentials and
// /api/guard/analyze returned no response at all, and the process stayed wedged
// even after Redis came back.
const CONNECT_TIMEOUT_MS = Math.max(250, Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "2000"));
const COMMAND_TIMEOUT_MS = Math.max(250, Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? "1500"));
const MAX_RECONNECT_ATTEMPTS = Math.max(0, Number(process.env.REDIS_MAX_RECONNECT_ATTEMPTS ?? "3"));
// A refused socket emits an error per retry; unthrottled that is thousands of
// identical lines per test run, which buries every other server log.
const ERROR_LOG_INTERVAL_MS = 30_000;

let lastErrorLoggedAt = 0;

function logRedisError(error: unknown) {
  const now = Date.now();
  if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) return;
  lastErrorLoggedAt = now;
  const code = (error as { code?: string } | null)?.code;
  console.error(
    `[SoterAI] Redis unavailable${code ? ` (${code})` : ""}. Rate limits fall back to the in-process store until it recovers.`,
  );
}

async function withTimeout<T>(operation: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis ${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class NodeRedis implements RedisLike {
  private clientPromise: Promise<import("redis").RedisClientType> | null = null;
  private generation = 0;

  constructor(private readonly url: string) {}

  // Only the generation that is still current may clear the memo, so a late
  // error from a superseded client cannot discard a healthy one.
  private forget(generation: number) {
    if (this.generation === generation) this.clientPromise = null;
  }

  private async client() {
    if (!this.clientPromise) {
      const generation = ++this.generation;
      this.clientPromise = this.connect(generation);
    }
    return this.clientPromise;
  }

  private async connect(generation: number) {
    const { createClient } = await import("redis");
    const client = createClient({
      url: this.url,
      // Fail commands fast instead of queueing them while the socket is down —
      // the unbounded offline queue is what turned "Redis is down" into
      // "requests never return".
      disableOfflineQueue: true,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) =>
          retries >= MAX_RECONNECT_ATTEMPTS
            ? new Error("Redis reconnect attempts exhausted")
            : Math.min(100 * 2 ** retries, 1_000),
      },
    });
    client.on("error", (error) => {
      logRedisError(error);
      // Never keep a closed client memoised, or the process can never reconnect.
      if (!client.isOpen) this.forget(generation);
    });
    try {
      await withTimeout(client.connect(), CONNECT_TIMEOUT_MS, "connect");
    } catch (error) {
      this.forget(generation);
      try {
        await client.disconnect();
      } catch {
        // Already closed, or never opened — nothing to release.
      }
      throw error;
    }
    return client as import("redis").RedisClientType;
  }

  private async command<T>(label: string, run: (client: import("redis").RedisClientType) => Promise<T>) {
    const client = await this.client();
    return withTimeout(run(client), COMMAND_TIMEOUT_MS, label);
  }

  async incrBy(key: string, value: number) { return this.command("incrBy", (c) => c.incrBy(key, value)); }
  async expire(key: string, seconds: number) { return this.command("expire", (c) => c.expire(key, seconds)); }
  async get<T = unknown>(key: string) {
    const value = await this.command("get", (c) => c.get(key));
    if (value === null) return null;
    const numeric = Number(value);
    return (Number.isNaN(numeric) ? value : numeric) as T;
  }
  async ttl(key: string) { return this.command("ttl", (c) => c.ttl(key)); }
  async set(key: string, value: string | number, opts?: { ex?: number }) {
    return this.command("set", (c) => (opts?.ex ? c.setEx(key, opts.ex, String(value)) : c.set(key, String(value))));
  }
  async del(...keys: string[]) { return keys.length ? this.command("del", (c) => c.del(keys)) : 0; }
}

export function getRedis(): RedisLike {
  if (cached) return cached;
  const redisUrl = cleanEnvValue(process.env.REDIS_URL);
  if (redisUrl) {
    cached = new NodeRedis(redisUrl);
    return cached;
  }
  const url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (url && token) {
    const client = new Redis({ url, token });
    cached = {
      async incrBy(key, by) { return Number(await client.incrby(key, by)); },
      async expire(key, seconds) { return client.expire(key, seconds); },
      async get<T>(key: string) { return (await client.get(key)) as T | null; },
      async set(key: string, value: string | number, opts?: { ex?: number }) {
        if (opts?.ex) return client.setex(key, opts.ex, String(value));
        return client.set(key, String(value));
      },
      async ttl(key) { return Number(await client.ttl(key)); },
      async del(...keys: string[]) { return keys.length ? client.del(...keys) : 0; },
    };
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Distributed Redis is required in production. Configure UPSTASH_REDIS_REST_URL or REDIS_URL.");
  }
  if (!warned) {
    console.warn("[SoterAI] UPSTASH_REDIS_REST_URL is not set. Using in-memory rate limit store. Do NOT run multi-instance in this state.");
    warned = true;
  }
  cached = createMemoryRedis();
  return cached;
}
