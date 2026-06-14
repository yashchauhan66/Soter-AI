import { db } from "../db";
import { generateWebhookSecret, hashWebhookSecret } from "./signing";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "../secrets/secretStore";

async function auditSecretAction(input: { endpointId: string; projectId?: string; action: string; success: boolean; message: string }) {
  const organizationId = input.projectId
    ? (await db.project.findUnique({ where: { id: input.projectId }, select: { organizationId: true } }))?.organizationId
    : null;
  await db.adminAuditLog.create({
    data: {
      adminUserId: null,
      organizationId,
      action: input.action,
      targetType: "WebhookEndpoint",
      targetId: input.endpointId,
      reason: input.message,
      metadata: { projectId: input.projectId, success: input.success },
    },
  }).catch(() => undefined);
}

interface CreateInput {
  projectId: string;
  url: string;
  description?: string;
  events: string[];
}

export async function createWebhookEndpoint(input: CreateInput) {
  const secret = generateWebhookSecret();
  const encrypted = await encryptSecret(secret.raw);
  const endpoint = await db.webhookEndpoint.create({
    data: {
      projectId: input.projectId,
      url: input.url,
      description: input.description,
      secretHash: secret.hash,
      secretPreview: secret.preview,
      encryptedSecret: encrypted.ciphertext,
      secretKeyVersion: `${encrypted.provider}:${encrypted.version ?? encrypted.keyVersion ?? "unknown"}`,
      secretRotatedAt: new Date(),
      events: input.events,
    },
  });
  return { endpoint, rawSecret: secret.raw };
}

export async function rotateWebhookSecret(endpointId: string) {
  const endpoint = await db.webhookEndpoint.findUnique({ where: { id: endpointId }, select: { projectId: true } });
  try {
    const secret = generateWebhookSecret();
    const encrypted = await encryptSecret(secret.raw);
    await db.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        secretHash: secret.hash,
        secretPreview: secret.preview,
        encryptedSecret: encrypted.ciphertext,
        secretKeyVersion: `${encrypted.provider}:${encrypted.version ?? encrypted.keyVersion ?? "unknown"}`,
        secretRotatedAt: new Date(),
      },
    });
    await auditSecretAction({ endpointId, projectId: endpoint?.projectId, action: "KMS_SECRET_ROTATED", success: true, message: "Webhook signing secret was rotated through the configured secret store." });
    return secret.raw;
  } catch (error) {
    await auditSecretAction({ endpointId, projectId: endpoint?.projectId, action: "KMS_SECRET_ROTATION_FAILED", success: false, message: "Webhook signing secret rotation failed closed." });
    throw error;
  }
}

export async function getEndpointSecret(endpointId: string) {
  const endpoint = await db.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { projectId: true, secretHash: true, encryptedSecret: true, secretKeyVersion: true, secretRotatedAt: true },
  });
  if (!endpoint?.encryptedSecret || !endpoint.secretKeyVersion) return undefined;
  const [provider, ...versionParts] = endpoint.secretKeyVersion.split(":");
  try {
    const version = versionParts.join(":");
    const value = await decryptSecret({
      provider: provider as EncryptedSecret["provider"],
      version,
      keyVersion: version,
      ciphertext: endpoint.encryptedSecret,
      createdAt: endpoint.secretRotatedAt?.toISOString() ?? new Date(0).toISOString(),
    });
    if (hashWebhookSecret(value) !== endpoint.secretHash) {
      await auditSecretAction({ endpointId, projectId: endpoint.projectId, action: "KMS_SECRET_DECRYPT_FAILED", success: false, message: "Decrypted webhook secret failed integrity verification." });
      return undefined;
    }
    await auditSecretAction({ endpointId, projectId: endpoint.projectId, action: "KMS_SECRET_DECRYPTED", success: true, message: "Webhook signing secret was decrypted for an authorized delivery operation." });
    return value;
  } catch (error) {
    await auditSecretAction({ endpointId, projectId: endpoint.projectId, action: "KMS_SECRET_DECRYPT_FAILED", success: false, message: "Webhook secret decryption failed closed." });
    throw error;
  }
}

export function rawSecretLookup() {
  return async (endpointId: string) => getEndpointSecret(endpointId);
}
