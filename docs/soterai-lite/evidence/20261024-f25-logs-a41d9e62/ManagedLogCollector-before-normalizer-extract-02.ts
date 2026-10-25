import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor, type OutputChannel, type OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { completedLogParts } from "./LogContent";

const buffered = Object.freeze({ status: "BUFFERED" as const }), denied = Object.freeze({ status: "WITHHELD" as const });
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "managed_log_output_withheld" });
const MASK = "[REDACTED_SECRET_OUTPUT]";
/** Owned finite output only. Both private F08 instances share exactly the same
 * bounds/normalization. The empty-registration instance supplies completed
 * semantic input privately; it is never a UI sink or a fallback release. */
export class ManagedLogCollector {
    #redactor?: StreamingOutputRedactor; #semantic?: StreamingOutputRedactor; #matcher?: RegisteredSecretMatcher;
    #enabled: () => boolean; #closed = false; #revoked = false; #short = false; #completed?: OutputResult;
    constructor(values: readonly string[], enabled: () => boolean) {
        this.#enabled = enabled;
        try {
            this.#matcher = new RegisteredSecretMatcher(values);
            if (this.#matcher.inspectRequest([]).status !== "CLEAN") throw Error();
            this.#short = values.some(value => value.length > 0 && Array.from(value).length < 8);
            this.#redactor = new StreamingOutputRedactor(values, { enabled: () => this.available(), completedLogFraming: "original-lines-v1" });
            this.#semantic = new StreamingOutputRedactor([], { enabled: () => this.available() });
        } catch { this.cancel(); }
    }
    available(): boolean {
        if (this.#closed || this.#revoked) return false;
        try { if (this.#enabled() === true && !this.#closed && !this.#revoked) return true; } catch { /* Static withholding only. */ }
        this.cancel(); return false;
    }
    push(channel: OutputChannel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }> {
        if (!this.available()) return denied;
        try {
            if (this.#redactor!.push(channel, bytes).status !== "BUFFERED" || this.#semantic!.push(channel, bytes).status !== "BUFFERED"
                || !this.available()) throw Error();
            return buffered;
        } catch { this.cancel(); return denied; }
    }
    finish(exitCode: number): OutputResult {
        if (!this.available()) return withheld();
        try {
            const privateNormalized = this.#semantic!.finish(exitCode);
            if (privateNormalized.status !== "COMPLETE" || !this.available()) throw Error();
            const parts = completedLogParts(privateNormalized.stdout, privateNormalized.stderr), decision = this.#matcher!.inspectRequest(parts);
            if (decision.status === "WITHHELD" || !this.available()) throw Error();
            let result = this.#redactor!.finish(exitCode);
            if (result.status !== "COMPLETE" || !this.available()) throw Error();
            if ((decision.status === "MATCHED" || this.#short) && (result.stdout || result.stderr)) {
                const stdout = result.stdout ? MASK : "", stderr = result.stderr ? MASK : "";
                if (!this.#matcher!.isSafeReplacement(stdout + stderr)) throw Error();
                result = Object.freeze({ status: "COMPLETE", stdout, stderr, redacted: true, exitCode });
            }
            if (!this.available()) throw Error();
            this.#closed = true; this.#redactor?.dispose(); this.#semantic?.dispose();
            this.#redactor = undefined; this.#semantic = undefined; this.#matcher = undefined; this.#short = false;
            this.#completed = result; return result;
        } catch { this.cancel(); return withheld(); }
    }
    canRelease(result: OutputResult): boolean {
        if (this.#revoked || this.#completed === undefined || result !== this.#completed) return false;
        try { if (this.#enabled() === true && !this.#revoked && result === this.#completed) return true; } catch { /* Sticky guard error. */ }
        this.cancel(); return false;
    }
    cancel(): void {
        this.#closed = true; this.#revoked = true; this.#completed = undefined;
        this.#redactor?.dispose(); this.#semantic?.dispose(); this.#redactor = undefined; this.#semantic = undefined;
        this.#matcher = undefined; this.#short = false; this.#enabled = () => false;
    }
    dispose(): void { this.cancel(); }
}
