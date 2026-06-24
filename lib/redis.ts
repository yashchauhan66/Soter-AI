// SECURITY: Redis client used for distributed rate limits and monthly usage
// metering. Falls back to in-memory if Upstash credentials are not configured;
// the fallback prints a one-time warning so operators notice in non-production
// environments.

import { Redis } from "@upstash/redis";

interface RedisLike {
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

class NodeRedis implements RedisLike {
  private clientPromise: Promise<import("redis").RedisClientType> | null = null;

  constructor(private readonly url: string) {}

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("redis").then(async ({ createClient }) => {
        const client = createClient({ url: this.url });
        client.on("error", (error) => console.error("[SoterAI] Redis client error", error));
        await client.connect();
        return client as import("redis").RedisClientType;
      });
    }
    return this.clientPromise;
  }

  async incrBy(key: string, value: number) { return (await this.client()).incrBy(key, value); }
  async expire(key: string, seconds: number) { return (await this.client()).expire(key, seconds); }
  async get<T = unknown>(key: string) {
    const value = await (await this.client()).get(key);
    if (value === null) return null;
    const numeric = Number(value);
    return (Number.isNaN(numeric) ? value : numeric) as T;
  }
  async ttl(key: string) { return (await this.client()).ttl(key); }
  async set(key: string, value: string | number, opts?: { ex?: number }) {
    const client = await this.client();
    if (opts?.ex) {
      return client.setEx(key, opts.ex, String(value));
    }
    return client.set(key, String(value));
  }
  async del(...keys: string[]) { return keys.length ? (await this.client()).del(keys) : 0; }
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
  cached = new MemoryRedis();
  return cached;
}
