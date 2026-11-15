import { createPublicKey } from "node:crypto";
import * as path from "node:path";
import { TextDecoder, types } from "node:util";

export interface HookClientPin {
    readonly version: 1; readonly root: string; readonly generation: string; readonly publicKey: string;
    readonly worker: string; readonly workerSha256: string; readonly runtime: string; readonly runtimeSha256: string;
    readonly descriptor: string; readonly systemRoot: string;
}
const fields = ["version", "root", "generation", "publicKey", "worker", "workerSha256", "runtime", "runtimeSha256", "descriptor", "systemRoot"].sort().join(",");
const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const marker = "# SoterAI Lite pre-commit v1 ";
function literal(value: unknown): value is string {
    return typeof value === "string" && value.length <= 2048 && /^[A-Za-z]:\\/.test(value) && path.win32.normalize(value) === value
        && !/[\p{Cc}\p{Cf}<>"|?*]/u.test(value) && value.slice(3).split("\\").every(part => !!part && !/[. ]$|:|~[0-9]+(?:\.|$)/i.test(part)
            && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$|clock\$)(?:\.|$)/i.test(part));
}
function text(raw: unknown, cap: number): string | undefined {
    if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw) || length.call(raw) > cap) return undefined;
    const copy = new Uint8Array(length.call(raw)); Uint8Array.prototype.set.call(copy, raw);
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
}
/** Public reviewed pins only; no filesystem, listener, key-store or execution. */
export function parseHookClientPin(raw: Buffer): Readonly<HookClientPin> | undefined {
    try {
        const source = text(raw, 12288); if (!source) return undefined;
        const value = JSON.parse(source);
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== fields
            || JSON.stringify(value) !== source || value.version !== 1
            || ![value.root, value.worker, value.runtime, value.descriptor, value.systemRoot].every(literal)
            || typeof value.generation !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.generation)
            || !digest(value.workerSha256) || !digest(value.runtimeSha256) || typeof value.publicKey !== "string"
            || value.publicKey.length > 128 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.publicKey)) return undefined;
        const bytes = Buffer.from(value.publicKey, "base64"); if (bytes.toString("base64") !== value.publicKey) return undefined;
        const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
        if (key.asymmetricKeyType !== "ed25519" || !(key.export({ format: "der", type: "spki" }) as Buffer).equals(bytes)) return undefined;
        return Object.freeze(value) as Readonly<HookClientPin>;
    } catch { return undefined; }
}
const quote = (value: string): string => "'" + value.split("'").join("'\"'\"'") + "'";
const shellPath = (value: string): string => quote(value.replace(/\\/g, "/"));

/** Shared preflight for owner review and the builder. No key or service needed. */
export function supportedPreCommitOriginal(before: Buffer | undefined): boolean {
    if (before === undefined) return true;
    try {
        const original = text(before, 65536);
        return !!original?.startsWith("#!/bin/sh\n") && !/[\x00-\x08\x0b-\x1f\x7f-\x9f\p{Cf}]/u.test(original) && !original.includes(marker);
    } catch { return false; }
}

/** Insert before an ordinary supported hook body; its environment, arguments,
 * bytes and exit status remain its own. env -i scrubs the client before startup,
 * not the hook shell which already inherited its parent environment. */
export function buildPreCommitHookText(before: Buffer | undefined, rawPin: Buffer): Buffer | undefined {
    try {
        const pin = parseHookClientPin(rawPin); if (!pin || !supportedPreCommitOriginal(before)) return undefined;
        let body = "exit 0\n";
        if (before !== undefined) {
            const original = text(before, 65536);
            body = original!.slice(10);
        }
        const invocation = [shellPath("C:\\Program Files\\Git\\usr\\bin\\env.exe"), "-i", quote("SystemRoot=" + pin.systemRoot),
            quote("WINDIR=" + pin.systemRoot), quote("ELECTRON_RUN_AS_NODE=1"), shellPath(pin.runtime), shellPath(pin.worker),
            "--pin", quote(rawPin.toString("base64url")), "--index", '"${GIT_INDEX_FILE-.git/index}"'].join(" ");
        return Buffer.from("#!/bin/sh\n" + marker + pin.generation + "\nif " + invocation + "; then\n  :\nelse\n"
            + "  printf '%s\\n' 'SoterAI: Commit withheld. Open the owning editor or review pre-commit status.' >&2\n  exit 1\nfi\n"
            + "# End SoterAI Lite pre-commit v1\n" + body, "utf8");
    } catch { return undefined; }
}
