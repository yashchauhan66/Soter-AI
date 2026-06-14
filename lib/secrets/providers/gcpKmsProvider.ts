import { createHash } from "crypto";
import type { EncryptedSecret, RotationResult, SecretStore, SecretStoreHealth } from "../secretStore";

export class GcpKmsProvider implements SecretStore {
  private config() {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const keyRing = process.env.GCP_KEY_RING;
    const cryptoKey = process.env.GCP_CRYPTO_KEY ?? process.env.GCP_KMS_KEY_ID;
    const accessToken = process.env.GCP_KMS_ACCESS_TOKEN ?? process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    if (!projectId || !location || !keyRing || !cryptoKey || !accessToken) {
      throw new Error("GCP KMS requires GCP_PROJECT_ID, GCP_LOCATION, GCP_KEY_RING, GCP_CRYPTO_KEY, and a GCP_KMS_ACCESS_TOKEN.");
    }
    const keyName = `projects/${projectId}/locations/${location}/keyRings/${keyRing}/cryptoKeys/${cryptoKey}`;
    return { keyName, accessToken };
  }

  private async call<T>(suffix: string, body?: Record<string, unknown>): Promise<T> {
    const { keyName, accessToken } = this.config();
    const response = await fetch(`https://cloudkms.googleapis.com/v1/${keyName}${suffix}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GCP KMS request failed with HTTP ${response.status}.`);
    return await response.json() as T;
  }

  async encryptSecret(plainText: string): Promise<EncryptedSecret> {
    const { keyName } = this.config();
    const result = await this.call<{ ciphertext: string; name?: string }>(":encrypt", { plaintext: Buffer.from(plainText).toString("base64"), additionalAuthenticatedData: Buffer.from("cyberrakshak-guard").toString("base64") });
    return { provider: "gcp-kms", ciphertext: result.ciphertext, keyId: result.name ?? keyName, version: result.name?.split("/").pop() ?? "primary", keyVersion: result.name?.split("/").pop() ?? "primary", createdAt: new Date().toISOString() };
  }

  async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    if (encrypted.provider !== "gcp-kms") throw new Error("GCP KMS received an incompatible envelope.");
    const result = await this.call<{ plaintext: string }>(":decrypt", { ciphertext: encrypted.ciphertext, additionalAuthenticatedData: Buffer.from("cyberrakshak-guard").toString("base64") });
    return Buffer.from(result.plaintext, "base64").toString("utf8");
  }

  async rotateSecret(secret: string | EncryptedSecret, nextPlainText?: string): Promise<RotationResult> {
    if (typeof secret === "string" && !nextPlainText) throw new Error("GCP KMS rotation requires an encrypted envelope or replacement plaintext.");
    const plainText = nextPlainText ?? await this.decryptSecret(secret as EncryptedSecret);
    const encryptedSecret = await this.encryptSecret(plainText);
    const secretId = typeof secret === "string" ? secret : createHash("sha256").update(secret.ciphertext).digest("hex").slice(0, 16);
    return { ...encryptedSecret, secretId, rotatedAt: new Date().toISOString(), encryptedSecret };
  }

  async healthCheck(): Promise<SecretStoreHealth> {
    const started = Date.now();
    try {
      await this.call("");
      return { provider: "gcp-kms", healthy: true, configured: true, latencyMs: Date.now() - started, message: "GCP KMS key is reachable.", checkedAt: new Date().toISOString() };
    } catch (error) {
      return { provider: "gcp-kms", healthy: false, configured: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "GCP KMS health check failed.", checkedAt: new Date().toISOString() };
    }
  }
}
