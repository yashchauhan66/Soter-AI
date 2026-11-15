import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Fixed work and allocation ceilings; untrusted files cannot choose a KDF cost. */
export const RECOVERY_ENVELOPE_LIMITS = Object.freeze({
    maxArchiveBytes: 8 * 1024 * 1024,
    maxEnvelopeBytes: 12 * 1024 * 1024,
    minPassphraseCharacters: 16,
    maxPassphraseBytes: 1024,
    scryptN: 32768,
    scryptR: 8,
    scryptP: 1,
    scryptMaxMemoryBytes: 64 * 1024 * 1024,
    maxConcurrentDerivations: 2,
});

export class RecoveryEnvelopeError extends Error {
    readonly code = "recovery_unavailable";
    constructor() { super("Recovery envelope unavailable. Check the recovery file and passphrase."); this.name = "RecoveryEnvelopeError"; }
}
const unavailable = (): never => { throw new RecoveryEnvelopeError(); };

export interface RecoveryEnvelopeInput {
    readonly vaultKey: Uint8Array;
    /** Opaque archive of encrypted vault records. The host owns its schema. */
    readonly archive: Uint8Array;
}
export interface OpenedRecoveryEnvelope extends RecoveryEnvelopeInput {
    readonly archiveSha256: string;
}
export interface RecoveryEnvelopeInspection {
    readonly version: 1;
    readonly envelopeSha256: string;
    readonly byteLength: number;
}

interface Header {
    schemaVersion: 1;
    purpose: "soterai-vault-recovery";
    kdf: { name: "scrypt"; N: number; r: number; p: number; salt: string };
    cipher: { name: "aes-256-gcm"; nonce: string };
}
interface Envelope extends Header { ciphertext: string; tag: string }

const MAGIC = Buffer.from("SOTERAI-RECOVERY-ARCHIVE-V1\0", "ascii");
const LENGTH_OFFSET = MAGIC.length;
const KEY_OFFSET = LENGTH_OFFSET + 4;
const HASH_OFFSET = KEY_OFFSET + 32;
const ARCHIVE_OFFSET = HASH_OFFSET + 32;
const MAX_SEALED_BYTES = ARCHIVE_OFFSET + RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
let activeDerivations = 0;

function hash(bytes: Uint8Array): Buffer { return createHash("sha256").update(bytes).digest(); }
function snapshot(value: Uint8Array, minBytes: number, maxBytes: number): Buffer {
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)
        || value.byteLength < minBytes || value.byteLength > maxBytes) return unavailable();
    return Buffer.from(value);
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) return unavailable();
    return value as Record<string, unknown>;
}
function base64(value: unknown, minBytes: number, maxBytes = minBytes): Buffer {
    if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 || value.length % 4 !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return unavailable();
    const decoded = Buffer.from(value, "base64");
    if (decoded.length < minBytes || decoded.length > maxBytes || decoded.toString("base64") !== value) return unavailable();
    return decoded;
}
function header(envelope: Envelope): Header {
    return { schemaVersion: 1, purpose: "soterai-vault-recovery", kdf: { ...envelope.kdf }, cipher: { ...envelope.cipher } };
}
function aad(value: Header): Buffer {
    return Buffer.from("SoterAI recovery authenticated header v1\0" + JSON.stringify(value), "utf8");
}

function boundedStructure(text: string): void {
    // The format has three objects at depth <= 2, thirteen fields and no arrays.
    // Bound structure before JSON.parse so a small file cannot allocate millions
    // of nested nodes or duplicate members before the exact schema rejects it.
    let quoted = false, escaped = false, depth = 0, objects = 0, fields = 0;
    for (const char of text) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
            continue;
        }
        if (char === '"') quoted = true;
        else if (char === "{") { if (++depth > 2 || ++objects > 3) return unavailable(); }
        else if (char === "}") { if (--depth < 0) return unavailable(); }
        else if (char === ":") { if (++fields > 13) return unavailable(); }
        else if (char === "[" || char === "]") return unavailable();
    }
    if (quoted || depth !== 0) return unavailable();
}

/** Canonical JSON is intentional: alternate spelling/order, whitespace,
 * duplicate keys and unknown fields are all rejected before key derivation. */
function parseEnvelope(bytes: Uint8Array): { bytes: Buffer; envelope: Envelope; salt: Buffer; nonce: Buffer; tag: Buffer; sealed: Buffer } {
    const copy = snapshot(bytes, 1, RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
    const text = utf8.decode(copy);
    boundedStructure(text);
    const value = object(JSON.parse(text), ["schemaVersion", "purpose", "kdf", "cipher", "ciphertext", "tag"]);
    const kdf = object(value.kdf, ["name", "N", "r", "p", "salt"]);
    const cipher = object(value.cipher, ["name", "nonce"]);
    if (value.schemaVersion !== 1 || value.purpose !== "soterai-vault-recovery" || kdf.name !== "scrypt"
        || kdf.N !== RECOVERY_ENVELOPE_LIMITS.scryptN || kdf.r !== RECOVERY_ENVELOPE_LIMITS.scryptR
        || kdf.p !== RECOVERY_ENVELOPE_LIMITS.scryptP || cipher.name !== "aes-256-gcm") return unavailable();
    const salt = base64(kdf.salt, 16), nonce = base64(cipher.nonce, 12), tag = base64(value.tag, 16);
    const sealed = base64(value.ciphertext, ARCHIVE_OFFSET + 1, MAX_SEALED_BYTES);
    const envelope: Envelope = {
        schemaVersion: 1, purpose: "soterai-vault-recovery",
        kdf: { name: "scrypt", N: RECOVERY_ENVELOPE_LIMITS.scryptN, r: RECOVERY_ENVELOPE_LIMITS.scryptR,
            p: RECOVERY_ENVELOPE_LIMITS.scryptP, salt: salt.toString("base64") },
        cipher: { name: "aes-256-gcm", nonce: nonce.toString("base64") },
        ciphertext: sealed.toString("base64"), tag: tag.toString("base64"),
    };
    if (JSON.stringify(envelope) !== text) return unavailable();
    return { bytes: copy, envelope, salt, nonce, tag, sealed };
}

function passwordBytes(passphrase: string): Buffer {
    if (typeof passphrase !== "string" || passphrase.length > RECOVERY_ENVELOPE_LIMITS.maxPassphraseBytes
        || Array.from(passphrase).length < RECOVERY_ENVELOPE_LIMITS.minPassphraseCharacters) return unavailable();
    const bytes = Buffer.from(passphrase, "utf8");
    if (bytes.length > RECOVERY_ENVELOPE_LIMITS.maxPassphraseBytes || utf8.decode(bytes) !== passphrase) {
        bytes.fill(0); return unavailable();
    }
    return bytes;
}
async function derive(passphrase: string, salt: Buffer): Promise<Buffer> {
    if (activeDerivations >= RECOVERY_ENVELOPE_LIMITS.maxConcurrentDerivations) return unavailable();
    const password = passwordBytes(passphrase);
    activeDerivations++;
    try {
        return await new Promise<Buffer>((resolve, reject) => {
            scrypt(password, salt, 32, { N: RECOVERY_ENVELOPE_LIMITS.scryptN, r: RECOVERY_ENVELOPE_LIMITS.scryptR,
                p: RECOVERY_ENVELOPE_LIMITS.scryptP, maxmem: RECOVERY_ENVELOPE_LIMITS.scryptMaxMemoryBytes },
            (error, key) => error ? reject(new RecoveryEnvelopeError()) : resolve(key));
        });
    } finally { password.fill(0); activeDerivations--; }
}

/** Length checks do not establish passphrase entropy. Use a generated recovery
 * password and retain it separately from the exported file. No filesystem or
 * SecretStorage access occurs here. Input material is copied before awaiting. */
export async function createRecoveryEnvelope(input: RecoveryEnvelopeInput, passphrase: string): Promise<Uint8Array> {
    let key: Buffer | undefined, archive: Buffer | undefined, payload: Buffer | undefined, derived: Buffer | undefined;
    try {
        key = snapshot(input.vaultKey, 32, 32);
        archive = snapshot(input.archive, 1, RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes);
        payload = Buffer.alloc(ARCHIVE_OFFSET + archive.length);
        MAGIC.copy(payload); payload.writeUInt32BE(archive.length, LENGTH_OFFSET);
        key.copy(payload, KEY_OFFSET); hash(archive).copy(payload, HASH_OFFSET); archive.copy(payload, ARCHIVE_OFFSET);
        // Independent salt and nonce on every export; never supplied by the host.
        const salt = randomBytes(16), nonce = randomBytes(12);
        const metadata: Header = { schemaVersion: 1, purpose: "soterai-vault-recovery",
            kdf: { name: "scrypt", N: RECOVERY_ENVELOPE_LIMITS.scryptN, r: RECOVERY_ENVELOPE_LIMITS.scryptR,
                p: RECOVERY_ENVELOPE_LIMITS.scryptP, salt: salt.toString("base64") },
            cipher: { name: "aes-256-gcm", nonce: nonce.toString("base64") } };
        derived = await derive(passphrase, salt);
        const cipher = createCipheriv("aes-256-gcm", derived, nonce, { authTagLength: 16 });
        cipher.setAAD(aad(metadata));
        const sealed = Buffer.concat([cipher.update(payload), cipher.final()]);
        const result = Buffer.from(JSON.stringify({ ...metadata, ciphertext: sealed.toString("base64"), tag: cipher.getAuthTag().toString("base64") }), "utf8");
        if (result.length > RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes) return unavailable();
        return result;
    } catch { return unavailable(); }
    finally { key?.fill(0); archive?.fill(0); payload?.fill(0); derived?.fill(0); }
}

/** Structural inspection and exact-byte review binding, not authentication.
 * The caller must retain this hash outside the untrusted recovery file. */
export function inspectRecoveryEnvelope(bytes: Uint8Array): Readonly<RecoveryEnvelopeInspection> {
    try {
        const parsed = parseEnvelope(bytes);
        return Object.freeze({ version: 1, envelopeSha256: hash(parsed.bytes).toString("hex"), byteLength: parsed.bytes.length });
    } catch { return unavailable(); }
}

/** Authenticated material for trusted host code only. Returned arrays are owned
 * copies; the host must wipe them after use and must never expose them through
 * commands, logs, previews or reports. This function does not install a store.
 * The host must validate its archive and require a locked, empty destination. */
export async function openRecoveryEnvelope(bytes: Uint8Array, passphrase: string, expectedEnvelopeSha256: string): Promise<Readonly<OpenedRecoveryEnvelope>> {
    let derived: Buffer | undefined, payload: Buffer | undefined, key: Buffer | undefined, archive: Buffer | undefined;
    let returned = false;
    try {
        const parsed = parseEnvelope(bytes);
        if (typeof expectedEnvelopeSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedEnvelopeSha256)
            || !timingSafeEqual(hash(parsed.bytes), Buffer.from(expectedEnvelopeSha256, "hex"))) return unavailable();
        derived = await derive(passphrase, parsed.salt);
        const decipher = createDecipheriv("aes-256-gcm", derived, parsed.nonce, { authTagLength: 16 });
        decipher.setAAD(aad(header(parsed.envelope))); decipher.setAuthTag(parsed.tag);
        // Keep update() output local even if final() rejects authentication.
        const pending = decipher.update(parsed.sealed);
        try { payload = Buffer.concat([pending, decipher.final()]); }
        finally { pending.fill(0); }
        if (payload.length < ARCHIVE_OFFSET + 1 || !timingSafeEqual(payload.subarray(0, MAGIC.length), MAGIC)) return unavailable();
        const length = payload.readUInt32BE(LENGTH_OFFSET);
        if (length < 1 || length > RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes || payload.length !== ARCHIVE_OFFSET + length) return unavailable();
        archive = Buffer.from(payload.subarray(ARCHIVE_OFFSET));
        const archiveHash = hash(archive);
        if (!timingSafeEqual(archiveHash, payload.subarray(HASH_OFFSET, ARCHIVE_OFFSET))) return unavailable();
        key = Buffer.from(payload.subarray(KEY_OFFSET, HASH_OFFSET));
        const result = Object.freeze({ vaultKey: key, archive, archiveSha256: archiveHash.toString("hex") });
        returned = true;
        return result;
    } catch { return unavailable(); }
    finally {
        derived?.fill(0); payload?.fill(0);
        if (!returned) { key?.fill(0); archive?.fill(0); }
    }
}
