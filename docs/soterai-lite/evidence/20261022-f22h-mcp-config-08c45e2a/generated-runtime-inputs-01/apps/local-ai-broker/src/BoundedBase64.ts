import { BoundedJsonError, decodeBoundedJson } from "./BoundedJson";
import { BoundedChatFramesError, decodeBoundedChatFrames } from "./BoundedChatFrames";
type Body = Readonly<Record<string, unknown>>;
export class BoundedBase64Error extends Error {
    constructor(readonly code: "base64_invalid" | "base64_limit" | "base64_unsupported" | "base64_unavailable" | "base64_nested") { super("Base64 request could not be safely decoded"); }
}
const fail = (code: BoundedBase64Error["code"] = "base64_invalid"): never => { throw new BoundedBase64Error(code); };
const uriStart = (value: unknown): value is string => typeof value === "string" && /^[ \t\r\n]*data:/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function nested(value: unknown): boolean {
    if (uriStart(value)) return true;
    if (Array.isArray(value)) return value.some(nested);
    if (object(value)) return value.type === "soterai_base64" || value.encoding !== undefined && value.mediaType !== undefined && value.data !== undefined || Object.values(value).some(nested);
    return false;
}
function guarded<T>(operation: () => T): T {
    try { return operation(); } catch (error) {
        if (error instanceof BoundedBase64Error) throw error;
        if (error instanceof BoundedJsonError && ["body_too_large", "json_complexity"].includes(error.code) || error instanceof BoundedChatFramesError && error.code === "framed_limit") return fail("base64_limit");
        return fail();
    }
}
function decoder(enabled: boolean, allow = true) {
    let blobs = 0, bytes = 0;
    const decode = (data: unknown, encoding: unknown, media: unknown): string => {
        if (!enabled) return fail("base64_unavailable"); if (!allow) return fail("base64_nested");
        if (media !== "text/plain" && media !== "application/json") return fail("base64_unsupported");
        if (encoding !== "base64" && encoding !== "base64url") return fail();
        if (typeof data !== "string" || !data.length) return fail();
        if (data.length > 43692 || ++blobs > 16) return fail("base64_limit");
        if (!(encoding === "base64" ? /^[A-Za-z0-9+/]*={0,2}$/ : /^[A-Za-z0-9_-]+$/).test(data)) return fail();
        const decoded = Buffer.from(data, encoding);
        if (decoded.toString(encoding) !== data) return fail();
        bytes += decoded.length; if (decoded.length > 32768 || bytes > 131072) return fail("base64_limit");
        let text: string; try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(decoded); } catch { return fail(); }
        if (media === "application/json") { const json = decodeBoundedJson(decoded); if (nested(json.body)) return fail("base64_nested"); return json.canonical; }
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return fail();
        if (uriStart(text)) return fail("base64_nested"); return text;
    };
    const uri = (text: string): string => {
        if (!enabled) return fail("base64_unavailable"); if (!allow) return fail("base64_nested");
        const match = /^data:(text\/plain|application\/json)(?:;charset=utf-8)?;base64,([A-Za-z0-9+/]*={0,2})$/i.exec(text);
        if (!match) { if (/^data:(?!text\/plain(?:;|$)|application\/json(?:;|$))/i.test(text)) return fail("base64_unsupported"); return fail(); }
        return decode(match[2], "base64", match[1].toLowerCase());
    };
    return { decode, uri, get blobs() { return blobs; } };
}
/** Normalize only declared blob representations in an already bounded JSON chat. */
export function decodeChatBase64Blobs(body: Body, enabled = true, allow = true): { body: Body; canonical: string; blobs: number } {
    return guarded(() => {
        const codec = decoder(enabled, allow);
        const content = (value: unknown): unknown => {
            if (uriStart(value)) return codec.uri(value);
            if (!Array.isArray(value)) return value;
            return value.map(part => {
                if (!object(part)) return part;
                if (part.type === "soterai_base64") {
                    if (Object.keys(part).length !== 4 || !["type", "encoding", "media_type", "data"].every(key => Object.hasOwn(part, key))) return fail();
                    return { type: "text", text: codec.decode(part.data, part.encoding, part.media_type) };
                }
                if (part.type === "text" && uriStart(part.text)) return Object.assign(Object.create(null), part, { text: codec.uri(part.text) });
                // Data-URI images/binary attachments are not supported by this text boundary.
                if (part.type === "image_url" && object(part.image_url) && uriStart(part.image_url.url)) return fail(enabled ? "base64_unsupported" : "base64_unavailable");
                return part;
            });
        };
        const messages = Array.isArray(body.messages) ? body.messages.map(message => object(message) && Object.hasOwn(message, "content") ? Object.assign(Object.create(null), message, { content: content(message.content) }) : message) : undefined;
        if (!codec.blobs) return Object.freeze({ body, canonical: JSON.stringify(body), blobs: 0 });
        const aggregate = Object.assign(Object.create(null), body, { messages });
        return Object.freeze({ ...decodeBoundedJson(Buffer.from(JSON.stringify(aggregate))), blobs: codec.blobs });
    });
}
/** Complete explicit one-layer base64 JSON-chat transport; no nested blob fallback. */
export function decodeBoundedBase64Envelope(input: Uint8Array, enabled = true): { body: Body; canonical: string; blobs: number } {
    return guarded(() => {
        if (!enabled) return fail("base64_unavailable");
        const envelope = decodeBoundedJson(input).body;
        if (Object.keys(envelope).length !== 3 || !["encoding", "mediaType", "data"].every(key => Object.hasOwn(envelope, key))) return fail();
        if (envelope.mediaType !== "application/json") return fail("base64_unsupported");
        const codec = decoder(true), text = codec.decode(envelope.data, envelope.encoding, envelope.mediaType);
        const request = decodeBoundedChatFrames(Buffer.from(text + "\n"), "ndjson");
        // decoder rejects any explicit nested representation anywhere in the JSON object.
        return Object.freeze({ body: request.body, canonical: request.canonical, blobs: codec.blobs });
    });
}
