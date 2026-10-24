import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EditorRecovery {
    schemaVersion: 1; source: string; root: string; savedText: string; draftText: string; fileIdentity: string;
}
interface Binding { source: string; root: string; keyId?: string }
const MAX_ENVELOPE = 512 * 1024;
const bad = (): never => { throw new Error("Encrypted editor recovery unavailable."); };
function object(value: unknown, allowed: string[], required = allowed): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return bad();
    if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) return bad();
    return value as Record<string, unknown>;
}
function uri(value: unknown): asserts value is string {
    if (typeof value !== "string" || !value.startsWith("file:///") || value.length > 8192 || /[\r\n\0]/.test(value)) return bad();
    const parsed = new URL(value); if (parsed.protocol !== "file:" || parsed.host || parsed.search || parsed.hash) return bad();
}
function payload(value: unknown): EditorRecovery {
    const record = object(value, ["schemaVersion", "source", "root", "savedText", "draftText", "fileIdentity"]);
    if (record.schemaVersion !== 1) return bad(); uri(record.source); uri(record.root);
    for (const key of ["savedText", "draftText"]) if (typeof record[key] !== "string" || Buffer.byteLength(record[key] as string, "utf8") > 65536
        || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\uD800-\uDFFF]/u.test(record[key] as string)) return bad();
    if (typeof record.fileIdentity !== "string" || !record.fileIdentity || record.fileIdentity.length > 16384) return bad();
    return { schemaVersion: 1, source: record.source, root: record.root, savedText: record.savedText as string,
        draftText: record.draftText as string, fileIdentity: record.fileIdentity };
}
function keyBytes(key: Uint8Array): Buffer {
    if (!(key instanceof Uint8Array) || key.byteLength !== 32) return bad(); return Buffer.from(key);
}
function keyIdentifier(keyId?: string): void {
    if (keyId !== undefined && (typeof keyId !== "string" || !/^soterai\.lite\.secureEditor\.recovery\.[a-f0-9-]{36}$/i.test(keyId))) return bad();
}
function aad(source: string, root: string, keyId?: string): Buffer { return Buffer.from(JSON.stringify([1, source, root, keyId ?? null]), "utf8"); }
function base64(value: unknown, size?: number): Buffer {
    if (typeof value !== "string" || !value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return bad();
    const bytes = Buffer.from(value, "base64"); if (bytes.toString("base64") !== value || (size !== undefined && bytes.length !== size)) return bad(); return bytes;
}
/** Reject ambiguous JSON without retaining unsupported header data. */
function uniqueJson(text: string): unknown {
    const value: unknown = JSON.parse(text);
    const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
    const stack: Array<Set<string> | undefined> = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === "{") stack.push(new Set()); else if (token === "[") stack.push(undefined);
        else if (token === "}" || token === "]") stack.pop();
        else if (token.startsWith('"') && tokens[i + 1] === ":") {
            const keys = stack[stack.length - 1], name = JSON.parse(token) as string;
            if (!keys || keys.has(name)) return bad(); keys.add(name);
        }
    }
    return value;
}
export function encryptEditorRecovery(value: EditorRecovery, key: Uint8Array, options: { keyId?: string } = {}): string {
    const data = payload(value), secret = keyBytes(key); keyIdentifier(options.keyId);
    const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secret, nonce);
    try {
        cipher.setAAD(aad(data.source, data.root, options.keyId));
        const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
        const result = JSON.stringify({ schemaVersion: 1, source: data.source, root: data.root, nonce: nonce.toString("base64"),
            ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ...(options.keyId ? { keyId: options.keyId } : {}) });
        if (Buffer.byteLength(result, "utf8") > MAX_ENVELOPE) return bad(); return result;
    } finally { secret.fill(0); }
}
export function decryptEditorRecovery(text: string, key: Uint8Array, expected: Binding): EditorRecovery {
    if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_ENVELOPE) return bad();
    const record = object(uniqueJson(text), ["schemaVersion", "source", "root", "nonce", "ciphertext", "tag", "keyId"], ["schemaVersion", "source", "root", "nonce", "ciphertext", "tag"]);
    if (record.schemaVersion !== 1) return bad(); uri(record.source); uri(record.root); uri(expected.source); uri(expected.root);
    keyIdentifier(record.keyId as string | undefined); keyIdentifier(expected.keyId);
    if (record.source !== expected.source || record.root !== expected.root || record.keyId !== expected.keyId) return bad();
    const nonce = base64(record.nonce, 12), tag = base64(record.tag, 16), encrypted = base64(record.ciphertext), secret = keyBytes(key);
    try {
        const cipher = createDecipheriv("aes-256-gcm", secret, nonce); cipher.setAAD(aad(record.source, record.root, expected.keyId)); cipher.setAuthTag(tag);
        const bytes = Buffer.concat([cipher.update(encrypted), cipher.final()]);
        try {
            const result = payload(uniqueJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
            if (result.source !== expected.source || result.root !== expected.root) return bad(); return result;
        } finally { bytes.fill(0); }
    } finally { secret.fill(0); }
}
