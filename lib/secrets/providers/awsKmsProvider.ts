import { createHash, createHmac } from "crypto";
import type { EncryptedSecret, RotationResult, SecretStore, SecretStoreHealth } from "../secretStore";

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: Buffer | string, value: string) { return createHmac("sha256", key).update(value).digest(); }

export class AwsKmsProvider implements SecretStore {
  private config() {
    const region = process.env.AWS_REGION;
    const keyId = process.env.AWS_KMS_KEY_ID;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !keyId || !accessKeyId || !secretAccessKey) {
      throw new Error("AWS KMS requires AWS_REGION, AWS_KMS_KEY_ID, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.");
    }
    return { region, keyId, accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN };
  }

  private async call<T>(target: string, body: Record<string, unknown>): Promise<T> {
    const config = this.config();
    const host = `kms.${config.region}.amazonaws.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payload = JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/x-amz-json-1.1",
      host,
      "x-amz-date": amzDate,
      "x-amz-target": `TrentService.${target}`,
    };
    if (config.sessionToken) headers["x-amz-security-token"] = config.sessionToken;
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map((key) => `${key}:${headers[key].trim()}\n`).join("");
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
    const scope = `${date}/${config.region}/kms/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const dateKey = hmac(`AWS4${config.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, config.region);
    const serviceKey = hmac(regionKey, "kms");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(`https://${host}/`, { method: "POST", headers: { ...headers, authorization }, body: payload, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`AWS KMS ${target} failed with HTTP ${response.status}.`);
    return await response.json() as T;
  }

  async encryptSecret(plainText: string): Promise<EncryptedSecret> {
    const { keyId } = this.config();
    const result = await this.call<{ CiphertextBlob: string; KeyId?: string }>("Encrypt", { KeyId: keyId, Plaintext: Buffer.from(plainText).toString("base64"), EncryptionContext: { service: "cyberrakshak-guard" } });
    return { provider: "aws-kms", ciphertext: result.CiphertextBlob, keyId: result.KeyId ?? keyId, version: "aws-kms", keyVersion: "aws-kms", createdAt: new Date().toISOString() };
  }

  async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    if (encrypted.provider !== "aws-kms") throw new Error("AWS KMS received an incompatible envelope.");
    const result = await this.call<{ Plaintext: string }>("Decrypt", { CiphertextBlob: encrypted.ciphertext, EncryptionContext: { service: "cyberrakshak-guard" } });
    return Buffer.from(result.Plaintext, "base64").toString("utf8");
  }

  async rotateSecret(secret: string | EncryptedSecret, nextPlainText?: string): Promise<RotationResult> {
    if (typeof secret === "string" && !nextPlainText) throw new Error("AWS KMS rotation requires an encrypted envelope or replacement plaintext.");
    const plainText = nextPlainText ?? await this.decryptSecret(secret as EncryptedSecret);
    const encryptedSecret = await this.encryptSecret(plainText);
    const secretId = typeof secret === "string" ? secret : sha256(secret.ciphertext).slice(0, 16);
    return { ...encryptedSecret, secretId, rotatedAt: new Date().toISOString(), encryptedSecret };
  }

  async healthCheck(): Promise<SecretStoreHealth> {
    const started = Date.now();
    try {
      const { keyId } = this.config();
      await this.call("DescribeKey", { KeyId: keyId });
      return { provider: "aws-kms", healthy: true, configured: true, latencyMs: Date.now() - started, message: "AWS KMS key is reachable.", checkedAt: new Date().toISOString() };
    } catch (error) {
      return { provider: "aws-kms", healthy: false, configured: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "AWS KMS health check failed.", checkedAt: new Date().toISOString() };
    }
  }
}
