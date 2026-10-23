import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { configSyntaxUnavailable as fail, configArgumentName, configCredentialName, hasConfigCredential, type ConfigComment, type StaticConfigSyntax, type TextScalar } from "./JsoncSecretPlan";

interface Token { kind: "string" | "bare" | "symbol" | "newline" | "eof"; value: string; start: number; end: number; multiline?: boolean }
interface Table { kind: "table"; fields: Map<string, Value>; origin: "root" | "header" | "dotted" | "inline"; explicit: boolean }
interface Scalar { kind: "string" | "primitive"; token: Token }
interface List { kind: "array"; items: Value[] }
type Value = Table | Scalar | List;
const table = (origin: Table["origin"], explicit = false): Table => ({ kind: "table", fields: new Map(), origin, explicit });

/** A closed TOML subset. Tokenize and bound nesting before recursive parsing.
 * No packages, include handling, environment resolution or client execution. */
function tokenize(text: string): { tokens: Token[]; comments: ConfigComment[] } {
    const tokens: Token[] = [], comments: ConfigComment[] = []; let at = 0, depth = 0;
    const add = (kind: Token["kind"], value: string, start: number, multiline = false) => {
        if (tokens.length >= 32768) return fail(); tokens.push({ kind, value, start, end: at, multiline });
    };
    while (at < text.length) {
        const start = at, char = text[at];
        if (char === " " || char === "\t") { at++; continue; }
        if (char === "\n" || char === "\r") { if (char === "\r" && text[++at] !== "\n") return fail(); at++; add("newline", "\n", start); continue; }
        if (char === "#") { while (at < text.length && text[at] !== "\n" && text[at] !== "\r") at++; comments.push({ text: text.slice(start + 1, at), offset: start + 1 }); continue; }
        if (char === '"' || char === "'") {
            const quote = char, multiline = text.startsWith(quote.repeat(3), at), width = multiline ? 3 : 1; at += width;
            let value = "", closed = false;
            if (multiline && text[at] === "\n") at++;
            else if (multiline && text.startsWith("\r\n", at)) at += 2;
            while (at < text.length) {
                if (text[at] === quote) {
                    let count = 0; while (text[at + count] === quote) count++;
                    if (!multiline || count >= 3) {
                        if (multiline && count > 5) return fail();
                        value += multiline ? quote.repeat(count - 3) : ""; at += multiline ? count : 1; closed = true; break;
                    }
                    value += quote.repeat(count); at += count; continue;
                }
                const next = text[at++];
                if (next === "\n" || next === "\r") {
                    if (!multiline) return fail();
                    if (next === "\r") { if (text[at++] !== "\n") return fail(); }
                    value += "\n"; continue;
                }
                if (next.charCodeAt(0) < 32 && next !== "\t" || next === "\x7f") return fail();
                if (quote === '"' && next === "\\") {
                    // TOML multiline basic-string continuation trims following whitespace.
                    if (multiline && /[ \t\r\n]/.test(text[at] ?? "")) {
                        const whitespace = /^[ \t]*(?:\r?\n)[ \t\r\n]*/.exec(text.slice(at)); if (!whitespace) return fail(); at += whitespace[0].length; continue;
                    }
                    const escape = text[at++], escapes: Record<string, string> = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
                    if (Object.hasOwn(escapes, escape)) value += escapes[escape];
                    else if (escape === "u" || escape === "U") {
                        const size = escape === "u" ? 4 : 8, digits = text.slice(at, at + size);
                        if (digits.length !== size || !/^[0-9a-f]+$/i.test(digits)) return fail();
                        const point = Number.parseInt(digits, 16); if (point > 0x10ffff || point >= 0xd800 && point <= 0xdfff) return fail();
                        value += String.fromCodePoint(point); at += size;
                    } else return fail();
                } else value += next;
            }
            if (!closed) return fail(); new SecureEditorModel(value, false); add("string", value, start, multiline); continue;
        }
        if ("[]{}=.,".includes(char)) {
            if (char === "[" || char === "{") { if (++depth > 64) return fail(); }
            if (char === "]" || char === "}") { if (--depth < 0) return fail(); }
            at++; add("symbol", char, start); continue;
        }
        while (at < text.length && !/[ \t\r\n#[\]{}=.,'"\\]/.test(text[at])) at++;
        if (at === start) return fail(); add("bare", text.slice(start, at), start);
    }
    if (depth) return fail(); add("eof", "", at); return { tokens, comments };
}

/** Parse only the declared scalar/table/array subset; duplicate decoded names
 * and collisions are rejected using Maps, including prototype-looking keys. */
export function parseMcpToml(text: string): StaticConfigSyntax {
    const { tokens, comments } = tokenize(text), root = table("root"); let cursor = 0, nodes = 0, current = root;
    const peek = () => tokens[cursor], take = () => tokens[cursor++];
    const symbol = (value: string) => peek().kind === "symbol" && peek().value === value;
    const requireSymbol = (value: string) => { if (!symbol(value)) return fail(); take(); };
    const count = (depth: number) => { if (++nodes > 16384 || depth > 64) return fail(); };
    const newline = () => { while (peek().kind === "newline") take(); };
    const keys = (): string[] => {
        const result: string[] = [];
        for (;;) {
            const token = take();
            if (token.kind !== "string" && token.kind !== "bare" || token.multiline || !token.value || token.value.length > 1024 || token.kind === "bare" && !/^[A-Za-z0-9_-]+$/.test(token.value)) return fail();
            new SecureEditorModel(token.value, false); if (hasConfigCredential("", token.value, "mcp")) return fail();
            result.push(token.value); if (result.length > 64) return fail(); if (!symbol(".")) break; take();
        }
        return result;
    };
    const assign = (parent: Table, names: string[], value: Value) => {
        let target = parent;
        for (const key of names.slice(0, -1)) {
            let next = target.fields.get(key);
            if (!next) { count(names.length); next = table("dotted"); target.fields.set(key, next); }
            if (next.kind !== "table" || next.origin === "inline") return fail(); target = next;
        }
        const leaf = names.at(-1)!; if (target.fields.has(leaf)) return fail(); target.fields.set(leaf, value);
    };
    const value = (depth: number): Value => {
        count(depth); const token = peek();
        if (token.kind === "string") { take(); return { kind: "string", token }; }
        if (symbol("[")) {
            take(); const items: Value[] = []; newline();
            if (!symbol("]")) for (;;) { items.push(value(depth + 1)); newline(); if (!symbol(",")) break; take(); newline(); if (symbol("]")) break; }
            requireSymbol("]"); return { kind: "array", items };
        }
        if (symbol("{")) {
            take(); const fields = table("inline", true);
            if (!symbol("}")) for (;;) { const names = keys(); requireSymbol("="); assign(fields, names, value(depth + 1)); if (!symbol(",")) break; take(); if (symbol("}")) return fail(); }
            requireSymbol("}"); return fields;
        }
        if (token.kind !== "bare") return fail(); take();
        // Decimal dots are separate key punctuation tokens. Join only contiguous
        // number lexemes; whitespace and dotted identifiers can never be values.
        let raw = token.value;
        if (symbol(".") && token.end === peek().start) {
            const dot = take(), tail = take(); if (tail.kind !== "bare" || tail.start !== dot.end) return fail(); raw += "." + tail.value;
        }
        const digits = "(?:0|[1-9](?:_?[0-9])*)", decimal = new RegExp("^[+-]?" + digits + "(?:\\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?$");
        const radix = /^(?:0x[0-9a-fA-F](?:_?[0-9a-fA-F])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*)$/;
        if (raw !== "true" && raw !== "false") {
            if (!decimal.test(raw) && !radix.test(raw)) return fail();
            const number = Number(raw.replaceAll("_", ""));
            if (!Number.isFinite(number) || !/[.eE]/.test(raw) && !Number.isSafeInteger(number)) return fail();
        }
        return { kind: "primitive", token };
    };
    newline();
    while (peek().kind !== "eof") {
        if (symbol("[")) {
            take(); if (symbol("[")) return fail(); const path = keys(); requireSymbol("]"); let target = root;
            for (let index = 0; index < path.length; index++) {
                const key = path[index]; let next = target.fields.get(key);
                if (!next) { count(path.length); next = table("header"); target.fields.set(key, next); }
                if (next.kind !== "table" || next.origin === "inline" || next.origin === "dotted") return fail();
                if (index === path.length - 1) { if (next.explicit) return fail(); next.explicit = true; } target = next;
            }
            current = target;
        } else { const names = keys(); requireSymbol("="); assign(current, names, value(0)); }
        if (peek().kind !== "newline" && peek().kind !== "eof") return fail(); newline();
    }
    const scalars: TextScalar[] = [], names: string[] = [], stack: Array<{ value: Value; path: string[]; key: string; depth: number }> = [{ value: root, path: [], key: "", depth: 0 }]; nodes = 0;
    const reference = (item: Value): void => {
        if (item.kind !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.token.value) || hasConfigCredential("", item.token.value, "mcp")) return fail();
        scalars.push({ key: "", rawValue: item.token.value, start: item.token.start, end: item.token.end });
    };
    while (stack.length) {
        const frame = stack.pop()!, item = frame.value; count(frame.depth);
        const server = frame.path.length === 3 && frame.path[0] === "mcp_servers";
        if (server && frame.key === "env_vars") {
            if (item.kind !== "array") return fail(); for (const entry of item.items) reference(entry); continue;
        }
        if (server && frame.key === "env_http_headers") {
            if (item.kind !== "table") return fail(); for (const [name, entry] of item.fields) { names.push(name); reference(entry); } continue;
        }
        if (server && frame.key === "bearer_token_env_var") { reference(item); continue; }
        if (item.kind === "table") {
            if (configCredentialName(frame.key) && !(frame.path.length === 2 && frame.path[0] === "mcp_servers")) return fail();
            for (const [name, entry] of item.fields) { names.push(name); stack.push({ value: entry, path: [...frame.path, name], key: name, depth: frame.depth + 1 }); }
        } else if (item.kind === "array") {
            if (configCredentialName(frame.key)) return fail();
            for (let index = 0; index < item.items.length; index++) {
                const previous = item.items[index - 1], adjacent = /^(?:args|arguments)$/i.test(frame.key) && previous?.kind === "string" && configArgumentName(previous.token.value), entry = item.items[index];
                if (adjacent && entry.kind !== "string") return fail();
                if (/^(?:args|arguments)$/i.test(frame.key) && entry.kind === "string" && configArgumentName(entry.token.value) && index + 1 === item.items.length) return fail();
                stack.push({ value: entry, path: [...frame.path, String(index)], key: adjacent ? "MCP_SECRET" : "", depth: frame.depth + 1 });
            }
        } else if (item.kind === "string") scalars.push({ key: frame.key, rawValue: item.token.value, start: item.token.start, end: item.token.end });
        else if (configCredentialName(frame.key)) return fail();
    }
    return { scalars, names, comments };
}
