const MAX_BYTES = 64 * 1024;
const UNSAFE_TEXT = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\uD800-\uDFFF]/u;
interface Field { id: string; name: string; editable: boolean; start: number; end: number; quote?: string }
export interface SecureEditorMetadata { readonly revision: number; readonly fields: readonly Readonly<{ id: string; name: string; editable: boolean }>[] }
function validText(text: string): void {
    if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_BYTES || UNSAFE_TEXT.test(text)) throw new Error("Unsupported secure editor text.");
}
function fields(text: string, environment: boolean): Field[] {
    const contents = (editable: boolean): Field[] => [{ id: "contents", name: "Contents", editable, start: 0, end: text.length }];
    if (!environment) return contents(true);
    const result: Field[] = [];
    let cursor = text.startsWith("\uFEFF") ? 1 : 0;
    while (cursor < text.length) {
        const lineBreak = text.indexOf("\n", cursor), lineEnd = lineBreak < 0 ? text.length : lineBreak;
        const bodyEnd = text[lineEnd - 1] === "\r" ? lineEnd - 1 : lineEnd;
        const line = text.slice(cursor, bodyEnd);
        if (!line.trim() || line.trimStart().startsWith("#")) { cursor = lineBreak < 0 ? text.length : lineBreak + 1; continue; }
        const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]{0,127})[ \t]*=[ \t]*/.exec(line);
        if (!match) return contents(false);
        const start = cursor + match[0].length;
        const quote = ["'", '"', "`"].includes(text[start]) ? text[start] : undefined;
        let end: number;
        if (quote) {
            let close = start + 1;
            while (close < text.length) {
                if (quote === '"' && text[close] === "\\") { close += 2; continue; }
                if (text[close] === quote) break;
                close++;
            }
            if (close >= text.length) return contents(false);
            end = close + 1;
            const next = text.indexOf("\n", end), suffixEnd = next < 0 ? text.length : next;
            const suffixBodyEnd = text[suffixEnd - 1] === "\r" ? suffixEnd - 1 : suffixEnd;
            if (!/^[ \t\r]*(?:#.*)?$/.test(text.slice(end, suffixBodyEnd))) return contents(false);
            cursor = next < 0 ? text.length : next + 1;
        } else {
            const comment = text.indexOf("#", start);
            end = comment >= start && comment < bodyEnd ? comment : bodyEnd;
            while (end > start && /[ \t]/.test(text[end - 1])) end--;
            cursor = lineBreak < 0 ? text.length : lineBreak + 1;
        }
        result.push({ id: "field-" + result.length, name: match[1], editable: true, start, end, ...(quote ? { quote } : {}) });
        if (result.length > 256) throw new Error("Secure editor field budget exceeded.");
    }
    return result;
}
function encodedValue(value: string): string {
    if (/^[^\s#'"`]*$/.test(value)) return value;
    for (const quote of ["'", "`", '"']) {
        if (value.includes(quote)) continue;
        if (quote === '"' && (/\\[nr]/.test(value) || value.endsWith("\\"))) continue;
        return quote + value + quote;
    }
    throw new Error("Value requires an unsupported quoted representation.");
}
/** Plaintext belongs only to the provider's private model, never a tool receipt. */
export class SecureEditorModel {
    private text: string;
    private entries: Field[];
    private revision = 0;
    constructor(text: string, private readonly environment: boolean) {
        if (typeof environment !== "boolean") throw new Error("Secure editor mode unavailable.");
        validText(text); this.entries = fields(text, environment); this.text = text;
    }
    metadata(): SecureEditorMetadata {
        return Object.freeze({ revision: this.revision, fields: Object.freeze(this.entries.map(({ id, name, editable }) => Object.freeze({ id, name, editable }))) });
    }
    readOwnerValue(id: string): string {
        const field = this.entries.find(entry => entry.id === id);
        if (!field) throw new Error("Secure field unavailable.");
        const value = this.text.slice(field.start, field.end);
        if (!field.quote) return value;
        const body = value.slice(1, -1);
        return field.quote === '"' ? body.replace(/\\n/g, "\n").replace(/\\r/g, "\r") : body;
    }
    applyOwnerValue(id: string, value: string): void {
        const field = this.entries.find(entry => entry.id === id);
        if (!field?.editable) throw new Error("Secure field is not editable.");
        validText(value);
        const replacement = this.environment ? encodedValue(value) : value;
        this.restoreFromStorage(this.text.slice(0, field.start) + replacement + this.text.slice(field.end));
    }
    snapshotForStorage(): string { return this.text; }
    restoreFromStorage(text: string): void {
        validText(text); const next = fields(text, this.environment);
        if (!Number.isSafeInteger(this.revision + 1)) throw new Error("Secure editor revision unavailable.");
        this.text = text; this.entries = next; this.revision++;
    }
}
