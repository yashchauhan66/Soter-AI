import { types } from "node:util";
import { parseOwnerHookConfig } from "./OwnerHookProtocol";
import { supportedPrePushOriginal } from "./PrePushHookText";
import { hookSnapshotDigest, type HookFileSnapshot, type HookRecoveryReceipt } from "./PrePushHookTransaction";

type Status = "RESTORED" | "CANCELLED" | "UNAVAILABLE" | "INCOMPLETE";
export interface HookRestoreDependencies {
    current(): boolean;
    confirm(preview: Readonly<{ operation: "restore"; hookRelative: string; originalPresent: boolean }>): Promise<boolean>;
    read(): HookFileSnapshot | undefined;
    readonly backups: { retrieve(handle: string): Promise<string | null> };
    withdraw(): void | Promise<void>;
    save(receipt: HookRecoveryReceipt, state: "ROLLED_BACK" | "INCOMPLETE"): Promise<void>;
    write(expected: HookFileSnapshot, bytes: Buffer | undefined, mode: number | undefined): boolean;
}
const result = (status: Status): Readonly<{ status: Status }> => Object.freeze({ status });
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const mode = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0o777;
function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every(key => typeof key === "string" && fields.includes(key))
        && Object.values(descriptors).every(field => "value" in field && field.enumerable);
}
/** One canonical private recovery schema, also used by persisted ownership. */
export function parseHookRecoveryReceipt(value: unknown): Readonly<HookRecoveryReceipt> | undefined {
    try {
        const fields = ["version", "generation", "root", "hooksRelative", "backup", "beforeDigest", "afterDigest", "originalPresent", "mode"];
        if (!exact(value, [...fields, "originalMode"]) && !exact(value, fields)) return undefined;
        if (value.version !== 1 || typeof value.generation !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.generation)
            || typeof value.root !== "string" || typeof value.hooksRelative !== "string" || typeof value.backup !== "string" || !/^[a-f0-9]{32}$/.test(value.backup)
            || !digest(value.beforeDigest) || !digest(value.afterDigest) || value.beforeDigest === value.afterDigest || !mode(value.mode)
            || typeof value.originalPresent !== "boolean" || (value.originalPresent ? !mode(value.originalMode) || value.originalMode !== value.mode : Object.hasOwn(value, "originalMode"))
            || !parseOwnerHookConfig(Buffer.from("local\0file:.git/config\0core.hookspath\n" + value.hooksRelative + "\0"), value.root)) return undefined;
        return Object.freeze({ ...value }) as unknown as Readonly<HookRecoveryReceipt>;
    } catch { return undefined; }
}
function payload(raw: unknown, receipt: HookRecoveryReceipt): Pick<HookFileSnapshot, "bytes" | "mode"> | undefined {
    try {
        if (typeof raw !== "string" || raw.length > 90000) return undefined;
        const value: unknown = JSON.parse(raw);
        if (!exact(value, ["version", "present", "mode", "bytes"]) || value.version !== 1 || value.present !== receipt.originalPresent
            || JSON.stringify({ version: value.version, present: value.present, mode: value.mode, bytes: value.bytes }) !== raw) return undefined;
        let bytes: Buffer | undefined, originalMode: number | undefined;
        if (value.present) {
            if (value.mode !== receipt.originalMode || typeof value.bytes !== "string" || value.bytes.length > 87384) return undefined;
            bytes = Buffer.from(value.bytes, "base64");
            if (bytes.toString("base64") !== value.bytes || bytes.length > 65536 || !supportedPrePushOriginal(bytes)) return undefined;
            originalMode = receipt.originalMode;
        } else if (value.mode !== null || value.bytes !== null) return undefined;
        const before = { bytes, mode: originalMode };
        return hookSnapshotDigest(before) === receipt.beforeDigest ? before : undefined;
    } catch { return undefined; }
}
function owned(value: HookFileSnapshot | undefined, receipt: HookRecoveryReceipt): value is HookFileSnapshot {
    try { return !!value && digest(value.identity) && types.isUint8Array(value.bytes) && Buffer.isBuffer(value.bytes)
        && value.bytes.byteLength <= 98304 && value.mode === receipt.mode && hookSnapshotDigest(value) === receipt.afterDigest; }
    catch { return false; }
}
function original(value: HookFileSnapshot | undefined, before: Pick<HookFileSnapshot, "bytes" | "mode">): boolean {
    try { return !!value && digest(value.identity) && value.mode === before.mode
        && (before.bytes === undefined ? value.bytes === undefined : Buffer.isBuffer(value.bytes) && value.bytes.equals(before.bytes)); }
    catch { return false; }
}

/** Explicit owner-reviewed restoration remains available with opt-in disabled.
 * Its caller supplies a distinct restore guard. No key creation or retry path. */
export class PrePushHookRestore {
    readonly #receipt: Readonly<HookRecoveryReceipt> | undefined; #used = false;
    constructor(receipt: HookRecoveryReceipt) { this.#receipt = parseHookRecoveryReceipt(receipt); }
    async run(deps: HookRestoreDependencies): Promise<Readonly<{ status: Status }>> {
        if (this.#used) return result("UNAVAILABLE"); this.#used = true;
        const receipt = this.#receipt; if (!receipt) return result("UNAVAILABLE");
        let phase: "early" | "read" | "review" | "retrieve" | "withdraw" = "early";
        const incomplete = async () => { try { await deps.save(receipt, "INCOMPLETE"); } catch { /* retain prior durable recovery */ } return result("INCOMPLETE"); };
        try {
            if (deps.current() !== true) return result("UNAVAILABLE");
            phase = "read";
            const initial = deps.read(); if (!owned(initial, receipt)) return await incomplete();
            const identity = initial.identity;
            const sameOwned = (value: HookFileSnapshot | undefined): value is HookFileSnapshot => owned(value, receipt) && value.identity === identity;
            phase = "review";
            if ((await deps.confirm(Object.freeze({ operation: "restore", hookRelative: receipt.hooksRelative + "/pre-push", originalPresent: receipt.originalPresent }))) !== true) return result("CANCELLED");
            if (deps.current() !== true) return result("UNAVAILABLE");
            phase = "read"; if (!sameOwned(deps.read())) return await incomplete();
            phase = "retrieve";
            const raw = await deps.backups.retrieve(receipt.backup);
            if (deps.current() !== true) return result("UNAVAILABLE");
            const before = payload(raw, receipt); if (!before || !sameOwned(deps.read())) return await incomplete();
            phase = "withdraw";
            await deps.withdraw();
            const expected = deps.read();
            if (!sameOwned(expected) || deps.current() !== true) return await incomplete();
            if (deps.write(expected, before.bytes === undefined ? undefined : Buffer.from(before.bytes), before.mode) !== true
                || !original(deps.read(), before) || deps.current() !== true) return await incomplete();
            await deps.save(receipt, "ROLLED_BACK");
            // No await between final synchronous read/current and success.
            if (!original(deps.read(), before) || deps.current() !== true) return await incomplete();
            return result("RESTORED");
        } catch {
            return phase === "early" || phase === "review" ? result("UNAVAILABLE") : await incomplete();
        }
    }
}
