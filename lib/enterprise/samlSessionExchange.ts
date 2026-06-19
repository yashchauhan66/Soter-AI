import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "../db";

const SAML_EXCHANGE_TTL_MS = 2 * 60 * 1000;

export interface SamlExchangeRequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

interface SamlExchangeState extends SamlExchangeRequestContext {
  expiresAt: Date;
  usedAt: Date | null;
}

function normalizeContextValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function equalOptionalContext(expected?: string | null, actual?: string | null) {
  const left = Buffer.from(normalizeContextValue(expected) ?? "");
  const right = Buffer.from(normalizeContextValue(actual) ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashSamlSessionExchangeToken(token: string) {
  return createHash("sha256").update(`saml-session-exchange:${token}`).digest("hex");
}

export function isSamlSessionExchangeUsable<T extends SamlExchangeState>(
  exchange: T | null,
  context: SamlExchangeRequestContext,
  now = new Date(),
): exchange is T {
  if (!exchange || exchange.usedAt || exchange.expiresAt <= now) return false;
  return equalOptionalContext(exchange.ip, context.ip) && equalOptionalContext(exchange.userAgent, context.userAgent);
}

export async function createSamlSessionExchange(input: {
  userId: string;
  organizationId: string;
  providerId: string;
  context: SamlExchangeRequestContext;
}, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SAML_EXCHANGE_TTL_MS);
  const ip = normalizeContextValue(input.context.ip);
  const userAgent = normalizeContextValue(input.context.userAgent);

  await db.$transaction([
    db.samlSessionExchange.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { userId: input.userId, usedAt: { not: null } },
        ],
      },
    }),
    db.samlSessionExchange.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        providerId: input.providerId,
        tokenHash: hashSamlSessionExchangeToken(token),
        ip,
        userAgent,
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export async function consumeSamlSessionExchange(
  token: string,
  context: SamlExchangeRequestContext,
  now = new Date(),
) {
  const tokenHash = hashSamlSessionExchangeToken(token);
  return db.$transaction(async (tx) => {
    const exchange = await tx.samlSessionExchange.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        providerId: true,
        ip: true,
        userAgent: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    if (!isSamlSessionExchangeUsable(exchange, context, now)) return null;

    const claimed = await tx.samlSessionExchange.updateMany({
      where: {
        id: exchange.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    const user = await tx.user.findUnique({
      where: { id: exchange.userId },
      select: { id: true, email: true, name: true, isAdmin: true },
    });
    if (!user) return null;

    return {
      user,
      organizationId: exchange.organizationId,
      providerId: exchange.providerId,
    };
  });
}
