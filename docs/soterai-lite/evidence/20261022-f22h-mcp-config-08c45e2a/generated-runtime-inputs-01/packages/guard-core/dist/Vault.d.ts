/**
 * Vault (pure logic) — extracts secrets from `.env`-style content, replaces them
 * with SoterAI placeholders, and produces metadata that carries a HASH ONLY,
 * never the raw value. The encrypted store and SecretStorage key live in the
 * extension layer (VaultManager); this module is filesystem-free and unit-tested.
 *
 * Goal (honest): remove raw secrets from normal workspace files so a local AI
 * assistant reading those files sees placeholders, not credentials. This does
 * NOT stop an extension from reading a file you have not migrated.
 */
export declare const PLACEHOLDER_PREFIX = "SOTERAI_PROTECTED_";
export interface VaultCandidate {
    /** The env var / assignment key, e.g. DATABASE_URL. */
    key: string;
    /** The raw secret value — kept in memory only, never persisted to metadata. */
    rawValue: string;
    /** Best-effort classification of the secret kind. */
    type: string;
    /** The placeholder that will replace the raw value in the workspace file. */
    placeholder: string;
    /** Byte offsets of the raw value within the source text. */
    start: number;
    end: number;
}
export interface VaultEntryMetadata {
    id: string;
    key: string;
    type: string;
    originalFile: string;
    placeholder: string;
    createdAt: string;
    /** SHA-256 of the raw value. Lets us verify/restore without storing plaintext. */
    hash: string;
}
/** A stored vault entry = safe metadata + the encrypted raw value envelope. */
export interface VaultEntry extends VaultEntryMetadata {
    /** Base64 AES-GCM payload of the raw value (see VaultCrypto). Extension-owned. */
    encryptedValue?: string;
}
/** Best-effort secret-type label from the key and value. */
export declare function classifySecretType(key: string, value: string): string;
/**
 * Extract vault candidates from `.env`-style text. Returns entries with byte
 * offsets so {@link applyPlaceholders} can replace precisely. The raw value is
 * carried on the candidate for encryption but is stripped from persisted
 * metadata by {@link buildVaultMetadata}.
 */
export declare function extractEnvSecrets(text: string): VaultCandidate[];
/**
 * Extract every secret shape that can be replaced without breaking its host file.
 *
 * Environment assignments keep their stable key-based placeholders. Standalone
 * credentials (tokens, URLs and private-key blocks) come from SecretDetector and
 * receive occurrence-qualified placeholders so two values of the same type can
 * always be restored independently. Assignment-shaped detector matches are
 * deliberately excluded because replacing `api_key = value` as a whole can make
 * JSON/YAML/source files invalid; the env parser already handles safe assignment
 * replacement where it can identify the value boundary precisely.
 */
export declare function extractVaultCandidates(text: string): VaultCandidate[];
/**
 * Replace each candidate's raw value with its placeholder. Applied
 * right-to-left so earlier offsets stay valid.
 */
export declare function applyPlaceholders(text: string, candidates: VaultCandidate[]): string;
/**
 * Restore placeholders back to raw values using a map of placeholder → raw.
 * Used by `SoterAI: Restore Secret Placeholders`. The raw map is supplied by
 * the extension after decrypting the vault; it is never stored in metadata.
 */
export declare function restorePlaceholders(text: string, placeholderToRaw: Record<string, string>): string;
/** Build persist-safe metadata (hash only — never the raw value). */
export declare function buildVaultMetadata(candidate: VaultCandidate, originalFile: string): Promise<VaultEntryMetadata>;
/**
 * Produce a safe `.env.example` from `.env` content: keep keys, drop every
 * value. Secret-looking keys get a `<type>` hint; other keys get an empty
 * value. Never emits a raw secret.
 */
export declare function generateEnvExample(text: string): string;
//# sourceMappingURL=Vault.d.ts.map