export interface JsonLimits { maxBytes?: number; maxDepth?: number; maxNodes?: number; maxStringBytes?: number }
export const JSON_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxDepth: 32, maxNodes: 8192, maxStringBytes: 65536 });
export class BoundedJsonError extends Error {
    constructor(readonly code: "invalid_json" | "invalid_utf8" | "body_too_large" | "json_complexity") { super("Request JSON could not be safely decoded"); }
}
/** Complete request-local syntax boundary; no secret/policy authority or I/O. */
export function decodeBoundedJson(input: Uint8Array, overrides: JsonLimits = {}): { body: Readonly<Record<string, unknown>>; canonical: string } {
    const limits: Required<JsonLimits> = { ...JSON_LIMITS };
    for (const key of Object.keys(overrides)) {
        if (!Object.hasOwn(limits, key)) throw new BoundedJsonError("json_complexity");
        const value = overrides[key as keyof JsonLimits];
        if (!Number.isSafeInteger(value) || value! < 1 || value! > JSON_LIMITS[key as keyof JsonLimits]) throw new BoundedJsonError("json_complexity");
        limits[key as keyof JsonLimits] = value!;
    }
    if (!(input instanceof Uint8Array) || input.byteLength > limits.maxBytes) throw new BoundedJsonError("body_too_large");
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input); }
    catch { throw new BoundedJsonError("invalid_utf8"); }
    let cursor = 0, nodes = 0;
    const fail = (): never => { throw new BoundedJsonError("invalid_json"); };
    const node = () => { if (++nodes > limits.maxNodes) throw new BoundedJsonError("json_complexity"); };
    const whitespace = () => { while (cursor < text.length && [" ", "\t", "\r", "\n"].includes(text[cursor])) cursor++; };
    const string = (): string => {
        if (text[cursor] !== '"') return fail(); const start = cursor++;
        while (cursor < text.length) {
            const code = text.charCodeAt(cursor);
            if (code === 0x22) {
                cursor++; let value: string; try { value = JSON.parse(text.slice(start, cursor)) as string; } catch { return fail(); }
                if (Buffer.byteLength(value, "utf8") > limits.maxStringBytes) throw new BoundedJsonError("json_complexity");
                for (let i = 0; i < value.length; i++) {
                    const unit = value.charCodeAt(i);
                    if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return fail(); }
                    else if (unit >= 0xdc00 && unit <= 0xdfff) return fail();
                }
                return value;
            }
            if (code < 0x20) return fail();
            if (code === 0x5c) { cursor += 2; } else cursor++;
        }
        return fail();
    };
    const numeric = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    const value = (depth: number): unknown => {
        if (depth > limits.maxDepth) throw new BoundedJsonError("json_complexity"); node(); whitespace();
        const token = text[cursor];
        if (token === '"') return string();
        if (token === "{") {
            cursor++; whitespace(); const object: Record<string, unknown> = Object.create(null), keys = new Set<string>();
            if (text[cursor] === "}") { cursor++; return Object.freeze(object); }
            while (cursor < text.length) {
                node(); const key = string(); if (keys.has(key)) return fail(); keys.add(key); whitespace();
                if (text[cursor++] !== ":") return fail();
                Object.defineProperty(object, key, { value: value(depth + 1), enumerable: true, writable: false, configurable: false }); whitespace();
                const end = text[cursor++]; if (end === "}") return Object.freeze(object); if (end !== ",") return fail(); whitespace();
            }
            return fail();
        }
        if (token === "[") {
            cursor++; whitespace(); const array: unknown[] = []; if (text[cursor] === "]") { cursor++; return Object.freeze(array); }
            while (cursor < text.length) { array.push(value(depth + 1)); whitespace(); const end = text[cursor++]; if (end === "]") return Object.freeze(array); if (end !== ",") return fail(); whitespace(); }
            return fail();
        }
        for (const [literal, result] of [["true", true], ["false", false], ["null", null]] as const) if (text.startsWith(literal, cursor)) { cursor += literal.length; return result; }
        numeric.lastIndex = cursor; const match = numeric.exec(text); if (!match) return fail(); cursor = numeric.lastIndex;
        const number = Number(match[0]); if (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) return fail(); return number;
    };
    const body = value(0); whitespace();
    if (cursor !== text.length || !body || typeof body !== "object" || Array.isArray(body)) return fail();
    // Partially built private parse nodes never escape; publish only on completion.
    return Object.freeze({ body: body as Readonly<Record<string, unknown>>, canonical: JSON.stringify(body) });
}
