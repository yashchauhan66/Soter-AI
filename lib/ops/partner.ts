import crypto from "crypto";
import { db } from "../db";

export function buildReferralCode(name: string, entropy = crypto.randomBytes(4).toString("hex")) {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PARTNER";
  return `${prefix}-${entropy.toUpperCase()}`;
}

export async function createUniqueReferralCode(name: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildReferralCode(name);
    const exists = await db.partnerProfile.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not create a unique referral code.");
}
