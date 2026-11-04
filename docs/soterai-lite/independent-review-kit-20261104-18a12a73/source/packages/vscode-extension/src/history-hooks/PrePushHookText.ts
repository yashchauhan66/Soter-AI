import { TextDecoder, types } from "node:util";
import { parseHookClientPin } from "./PreCommitHookText";
export { parseHookClientPin } from "./PreCommitHookText";
export type { HookClientPin } from "./PreCommitHookText";

const marker = "# SoterAI Lite pre-push v1 ";
const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const quote = (text: string) => "'" + text.split("'").join("'\"'\"'") + "'";
const shellPath = (text: string) => quote(text.replace(/\\/g, "/"));
function original(raw: unknown): string | undefined {
    if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return undefined;
    const size: number = length.call(raw); if (size > 65536) return undefined;
    const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, raw);
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    return text.startsWith("#!/bin/sh\n") && !/[\x00-\x08\x0b-\x1f\x7f-\x9f\p{Cf}]/u.test(text)
        && !text.includes(marker) && !text.includes("# SoterAI Lite pre-commit v1 ") ? text : undefined;
}
export function supportedPrePushOriginal(raw: Buffer | undefined): boolean {
    try { return raw === undefined || original(raw) !== undefined; } catch { return false; }
}
/** The finite worker captures/validates stdin before shell replay. Its final
 * sentinel preserves every admitted LF through command substitution. Wrapper
 * variables never replace pre-existing caller variables; originals run once
 * in a subshell with the same arguments/environment and their own exit code. */
export function buildPrePushHookText(before: Buffer | undefined, rawPin: Buffer): Buffer | undefined {
    try {
        const pin = parseHookClientPin(rawPin); if (!pin || !supportedPrePushOriginal(before)) return undefined;
        const body = before === undefined ? "exit 0\n" : original(before)!.slice(10);
        const invoke = [shellPath("C:\\Program Files\\Git\\usr\\bin\\env.exe"), "-i", quote("SystemRoot=" + pin.systemRoot),
            quote("WINDIR=" + pin.systemRoot), quote("ELECTRON_RUN_AS_NODE=1"), shellPath(pin.runtime), shellPath(pin.worker),
            "--pre-push --pin", quote(rawPin.toString("base64url")), "--replay"].join(" ");
        const refusal = "  command printf '%s\\n' 'SoterAI: Push withheld. Open the owning editor or review pre-push status.' >&2\n  exit 1\n";
        const text = "#!/bin/sh\n" + marker + pin.generation + "\n"
            + 'if [ "${SOTERAI_PRE_PUSH_REPLAY+x}" = x ] || [ "${SOTERAI_PRE_PUSH_STATUS+x}" = x ]; then\n' + refusal + "fi\n"
            + 'SOTERAI_PRE_PUSH_REPLAY="$(' + invoke + ')"\nSOTERAI_PRE_PUSH_STATUS=$?\n'
            + 'if [ "$SOTERAI_PRE_PUSH_STATUS" -ne 0 ]; then\n' + refusal + "fi\n"
            + 'case "$SOTERAI_PRE_PUSH_REPLAY" in *.) ;; *)\n' + refusal + "esac\n"
            + 'SOTERAI_PRE_PUSH_REPLAY="${SOTERAI_PRE_PUSH_REPLAY%.}"\n'
            + 'command printf \'%s\' "$SOTERAI_PRE_PUSH_REPLAY" | (\n'
            + "unset SOTERAI_PRE_PUSH_REPLAY SOTERAI_PRE_PUSH_STATUS\n" + body + (body.endsWith("\n") ? "" : "\n") + ")\n";
        const bytes = Buffer.from(text); return bytes.length <= 98304 ? bytes : undefined;
    } catch { return undefined; }
}
