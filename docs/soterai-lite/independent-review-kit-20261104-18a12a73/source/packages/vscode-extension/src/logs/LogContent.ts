import { createScanner, parseTree, ScanError, SyntaxKind, type Node, type ParseError } from "jsonc-parser";
import { containsRawSecret } from "@soterai/guard-core";
import { publicationRelativePath } from "../project-privacy/publication/PublicationPaths";
import { hygieneCredentialName, normalizeHygieneName } from "../hygiene/HygieneCandidatePolicy";

export const LOG_LIMITS = Object.freeze({ files: 128, fileBytes: 65536, totalBytes: 1048576, milliseconds: 60000,
    parts: 32, depth: 32, nodes: 10000, records: 128 });
export const LOG_SCOPE = "Owner-reviewed bounded saved logs and test output; heuristic keyed possible-exposure metadata only. Review cleanup and provider rotation manually. Original logs, other extensions' collectors, arbitrary processes and earlier disclosures remain reachable.";
export interface LogView { readonly relativePath: string; readonly text: string; readonly language: "text"; readonly credentialName?: string }
export interface LogContentResult { readonly status: "ANALYZED" | "WITHHELD"; readonly kind: "TEXT" | "JSON" | "JSONL";
    readonly reason?: string; readonly views: readonly LogView[] }
const unsafe = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u;
const fail = (): never => { throw Error("Saved log content unavailable."); };
function validText(text: string, maximumBytes: number = LOG_LIMITS.fileBytes): void {
    if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > maximumBytes || unsafe.test(text) || /\p{Bidi_Control}/u.test(text)
        || Buffer.from(text, "utf8").toString("utf8") !== text) return fail();
}
interface State { nodes: number; bytes: number; strings: string[]; hints: string[] }
/** Fixed parse-only JSON. The lexical depth check runs before recursive parser
 * allocation. Key names are validated, never used as paths or public labels. */
function semanticStrings(text: string, state: State, maximumBytes: number = LOG_LIMITS.fileBytes): void {
    const scanner = createScanner(text, false); let depth = 0;
    for (;;) {
        const token = scanner.scan();
        if (scanner.getTokenError() !== ScanError.None
            || [SyntaxKind.Unknown, SyntaxKind.LineCommentTrivia, SyntaxKind.BlockCommentTrivia].includes(token)) return fail();
        if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.OpenBracketToken) { if (++depth > LOG_LIMITS.depth) return fail(); }
        if (token === SyntaxKind.CloseBraceToken || token === SyntaxKind.CloseBracketToken) { if (--depth < 0) return fail(); }
        if (token === SyntaxKind.EOF) break;
    }
    if (depth !== 0) return fail();
    const errors: ParseError[] = [], root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
    if (errors.length || !root) return fail();
    const stack: Array<{ node: Node; hint: string }> = [{ node: root, hint: "" }];
    while (stack.length) {
        const { node, hint } = stack.pop()!; if (++state.nodes > LOG_LIMITS.nodes) return fail();
        if (node.type === "string") {
            validText(node.value, maximumBytes);
            state.bytes += Buffer.byteLength(node.value, "utf8");
            if (state.strings.length >= LOG_LIMITS.parts || state.bytes > maximumBytes) return fail();
            state.strings.push(node.value);
            state.hints.push(hint);
        } else if (node.type === "number") { if (!Number.isFinite(node.value)) return fail(); }
        else if (node.type === "object") {
            const fields = node.children ?? [], names = new Set<string>();
            for (const field of fields) {
                const [key, value] = field.children ?? [];
                if (field.type !== "property" || field.children?.length !== 2 || key?.type !== "string" || !value || names.has(key.value)) return fail();
                validText(key.value, maximumBytes); names.add(key.value);
            }
            for (let index = fields.length - 1; index >= 0; index--) {
                const [key, value] = fields[index].children!;
                let next = hygieneCredentialName(key.value) ? normalizeHygieneName(key.value) : "";
                if (/^[0-9]/.test(next)) next = "LOG_" + next;
                if (next && !/^[A-Z_][A-Z0-9_]{0,255}$/.test(next)) return fail();
                stack.push({ node: value, hint: next });
            }
        } else if (node.type === "array") {
            for (let index = (node.children?.length ?? 0) - 1; index >= 0; index--) stack.push({ node: node.children![index], hint });
        } else if (node.type !== "boolean" && node.type !== "null") return fail();
    }
}

/** Private completed F08 output uses its existing combined128KiB budget.
 * This capability never receives or releases a public command argument. */
export function completedLogParts(stdout: string, stderr: string): readonly string[] {
    const maximumBytes = 131072;
    validText(stdout, maximumBytes); validText(stderr, maximumBytes);
    if (Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8") > maximumBytes) return fail();
    const state: State = { nodes: 0, bytes: 0, strings: [], hints: [] };
    for (const text of [stdout, stderr]) {
        if (!text) continue;
        if (/^[ \t\r\n]*[\[{]/.test(text)) semanticStrings(text, state, maximumBytes);
        else {
            if (state.strings.length >= LOG_LIMITS.parts) return fail();
            state.bytes += Buffer.byteLength(text, "utf8"); if (state.bytes > maximumBytes) return fail();
            state.strings.push(text);
        }
    }
    return Object.freeze(state.strings);
}

/** Raw strings exist only in private local analysis views. No filesystem,
 * references, project configuration, imports, builds or network are executed. */
export function logContentViews(relativePath: string, text: string): Readonly<LogContentResult> {
    let kind: LogContentResult["kind"] = "TEXT";
    try {
        if (typeof relativePath !== "string" || typeof text !== "string") return fail();
        kind = /\.(?:jsonl|ndjson)$/i.test(relativePath) ? "JSONL"
            : /\.json$/i.test(relativePath) || /^[ \t\r\n]*[\[{]/.test(text) ? "JSON" : "TEXT";
        publicationRelativePath(relativePath); if (containsRawSecret(relativePath)) return fail(); validText(text);
        const state: State = { nodes: 0, bytes: 0, strings: [], hints: [] };
        if (kind === "TEXT") state.strings.push(text);
        else if (kind === "JSON") semanticStrings(text, state);
        else {
            let records = 0;
            for (const line of text.split("\n")) {
                if (/^[ \t\r]*$/.test(line)) continue;
                if (++records > LOG_LIMITS.records) return fail(); semanticStrings(line, state);
            }
        }
        const views = Object.freeze(state.strings.map((value, index) => Object.freeze({
            relativePath: relativePath + (kind === "TEXT" ? "/text.txt" : "/value-" + index + ".txt"), text: value, language: "text" as const,
            ...(state.hints[index] ? { credentialName: state.hints[index] } : {}),
        })));
        return Object.freeze({ status: "ANALYZED", kind, views });
    } catch { return Object.freeze({ status: "WITHHELD", kind, reason: "saved_log_content_withheld", views: Object.freeze([]) }); }
}
