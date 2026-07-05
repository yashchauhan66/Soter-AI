// SECURITY: MCP Credential Vault — encrypted credential storage for MCP servers,
// tool integrations, and AI service credentials.
//
// Secrets are encrypted at rest using AES-256-GCM with a key derived from the
// organization-scoped API_KEY_PEPPER. Raw secrets are never logged, never
// returned in API responses, and are only exposed via explicit "reveal" actions
// with audit logging.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "../db";

const INVALID_VAULT_KEY_MATERIAL = new Set([
  "replace-with-a-long-random-secret",
  "cybersecurityguard-vault-key",
  "development-only",
]);

/**
 * Resolve the credential-vault root key without changing the legacy source
 * precedence used by existing ciphertext. A configured-but-invalid higher
 * priority value fails closed instead of silently selecting a different key,
 * which would make existing credentials undecryptable.
 */
export function resolveCredentialVaultKeyMaterial(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [
    ["API_KEY_PEPPER", env.API_KEY_PEPPER],
    ["NEXTAUTH_SECRET", env.NEXTAUTH_SECRET],
    ["AUTH_SECRET", env.AUTH_SECRET],
  ] as const;
  const selected = candidates.find(([, value]) => value !== undefined);

  if (!selected) {
    throw new Error(
      "Credential vault encryption key material is required. Configure API_KEY_PEPPER, NEXTAUTH_SECRET, or AUTH_SECRET.",
    );
  }

  const [source, value] = selected;
  if (!value || value.length < 32) {
    throw new Error(`${source} must contain at least 32 characters for credential vault encryption.`);
  }
  if (INVALID_VAULT_KEY_MATERIAL.has(value)) {
    throw new Error(`${source} contains a placeholder value and cannot be used for credential vault encryption.`);
  }
  return value;
}

// ── Encryption ────────────────────────────────────────────────────────────────

function vaultEncryptionKey(organizationId: string): Buffer {
  const pepper = resolveCredentialVaultKeyMaterial();
  return createHash("sha256").update(`${pepper}.${organizationId}`).digest();
}

function encryptSecret(plaintext: string, organizationId: string): { encrypted: string; iv: string } {
  const key = vaultEncryptionKey(organizationId);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted: `${encrypted}:${authTag}`, iv: iv.toString("hex") };
}

function decryptSecret(stored: string, ivHex: string, organizationId: string): string {
  const key = vaultEncryptionKey(organizationId);
  const iv = Buffer.from(ivHex, "hex");
  const parts = stored.split(":");
  const encryptedHex = parts.slice(0, -1).join(":");
  const authTag = Buffer.from(parts[parts.length - 1], "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── Credential management ─────────────────────────────────────────────────────

export interface McpCredentialInput {
  organizationId: string;
  projectId?: string;
  name: string;
  serverUrl: string;
  secret: string;
  description?: string;
  expiresAt?: Date;
  createdById?: string;
}

export interface McpCredentialResult {
  id: string;
  name: string;
  serverUrl: string;
  description: string | null;
  preview: string;
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createPreview(secret: string): string {
  if (secret.length <= 8) return `${"*".repeat(secret.length - 4)}${secret.slice(-4)}`;
  return `${secret.slice(0, 4)}${"*".repeat(Math.min(20, secret.length - 8))}${secret.slice(-4)}`;
}

export async function storeCredential(input: McpCredentialInput): Promise<McpCredentialResult> {
  const { encrypted, iv } = encryptSecret(input.secret, input.organizationId);
  const stored = await db.mcpCredentialVault.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      serverUrl: input.serverUrl,
      description: input.description,
      encryptedSecret: JSON.stringify({ data: encrypted, iv }),
      secretPreview: createPreview(input.secret),
      keyVersion: "v1",
      expiresAt: input.expiresAt,
      status: "ACTIVE",
      createdById: input.createdById,
    },
  });
  return toResult(stored);
}

export async function revealCredential(id: string, organizationId: string, actorUserId?: string): Promise<{ secret: string; name: string; serverUrl: string }> {
  const vault = await db.mcpCredentialVault.findFirst({
    where: { id, organizationId, status: "ACTIVE" },
  });
  if (!vault) throw new Error("Credential not found or inactive.");

  const stored = JSON.parse(vault.encryptedSecret);
  const secret = decryptSecret(stored.data, stored.iv, organizationId);

  // Audit log the reveal
  await db.mcpCredentialAccessLog.create({
    data: {
      vaultId: vault.id,
      action: "REVEAL",
      actorUserId,
      success: true,
    },
  });

  await db.mcpCredentialVault.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });

  return { secret, name: vault.name, serverUrl: vault.serverUrl };
}

export async function listCredentials(organizationId: string): Promise<McpCredentialResult[]> {
  const vaults = await db.mcpCredentialVault.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return vaults.map(toResult);
}

export async function rotateCredential(
  id: string,
  organizationId: string,
  newSecret: string,
  actorUserId?: string,
): Promise<McpCredentialResult> {
  const vault = await db.mcpCredentialVault.findFirst({
    where: { id, organizationId },
  });
  if (!vault) throw new Error("Credential not found.");

  const { encrypted, iv } = encryptSecret(newSecret, organizationId);

  const updated = await db.mcpCredentialVault.update({
    where: { id },
    data: {
      encryptedSecret: JSON.stringify({ data: encrypted, iv }),
      secretPreview: createPreview(newSecret),
      keyVersion: `v${Number((vault.keyVersion ?? "v0").replace("v", "")) + 1}`,
      status: "ACTIVE",
    },
  });

  await db.mcpCredentialAccessLog.create({
    data: { vaultId: id, action: "ROTATE", actorUserId, success: true },
  });

  return toResult(updated);
}

export async function revokeCredential(id: string, organizationId: string, actorUserId?: string): Promise<void> {
  await db.mcpCredentialVault.updateMany({
    where: { id, organizationId },
    data: { status: "REVOKED" },
  });
  await db.mcpCredentialAccessLog.create({
    data: { vaultId: id, action: "REVOKE", actorUserId, success: true },
  });
}

export async function getCredentialAccessLogs(organizationId: string, limit = 20) {
  return db.mcpCredentialAccessLog.findMany({
    where: { vault: { organizationId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { vault: { select: { name: true, serverUrl: true } } },
  });
}

function toResult(vault: {
  id: string;
  name: string;
  serverUrl: string;
  description: string | null;
  secretPreview: string;
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): McpCredentialResult {
  return {
    id: vault.id,
    name: vault.name,
    serverUrl: vault.serverUrl,
    description: vault.description,
    preview: vault.secretPreview,
    status: vault.status,
    lastUsedAt: vault.lastUsedAt,
    expiresAt: vault.expiresAt,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
  };
}

export function validateServerUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) {
      return { valid: false, error: "Protocol must be http, https, ws, or wss." };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }
}
