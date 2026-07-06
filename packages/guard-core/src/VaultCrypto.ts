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

const IV_BYTES = 12; // 96-bit nonce, the GCM standard.
const KEY_BYTES = 32; // AES-256.

function toBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

// Typed as `any` because guard-core's tsconfig has no DOM lib (SubtleCrypto /
// CryptoKey types are unavailable). WebCrypto is present at runtime in Node 18+.
function getSubtle(): any {
    const subtle = (globalThis as any).crypto?.subtle;
    if (!subtle) {
        throw new Error("VaultCrypto requires WebCrypto (globalThis.crypto.subtle), which is unavailable here.");
    }
    return subtle;
}

function randomBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    (globalThis as any).crypto.getRandomValues(out);
    return out;
}

/** Generate a fresh base64-encoded AES-256 key. Store this in SecretStorage. */
export function generateVaultKey(): string {
    return toBase64(randomBytes(KEY_BYTES));
}

async function importKey(keyB64: string): Promise<any> {
    const raw = fromBase64(keyB64);
    if (raw.length !== KEY_BYTES) {
        throw new Error(`Vault key must be ${KEY_BYTES} bytes (got ${raw.length}).`);
    }
    return getSubtle().importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a plaintext string with the base64 key. Returns a base64 payload. */
export async function encryptVault(plaintext: string, keyB64: string): Promise<string> {
    const key = await importKey(keyB64);
    const iv = randomBytes(IV_BYTES);
    const data = new TextEncoder().encode(plaintext);
    const cipher = new Uint8Array(await getSubtle().encrypt({ name: "AES-GCM", iv }, key, data));
    const payload = new Uint8Array(iv.length + cipher.length);
    payload.set(iv, 0);
    payload.set(cipher, iv.length);
    return toBase64(payload);
}

/** Decrypt a base64 payload produced by {@link encryptVault}. */
export async function decryptVault(payloadB64: string, keyB64: string): Promise<string> {
    const key = await importKey(keyB64);
    const payload = fromBase64(payloadB64);
    if (payload.length <= IV_BYTES) throw new Error("Vault payload is too short or corrupt.");
    const iv = payload.slice(0, IV_BYTES);
    const cipher = payload.slice(IV_BYTES);
    const plain = await getSubtle().decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
}
