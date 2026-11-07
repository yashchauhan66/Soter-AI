import { BoundedJsonError, decodeBoundedJson, JSON_LIMITS } from "./BoundedJson";
import { BoundedChatFramesError, decodeBoundedChatFrames } from "./BoundedChatFrames";
export class BoundedMultipartError extends Error {
    constructor(readonly code: "multipart_invalid" | "multipart_limit") { super("Multipart request could not be safely decoded"); }
}
const invalid = (): never => { throw new BoundedMultipartError("multipart_invalid"); };
const limit = (): never => { throw new BoundedMultipartError("multipart_limit"); };
export function parseMultipartMedia(media: string): string {
    const match = typeof media === "string" && /^[ \t]*multipart\/form-data[ \t]*;[ \t]*boundary[ \t]*=[ \t]*(?:"([A-Za-z0-9'()+_,./:=?-]{1,70})"|([A-Za-z0-9'+_.-]{1,70}))[ \t]*$/i.exec(media);
    if (!match) return invalid(); return match[1] ?? match[2];
}
/** Explicit finite chat form, entirely memory bounded; filenames never become paths. */
export function decodeBoundedMultipart(input: Uint8Array, boundary: string): { body: Readonly<Record<string, unknown>>; canonical: string; parts: number } {
    if (!(input instanceof Uint8Array) || input.byteLength > JSON_LIMITS.maxBytes) return limit();
    if (typeof boundary !== "string" || !/^[A-Za-z0-9'()+_,./:=?-]{1,70}$/.test(boundary)) return invalid();
    const wire = Buffer.from(input), opening = Buffer.from("--" + boundary + "\r\n"), delimiter = Buffer.from("\r\n--" + boundary), separator = Buffer.from("\r\n\r\n");
    if (!wire.subarray(0, opening.length).equals(opening)) return invalid();
    let cursor = opening.length, parts = 0, closed = false, request: Readonly<Record<string, unknown>> | undefined;
    const attachments: { role: string; content: string }[] = [];
    try {
        while (cursor < wire.length) {
            if (++parts > 17) return limit();
            const headerEnd = wire.indexOf(separator, cursor); if (headerEnd < 0) return invalid();
            if (headerEnd - cursor > 4096) return limit();
            const rawHeaders = wire.subarray(cursor, headerEnd); if (rawHeaders.some(c => c !== 13 && c !== 10 && (c < 32 || c > 126))) return invalid();
            const rows = rawHeaders.toString("ascii").split("\r\n"); if (rows.length > 8) return limit();
            const headers = new Map<string, string>();
            for (const row of rows) {
                const match = /^(Content-Disposition|Content-Type):[ \t]*([^\r\n]+)$/i.exec(row); if (!match) return invalid();
                const key = match[1].toLowerCase(); if (headers.has(key)) return invalid(); headers.set(key, match[2].trim());
            }
            const disposition = /^form-data[ \t]*;[ \t]*name="(request|attachment)"(?:[ \t]*;[ \t]*filename="([^"\\\r\n]*)")?$/i.exec(headers.get("content-disposition") ?? "");
            if (!disposition) return invalid();
            const name = disposition[1], filename = disposition[2];
            if (filename !== undefined && (!filename || filename === "." || filename === ".." || /[\/:\x00-\x1f]/.test(filename) || Buffer.byteLength(filename) > 128)) return invalid();
            const type = headers.get("content-type") ?? "";
            cursor = headerEnd + separator.length;
            const next = wire.indexOf(delimiter, cursor); if (next < 0) return invalid();
            const data = wire.subarray(cursor, next); if (data.length > 65536) return limit();
            if (name === "request") {
                if (request || filename !== undefined || !/^application\/json(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?$/i.test(type)) return invalid();
                const json = decodeBoundedJson(data);
                request = decodeBoundedChatFrames(Buffer.from(json.canonical + "\n"), "ndjson").body;
            } else if (name === "attachment") {
                if (attachments.length >= 16) return limit();
                if (!/^text\/plain(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?$/i.test(type)) return invalid();
                let content: string; try { content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data); } catch { return invalid(); }
                if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content)) return invalid();
                attachments.push({ role: "user", content });
            } else return invalid();
            cursor = next + delimiter.length;
            if (wire.subarray(cursor, cursor + 4).equals(Buffer.from("--\r\n"))) { cursor += 4; if (cursor !== wire.length) return invalid(); closed = true; break; }
            if (!wire.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) return invalid(); cursor += 2;
        }
        if (!closed || !request || cursor !== wire.length || !Array.isArray(request.messages)) return invalid();
        const messages = [...request.messages, ...attachments]; if (messages.length > 256) return limit();
        const aggregate: Record<string, unknown> = Object.create(null);
        for (const key of Object.keys(request)) if (key !== "messages") Object.defineProperty(aggregate, key, { value: request[key], enumerable: true });
        Object.defineProperty(aggregate, "messages", { value: messages, enumerable: true });
        return Object.freeze({ ...decodeBoundedJson(Buffer.from(JSON.stringify(aggregate))), parts });
    } catch (error) {
        if (error instanceof BoundedMultipartError) throw error;
        if (error instanceof BoundedChatFramesError && error.code === "framed_limit" || error instanceof BoundedJsonError && ["body_too_large", "json_complexity"].includes(error.code)) return limit();
        return invalid();
    }
}
