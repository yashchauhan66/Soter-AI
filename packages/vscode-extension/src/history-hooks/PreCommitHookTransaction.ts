import { createHash } from "node:crypto";
import { win32 } from "node:path";
import { types } from "node:util";
import { parseOwnerHookConfig } from "./OwnerHookProtocol";
import { buildPreCommitHookText, parseHookClientPin, supportedPreCommitOriginal } from "./PreCommitHookText";

export interface HookFileSnapshot { readonly bytes: Buffer | undefined; readonly mode: number | undefined; readonly identity: string }
export type HookRecoveryState = "PREPARED" | "APPLIED" | "ROLLED_BACK" | "INCOMPLETE";
export interface HookRecoveryReceipt {
    readonly version: 1; readonly generation: string; readonly root: string; readonly hooksRelative: string; readonly backup: string;
    readonly beforeDigest: string; readonly afterDigest: string; readonly originalPresent: boolean; readonly originalMode?: number; readonly mode: number;
}
export interface HookInstallPreview {
    readonly operation: "install"; readonly hookRelative: string; readonly existing: boolean; readonly originalBytes: number;
    readonly workerSha256: string; readonly runtimeSha256: string;
}
export interface HookPreparedLease { readonly pin: Buffer; withdraw(): void | Promise<void> }
export interface HookTransactionDependencies {
    current(): boolean; confirm(preview: HookInstallPreview): Promise<boolean>; read(): HookFileSnapshot | undefined;
    queryProjection(): Promise<string | undefined>; prepare(): Promise<HookPreparedLease | undefined>;
    readonly backups: { store(originalPath: string, content: string): Promise<string>; retrieve(handle: string): Promise<string | null> };
    save(receipt: HookRecoveryReceipt, state: HookRecoveryState): Promise<void>;
    write(expected: HookFileSnapshot, bytes: Buffer | undefined, mode: number | undefined): boolean;
}
interface Input {
    readonly root: string; readonly hooksRelative: string; readonly generation: string; readonly projectionFingerprint: string;
    readonly workerSha256: string; readonly runtimeSha256: string; readonly before: HookFileSnapshot;
}
type Status = "APPLIED" | "CANCELLED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE";
const result = (status: Status): Readonly<{ status: Status }> => Object.freeze({ status });
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const mode = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0o777;
const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
function bytes(value: unknown): value is Buffer { return types.isUint8Array(value) && Buffer.isBuffer(value) && length.call(value) <= 98304; }
function plain(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !types.isProxy(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
        && Object.values(Object.getOwnPropertyDescriptors(value)).every(field => "value" in field);
}
function snapshot(value: unknown): value is HookFileSnapshot {
    if (!plain(value) || !digest(value.identity)) return false;
    return value.bytes === undefined ? value.mode === undefined : bytes(value.bytes) && mode(value.mode);
}
function equal(value: HookFileSnapshot | undefined, expected: HookFileSnapshot, identity = false): boolean {
    return snapshot(value) && (!identity || value.identity === expected.identity) && value.mode === expected.mode
        && (expected.bytes === undefined ? value.bytes === undefined : value.bytes !== undefined && value.bytes.equals(expected.bytes));
}
export function hookSnapshotDigest(value: Pick<HookFileSnapshot, "bytes" | "mode">): string {
    return createHash("sha256").update("SoterAI/pre-commit/file/v1\0").update(JSON.stringify([value.bytes !== undefined, value.mode ?? null]))
        .update("\0").update(value.bytes ?? Buffer.alloc(0)).digest("hex");
}

/** Reviewed single mutation, with private encrypted recovery prepared first.
 * This coordinates capabilities; it does not grant filesystem or flag authority. */
export class PreCommitHookTransaction {
    #input: Input | undefined; #used = false;
    constructor(input: Input) {
        try {
            if (!plain(input) || !snapshot(input.before) || !digest(input.projectionFingerprint) || !digest(input.workerSha256) || !digest(input.runtimeSha256)
                || typeof input.generation !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.generation)
                || typeof input.hooksRelative !== "string" || !parseOwnerHookConfig(Buffer.from("local\0file:.git/config\0core.hookspath\n" + input.hooksRelative + "\0"), input.root)) return;
            this.#input = Object.freeze({ ...input, before: Object.freeze({ identity: input.before.identity, mode: input.before.mode,
                bytes: input.before.bytes === undefined ? undefined : Buffer.from(input.before.bytes) }) });
        } catch { /* malformed private input is inert */ }
    }
    async run(deps: HookTransactionDependencies): Promise<Readonly<{ status: Status }>> {
        if (this.#used) return result("UNAVAILABLE"); this.#used = true;
        const input = this.#input; if (!input || !supportedPreCommitOriginal(input.before.bytes)) return result("UNAVAILABLE");
        let prepared: HookPreparedLease | undefined, receipt: HookRecoveryReceipt | undefined, after: HookFileSnapshot | undefined;
        let durable = false, attempted = false, applied = false;
        const current = () => deps.current() === true;
        const original = () => { const value = deps.read(); return equal(value, input.before, true) ? value : undefined; };
        const projection = async () => (await deps.queryProjection()) === input.projectionFingerprint;
        const incomplete = async () => { if (receipt && durable) try { await deps.save(receipt, "INCOMPLETE"); } catch { /* retained PREPARED remains recovery evidence */ } };
        const recover = async (): Promise<Readonly<{ status: Status }>> => {
            let observed: HookFileSnapshot | undefined;
            try { observed = deps.read(); } catch { /* unknown state cannot be overwritten */ }
            if (equal(observed, input.before, true)) { await incomplete(); return result("UNAVAILABLE"); }
            if (receipt && after && observed && equal(observed, after)) {
                try {
                    if (deps.write(observed, input.before.bytes === undefined ? undefined : Buffer.from(input.before.bytes), input.before.mode) === true
                        && equal(deps.read(), input.before)) {
                        await deps.save(receipt, "ROLLED_BACK");
                        if (equal(deps.read(), input.before)) return result("ROLLED_BACK");
                    }
                } catch { /* failed or uncertain rollback is not successful recovery */ }
            }
            await incomplete(); return result("INCOMPLETE");
        };
        try {
            if (!current()) return result("UNAVAILABLE");
            const preview = Object.freeze({ operation: "install" as const, hookRelative: input.hooksRelative + "/pre-commit", existing: input.before.bytes !== undefined,
                originalBytes: input.before.bytes?.length ?? 0, workerSha256: input.workerSha256, runtimeSha256: input.runtimeSha256 });
            if ((await deps.confirm(preview)) !== true) return result("CANCELLED");
            if (!current() || !original() || !(await projection()) || !current() || !original()) return result("UNAVAILABLE");
            prepared = await deps.prepare(); if (!prepared) return result("UNAVAILABLE");
            const pin = parseHookClientPin(prepared.pin);
            if (!pin || pin.root !== input.root || pin.generation !== input.generation || pin.workerSha256 !== input.workerSha256
                || pin.runtimeSha256 !== input.runtimeSha256 || !current()) return result("UNAVAILABLE");
            const output = buildPreCommitHookText(input.before.bytes, prepared.pin); if (!output || output.length > 98304) return result("UNAVAILABLE");
            const outputMode = input.before.mode ?? (process.platform === "win32" ? 0o666 : 0o755);
            after = { bytes: output, mode: outputMode, identity: "0".repeat(64) };
            const payload = JSON.stringify({ version: 1, present: input.before.bytes !== undefined, mode: input.before.mode ?? null, bytes: input.before.bytes?.toString("base64") ?? null });
            const backup = await deps.backups.store(win32.join(input.root, ...preview.hookRelative.split("/")), payload);
            if (typeof backup !== "string" || !/^[a-f0-9]{32}$/.test(backup) || (await deps.backups.retrieve(backup)) !== payload || !current()) return result("UNAVAILABLE");
            receipt = Object.freeze({ version: 1, generation: input.generation, root: input.root, hooksRelative: input.hooksRelative, backup,
                beforeDigest: hookSnapshotDigest(input.before), afterDigest: hookSnapshotDigest(after), originalPresent: input.before.bytes !== undefined,
                ...(input.before.mode === undefined ? {} : { originalMode: input.before.mode }), mode: outputMode });
            await deps.save(receipt, "PREPARED"); durable = true;
            if (!(await projection())) { await incomplete(); return result("UNAVAILABLE"); }
            const expected = original(); if (!expected || !current()) { await incomplete(); return result("UNAVAILABLE"); }
            attempted = true;
            if (deps.write(expected, Buffer.from(output), outputMode) !== true || !equal(deps.read(), after) || !current() || !(await projection()) || !current()) return await recover();
            await deps.save(receipt, "APPLIED");
            // No await after this final synchronous recapture and authority check.
            if (!equal(deps.read(), after) || !current()) return await recover();
            applied = true; return result("APPLIED");
        } catch {
            if (attempted) return await recover();
            await incomplete(); return result("UNAVAILABLE");
        } finally {
            if (prepared && !applied) try { await prepared.withdraw(); } catch { /* private cleanup errors never escape */ }
        }
    }
}
