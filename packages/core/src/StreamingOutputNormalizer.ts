import { TextDecoder } from "node:util";
import type { OutputChannel } from "./StreamingOutputRedactor";
export const STREAM_OUTPUT_LIMITS = Object.freeze({ maxInputBytes: 131072, maxOutputBytes: 131072,
    maxChunks: 4096, maxSgrLength: 128, maxControlLength: 4096, maxExpansion: 32 });

type ChannelState = { decoder: TextDecoder; mode: "text" | "cr" | "esc" | "csi" | "osc" | "oscEsc"; controlLength: number };
const channelState = (): ChannelState => ({ decoder: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }), mode: "text", controlLength: 0 });

/** Internal completed normalization only; deliberately omitted from index.ts.
 * The two guarded consumers own the original normalized bytes privately.
 * No UI, command, progress callback or failed-analysis fallback accepts them. */
export class StreamingOutputNormalizer {
    #states: Record<OutputChannel, ChannelState> | undefined = { stdout: channelState(), stderr: channelState() };
    #pieces: Array<{ channel: OutputChannel; text: string }> = [];
    #rawBytes = 0; #normalizedBytes = 0; #chunks = 0; #closed = false;
    push(channel: OutputChannel, bytes: Uint8Array): void {
        try {
            if (this.#closed || channel !== "stdout" && channel !== "stderr" || !(bytes instanceof Uint8Array)) throw Error();
            if (++this.#chunks > STREAM_OUTPUT_LIMITS.maxChunks) throw Error();
            this.#rawBytes += bytes.byteLength;
            if (this.#rawBytes > STREAM_OUTPUT_LIMITS.maxInputBytes) throw Error();
            const state = this.#states![channel];
            this.#append(channel, this.#normalize(state, state.decoder.decode(Buffer.from(bytes), { stream: true })));
        } catch { this.dispose(); throw Error("Completed output normalization unavailable."); }
    }
    finish(): Readonly<{ stdout: string; stderr: string; arrival: string; inputBytes: number }> {
        try {
            if (this.#closed) throw Error();
            for (const channel of ["stdout", "stderr"] as const) {
                const state = this.#states![channel];
                this.#append(channel, this.#normalize(state, state.decoder.decode()));
                if (state.mode !== "text") throw Error();
            }
            const result = Object.freeze({
                stdout: this.#pieces.filter(piece => piece.channel === "stdout").map(piece => piece.text).join(""),
                stderr: this.#pieces.filter(piece => piece.channel === "stderr").map(piece => piece.text).join(""),
                arrival: this.#pieces.map(piece => piece.text).join(""), inputBytes: this.#rawBytes,
            });
            this.dispose(); return result;
        } catch { this.dispose(); throw Error("Completed output normalization unavailable."); }
    }
    dispose(): void {
        this.#closed = true; this.#pieces = []; this.#states = undefined;
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
