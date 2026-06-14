import { createHash } from "crypto";
import type { EncryptedSecret, RotationResult, SecretStore, SecretStoreHealth } from "../secretStore";

export class VaultProvider implements SecretStore {
  private config() {
    const address = process.env.VAULT_ADDR?.replace(/\/$/, "");
    const token = process.env.VAULT_TOKEN;
    const key = process.env.VAULT_TRANSIT_KEY;
    if (!address || !token || !key) throw new Error("Vault Transit requires VAULT_ADDR, VAULT_TOKEN, and VAULT_TRANSIT_KEY.");
    return { address, token, key, context: process.env.VAULT_TRANSIT_CONTEXT };
  }

  private async call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const { address, token } = this.config();
    const response = await fetch(`${address}/v1/${path}`, { method: body ? "POST" : "GET", headers: { "x-vault-token": token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Vault request failed with HTTP ${response.status}.`);
    return await response.json() as T;
  }

  async encryptSecret(plainText: string): Promise<EncryptedSecret> {
    const { key, context } = this.config();
    const result = await this.call<{ data: { ciphertext: string; key_version?: number } }>(`transit/encrypt/${encodeURIComponent(key)}`, { plaintext: Buffer.from(plainText).toString("base64"), ...(context ? { context: Buffer.from(context).toString("base64") } : {}) });
    const version = String(result.data.key_version ?? result.data.ciphertext.match(/^vault:v(\d+):/)?.[1] ?? "unknown");
    return { provider: "vault", ciphertext: result.data.ciphertext, keyId: key, version, keyVersion: version, createdAt: new Date().toISOString() };
  }

  async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    if (encrypted.provider !== "vault") throw new Error("Vault received an incompatible envelope.");
    const { key, context } = this.config();
    const result = await this.call<{ data: { plaintext: string } }>(`transit/decrypt/${encodeURIComponent(key)}`, { ciphertext: encrypted.ciphertext, ...(context ? { context: Buffer.from(context).toString("base64") } : {}) });
    return Buffer.from(result.data.plaintext, "base64").toString("utf8");
  }

  async rotateSecret(secret: string | EncryptedSecret, nextPlainText?: string): Promise<RotationResult> {
    const secretId = typeof secret === "string" ? secret : createHash("sha256").update(secret.ciphertext).digest("hex").slice(0, 16);
    let encryptedSecret: EncryptedSecret;
    if (typeof secret !== "string" && !nextPlainText) {
      const { key, context } = this.config();
      const result = await this.call<{ data: { ciphertext: string } }>(`transit/rewrap/${encodeURIComponent(key)}`, { ciphertext: secret.ciphertext, ...(context ? { context: Buffer.from(context).toString("base64") } : {}) });
      const version = result.data.ciphertext.match(/^vault:v(\d+):/)?.[1] ?? "unknown";
      encryptedSecret = { provider: "vault", ciphertext: result.data.ciphertext, keyId: key, version, keyVersion: version, createdAt: new Date().toISOString() };
    } else {
      const plainText = nextPlainText ?? secret as string;
      encryptedSecret = await this.encryptSecret(plainText);
    }
    return { ...encryptedSecret, secretId, rotatedAt: new Date().toISOString(), encryptedSecret };
  }

  async healthCheck(): Promise<SecretStoreHealth> {
    const started = Date.now();
    try {
      const { key } = this.config();
      await this.call(`transit/keys/${encodeURIComponent(key)}`);
      return { provider: "vault", healthy: true, configured: true, latencyMs: Date.now() - started, message: "Vault Transit key is reachable.", checkedAt: new Date().toISOString() };
    } catch (error) {
      return { provider: "vault", healthy: false, configured: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Vault health check failed.", checkedAt: new Date().toISOString() };
    }
  }
}
