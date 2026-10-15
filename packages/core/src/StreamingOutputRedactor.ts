import { TextDecoder } from "node:util";
import { RegisteredSecretMatcher } from "./RegisteredSecretMatcher";

export const STREAM_OUTPUT_LIMITS = Object.freeze({ maxInputBytes: 131072, maxOutputBytes: 131072,
    maxChunks: 4096, maxSgrLength: 128, maxControlLength: 4096, maxExpansion: 32 });
export type OutputChannel = "stdout" | "stderr";
export interface OutputResult {
    readonly status: "COMPLETE" | "WITHHELD";
    readonly stdout: string;
    readonly stderr: string;
    readonly redacted: boolean;
    readonly exitCode?: number;
    readonly reason?: string;
}
type ChannelState = { decoder: TextDecoder; mode: "text" | "cr" | "esc" | "csi" | "osc" | "oscEsc"; controlLength: number };
const channelState = (): ChannelState => ({ decoder: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }), mode: "text", controlLength: 0 });
const MASK = "[REDACTED_SECRET_OUTPUT]";

/** Incremental byte input with an atomic completed-result release. This does
 * not provide interactive passthrough or inspect another process's uploads. */
export class StreamingOutputRedactor {
    #matcher: RegisteredSecretMatcher | undefined;
    #states: Record<OutputChannel, ChannelState> | undefined = { stdout: channelState(), stderr: channelState() };
    #pieces: Array<{ channel: OutputChannel; text: string }> = [];
    #enabled: () => boolean;
    #closed = false;
    #reason = "stream_closed";
    #rawBytes = 0;
    #normalizedBytes = 0;
    #chunks = 0;
    constructor(values: readonly string[], options: { enabled?: () => boolean } = {}) {
        this.#matcher = new RegisteredSecretMatcher(values);
        this.#enabled = options?.enabled ?? (() => true);
    }

    push(channel: OutputChannel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }> {
        if (!this.#available()) return Object.freeze({ status: "WITHHELD" });
        try {
            if (channel !== "stdout" && channel !== "stderr" || !(bytes instanceof Uint8Array)) throw new Error();
            if (++this.#chunks > STREAM_OUTPUT_LIMITS.maxChunks) throw new Error();
            this.#rawBytes += bytes.byteLength;
            if (this.#rawBytes > STREAM_OUTPUT_LIMITS.maxInputBytes) throw new Error();
            const state = this.#states![channel];
            const decoded = state.decoder.decode(Buffer.from(bytes), { stream: true });
            this.#append(channel, this.#normalize(state, decoded));
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
            for (const channel of ["stdout", "stderr"] as const) {
                const state = this.#states![channel];
                this.#append(channel, this.#normalize(state, state.decoder.decode()));
                if (state.mode !== "text") throw new Error();
            }
            let stdout = this.#pieces.filter(piece => piece.channel === "stdout").map(piece => piece.text).join("");
            let stderr = this.#pieces.filter(piece => piece.channel === "stderr").map(piece => piece.text).join("");
            const arrival = this.#pieces.map(piece => piece.text).join("");
            let redacted = false;
            for (const view of new Set([stdout, stderr, arrival, stdout + stderr])) {
                const result = this.#matcher!.inspectRequest([view]);
                if (result.status === "WITHHELD") throw new Error();
                if (result.status === "MATCHED") redacted = true;
            }
            if (redacted) {
                stdout = stdout ? MASK : ""; stderr = stderr ? MASK : "";
                // An owner can register the marker itself. Never expose that
                // value as a purported replacement or recursively pick masks.
                if (!this.#matcher!.isSafeReplacement(stdout + stderr)) throw new Error();
            }
            const outputBytes = Buffer.byteLength(stdout + stderr, "utf8");
            if (outputBytes > STREAM_OUTPUT_LIMITS.maxOutputBytes || outputBytes > Math.max(64, this.#rawBytes * STREAM_OUTPUT_LIMITS.maxExpansion)) throw new Error();
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
        this.#closed = true; this.#reason = reason; this.#pieces = []; this.#states = undefined; this.#matcher = undefined;
        this.#rawBytes = 0; this.#normalizedBytes = 0; this.#chunks = 0;
    }
    #append(channel: OutputChannel, text: string): void {
        if (!text) return;
        this.#normalizedBytes += Buffer.byteLength(text, "utf8");
        if (this.#normalizedBytes > STREAM_OUTPUT_LIMITS.maxOutputBytes) throw new Error();
        this.#pieces.push({ channel, text });
    }
    #normalize(state: ChannelState, input: string): string {
        const output: string[] = [];
        for (const char of input) {
            if (state.mode === "cr") {
                if (char !== "\n") throw new Error();
                output.push("\n"); state.mode = "text"; continue;
            }
            if (state.mode !== "text") {
                state.controlLength += char.length;
                if (state.controlLength > (state.mode === "csi" ? STREAM_OUTPUT_LIMITS.maxSgrLength : STREAM_OUTPUT_LIMITS.maxControlLength)) throw new Error();
                if (state.mode === "esc") {
                    if (char === "[") state.mode = "csi";
                    else if (char === "]") state.mode = "osc";
                    else throw new Error();
                } else if (state.mode === "csi") {
                    if (char === "m") { state.mode = "text"; state.controlLength = 0; }
                    else if (!/^[0-9:;]$/.test(char)) throw new Error();
                } else if (state.mode === "oscEsc") {
                    if (char !== "\\") throw new Error();
                    state.mode = "text"; state.controlLength = 0;
                } else if (state.mode === "osc") {
                    if (char === "\x07" || char === "\u009c") {
                        state.mode = "text"; state.controlLength = 0;
                    } else if (char === "\x1b") state.mode = "oscEsc";
                    else if (/[\x00-\x1f\x7f-\x9f]/u.test(char) || /\p{Bidi_Control}/u.test(char)) throw new Error();
                }
                continue;
            }
            if (char === "\r") state.mode = "cr";
            else if (char === "\x1b") { state.mode = "esc"; state.controlLength = 1; }
            else if (char === "\u009b") { state.mode = "csi"; state.controlLength = 1; }
            else if (char === "\u009d") { state.mode = "osc"; state.controlLength = 1; }
            else if (char === "\t" || char === "\n") output.push(char);
            else if (/[\x00-\x1f\x7f-\x9f]/u.test(char) || /\p{Bidi_Control}/u.test(char)) throw new Error();
            else output.push(char);
        }
        return output.join("");
    }
}
