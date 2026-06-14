import { AwsKmsProvider } from "./providers/awsKmsProvider";
import { GcpKmsProvider } from "./providers/gcpKmsProvider";
import { LocalDevProvider } from "./providers/localDevProvider";
import { VaultProvider } from "./providers/vaultProvider";

export type SecretStoreProvider = "local" | "aws-kms" | "gcp-kms" | "vault";

export interface EncryptedSecret {
  provider: SecretStoreProvider;
  ciphertext: string;
  keyId?: string;
  version?: string;
  /** Phase 4 compatibility alias. */
  keyVersion?: string;
  createdAt: string;
}

export interface SecretStoreHealth {
  provider: SecretStoreProvider;
  healthy: boolean;
  configured: boolean;
  latencyMs: number;
  message: string;
  checkedAt: string;
}

export interface RotationResult extends EncryptedSecret {
  secretId: string;
  rotatedAt: string;
  encryptedSecret: EncryptedSecret;
}

export interface SecretStore {
  encryptSecret(plainText: string): Promise<EncryptedSecret>;
  decryptSecret(encrypted: EncryptedSecret): Promise<string>;
  rotateSecret(secret: string | EncryptedSecret, nextPlainText?: string): Promise<RotationResult>;
  healthCheck(): Promise<SecretStoreHealth>;
}

export function configuredSecretStoreProvider(): SecretStoreProvider {
  const provider = (process.env.SECRET_STORE_PROVIDER ?? "local") as SecretStoreProvider;
  if (!["local", "aws-kms", "gcp-kms", "vault"].includes(provider)) {
    throw new Error(`Unsupported secret store provider: ${provider}`);
  }
  if (provider === "local" && process.env.NODE_ENV === "production") {
    throw new Error("The local secret store is disabled in production. Configure AWS KMS, GCP KMS, or Vault.");
  }
  return provider;
}

export function getSecretStore(provider = configuredSecretStoreProvider()): SecretStore {
  if (provider === "local") return new LocalDevProvider();
  if (provider === "aws-kms") return new AwsKmsProvider();
  if (provider === "gcp-kms") return new GcpKmsProvider();
  if (provider === "vault") return new VaultProvider();
  throw new Error(`Unsupported secret store provider: ${provider satisfies never}`);
}

export async function encryptSecret(secret: string) {
  return getSecretStore().encryptSecret(secret);
}

export async function decryptSecret(envelope: EncryptedSecret) {
  return getSecretStore(envelope.provider).decryptSecret(envelope);
}

export async function rotateSecret(envelope: EncryptedSecret, nextSecret?: string) {
  return getSecretStore(envelope.provider).rotateSecret(envelope, nextSecret);
}

export { LocalDevProvider as LocalSecretStore } from "./providers/localDevProvider";
