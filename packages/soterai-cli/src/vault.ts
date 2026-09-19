/**
 * The CLI's own secret vault, and the JIT injection that `soterai run` performs.
 *
 * WHY A SEPARATE VAULT. The VS Code extension already has a vault, but its AES
 * key lives in VS Code SecretStorage (the OS keychain), reachable only through
 * the VS Code API. A standalone CLI process cannot read it, so `soterai run`
 * cannot decrypt the extension's vault — that is a boundary, not a bug. The CLI
 * therefore owns a vault of its own, and to avoid simply moving the problem to a
 * key file that a same-user agent could also read, the key is DERIVED FROM A
 * PASSPHRASE (scrypt) and never written to disk. The vault file holds only
 * ciphertext; without the passphrase it is inert.
 *
 * WHAT JIT INJECTION BUYS, STATED HONESTLY. `run` decrypts the vault in memory
 * and hands the secrets to a child process as environment variables, so the
 * value never has to sit in a `.env` or a config file on disk. That removes it
 * from the surface an AI agent actually reads — file contents it greps, indexes
 * for RAG, or is asked to "paste". It is NOT an airtight process boundary: a
 * determined same-user process can still read `/proc/<pid>/environ`. It is a
 * real reduction of the file-read surface, not a sandbox.
 *
 * Uses node's `crypto` (this is a node-only CLI, unlike guard-core which targets
 * the browser bundle and so uses WebCrypto). No new dependency.
 */
import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scryptSync,
    timingSafeEqual,
} from "node:crypto";

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard nonce
const SALT_BYTES = 16;
const TAG_BYTES = 16;

// scrypt cost. N=2^15 keeps derivation ~100ms on a laptop and its memory
// (128*N*r ≈ 32 MB) sits under node's default maxmem, but we pass maxmem
// explicitly so a future N bump fails loudly here instead of at runtime.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** On-disk vault. Everything here is safe at rest: no key, no plaintext. */
export interface VaultFile {
    version: 1;
    kdf: { algo: "scrypt"; salt: string; N: number; r: number; p: number };
    /** base64( IV | ciphertext | GCM tag ) of the JSON secrets map. */
    payload: string;
}

/** The decrypted secrets: NAME → raw value. Never persisted, never printed. */
export type Secrets = Record<string, string>;

function deriveKey(passphrase: string, salt: Buffer, params = SCRYPT): Buffer {
    if (!passphrase) throw new Error("Empty passphrase.");
    return scryptSync(passphrase.normalize("NFKC"), salt, KEY_BYTES, {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: params.maxmem,
    });
}

/** Encrypt a secrets map into a fresh VaultFile (new salt + IV every write). */
export function encryptSecrets(secrets: Secrets, passphrase: string): VaultFile {
    const salt = randomBytes(SALT_BYTES);
    const key = deriveKey(passphrase, salt);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        version: 1,
        kdf: { algo: "scrypt", salt: salt.toString("base64"), N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
        payload: Buffer.concat([iv, enc, tag]).toString("base64"),
    };
}

/**
 * Decrypt a VaultFile. A wrong passphrase fails here as a GCM auth error — the
 * tag will not verify — so there is no separate password check to get wrong.
 */
export function decryptSecrets(vault: VaultFile, passphrase: string): Secrets {
    if (vault.version !== 1) throw new Error(`Unsupported vault version ${vault.version}.`);
    if (vault.kdf.algo !== "scrypt") throw new Error(`Unsupported KDF ${vault.kdf.algo}.`);
    const salt = Buffer.from(vault.kdf.salt, "base64");
    const key = deriveKey(passphrase, salt, { ...SCRYPT, N: vault.kdf.N, r: vault.kdf.r, p: vault.kdf.p });
    const raw = Buffer.from(vault.payload, "base64");
    if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error("Vault payload is too short or corrupt.");
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const enc = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let plaintext: Buffer;
    try {
        plaintext = Buffer.concat([decipher.update(enc), decipher.final()]);
    } catch {
        // GCM tag mismatch — the passphrase is wrong or the file was tampered.
        throw new Error("Wrong passphrase, or the vault file is corrupt.");
    }
    const parsed = JSON.parse(plaintext.toString("utf8")) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Vault contents are not a secrets map.");
    }
    const out: Secrets = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v !== "string") throw new Error(`Vault entry ${k} is not a string.`);
        out[k] = v;
    }
    return out;
}

/** A vault env var name must be a valid POSIX-ish identifier we can export. */
export function isValidSecretName(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/**
 * Build the child's environment: the parent's env, with the vault's secrets
 * overlaid, and the passphrase variable REMOVED so `run`'s own passphrase is
 * never inherited by the process it launches. `SOTERAI_VAULT_PASSPHRASE` is the
 * one variable a child must never see, precisely because it unlocks everything.
 */
export function buildChildEnv(
    parentEnv: NodeJS.ProcessEnv,
    secrets: Secrets,
    passphraseVar = "SOTERAI_VAULT_PASSPHRASE",
): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...parentEnv };
    delete env[passphraseVar];
    for (const [name, value] of Object.entries(secrets)) env[name] = value;
    return env;
}

/**
 * Compare two candidate passphrases in constant time. Used by `vault init` to
 * confirm a new passphrase, so a mismatch is reported without a timing signal
 * (defensive; the real protection is scrypt + GCM).
 */
export function passphrasesMatch(a: string, b: string): boolean {
    const ba = Buffer.from(a.normalize("NFKC"), "utf8");
    const bb = Buffer.from(b.normalize("NFKC"), "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}

/** One parsed `.env` assignment, plus the source line it came from. */
export interface EnvEntry {
    name: string;
    value: string;
    /** 0-based index of the line in the original file, for a safe rewrite. */
    line: number;
}

export interface ParsedEnv {
    entries: EnvEntry[];
    /** Names present but rejected as invalid env identifiers. */
    skipped: string[];
}

/**
 * Parse a `.env` file into name/value pairs. Deliberately conservative for a
 * SECURITY tool:
 *   - A quoted value is taken verbatim between the quotes (so a `#` inside a
 *     secret survives); an unquoted value is the rest of the line, trimmed.
 *   - No inline-comment stripping on unquoted values and no `\n` escape
 *     expansion — both would risk silently CORRUPTING a secret, which is worse
 *     than importing a value that includes an unusual character.
 *   - `export KEY=…` is accepted (the `export ` prefix is dropped).
 * Later assignments to the same name win (last-wins, like a shell sourcing it).
 */
export function parseEnvFile(text: string): ParsedEnv {
    const entries: EnvEntry[] = [];
    const skipped: string[] = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const body = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trimStart() : trimmed;
        const eq = body.indexOf("=");
        if (eq <= 0) continue; // no `=`, or a leading `=` with no name
        const name = body.slice(0, eq).trim();
        if (!isValidSecretName(name)) { skipped.push(name); continue; }
        entries.push({ name, value: unquoteEnvValue(body.slice(eq + 1).trim()), line: i });
    }
    return { entries, skipped };
}

function unquoteEnvValue(raw: string): string {
    if (raw.length >= 2) {
        const q = raw[0];
        if ((q === '"' || q === "'") && raw[raw.length - 1] === q) return raw.slice(1, -1);
    }
    return raw;
}

/**
 * Rewrite a `.env` so the named keys keep their KEY (documenting what the app
 * needs) but lose their VALUE — the raw secret is gone from disk once it is in
 * the vault. A one-time header records where the values went. Other lines,
 * comments, and unlisted keys are left exactly as they were.
 *
 * The value is emptied rather than replaced with a placeholder token: an empty
 * value is unambiguous and can't be mistaken for a real secret, and `soterai
 * run` injects the real value into the environment over it at launch.
 */
export function rewriteEnvWithoutValues(text: string, entries: EnvEntry[]): string {
    const byLine = new Map(entries.map((e) => [e.line, e]));
    const lines = text.split(/\r?\n/);
    const out = lines.map((line, i) => {
        const entry = byLine.get(i);
        if (!entry) return line;
        const exported = line.trimStart().startsWith("export ") ? "export " : "";
        return `${exported}${entry.name}=`;
    });
    const header = "# Values below were moved to the SoterAI vault. Run via: soterai run -- <cmd>";
    return out[0]?.startsWith("# Values below were moved") ? out.join("\n") : `${header}\n${out.join("\n")}`;
}
