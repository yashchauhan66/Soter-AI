/**
 * VaultCrypto — authenticated encryption for the Protected Secret Vault.
 *
 * Uses WebCrypto AES-256-GCM via `globalThis.crypto.subtle` (available in
 * Node 18+ and in the esbuild bundle), matching the approach already used by
 * {@link hashContent} in HashCache. The vault file therefore never contains
 * plaintext secrets on disk; the key lives separately in VS Code SecretStorage.
 *
 * Payload format (base64): [12-byte IV][GCM ciphertext+tag].
 */
/** Generate a fresh base64-encoded AES-256 key. Store this in SecretStorage. */
export declare function generateVaultKey(): string;
/** Encrypt a plaintext string with the base64 key. Returns a base64 payload. */
export declare function encryptVault(plaintext: string, keyB64: string): Promise<string>;
/** Decrypt a base64 payload produced by {@link encryptVault}. */
export declare function decryptVault(payloadB64: string, keyB64: string): Promise<string>;
//# sourceMappingURL=VaultCrypto.d.ts.map