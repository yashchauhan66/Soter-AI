import { TextDecoder } from "node:util";
import { detectSecrets } from "../../guard-core/src/detectors/SecretDetector";

export const SECRET_MATCH_LIMITS = Object.freeze({ maxRegistrations: 128, maxValueBytes: 4096, maxRegisteredBytes: 65536,
    maxParts: 32, maxInputBytes: 131072, maxVariantBytes: 1048576, maxDecodedCandidates: 128,
    maxDecodedBytes: 262144, maxMatches: 256, maxSearchWork: 67108864 });
export const SECRET_ENTROPY_POLICY = Object.freeze({ minLength: 32, maxLength: 512, minClasses: 3, minBitsPerCharacter: 4.3 });
type Representation = "raw" | "base64" | "base64url" | "hex" | "url" | "json";
export interface SecretMatch {
    readonly kind: "registered" | "provider" | "entropy";
    readonly representation: Representation;
    readonly registrationId?: string;
    readonly start: number;
    readonly end: number;
    readonly parts: readonly { readonly index: number; readonly start: number; readonly end: number }[];
}
export interface MatchDecision { readonly status: "CLEAN" | "MATCHED" | "WITHHELD"; readonly matches: readonly SecretMatch[]; readonly reason?: string }
type Value = { id: string; text: string; short: boolean };
type Needle = { value: Value; text: string; representation: Representation };
type View = { text: string; start: number; end: number; representation: Representation };
const OMIT_PROVIDER = new Set(["generic_api_key", "password_assignment", "heroku_key", "high_entropy_token", "opaque_credential"]);
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function validUnicode(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = text.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        } else if (code >= 0xdc00 && code <= 0xdfff) return false;
    }
    return true;
}
function decision(status: MatchDecision["status"], matches: SecretMatch[] = [], reason?: string): MatchDecision {
    return Object.freeze({ status, matches: Object.freeze(matches), ...(reason ? { reason } : {}) });
}
function entropy(value: string): number {
    const counts = new Map<string, number>(); for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
    let result = 0; for (const count of counts.values()) { const p = count / value.length; result -= p * Math.log2(p); } return result;
}

/** Request-local exact-value recognition. Private fields never serialize to an
 * audit/UI result. This does not discover values, retain requests or decode
 * arbitrary nested encodings. All incomplete work withholds the entire result. */
export class RegisteredSecretMatcher {
    #values: Value[] = [];
    #needles: Needle[] = [];
    #invalid = false;
    #decodedCandidateLimit: number = SECRET_MATCH_LIMITS.maxDecodedCandidates;
    constructor(values: readonly string[], options: { maxDecodedCandidates?: number } = {}) {
        try {
            if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => key !== "maxDecodedCandidates")) throw new Error();
            if (Object.hasOwn(options, "maxDecodedCandidates")) {
                const limit = options.maxDecodedCandidates;
                if (!Number.isSafeInteger(limit) || limit! < 1 || limit! > 1024) throw new Error();
                this.#decodedCandidateLimit = limit!;
            }
            if (!Array.isArray(values)) throw new Error();
            let total = 0, expanded = 0; const seen = new Set<string>();
            for (const text of values) {
                if (typeof text !== "string" || !text || text.length > SECRET_MATCH_LIMITS.maxValueBytes || !validUnicode(text)) throw new Error();
                const size = Buffer.byteLength(text, "utf8"); if (size > SECRET_MATCH_LIMITS.maxValueBytes) throw new Error();
                total += size; if (total > SECRET_MATCH_LIMITS.maxRegisteredBytes) throw new Error();
                if (seen.has(text)) continue;
                seen.add(text);
                if (seen.size > SECRET_MATCH_LIMITS.maxRegistrations) throw new Error();
                const value: Value = { id: `r${seen.size}`, text, short: Array.from(text).length < 8 };
                const bytes = Buffer.from(text, "utf8"), base64 = bytes.toString("base64"), base64url = bytes.toString("base64url");
                const variants: Array<[Representation, string]> = [["raw", text], ["base64", base64], ["base64", base64.replace(/=+$/, "")],
                    ["base64url", base64url], ["base64url", base64url + "=".repeat((4 - base64url.length % 4) % 4)],
                    ["hex", bytes.toString("hex")], ["hex", bytes.toString("hex").toUpperCase()],
                    ["url", encodeURIComponent(text)], ["json", JSON.stringify(text)], ["json", JSON.stringify(text).slice(1, -1)]];
                const unique = new Set<string>();
                for (const [representation, variant] of variants) {
                    if (unique.has(variant)) continue; unique.add(variant);
                    expanded += Buffer.byteLength(variant, "utf8"); if (expanded > SECRET_MATCH_LIMITS.maxVariantBytes) throw new Error();
                    this.#needles.push({ value, text: variant, representation });
                }
                this.#values.push(value);
            }
        } catch { this.#invalid = true; this.#values = []; this.#needles = []; }
    }

    /** Replacement markers must not literally contain even a short registered
     * value. Input matching retains its separate conservative short-value rule. */
    isSafeReplacement(text: string): boolean {
        try {
            if (this.#invalid || typeof text !== "string" || text.length > SECRET_MATCH_LIMITS.maxInputBytes || !validUnicode(text)) return false;
            if (this.#values.some(value => text.includes(value.text))) return false;
            return this.inspectRequest([text]).status === "CLEAN";
        } catch { return false; }
    }

    inspectRequest(parts: readonly string[]): MatchDecision {
        if (this.#invalid) return decision("WITHHELD", [], "registration_unavailable");
        try {
            if (!Array.isArray(parts) || parts.length > SECRET_MATCH_LIMITS.maxParts) throw new Error();
            let inputBytes = 0;
            for (const part of parts) {
                if (typeof part !== "string" || part.length > SECRET_MATCH_LIMITS.maxInputBytes + 2 * SECRET_MATCH_LIMITS.maxParts) throw new Error();
                inputBytes += Buffer.byteLength(part, "utf8");
                // A split surrogate pair occupies six bytes separately, four
                // when joined; use a conservative allocation bound here.
                if (inputBytes > SECRET_MATCH_LIMITS.maxInputBytes + 2 * SECRET_MATCH_LIMITS.maxParts) throw new Error();
            }
            const text = parts.join("");
            if (!validUnicode(text) || Buffer.byteLength(text, "utf8") > SECRET_MATCH_LIMITS.maxInputBytes) throw new Error();
            const offsets: number[] = []; let cursor = 0;
            for (const part of parts) { offsets.push(cursor); cursor += part.length; }
            const matches: SecretMatch[] = [], seenMatches = new Set<string>();
            let work = 0, decodedBytes = 0;
            const charge = (amount: number): void => { work += amount; if (work > SECRET_MATCH_LIMITS.maxSearchWork) throw new Error(); };
            const add = (kind: SecretMatch["kind"], representation: Representation, start: number, end: number, registrationId?: string): void => {
                if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || end > text.length) throw new Error();
                const key = `${kind}:${registrationId ?? ""}:${start}:${end}`; if (seenMatches.has(key)) return;
                seenMatches.add(key); if (matches.length >= SECRET_MATCH_LIMITS.maxMatches) throw new Error();
                const spans: Array<{ index: number; start: number; end: number }> = [];
                for (let index = 0; index < parts.length; index++) {
                    const from = Math.max(start, offsets[index]), to = Math.min(end, offsets[index] + parts[index].length);
                    if (from < to) spans.push(Object.freeze({ index, start: from - offsets[index], end: to - offsets[index] }));
                }
                matches.push(Object.freeze({ kind, representation, ...(registrationId ? { registrationId } : {}), start, end, parts: Object.freeze(spans) }));
            };
            const wholePart = (start: number, end: number): boolean => start === 0 && end === text.length
                || parts.some((part, index) => offsets[index] === start && start + part.length === end);
            // HTTP URL path separators are framing as well as possible base64
            // characters. Recognize exact registered spellings in those paths
            // without recursively decoding a URL or relaxing padding checks.
            const pathSeparators = new Set<number>();
            charge(text.length);
            for (const url of text.matchAll(/\bhttps?:\/\/[^\s"'<>`]+/g)) {
                const path = url[0].indexOf("/", url[0].indexOf("://") + 3);
                if (path < 0) continue;
                for (let index = path; index < url[0].length; index++) if (url[0][index] === "/") pathSeparators.add(url.index! + index);
            }
            for (const needle of this.#needles) {
                charge(text.length);
                let at = text.indexOf(needle.text);
                while (at !== -1) {
                    const end = at + needle.text.length;
                    const encoded = ["base64", "base64url", "hex"].includes(needle.representation);
                    const alphabet = needle.representation === "hex" ? /[A-Fa-f0-9]/ : /[A-Za-z0-9+/_=\-]/;
                    const separator = (index: number): boolean => needle.representation !== "hex" && text[index] === "/" && pathSeparators.has(index);
                    const boundary = !encoded || !(at > 0 && alphabet.test(text[at - 1]) && !separator(at - 1))
                        && !(end < text.length && alphabet.test(text[end]) && !separator(end));
                    const explicitShortPart = needle.value.short && wholePart(at, end);
                    if ((boundary || explicitShortPart) && (!needle.value.short || explicitShortPart)) add("registered", needle.representation, at, end, needle.value.id);
                    at = text.indexOf(needle.text, at + 1);
                }
            }
            const views: View[] = [], seenViews = new Set<string>();
            const view = (decoded: string, start: number, end: number, representation: Representation): void => {
                if (!decoded || !validUnicode(decoded)) return;
                const key = `${representation}:${start}:${end}`; if (seenViews.has(key)) return;
                seenViews.add(key);
                if (views.length >= this.#decodedCandidateLimit) throw new Error();
                decodedBytes += Buffer.byteLength(decoded, "utf8"); if (decodedBytes > SECRET_MATCH_LIMITS.maxDecodedBytes) throw new Error();
                views.push({ text: decoded, start, end, representation });
            };
            // Lex only the original input. Decoded views never enter decoders.
            charge(text.length * 5);
            for (const token of text.matchAll(/[A-Fa-f0-9]{2,}/g)) {
                if (token[0].length % 2) continue;
                let decoded: string; try { decoded = utf8.decode(Buffer.from(token[0], "hex")); } catch { continue; }
                view(decoded, token.index!, token.index! + token[0].length, "hex");
            }
            for (const token of text.matchAll(/[A-Za-z0-9+/_\-]+={0,}/g)) {
                const source = token[0], start = token.index!;
                if (source.length < 2) continue;
                let bytes: Buffer | undefined, representation: Representation = "base64";
                if (/^[A-Fa-f0-9]+$/.test(source) && source.length % 2 === 0) {
                    bytes = Buffer.from(source, "hex"); representation = "hex";
                } else if (/^(?:[A-Za-z0-9+/]+={0,2}|[A-Za-z0-9_\-]+={0,2})$/.test(source)) {
                    const unpadded = source.replace(/=+$/, ""), url = /[_\-]/.test(source);
                    if (unpadded.length % 4 === 1) continue;
                    const candidate = Buffer.from(unpadded, url ? "base64url" : "base64");
                    const canonical = candidate.toString(url ? "base64url" : "base64").replace(/=+$/, "");
                    const padding = "=".repeat((4 - unpadded.length % 4) % 4);
                    if (canonical !== unpadded || source !== unpadded && source !== unpadded + padding) continue;
                    bytes = candidate; representation = url ? "base64url" : "base64";
                }
                if (bytes) {
                    let decoded: string; try { decoded = utf8.decode(bytes); } catch { continue; }
                    view(decoded, start, start + source.length, representation);
                }
            }
            if (text.includes("%")) {
                let decoded: string | undefined; try { decoded = decodeURIComponent(text); } catch { /* Still scan independent valid tokens below. */ }
                if (decoded !== undefined) view(decoded, 0, text.length, "url");
            }
            for (const token of text.matchAll(/[^\s"'<>`]+/g)) {
                if (!token[0].includes("%")) continue;
                let decoded: string; try { decoded = decodeURIComponent(token[0]); } catch { continue; }
                view(decoded, token.index!, token.index! + token[0].length, "url");
            }
            for (let index = 0; index < text.length; index++) {
                if (text[index] !== '"') continue;
                const start = index++; let closed = false;
                for (; index < text.length; index++) {
                    if (text[index] === "\\") { index++; continue; }
                    if (text[index] === '"') { closed = true; break; }
                }
                if (!closed) break;
                let decoded: unknown; try { decoded = JSON.parse(text.slice(start, index + 1)); } catch { continue; }
                if (typeof decoded === "string") view(decoded, start, index + 1, "json");
            }
            if (text.includes("\\")) {
                let decoded: unknown; try { decoded = JSON.parse('"' + text + '"'); } catch { /* Invalid string body. */ }
                if (typeof decoded === "string") view(decoded, 0, text.length, "json");
            }
            const scanPatterns = (content: string, map: (start: number, end: number) => [number, number], representation: Representation): void => {
                charge(content.length * 65);
                for (const finding of detectSecrets(content).matches) {
                    if (OMIT_PROVIDER.has(finding.type)) continue;
                    if (!Number.isInteger(finding.start) || !Number.isInteger(finding.end) || finding.start < 0 || finding.start >= finding.end || finding.end > content.length) throw new Error();
                    const [start, end] = map(finding.start, finding.end); add("provider", representation, start, end);
                }
                const assignment = /\b([A-Za-z_][A-Za-z0-9_.\-]{0,80})["']?\s*[:=]\s*["']?([A-Za-z0-9+/=_\-]+)["']?/g;
                for (const match of content.matchAll(assignment)) {
                    const key = match[1], value = match[2];
                    if (!/(?:secret|token|password|passwd|credentials?|api[_-]key|access[_-]key|auth)$/i.test(key)) continue;
                    if (value.length < 32 || value.length > 512 || [/[A-Z]/, /[a-z]/, /[0-9]/, /[+/=_\-]/].filter(pattern => pattern.test(value)).length < 3 || entropy(value) < 4.3) continue;
                    const [start, end] = map(match.index!, match.index! + match[0].length); add("entropy", representation, start, end);
                }
            };
            scanPatterns(text, (start, end) => [start, end], "raw");
            for (const candidate of views) {
                for (const value of this.#values) {
                    charge(candidate.text.length);
                    if (value.short ? candidate.text === value.text : candidate.text.includes(value.text))
                        add("registered", candidate.representation, candidate.start, candidate.end, value.id);
                }
                scanPatterns(candidate.text, () => [candidate.start, candidate.end], candidate.representation);
            }
            matches.sort((a, b) => a.start - b.start || a.end - b.end || (a.registrationId ?? "").localeCompare(b.registrationId ?? ""));
            return decision(matches.length ? "MATCHED" : "CLEAN", matches);
        } catch { return decision("WITHHELD", [], "matching_budget_or_input_unavailable"); }
    }
}
