import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor, type OutputChannel, type OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { PowerShell51Output } from "./PowerShell51Worker";

const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "managed_output_withheld" });
const noChunk = Object.freeze({ status: "WITHHELD" as const });
/** Values stay in private matcher memory. A missing registry is never replaced
 * by partial/provider-only filtering; this constructor requires all values. */
export class ManagedOutputFilter implements PowerShell51Output {
    #redactor: StreamingOutputRedactor | undefined;
    #matcher: RegisteredSecretMatcher | undefined;
    #short: boolean;
    #closed = false;
    #completed = false;
    #enabled: () => boolean;
    constructor(values: readonly string[], enabled: () => boolean) {
        this.#enabled = enabled; this.#matcher = new RegisteredSecretMatcher(values);
        if (this.#matcher.inspectRequest([]).status !== "CLEAN") throw new Error("Managed output unavailable.");
        this.#short = values.some(value => value.length > 0 && Array.from(value).length < 8);
        this.#redactor = new StreamingOutputRedactor(values, { enabled: () => this.available() });
    }
    available(): boolean {
        if (this.#closed) return false;
        try { if (this.#enabled() === true && !this.#closed) return true; } catch { /* Sticky failure. */ }
        this.cancel(); return false;
    }
    /** The single-use sink stays closed after finish. Its private binding must
     * still be current at the session's later managed-result release boundary. */
    canRelease(): boolean {
        if (!this.#completed) return false;
        try { if (this.#enabled() === true) return true; } catch { /* Sticky withdrawal. */ }
        this.#completed = false; return false;
    }
    push(channel: OutputChannel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }> {
        if (!this.available()) return noChunk;
        try {
            const result = this.#redactor!.push(channel, bytes);
            if (result.status !== "BUFFERED" || !this.available()) { this.cancel(); return noChunk; }
            return result;
        } catch { this.cancel(); return noChunk; }
    }
    finish(code: number): OutputResult {
        if (!this.available()) return withheld();
        let result = withheld();
        try {
            result = this.#redactor!.finish(code);
            if (result.status === "COMPLETE" && this.#short && (result.stdout || result.stderr)) {
                const stdout = result.stdout ? "[REDACTED_SECRET_OUTPUT]" : "", stderr = result.stderr ? "[REDACTED_SECRET_OUTPUT]" : "";
                result = this.#matcher?.isSafeReplacement(stdout + stderr)
                    ? Object.freeze({ status: "COMPLETE", stdout, stderr, redacted: true, exitCode: result.exitCode }) : withheld();
            }
            if (!this.available()) result = withheld();
        } catch { result = withheld(); }
        this.cancel(); this.#completed = result.status === "COMPLETE"; return result;
    }
    cancel(): void {
        if (this.#closed) return; this.#closed = true; this.#redactor?.dispose(); this.#redactor = undefined; this.#matcher = undefined;
    }
    dispose(): void { this.cancel(); }
}
