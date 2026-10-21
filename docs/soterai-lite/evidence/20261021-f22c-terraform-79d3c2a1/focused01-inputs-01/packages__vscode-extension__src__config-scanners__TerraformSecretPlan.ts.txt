import { classifySecretType, extractVaultCandidates } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { hygieneCredentialName, isHygieneCandidate } from "../hygiene/HygieneCandidatePolicy";
import type { PrivateVaultCandidate, PrivateVaultPlan } from "../firewall/VaultMigrationPlan";

export type TerraformFormat = "terraform" | "tfvars" | "terraform-json" | "tfvars-json";
export const TERRAFORM_WORKSPACE_GLOBS = Object.freeze(["**/*.{[tT][fF],[tT][fF][vV][aA][rR][sS]}", "**/*.{[tT][fF],[tT][fF][vV][aA][rR][sS]}.[jJ][sS][oO][nN]"]);
const FORMATS: readonly string[] = ["terraform", "tfvars", "terraform-json", "tfvars-json"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BLOCKS: Readonly<Record<string, number>> = Object.freeze({ terraform: 0, provider: 1, resource: 2, data: 2, module: 1, variable: 1, output: 1, locals: 0 });
const fail = (): never => { throw Error("Terraform static syntax, expression or size is unsupported; existing files are preserved."); };
export function terraformFormatForPath(relative: string): TerraformFormat | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative) || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) return fail();
    const name = relative.split("/").at(-1)!;
    return /\.tfvars\.json$/i.test(name) ? "tfvars-json" : /\.tf\.json$/i.test(name) ? "terraform-json" : /\.tfvars$/i.test(name) ? "tfvars" : /\.tf$/i.test(name) ? "terraform" : undefined;
}
interface Token { kind: "word" | "number" | "string" | "symbol" | "eof"; value: string; start: number; end: number; newline: boolean }
interface Pending extends PrivateVaultCandidate { mask: (marker: string) => string }
type Add = (key: string, raw: string, start: number, end: number, mask: (marker: string) => string) => void;
function staticTemplate(value: string): string {
    let result = "";
    for (let i = 0; i < value.length; i++) {
        if (value.startsWith("$${", i) || value.startsWith("%%{", i)) { result += value.slice(i + 1, i + 3); i += 2; }
        else if (value.startsWith("${", i) || value.startsWith("%{", i)) return fail(); else result += value[i];
    }
    return result;
}
/** Closed finite lexer: no imports, project config, function calls or evaluation. */
function tokens(text: string, json: boolean, add: Add): Token[] {
    const result: Token[] = []; let cursor = 0, newline = false;
    const push = (kind: Token["kind"], value: string, start: number, end: number) => { if (result.length >= 16384) return fail(); result.push({ kind, value, start, end, newline }); newline = false; cursor = end; };
    const comments = (body: string, offset: number) => { for (const c of extractVaultCandidates(body)) add(c.key, c.rawValue, offset + c.start, offset + c.end, marker => marker); };
    while (cursor < text.length) {
        const start = cursor, c = text[cursor];
        if (/[ \t\r\n]/.test(c)) { if (c === "\n") newline = true; cursor++; continue; }
        if (!json && (c === "#" || text.startsWith("//", cursor))) { const prefix = c === "#" ? 1 : 2, end = text.indexOf("\n", cursor), stop = end < 0 ? text.length : end; comments(text.slice(cursor + prefix, stop), cursor + prefix); cursor = stop; continue; }
        if (!json && text.startsWith("/*", cursor)) { const end = text.indexOf("*/", cursor + 2); if (end < 0) return fail(); comments(text.slice(cursor + 2, end), cursor + 2); if (text.slice(cursor, end + 2).includes("\n")) newline = true; cursor = end + 2; continue; }
        if (!json && text.startsWith("<<", cursor)) {
            const line = text.indexOf("\n", cursor); if (line < 0) return fail(); const header = /^<<(-?)([A-Za-z_][A-Za-z0-9_-]*)[ \t]*\r?$/.exec(text.slice(cursor, line)); if (!header) return fail();
            let bodyEnd = line + 1, end = -1;
            while (bodyEnd <= text.length) { const eol = text.indexOf("\n", bodyEnd), stop = eol < 0 ? text.length : eol, raw = text.slice(bodyEnd, stop).replace(/\r$/, ""); if ((header[1] ? raw.replace(/^ +/, "") : raw) === header[2]) { end = bodyEnd + raw.length; break; } if (eol < 0) return fail(); bodyEnd = eol + 1; }
            if (end < 0) return fail(); let raw = text.slice(line + 1, bodyEnd).replace(/\r\n/g, "\n");
            if (header[1]) { if (/^ *\t/m.test(raw)) return fail(); const lines = raw.split("\n"), lengths = lines.filter(v => v.trim()).map(v => /^ */.exec(v)![0].length), indent = lengths.length ? Math.min(...lengths) : 0; raw = lines.map(v => v.slice(Math.min(indent, /^ */.exec(v)![0].length))).join("\n"); }
            raw = staticTemplate(raw); new SecureEditorModel(raw, false); push("string", raw, start, end); continue;
        }
        if (c === '"') {
            let at = cursor + 1, value = "", closed = false;
            while (at < text.length) {
                const next = text[at++]; if (next === '"') { closed = true; break; } if (next === "\n" || next === "\r" || next.charCodeAt(0) < 32) return fail();
                if (next !== "\\") { value += next; continue; } const escape = text[at++];
                if (json) { if (!escape) return fail(); if (escape === "u") { if (!/^[a-fA-F0-9]{4}$/.test(text.slice(at, at + 4))) return fail(); at += 4; } else if (!'"\\/bfnrt'.includes(escape)) return fail(); continue; }
                if (escape === "n" || escape === "r" || escape === "t") value += escape === "n" ? "\n" : escape === "r" ? "\r" : "\t";
                else if (escape === '"' || escape === "\\") value += escape;
                else if (escape === "u" || escape === "U") { const length = escape === "u" ? 4 : 8, digits = text.slice(at, at + length); if (digits.length !== length || !/^[a-fA-F0-9]+$/.test(digits)) return fail(); const point = parseInt(digits, 16); if (point > 0x10ffff || point >= 0xd800 && point <= 0xdfff) return fail(); value += String.fromCodePoint(point); at += length; }
                else return fail();
            }
            if (!closed) return fail(); if (json) value = JSON.parse(text.slice(start, at)); value = staticTemplate(value); new SecureEditorModel(value, false); push("string", value, start, at); continue;
        }
        if (/[0-9-]/.test(c)) { const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(cursor)); if (number) { if (!Number.isFinite(Number(number[0]))) return fail(); push("number", number[0], start, cursor + number[0].length); continue; } }
        if (/[A-Za-z_]/.test(c)) { const word = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(text.slice(cursor))![0]; if (word.length > 1024) return fail(); push("word", word, start, cursor + word.length); continue; }
        if ('{}[]=,:.'.includes(c)) { push("symbol", c, start, cursor + 1); continue; } return fail();
    }
    push("eof", "", cursor, cursor); return result;
}
function parseStatic(text: string, format: TerraformFormat, add: Add): void {
    const json = format.endsWith("-json"), vars = format.startsWith("tfvars"), list = tokens(text, json, add); let cursor = 0, work = 0;
    const peek = () => list[cursor], take = () => { if (++work > 32768 || cursor >= list.length) return fail(); return list[cursor++]; }, symbol = (value: string) => { const t = take(); if (t.kind !== "symbol" || t.value !== value) return fail(); };
    const name = (t: Token): string => { if (t.kind !== "word" && t.kind !== "string" || !t.value || t.value.length > 1024 || isHygieneCandidate("", t.value)) return fail(); return t.value; };
    const inherit = (parent: string, key: string) => hygieneCredentialName(key) ? key : hygieneCredentialName(parent) ? parent : key;
    function value(hint: string, depth: number, location: string[] = []): void {
        if (depth > 64) return fail(); const t = peek();
        if (t.kind === "string") { take(); add(hint, t.value, t.start, t.end, marker => JSON.stringify(marker)); return; }
        if (t.kind === "number" || t.kind === "word" && ["true", "false", "null"].includes(t.value)) { take(); if (hygieneCredentialName(hint) && t.value !== "null") return fail(); return; }
        if (t.kind === "word" && !json) { take(); while (peek().value === ".") { symbol("."); if (take().kind !== "word") return fail(); } return; }
        if (t.kind !== "symbol") return fail();
        if (t.value === "[") { symbol("["); if (peek().value !== "]") while (true) { value(hint, depth + 1, location); if (peek().value === "]") break; symbol(","); if (peek().value === "]") { if (json) return fail(); break; } } symbol("]"); return; }
        if (t.value !== "{") return fail(); symbol("{"); const keys = new Set<string>();
        while (peek().value !== "}") {
            const token = take(); if (json && token.kind !== "string") return fail(); const key = name(token); if (keys.has(key)) return fail(); keys.add(key); if (json) symbol(":"); else { const assign = take(); if (assign.kind !== "symbol" || !["=", ":"].includes(assign.value)) return fail(); }
            let childHint = inherit(hint, key);
            if (json && !vars) {
                if (location.length === 0) { if (!Object.hasOwn(BLOCKS, key) || peek().value !== "{") return fail(); childHint = ""; }
                else if (location.length === 1 && ["provider", "variable", "output", "module", "resource", "data"].includes(location[0]) || location.length === 2 && ["resource", "data"].includes(location[0])) childHint = "";
                else if (location.length === 2 && (location[0] === "variable" && key === "default" || location[0] === "output" && key === "value")) childHint = location[1];
            }
            value(childHint, depth + 1, [...location, key]); if (peek().value === "}") break;
            if (peek().value === ",") { symbol(","); if (json && peek().value === "}") return fail(); } else if (json || !peek().newline) return fail();
        }
        symbol("}");
    }
    function body(depth: number, root: boolean, context: string, binding?: { type: string; label: string }): void {
        if (depth > 64) return fail(); const attributes = new Set<string>();
        while (peek().kind !== "eof" && (root || peek().value !== "}")) {
            const first = take(); if (first.kind !== "word") return fail(); const key = name(first);
            if (peek().value === "=") {
                if (root && !vars || attributes.has(key)) return fail(); attributes.add(key); symbol("="); const hint = binding && (binding.type === "variable" && key === "default" || binding.type === "output" && key === "value") ? binding.label : inherit(context, key); value(hint, depth + 1);
            } else {
                if (vars && root) return fail(); const labels: string[] = []; while (peek().kind === "string") { labels.push(name(take())); if (labels.length > 2) return fail(); }
                if (root && (!Object.hasOwn(BLOCKS, key) || labels.length !== BLOCKS[key])) return fail(); symbol("{"); body(depth + 1, false, hygieneCredentialName(key) ? key : "", labels.length === 1 && ["variable", "output"].includes(key) ? { type: key, label: labels[0] } : undefined); symbol("}");
            }
            if (peek().kind !== "eof" && peek().value !== "}" && !peek().newline) return fail();
        }
    }
    if (json) { if (peek().value !== "{") return fail(); value("", 0); } else body(0, true, ""); if (take().kind !== "eof") return fail();
}
/** Private static plan. Plaintext and exact original representations never form a receipt. */
export function createTerraformSecretPlan(text: string, format: TerraformFormat, generation: string): PrivateVaultPlan {
    try {
        if (!FORMATS.includes(format) || typeof generation !== "string" || !UUID.test(generation)) return fail(); new SecureEditorModel(text, false);
        const pending: Pending[] = [], add: Add = (key, rawValue, start, end, mask) => {
            new SecureEditorModel(rawValue, false); if (!isHygieneCandidate(key, rawValue)) return; if (pending.length >= 128 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return fail();
            pending.push({ key: key || "TERRAFORM_VALUE", rawValue, type: classifySecretType(key, rawValue), start, end, replacementText: text.slice(start, end), placeholder: "", mask });
        };
        parseStatic(text, format, add); pending.sort((a, b) => a.start - b.start); let maskedText = text;
        for (let i = 0; i < pending.length; i++) { const c = pending[i]; if (i && c.start < pending[i - 1].end) return fail(); c.placeholder = `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${i}]`; if (text.includes(c.placeholder)) return fail(); }
        for (const c of [...pending].reverse()) maskedText = maskedText.slice(0, c.start) + c.mask(c.placeholder) + maskedText.slice(c.end);
        if (pending.some(c => maskedText.includes(c.rawValue) || maskedText.includes(c.replacementText))) return fail(); new SecureEditorModel(maskedText, false); parseStatic(maskedText, format, () => undefined);
        return { maskedText, exampleText: "", restoreMode: "checkpoint", candidates: pending.map(({ mask: _privateMask, ...candidate }) => candidate) };
    } catch { return fail(); }
}
