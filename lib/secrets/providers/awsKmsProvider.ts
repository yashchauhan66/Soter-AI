import { createHash } from "crypto";
import { DecryptCommand, DescribeKeyCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import type { EncryptedSecret, RotationResult, SecretStore, SecretStoreHealth } from "../secretStore";

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }

export class AwsKmsProvider implements SecretStore {
  private config() {
    const region = process.env.AWS_REGION;
    const keyId = process.env.AWS_KMS_KEY_ID;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !keyId) {
      throw new Error("AWS KMS requires AWS_REGION and AWS_KMS_KEY_ID.");
    }
    const credentials = accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN }
      : undefined;
    return { keyId, client: new KMSClient({ region, credentials }) };
  }

  async encryptSecret(plainText: string): Promise<EncryptedSecret> {
    const { client, keyId } = this.config();
    const result = await client.send(new EncryptCommand({
      KeyId: keyId,
      Plaintext: Buffer.from(plainText),
      EncryptionContext: { service: "cyberrakshak-guard" },
    }));
    if (!result.CiphertextBlob) throw new Error("AWS KMS Encrypt returned no ciphertext.");
    return { provider: "aws-kms", ciphertext: Buffer.from(result.CiphertextBlob).toString("base64"), keyId: result.KeyId ?? keyId, version: "aws-kms", keyVersion: "aws-kms", createdAt: new Date().toISOString() };
  }

  async decryptSecret(encrypted: EncryptedSecret): Promise<string> {
    if (encrypted.provider !== "aws-kms") throw new Error("AWS KMS received an incompatible envelope.");
    const { client } = this.config();
    const result = await client.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(encrypted.ciphertext, "base64"),
      EncryptionContext: { service: "cyberrakshak-guard" },
    }));
    if (!result.Plaintext) throw new Error("AWS KMS Decrypt returned no plaintext.");
    return Buffer.from(result.Plaintext).toString("utf8");
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
      const { client, keyId } = this.config();
      await client.send(new DescribeKeyCommand({ KeyId: keyId }));
      return { provider: "aws-kms", healthy: true, configured: true, latencyMs: Date.now() - started, message: "AWS KMS key is reachable.", checkedAt: new Date().toISOString() };
    } catch (error) {
      return { provider: "aws-kms", healthy: false, configured: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "AWS KMS health check failed.", checkedAt: new Date().toISOString() };
    }
  }
}
