import crypto from "node:crypto";
import { db } from "@/lib/db";

export type EnrollmentTokenStatus = "valid" | "invalid" | "expired" | "revoked" | "overused";
export type EnrollmentRedeemStatus = EnrollmentTokenStatus | "seat_limit_reached";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function enrollmentTokenStatus(token: {
  expiresAt: Date;
  revokedAt: Date | null;
  usedCount: number;
  maxUses: number;
} | null, now = new Date()): EnrollmentTokenStatus {
  if (!token) return "invalid";
  if (token.revokedAt) return "revoked";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  if (token.usedCount >= token.maxUses) return "overused";
  return "valid";
}

export function enrollmentStatusMessage(status: Exclude<EnrollmentRedeemStatus, "valid">) {
  if (status === "expired") return "Enrollment code has expired.";
  if (status === "revoked") return "Enrollment code has been revoked.";
  if (status === "overused") return "Enrollment code has reached its usage limit.";
  if (status === "seat_limit_reached") return "Your organization has reached its licensed seat limit. Contact your administrator to add seats.";
  return "Invalid enrollment code.";
}

/**
 * Seat accounting for browser-extension licensing.
 * `limit === null` means unlimited (backward-compatible default). A seat is one
 * active enrolled browser-extension device. Returns whether one more device fits.
 */
export function seatCheck(limit: number | null | undefined, activeSeats: number): { withinLimit: boolean; limit: number | null; used: number; remaining: number | null } {
  if (limit === null || limit === undefined) return { withinLimit: true, limit: null, used: activeSeats, remaining: null };
  const remaining = Math.max(0, limit - activeSeats);
  return { withinLimit: activeSeats < limit, limit, used: activeSeats, remaining };
}

export async function createEnrollmentToken(input: {
  organizationId: string;
  createdByAdminId: string;
  employeeEmail?: string;
  department?: string;
  role?: string;
  maxUses: number;
  expiresAt: Date;
}, database: typeof db = db) {
  if (!Number.isInteger(input.maxUses) || input.maxUses < 1) throw new Error("Enrollment token maxUses must be a positive integer.");
  if (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now()) throw new Error("Enrollment token expiry must be in the future.");
  const rawToken = `soter_enroll_${crypto.randomBytes(32).toString("base64url")}`;
  const token = await database.$transaction(async (tx) => {
    const created = await tx.extensionEnrollmentToken.create({
      data: { ...input, tokenHash: hashSecret(rawToken) },
      select: {
        id: true, organizationId: true, employeeEmail: true, department: true,
        role: true, maxUses: true, usedCount: true, expiresAt: true, createdAt: true,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: input.createdByAdminId,
        organizationId: input.organizationId,
        action: "extension_enrollment_token_created",
        targetType: "extension_enrollment_token",
        targetId: created.id,
        reason: "Created extension enrollment token",
        metadata: { maxUses: input.maxUses, expiresAt: input.expiresAt.toISOString(), employeeEmail: input.employeeEmail ?? null },
      },
    });
    return created;
  });
  return { rawToken, token };
}

export async function redeemEnrollmentToken(input: {
  enrollmentCode: string;
  browser?: string;
  extensionVersion?: string;
  platform?: string;
  apiBaseUrl: string;
}, database: typeof db = db) {
  const now = new Date();
  const tokenHash = hashSecret(input.enrollmentCode);
  return database.$transaction(async (tx) => {
    const token = await tx.extensionEnrollmentToken.findUnique({
      where: { tokenHash },
      include: { organization: { select: { name: true, extensionSeatLimit: true } } },
    });
    const status = enrollmentTokenStatus(token, now);
    if (status !== "valid" || !token) return { ok: false as const, status, message: enrollmentStatusMessage(status as Exclude<EnrollmentRedeemStatus, "valid">) };

    // Seat licensing gate: refuse enrollment once the org hits its licensed seat cap.
    // Counted before consuming the token so a rejected enrollment does not burn a use.
    const activeSeats = await tx.deviceAgent.count({
      where: { organizationId: token.organizationId, type: "browser_extension", status: "active" },
    });
    const seats = seatCheck(token.organization.extensionSeatLimit, activeSeats);
    if (!seats.withinLimit) {
      return { ok: false as const, status: "seat_limit_reached" as const, message: enrollmentStatusMessage("seat_limit_reached") };
    }

    // The conditional update is the concurrency boundary: only one request may consume the final use.
    const consumed = await tx.extensionEnrollmentToken.updateMany({
      where: { id: token.id, revokedAt: null, expiresAt: { gt: now }, usedCount: { lt: token.maxUses } },
      data: { usedCount: { increment: 1 }, lastUsedAt: now },
    });
    if (consumed.count !== 1) return { ok: false as const, status: "overused" as const, message: enrollmentStatusMessage("overused") };

    const deviceToken = `soter_device_${crypto.randomBytes(32).toString("base64url")}`;
    const employeeId = token.employeeEmail ?? `ext-${crypto.randomBytes(10).toString("hex")}`;
    const device = await tx.deviceAgent.create({
      data: {
        organizationId: token.organizationId,
        employeeId,
        employeeEmail: token.employeeEmail,
        department: token.department,
        role: token.role,
        deviceId: `device-${crypto.randomBytes(12).toString("hex")}`,
        deviceTokenHash: hashSecret(deviceToken),
        type: "browser_extension",
        version: input.extensionVersion ?? "0.1.0",
        platform: input.platform ?? input.browser ?? "unknown",
        status: "active",
        lastHeartbeatAt: now,
      },
    });
    const lockdown = await tx.emergencyLockdownState.findUnique({ where: { organizationId: token.organizationId }, select: { policyVersion: true } });
    await tx.adminAuditLog.create({
      data: {
        organizationId: token.organizationId,
        action: "extension_enrollment_token_redeemed",
        targetType: "device_agent",
        targetId: device.id,
        reason: "Extension self-service enrollment completed",
        metadata: { enrollmentTokenId: token.id, browser: input.browser ?? "unknown" },
      },
    });
    return {
      ok: true as const,
      organizationId: token.organizationId,
      organizationName: token.organization.name,
      employeeId,
      employeeEmail: token.employeeEmail,
      department: token.department,
      role: token.role,
      deviceToken,
      policyVersion: String(lockdown?.policyVersion ?? 1),
      apiBaseUrl: input.apiBaseUrl,
    };
  });
}
