import { parsePrePushTranscript } from "./PrePushProtocol";
import { createPublicKey, KeyObject, sign, verify } from "node:crypto";
import { TextDecoder, types } from "node:util";
import * as path from "node:path";

export interface HookDescriptor { version: 1; root: string; generation: string; session: string; endpoint: string;
    workerSha256: string; runtimeSha256: string }
export interface HookDecision { version: 1; root: string; generation: string; session: string; nonce: string;
    status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "BUSY"; transcriptSha256: string; rootIdentity: string }
export interface HookRequest { version: 1; generation: string; session: string; nonce: string; transcript: string }
const descriptorDomain = "SoterAI-PrePush-Descriptor-v1", decisionDomain = "SoterAI-PrePush-Decision-v1";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const own = Reflect.ownKeys(value); if (own.some(key => typeof key !== "string") || own.length !== keys.length) return false;
    if ((own as string[]).sort().join(",") !== [...keys].sort().join(",")) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(field => !field.get && !field.set && field.enumerable);
}
function root(value: unknown): value is string {
    return typeof value === "string" && value.length <= 2048 && /^[a-z]:\\/i.test(value)
        && !/[\x00-\x1f\x7f-\x9f]/.test(value) && path.win32.normalize(value) === value;
}
function endpoint(value: unknown): value is string {
    if (typeof value !== "string" || value.length > 128) return false;
    try { const url = new URL(value); return url.href === value && url.protocol === "http:" && url.hostname === "127.0.0.1"
        && Number(url.port) > 0 && Number(url.port) <= 65535 && url.pathname === "/pre-push"
        && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
}
function descriptor(value: unknown): value is HookDescriptor {
    return exact(value, ["version", "root", "generation", "session", "endpoint", "workerSha256", "runtimeSha256"])
        && value.version === 1 && root(value.root) && uuid(value.generation) && uuid(value.session)
        && endpoint(value.endpoint) && digest(value.workerSha256) && digest(value.runtimeSha256);
}
function decision(value: unknown): value is HookDecision {
    return exact(value, ["version", "root", "generation", "session", "nonce", "status", "transcriptSha256", "rootIdentity"])
        && value.version === 1 && root(value.root) && uuid(value.generation) && uuid(value.session) && uuid(value.nonce)
        && ["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"].includes(value.status as string) && digest(value.transcriptSha256) && digest(value.rootIdentity);
}
function frame(raw: unknown, cap: number): unknown {
    if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return undefined;
    const size: number = length.call(raw); if (size > cap) return undefined;
    const copy = new Uint8Array(size); Uint8Array.prototype.set.call(copy, raw);
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy), value: unknown = JSON.parse(text);
    return JSON.stringify(value) === text ? value : undefined;
}
function publicKey(value: unknown): KeyObject | undefined {
    if (typeof value !== "string" || value.length > 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
    const bytes = Buffer.from(value, "base64"); if (bytes.toString("base64") !== value) return undefined;
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
    return key.asymmetricKeyType === "ed25519" && (key.export({ format: "der", type: "spki" }) as Buffer).equals(bytes) ? key : undefined;
}
const message = (domain: string, payload: unknown): Buffer => Buffer.from(domain + "\0" + JSON.stringify(payload), "utf8");
function signed(payload: unknown, key: KeyObject, domain: string, valid: (value: unknown) => boolean): Buffer | undefined {
    try {
        if (!valid(payload) || !(key instanceof KeyObject) || key.type !== "private" || key.asymmetricKeyType !== "ed25519") return undefined;
        const signature = sign(null, message(domain, payload), key).toString("base64url");
        return Buffer.from(JSON.stringify({ domain, payload, signature }), "utf8");
    } catch { return undefined; }
}
function verified(raw: unknown, pin: string, domain: string, valid: (value: unknown) => boolean): unknown {
    const envelope = frame(raw, 8192);
    if (!exact(envelope, ["domain", "payload", "signature"]) || envelope.domain !== domain || !valid(envelope.payload)
        || typeof envelope.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) return undefined;
    const signature = Buffer.from(envelope.signature, "base64url"), key = publicKey(pin);
    if (!key || signature.length !== 64 || signature.toString("base64url") !== envelope.signature
        || !verify(null, message(domain, envelope.payload), key, signature)) return undefined;
    return Object.freeze(envelope.payload);
}
/** Signed metadata is not a push capability until live owner and exact transcript/root
 * authority checks succeed. These functions perform no filesystem/network I/O. */
export function signHookDescriptor(value: unknown, key: KeyObject): Buffer | undefined { return signed(value, key, descriptorDomain, descriptor); }
export function signHookDecision(value: unknown, key: KeyObject): Buffer | undefined { return signed(value, key, decisionDomain, decision); }
export function verifyHookDescriptor(raw: unknown, pin: string, expected: unknown): Readonly<HookDescriptor> | undefined {
    try {
        if (!exact(expected, ["root", "generation", "workerSha256", "runtimeSha256"]) || !root(expected.root) || !uuid(expected.generation)
            || !digest(expected.workerSha256) || !digest(expected.runtimeSha256)) return undefined;
        const value = verified(raw, pin, descriptorDomain, descriptor) as HookDescriptor | undefined;
        return value && Object.keys(expected).every(key => value[key as keyof HookDescriptor] === expected[key]) ? value : undefined;
    } catch { return undefined; }
}
export function verifyHookDecision(raw: unknown, pin: string, expected: unknown): Readonly<HookDecision> | undefined {
    try {
        if (!exact(expected, ["root", "generation", "session", "nonce"]) || !root(expected.root)
            || !uuid(expected.generation) || !uuid(expected.session) || !uuid(expected.nonce)) return undefined;
        const value = verified(raw, pin, decisionDomain, decision) as HookDecision | undefined;
        return value && Object.keys(expected).every(key => value[key as keyof HookDecision] === expected[key]) ? value : undefined;
    } catch { return undefined; }
}
function validTranscript(value: unknown): boolean {
    if (typeof value !== "string" || value.length > 43691 || !/^[A-Za-z0-9_-]*$/.test(value)) return false;
    const bytes = Buffer.from(value, "base64url");
    return bytes.toString("base64url") === value && parsePrePushTranscript(bytes) !== undefined;
}
export function parseHookRequest(raw: unknown, expected: unknown): Readonly<HookRequest> | undefined {
    try {
        if (!exact(expected, ["generation", "session"]) || !uuid(expected.generation) || !uuid(expected.session)) return undefined;
        const value = frame(raw, 49152);
        if (!exact(value, ["version", "generation", "session", "nonce", "transcript"]) || value.version !== 1
            || value.generation !== expected.generation || value.session !== expected.session || !uuid(value.nonce)
            || !validTranscript(value.transcript)) return undefined;
        return Object.freeze(value) as unknown as Readonly<HookRequest>;
    } catch { return undefined; }
}
