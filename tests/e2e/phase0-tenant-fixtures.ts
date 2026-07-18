import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { encryptSecret } from "../../lib/secrets/secretStore";
import { hashWebhookSecret } from "../../lib/webhooks/signing";
import { hashSecret } from "../../lib/extension/enrollment";

export const phase0TenantFixtures = {
  password: "phase0-runtime-password-2026",
  orgAId: "phase0-runtime-org-a",
  orgBId: "phase0-runtime-org-b",
  projectAId: "phase0-runtime-project-a",
  projectBId: "phase0-runtime-project-b",
  memberAEmail: "phase0.member-a@soter.test",
  noPermEmail: "phase0.no-perm-a@soter.test",
  orgAdminEmail: "phase0.org-admin-a@soter.test",
  platformAdminEmail: "phase0.platform-admin@soter.test",
  webhookAId: "phase0-runtime-webhook-a",
  webhookBId: "phase0-runtime-webhook-b",
  deliveryAId: "phase0-runtime-delivery-a",
  deliveryBId: "phase0-runtime-delivery-b",
  tokenAId: "phase0-runtime-token-a",
  tokenBId: "phase0-runtime-token-b",
  tokenAExpiredId: "phase0-runtime-token-a-expired",
  tokenARevokedId: "phase0-runtime-token-a-revoked",
  deviceAId: "phase0-runtime-device-a",
  deviceBId: "phase0-runtime-device-b",
  deviceARevokedId: "phase0-runtime-device-a-revoked",
  nonexistentId: "phase0-runtime-does-not-exist",
} as const;

export type Phase0Actor = "memberA" | "noPermA" | "orgAdminA" | "platformAdmin";

export const phase0Actors: Record<Phase0Actor, { email: string; password: string }> = {
  memberA: { email: phase0TenantFixtures.memberAEmail, password: phase0TenantFixtures.password },
  noPermA: { email: phase0TenantFixtures.noPermEmail, password: phase0TenantFixtures.password },
  orgAdminA: { email: phase0TenantFixtures.orgAdminEmail, password: phase0TenantFixtures.password },
  platformAdmin: { email: phase0TenantFixtures.platformAdminEmail, password: phase0TenantFixtures.password },
};

export function configurePhase0RuntimeEnv() {
  process.env.NODE_ENV ||= "test";
  process.env.API_KEY_PEPPER ||= "phase0-runtime-api-key-pepper-at-least-32-chars";
  process.env.AUTH_SECRET ||= "phase0-runtime-auth-secret-at-least-32-characters";
  process.env.NEXTAUTH_SECRET ||= process.env.AUTH_SECRET;
  process.env.LOCAL_SECRET_STORE_KEY ||= "phase0-runtime-local-secret-store-key";
  process.env.SECRET_STORE_PROVIDER = "local";
  process.env.EMAIL_PROVIDER = "mock";
}

export function requireIsolatedDatabaseUrl() {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("E2E_DATABASE_URL is required for Phase 0 tenant runtime tests.");
  const hostname = new URL(databaseUrl).hostname;
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  if (!process.env.E2E_DATABASE_URL && !loopback) {
    throw new Error("Refusing to run Phase 0 tenant runtime tests against a non-loopback DATABASE_URL. Set E2E_DATABASE_URL to an isolated test database.");
  }
  return databaseUrl;
}

export async function seedPhase0TenantFixtures(databaseUrl = requireIsolatedDatabaseUrl()) {
  configurePhase0RuntimeEnv();
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await cleanupPhase0TenantFixtures(prisma);
    const passwordHash = await bcrypt.hash(phase0TenantFixtures.password, 12);
    const [memberA, noPermA, orgAdminA, platformAdmin, ownerB] = await Promise.all([
      prisma.user.create({ data: { email: phase0TenantFixtures.memberAEmail, name: "Phase0 Member A", passwordHash, emailVerifiedAt: new Date(), isAdmin: false } }),
      prisma.user.create({ data: { email: phase0TenantFixtures.noPermEmail, name: "Phase0 No Perm A", passwordHash, emailVerifiedAt: new Date(), isAdmin: false } }),
      prisma.user.create({ data: { email: phase0TenantFixtures.orgAdminEmail, name: "Phase0 Org Admin A", passwordHash, emailVerifiedAt: new Date(), isAdmin: false } }),
      prisma.user.create({ data: { email: phase0TenantFixtures.platformAdminEmail, name: "Phase0 Platform Admin", passwordHash, emailVerifiedAt: new Date(), isAdmin: true } }),
      prisma.user.create({ data: { email: "phase0.owner-b@soter.test", name: "Phase0 Owner B", passwordHash, emailVerifiedAt: new Date(), isAdmin: false } }),
    ]);

    await prisma.organization.create({ data: { id: phase0TenantFixtures.orgAId, slug: "phase0-runtime-org-a", name: "Phase0 Tenant A", contactEmail: memberA.email } });
    await prisma.organization.create({ data: { id: phase0TenantFixtures.orgBId, slug: "phase0-runtime-org-b", name: "Phase0 Tenant B", contactEmail: ownerB.email } });
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: phase0TenantFixtures.orgAId, userId: memberA.id, role: "DEVELOPER" },
        { organizationId: phase0TenantFixtures.orgAId, userId: noPermA.id, role: "VIEWER" },
        { organizationId: phase0TenantFixtures.orgAId, userId: orgAdminA.id, role: "ADMIN" },
        { organizationId: phase0TenantFixtures.orgBId, userId: ownerB.id, role: "OWNER" },
      ],
    });
    await prisma.project.create({ data: { id: phase0TenantFixtures.projectAId, name: "Phase0 Project A", userId: memberA.id, organizationId: phase0TenantFixtures.orgAId, badgeSlug: "phase0-project-a" } });
    await prisma.project.create({ data: { id: phase0TenantFixtures.projectBId, name: "Phase0 Project B", userId: ownerB.id, organizationId: phase0TenantFixtures.orgBId, badgeSlug: "phase0-project-b" } });

    await createWebhook(prisma, phase0TenantFixtures.webhookAId, phase0TenantFixtures.projectAId, "https://example.com/phase0-a");
    await createWebhook(prisma, phase0TenantFixtures.webhookBId, phase0TenantFixtures.projectBId, "https://example.com/phase0-b");
    await prisma.webhookDelivery.createMany({
      data: [
        deliveryData(phase0TenantFixtures.deliveryAId, phase0TenantFixtures.webhookAId),
        deliveryData(phase0TenantFixtures.deliveryBId, phase0TenantFixtures.webhookBId),
      ],
    });
    await prisma.extensionEnrollmentToken.createMany({
      data: [
        tokenData(phase0TenantFixtures.tokenAId, phase0TenantFixtures.orgAId, "phase0-token-a", orgAdminA.id, 5, new Date(Date.now() + 86_400_000)),
        tokenData(phase0TenantFixtures.tokenBId, phase0TenantFixtures.orgBId, "phase0-token-b", orgAdminA.id, 5, new Date(Date.now() + 86_400_000)),
        tokenData(phase0TenantFixtures.tokenAExpiredId, phase0TenantFixtures.orgAId, "phase0-token-a-expired", orgAdminA.id, 1, new Date(Date.now() - 86_400_000)),
        { ...tokenData(phase0TenantFixtures.tokenARevokedId, phase0TenantFixtures.orgAId, "phase0-token-a-revoked", orgAdminA.id, 1, new Date(Date.now() + 86_400_000)), revokedAt: new Date() },
      ],
    });
    await prisma.deviceAgent.createMany({
      data: [
        deviceData(phase0TenantFixtures.deviceAId, phase0TenantFixtures.orgAId, "phase0-device-a", "active"),
        deviceData(phase0TenantFixtures.deviceBId, phase0TenantFixtures.orgBId, "phase0-device-b", "active"),
        deviceData(phase0TenantFixtures.deviceARevokedId, phase0TenantFixtures.orgAId, "phase0-device-a-revoked", "revoked"),
      ],
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function createWebhook(prisma: PrismaClient, id: string, projectId: string, url: string) {
  const raw = `whsec_${id}_synthetic_secret_value`;
  const encrypted = await encryptSecret(raw);
  await prisma.webhookEndpoint.create({
    data: {
      id,
      projectId,
      url,
      description: id,
      secretHash: hashWebhookSecret(raw),
      secretPreview: `${raw.slice(0, 12)}...test`,
      encryptedSecret: encrypted.ciphertext,
      secretKeyVersion: `${encrypted.provider}:${encrypted.version ?? encrypted.keyVersion ?? "local-v1"}`,
      secretRotatedAt: new Date(),
      events: ["guard.prompt_injection.blocked"],
      isActive: true,
    },
  });
}

function deliveryData(id: string, endpointId: string): Prisma.WebhookDeliveryCreateManyInput {
  return {
    id,
    endpointId,
    event: "guard.prompt_injection.blocked",
    status: "DEAD_LETTER",
    attempts: 6,
    payloadHash: hashSecret(`${id}:payload`),
    payloadPreview: { test: true },
    idempotencyKey: `${id}-idempotency`,
    deadLetteredAt: new Date(),
  };
}

function tokenData(id: string, organizationId: string, raw: string, createdByAdminId: string, maxUses: number, expiresAt: Date): Prisma.ExtensionEnrollmentTokenCreateManyInput {
  return {
    id,
    organizationId,
    tokenHash: hashSecret(raw),
    createdByAdminId,
    employeeEmail: `${id}@soter.test`,
    department: "Security",
    role: "Engineer",
    maxUses,
    usedCount: 0,
    expiresAt,
  };
}

function deviceData(id: string, organizationId: string, token: string, status: string): Prisma.DeviceAgentCreateManyInput {
  return {
    id,
    organizationId,
    employeeId: id,
    employeeEmail: `${id}@soter.test`,
    department: "Security",
    role: "Engineer",
    deviceId: `${id}-device-id`,
    deviceTokenHash: hashSecret(token),
    type: "browser_extension",
    version: "0.0.0-phase0",
    platform: "test",
    status,
    lastHeartbeatAt: new Date(),
  };
}

async function cleanupPhase0TenantFixtures(prisma: PrismaClient) {
  await prisma.adminAuditLog.deleteMany({ where: { OR: [{ targetId: { startsWith: "phase0-runtime-" } }, { organizationId: { in: [phase0TenantFixtures.orgAId, phase0TenantFixtures.orgBId] } }] } });
  await prisma.securityEvent.deleteMany({ where: { organizationId: { in: [phase0TenantFixtures.orgAId, phase0TenantFixtures.orgBId] } } });
  await prisma.webhookDelivery.deleteMany({ where: { OR: [{ id: { startsWith: "phase0-runtime-" } }, { endpointId: { startsWith: "phase0-runtime-" } }] } });
  await prisma.webhookEndpoint.deleteMany({ where: { id: { startsWith: "phase0-runtime-" } } });
  await prisma.deviceAgent.deleteMany({ where: { id: { startsWith: "phase0-runtime-" } } });
  await prisma.extensionEnrollmentToken.deleteMany({ where: { id: { startsWith: "phase0-runtime-" } } });
  await prisma.project.deleteMany({ where: { id: { in: [phase0TenantFixtures.projectAId, phase0TenantFixtures.projectBId] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [phase0TenantFixtures.orgAId, phase0TenantFixtures.orgBId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [phase0TenantFixtures.orgAId, phase0TenantFixtures.orgBId] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@soter.test" } } });
}
