import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { EncryptedSecret, RotationResult, SecretStore, SecretStoreHealth } from "../secretStore";

function localKey() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local secret encryption is development-only.");
  }
  const material = process.env.LOCAL_SECRET_STORE_KEY ?? process.env.API_KEY_PEPPER;
  if (!material || material.length < 24) {
    throw new Error("LOCAL_SECRET_STORE_KEY or API_KEY_PEPPER must contain at least 24 characters.");
  }
  return createHash("sha256").update(`cyberrakshak-secret-store:${material}`).digest();
}

export class LocalDevProvider implements SecretStore {
  async encryptSecret(plainText: string): Promise<EncryptedSecret> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", localKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const version = "local-v1";
    return {
      provider: "local",
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url"),
      keyId: "local-development-key",
      version,
      keyVersion: version,
      createdAt: new Date().toISOString(),
    };
  }

  async decryptSecret(envelope: EncryptedSecret): Promise<string> {
    if (envelope.provider !== "local") throw new Error(`Cannot decrypt ${envelope.provider} with local provider.`);
    const packed = Buffer.from(envelope.ciphertext, "base64url");
    if (packed.length < 29) throw new Error("Encrypted secret envelope is invalid.");
    const decipher = createDecipheriv("aes-256-gcm", localKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
  }

  async rotateSecret(secret: string | EncryptedSecret, nextPlainText?: string): Promise<RotationResult> {
    const secretId = typeof secret === "string" ? secret : createHash("sha256").update(secret.ciphertext).digest("hex").slice(0, 16);
    const plainText = nextPlainText ?? (typeof secret === "string" ? secret : await this.decryptSecret(secret));
    const encryptedSecret = await this.encryptSecret(plainText);
    return { ...encryptedSecret, secretId, rotatedAt: new Date().toISOString(), encryptedSecret };
  }

  async healthCheck(): Promise<SecretStoreHealth> {
    const started = Date.now();
    try {
      const encrypted = await this.encryptSecret("health-check");
      const healthy = await this.decryptSecret(encrypted) === "health-check";
      return { provider: "local", healthy, configured: true, latencyMs: Date.now() - started, message: healthy ? "Development secret store is operational." : "Round-trip failed.", checkedAt: new Date().toISOString() };
    } catch (error) {
      return { provider: "local", healthy: false, configured: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Health check failed.", checkedAt: new Date().toISOString() };
    }
  }
}
