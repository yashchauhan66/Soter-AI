import { BoundedJsonError, decodeBoundedJson, JSON_LIMITS } from "./BoundedJson";

export class BoundedChatFramesError extends Error {
    constructor(readonly code: "framed_invalid" | "framed_limit" | "framed_conflict") { super("Framed request could not be safely decoded"); }
}
const invalid = (): never => { throw new BoundedChatFramesError("framed_invalid"); };
const limit = (): never => { throw new BoundedChatFramesError("framed_limit"); };
const sorted = (value: unknown): string => {
    if (Array.isArray(value)) return "[" + value.map(sorted).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + sorted((value as Record<string, unknown>)[key])).join(",") + "}";
    return JSON.stringify(value);
};
/** Finite chat batch transcoding, completed before admission. No policy or I/O authority. */
export function decodeBoundedChatFrames(input: Uint8Array, kind: "ndjson" | "sse"): { body: Readonly<Record<string, unknown>>; canonical: string; frames: number } {
    if (!(input instanceof Uint8Array) || input.byteLength > JSON_LIMITS.maxBytes) return limit();
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input); } catch { return invalid(); }
    const messages: unknown[] = [], options: Record<string, unknown> = Object.create(null), signatures = new Map<string, string>();
    let frames = 0;
    const json = (bytes: Uint8Array) => {
        try { return decodeBoundedJson(bytes); }
        catch (error) { if (error instanceof BoundedJsonError && ["body_too_large", "json_complexity"].includes(error.code)) return limit(); return invalid(); }
    };
    const add = (data: string) => {
        if (Buffer.byteLength(data, "utf8") > 65536 || ++frames > 128) return limit();
        const body = json(Buffer.from(data)).body;
        if (!Array.isArray(body.messages) || body.messages.length === 0) return invalid();
        for (const message of body.messages) {
            if (!message || typeof message !== "object" || Array.isArray(message)) return invalid();
            const value = message as Record<string, unknown>;
            if (typeof value.role !== "string" || value.role.length < 1 || value.role.length > 32) return invalid();
            if (Object.hasOwn(value, "content")) { if (value.content !== null && typeof value.content !== "string" && !Array.isArray(value.content)) return invalid(); }
            else if (!Array.isArray(value.tool_calls) && (!value.function_call || typeof value.function_call !== "object" || Array.isArray(value.function_call))) return invalid();
            if (messages.length >= 256) return limit(); messages.push(message);
        }
        for (const key of Object.keys(body)) {
            if (key === "messages") continue;
            const signature = sorted(body[key]);
            if (signatures.has(key)) { if (signatures.get(key) !== signature) throw new BoundedChatFramesError("framed_conflict"); }
            else { signatures.set(key, signature); Object.defineProperty(options, key, { value: body[key], enumerable: true }); }
        }
    };
    if (kind === "ndjson") {
        if (!text.endsWith("\n")) return invalid();
        const lines = text.split("\n"); if (lines.length - 1 > 1024) return limit();
        for (let row of lines.slice(0, -1)) {
            if (row.endsWith("\r")) row = row.slice(0, -1);
            if (Buffer.byteLength(row, "utf8") > 65536) return limit();
            if (row.includes("\r")) return invalid();
            row = row.replace(/^[ \t]+|[ \t]+$/g, ""); if (row) add(row);
        }
    } else if (kind === "sse") {
        if (text.startsWith("\ufeff")) text = text.slice(1);
        text = text.replace(/\r\n|\r/g, "\n");
        if (!text.endsWith("\n\n")) return invalid();
        const lines = text.split("\n"); if (lines.length - 1 > 1024) return limit();
        let data: string[] = [], dataBytes = 0, terminal = false, event = "message";
        for (const row of lines.slice(0, -1)) {
            if (row === "") {
                if (data.length) {
                    const joined = data.join("\n"); if (terminal) return invalid();
                    if (joined === "[DONE]") { if (!frames) return invalid(); terminal = true; } else add(joined);
                }
                data = []; dataBytes = 0; event = "message"; continue;
            }
            if (row.startsWith(":")) continue;
            const colon = row.indexOf(":"), field = colon < 0 ? row : row.slice(0, colon);
            let value = colon < 0 ? "" : row.slice(colon + 1); if (value.startsWith(" ")) value = value.slice(1);
            if (field === "data") { dataBytes += Buffer.byteLength(value) + (data.length ? 1 : 0); if (dataBytes > 65536) return limit(); data.push(value); }
            else if (field === "event") { event = value; if (!["message", "soterai.request"].includes(event)) return invalid(); }
            else if (field === "id") { if (value.includes("\0") || Buffer.byteLength(value) > 1024) return invalid(); }
            else if (field === "retry") { if (!/^\d{1,5}$/.test(value) || Number(value) > 60000) return invalid(); }
            else return invalid();
        }
    } else return invalid();
    if (!frames) return invalid();
    Object.defineProperty(options, "messages", { value: messages, enumerable: true });
    const final = json(Buffer.from(JSON.stringify(options)));
    return Object.freeze({ ...final, frames });
}
