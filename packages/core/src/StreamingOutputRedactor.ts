import { StreamingOutputNormalizer, STREAM_OUTPUT_LIMITS } from "./StreamingOutputNormalizer";
export { STREAM_OUTPUT_LIMITS } from "./StreamingOutputNormalizer";
import { RegisteredSecretMatcher } from "./RegisteredSecretMatcher";

export type OutputChannel = "stdout" | "stderr";
export interface OutputResult {
    readonly status: "COMPLETE" | "WITHHELD";
    readonly stdout: string;
    readonly stderr: string;
    readonly redacted: boolean;
    readonly exitCode?: number;
    readonly reason?: string;
}
const MASK = "[REDACTED_SECRET_OUTPUT]";

/** Incremental byte input with an atomic completed-result release. This does
 * not provide interactive passthrough or inspect another process's uploads. */
export class StreamingOutputRedactor {
    #matcher: RegisteredSecretMatcher | undefined;
    #normalizer: StreamingOutputNormalizer | undefined = new StreamingOutputNormalizer();
    #enabled: () => boolean;
    #closed = false;
    #reason = "stream_closed";
    #completedLogFraming = false;
    constructor(values: readonly string[], options: { enabled?: () => boolean; completedLogFraming?: "original-lines-v1" } = {}) {
        this.#matcher = new RegisteredSecretMatcher(values);
        this.#enabled = options?.enabled ?? (() => true);
        if (options?.completedLogFraming !== undefined) {
            if (options.completedLogFraming !== "original-lines-v1") this.#fail("stream_log_framing_unavailable");
            else this.#completedLogFraming = true;
        }
    }

    push(channel: OutputChannel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }> {
        if (!this.#available()) return Object.freeze({ status: "WITHHELD" });
        try {
            this.#normalizer!.push(channel, bytes);
            return Object.freeze({ status: "BUFFERED" });
        } catch {
            this.#fail("stream_input_unavailable");
            return Object.freeze({ status: "WITHHELD" });
        }
    }

    finish(exitCode: number): OutputResult {
        if (!this.#available()) return this.#withheld();
        try {
            if (!Number.isInteger(exitCode) || exitCode < -2147483648 || exitCode > 2147483647) throw new Error();
            const normalized = this.#normalizer!.finish();
            let { stdout, stderr } = normalized;
            const arrival = normalized.arrival;
            let redacted = false;
            for (const view of new Set([stdout, stderr, arrival, stdout + stderr])) {
                const result = this.#matcher!.inspectRequest([view]);
                if (result.status === "WITHHELD") throw new Error();
                if (result.status === "MATCHED") redacted = true;
                // Finite owned-log mode only. Match original completed line
                // bodies with the existing one-layer matcher in every view,
                // including normalized interleaved arrival order. No decoded
                // view is fed back into a decoder or released to a callback.
                if (this.#completedLogFraming && view.includes("\\") && view.includes("\n")) {
                    let candidates = 0;
                    for (const line of view.split("\n")) {
                        if (!line.includes("\\")) continue;
                        if (++candidates > 32) throw new Error();
                        const framed = this.#matcher!.inspectRequest([line]);
                        if (framed.status === "WITHHELD") throw new Error();
                        if (framed.status === "MATCHED") redacted = true;
                    }
                }
            }
            if (redacted) {
                stdout = stdout ? MASK : ""; stderr = stderr ? MASK : "";
                // An owner can register the marker itself. Never expose that
                // value as a purported replacement or recursively pick masks.
                if (!this.#matcher!.isSafeReplacement(stdout + stderr)) throw new Error();
            }
            const outputBytes = Buffer.byteLength(stdout + stderr, "utf8");
            if (outputBytes > STREAM_OUTPUT_LIMITS.maxOutputBytes || outputBytes > Math.max(64, normalized.inputBytes * STREAM_OUTPUT_LIMITS.maxExpansion)) throw new Error();
            if (!this.#available()) return this.#withheld();
            this.#fail("stream_closed");
            return Object.freeze({ status: "COMPLETE", stdout, stderr, redacted, exitCode });
        } catch { this.#fail("stream_final_unavailable"); return this.#withheld(); }
    }

    cancel(): void { this.#fail("stream_cancelled"); }
    dispose(): void { this.#fail("stream_disposed"); }

    #withheld(): OutputResult { return Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: this.#reason }); }
    #available(): boolean {
        if (this.#closed) return false;
        let enabled = false;
        try { enabled = this.#enabled() === true; } catch { /* Callback errors never enter reports. */ }
        if (this.#closed) return false;
        if (enabled) return true;
        this.#fail("stream_protection_unavailable"); return false;
    }
    #fail(reason: string): void {
        this.#closed = true; this.#reason = reason; this.#normalizer?.dispose(); this.#normalizer = undefined; this.#matcher = undefined;
    }

}
