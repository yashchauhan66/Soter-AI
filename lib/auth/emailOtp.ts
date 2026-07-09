import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "../db";

export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

type EmailOtpClient = {
  emailVerificationOtp: {
    deleteMany: (args: { where: { userId: string; usedAt: null } }) => Promise<unknown>;
    create: (args: {
      data: { userId: string; codeHash: string; expiresAt: Date };
    }) => Promise<unknown>;
  };
};

function otpSecret() {
  const secret = process.env.EMAIL_OTP_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_OTP_SECRET or AUTH_SECRET must be configured in production.");
  }
  return "soterai-development-email-otp-secret";
}

export function generateEmailOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashEmailOtp(userId: string, code: string, secret = otpSecret()) {
  return createHmac("sha256", secret)
    .update(`email-verification:${userId}:${code}`)
    .digest("hex");
}

export function emailOtpMatches(userId: string, candidate: string, storedHash: string) {
  const candidateHash = Buffer.from(hashEmailOtp(userId, candidate), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return candidateHash.length === expectedHash.length && timingSafeEqual(candidateHash, expectedHash);
}

/** Invalidates the previous code and stores only an HMAC of the new code. */
export async function createEmailVerificationOtp(
  userId: string,
  now = new Date(),
  client: EmailOtpClient = db,
) {
  const code = generateEmailOtp();
  await client.emailVerificationOtp.deleteMany({ where: { userId, usedAt: null } });
  await client.emailVerificationOtp.create({
    data: {
      userId,
      codeHash: hashEmailOtp(userId, code),
      expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
    },
  });
  return code;
}
