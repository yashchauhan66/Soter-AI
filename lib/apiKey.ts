import { timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { hashApiKey as digestApiKey } from "./apiKeyCrypto";
import { getLocalCache, setLocalCache } from "./localCache";

export { generateApiKey, hashApiKey } from "./apiKeyCrypto";

type VerifiedApiKey = Prisma.ApiKeyGetPayload<{
  include: { project: { include: { organization: { select: { quotaOverride: true; disabled: true } }; user: { select: { id: true; email: true } } } } };
}>;

const API_KEY_CACHE_TTL_MS = 30_000;
const LAST_USED_WRITE_TTL_MS = 5 * 60_000;

export async function verifyApiKey(rawKey: string | null) {
  if (!rawKey) return { ok: false as const, status: 401, message: "Missing x-api-key header." };
  if (!/^ck_(?:test|live)_[A-Za-z0-9_-]{20,}$/.test(rawKey)) return { ok: false as const, status: 401, message: "Invalid API key." };

  // Compare a peppered hash in constant time; raw keys are never queried or stored.
  const keyHash = digestApiKey(rawKey);
  const cacheKey = `api-key:${keyHash}`;
  const cached = getLocalCache<VerifiedApiKey>(cacheKey);
  if (cached) {
    touchApiKeyLastUsed(cached.id);
    return { ok: true as const, apiKey: cached, project: cached.project };
  }

  const candidates = await db.apiKey.findMany({
    where: { prefix: rawKey.slice(0, 15), isActive: true },
    include: {
      project: {
        include: {
          organization: { select: { quotaOverride: true, disabled: true } },
          user: { select: { id: true, email: true } },
        },
      },
    },
  });
  const match = candidates.find((candidate) => {
    const stored = Buffer.from(candidate.keyHash, "hex");
    const supplied = Buffer.from(keyHash, "hex");
    return stored.length === supplied.length && timingSafeEqual(stored, supplied);
  });
  if (!match) return { ok: false as const, status: 401, message: "Invalid API key." };
  if (match.project.disabledAt) return { ok: false as const, status: 403, message: "This project has been disabled by an administrator." };
  if (match.project.organization?.disabled) return { ok: false as const, status: 403, message: "This organization has been disabled by an administrator." };

  setLocalCache(cacheKey, match, API_KEY_CACHE_TTL_MS);
  touchApiKeyLastUsed(match.id);
  return { ok: true as const, apiKey: match, project: match.project };
}

function touchApiKeyLastUsed(apiKeyId: string) {
  const cacheKey = `api-key:last-used:${apiKeyId}`;
  if (getLocalCache<boolean>(cacheKey)) return;
  setLocalCache(cacheKey, true, LAST_USED_WRITE_TTL_MS);
  void db.apiKey.update({ where: { id: apiKeyId }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
}
