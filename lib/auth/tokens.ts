import { createHash, randomBytes } from "crypto";
import { db } from "../db";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Minimal client surface so callers can pass either the root Prisma client or
// an interactive-transaction client (tx) for atomic user+token creation.
type EmailVerificationTokenClient = {
  emailVerificationToken: {
    deleteMany: (args: { where: { userId: string; usedAt: null } }) => Promise<unknown>;
    create: (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<unknown>;
  };
};

export function hashOneTimeToken(token: string) {
  return createHash("sha256").update(`auth-token:${token}`).digest("hex");
}

function newToken() { return randomBytes(32).toString("base64url"); }

type TokenState = { usedAt: Date | null; expiresAt: Date };
export function isOneTimeTokenUsable<T extends TokenState>(record: T | null, now = new Date()): record is T {
  return Boolean(record && !record.usedAt && record.expiresAt > now);
}

/**
 * Creates a fresh email-verification token, invalidating any prior unused
 * tokens for the user (so resend regenerates safely and old links stop
 * working). Accepts an optional transaction client so token creation can be
 * committed atomically with user creation — no token is ever stored raw.
 */
export async function createEmailVerificationToken(
  userId: string,
  now = new Date(),
  client: EmailVerificationTokenClient = db,
) {
  const token = newToken();
  await client.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
  await client.emailVerificationToken.create({ data: { userId, tokenHash: hashOneTimeToken(token), expiresAt: new Date(now.getTime() + VERIFY_TTL_MS) } });
  return token;
}

export async function consumeEmailVerificationToken(token: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashOneTimeToken(token) } });
    if (!isOneTimeTokenUsable(record, now)) return null;
    await tx.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: now } });
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
    return record.userId;
  });
}

export async function createPasswordResetToken(userId: string, now = new Date()) {
  const token = newToken();
  await db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await db.passwordResetToken.create({ data: { userId, tokenHash: hashOneTimeToken(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) } });
  return token;
}

export async function consumePasswordResetToken(token: string, passwordHash: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashOneTimeToken(token) } });
    if (!isOneTimeTokenUsable(record, now)) return null;
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } });
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    return record.userId;
  });
}
