import { configuredSecretStoreProvider, getSecretStore, type SecretStoreHealth } from "./secretStore";

export async function checkSecretStoreHealth(): Promise<SecretStoreHealth> {
  try {
    return await getSecretStore(configuredSecretStoreProvider()).healthCheck();
  } catch (error) {
    return {
      provider: (process.env.SECRET_STORE_PROVIDER ?? "local") as SecretStoreHealth["provider"],
      healthy: false,
      configured: false,
      latencyMs: 0,
      message: error instanceof Error ? error.message : "Secret store configuration is invalid.",
      checkedAt: new Date().toISOString(),
    };
  }
}
