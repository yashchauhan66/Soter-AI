import { createScanner, parseTree, ScanError, SyntaxKind, type Node, type ParseError } from "jsonc-parser";
import { parse, type ParserOptions } from "@babel/parser";
import { containsRawSecret, extractVaultCandidates } from "@soterai/guard-core";
import { createSourceSecretPlan, sourceSyntaxForPath, type SourceSyntax } from "../config-scanners/SourceSecretPlan";
import { createVaultMigrationPlan } from "../firewall/VaultMigrationPlan";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { publicationRelativePath } from "../project-privacy/publication/PublicationPaths";

export const ARTIFACT_LIMITS = Object.freeze({ files: 128, fileBytes: 65536, totalBytes: 1048576, milliseconds: 60000,
    mapSources: 128, mapDepth: 64, mapWork: 16384 });
export const ARTIFACT_SCOPE = "Bounded local saved artifacts and copies; keyed possible-exposure metadata only. Source maps and mapping-URL files are withheld from publication. Review exclusion/rebuild and provider rotation manually; originals and past copies remain reachable.";
export interface ArtifactView { readonly source: string; readonly text: string; readonly mode: "text" | "source" }
const GENERATION = "10000000-0000-4000-8000-000000000024";
const fail = (): never => { throw Error("Artifact syntax, path or size is unsupported; exclude the file and review a public rebuild. Existing files are preserved."); };
const syntaxes = new Set<SourceSyntax>(["js", "jsx", "ts", "tsx", "mjs", "cjs"]);
function syntax(relative: string, text: string): SourceSyntax | undefined {
    const selected = sourceSyntaxForPath(relative);
    if (selected) return selected;
    return /^\s*(?:export\b|import\b|(?:const|let|var|function|class)\s|\(\s*\(?[^\r\n]{0,128}=>)/.test(text) ? "js" : undefined;
}
function validate(relative: string, text: string): void {
    publicationRelativePath(relative);
    if (containsRawSecret(relative)) return fail();
    new SecureEditorModel(text, false);
}
function view(relative: string, text: string, selected?: SourceSyntax): ArtifactView {
    new SecureEditorModel(text, false);
    if (selected) remainingSourceLiterals(createSourceSecretPlan(text, selected, GENERATION).maskedText, selected);
    else if (containsRawSecret(createVaultMigrationPlan(text, false, GENERATION).maskedText)) return fail();
    return Object.freeze({ source: relative, text, mode: selected ? "source" : "text" });
}

/** Canonical source analysis intentionally omits import/type/property names.
 * Artifact release must still withhold recognized secrets in those decoded
 * literals. Parse with fixed grammar only; never resolve imports or evaluate. */
function remainingSourceLiterals(text: string, selected: SourceSyntax): void {
    if (containsRawSecret(text)) return fail();
    const options: ParserOptions = { sourceType: selected === "mjs" ? "module" : selected === "cjs" ? "commonjs" : "unambiguous",
        errorRecovery: false, plugins: selected === "ts" ? ["typescript"] : selected === "tsx" ? ["typescript", "jsx"] : selected === "jsx" ? ["jsx"] : [] };
    const tree = parse(text, options), stack: unknown[] = [tree]; let work = 0;
    const mixedMarker = (value: string) => value.includes("[SOTERAI_PROTECTED_") && !/^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/.test(value);
    while (stack.length) {
        const value = stack.pop(); if (!value || typeof value !== "object") continue;
        if (++work > ARTIFACT_LIMITS.mapWork) return fail();
        const node = value as { type?: string; value?: unknown; [key: string]: unknown };
        if (["StringLiteral", "DirectiveLiteral", "JSXText"].includes(node.type ?? "") && typeof node.value === "string"
            && (containsRawSecret(node.value) || mixedMarker(node.value))) return fail();
        if (node.type === "TemplateElement") {
            const cooked = (node.value as { cooked?: unknown })?.cooked;
            if (typeof cooked !== "string" || containsRawSecret(cooked) || mixedMarker(cooked)) return fail();
        }
        if (["CommentLine", "CommentBlock"].includes(node.type ?? "") && typeof node.value === "string"
            && extractVaultCandidates(node.value).some(candidate => mixedMarker(candidate.rawValue))) return fail();
        for (const [key, child] of Object.entries(node)) {
            if (["loc", "extra", "tokens", "errors"].includes(key)) continue;
            if (Array.isArray(child)) stack.push(...child); else if (child && typeof child === "object") stack.push(child);
        }
    }
}

/** Fixed parse-only v3 maps. References are strings, never read or resolved.
 * These raw views are a PRIVATE local analysis input, never a command result. */
function mapViews(relative: string, text: string): readonly ArtifactView[] {
    const scanner = createScanner(text, false); let depth = 0, work = 0;
    for (;;) {
        const token = scanner.scan();
        if (++work > ARTIFACT_LIMITS.mapWork || scanner.getTokenError() !== ScanError.None
            || [SyntaxKind.Unknown, SyntaxKind.LineCommentTrivia, SyntaxKind.BlockCommentTrivia].includes(token)) return fail();
        if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.OpenBracketToken) { if (++depth > ARTIFACT_LIMITS.mapDepth) return fail(); }
        if (token === SyntaxKind.CloseBraceToken || token === SyntaxKind.CloseBracketToken) { if (--depth < 0) return fail(); }
        if (token === SyntaxKind.EOF) break;
    }
    if (depth) return fail();
    const errors: ParseError[] = [], root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
    if (errors.length || !root || root.type !== "object") return fail();
    const stack: Node[] = [root]; work = 0;
    while (stack.length) {
        const node = stack.pop()!; if (++work > ARTIFACT_LIMITS.mapWork) return fail();
        if (node.type === "object") {
            const names = new Set<string>();
            for (const property of node.children ?? []) {
                const key = property.children?.[0];
                if (property.type !== "property" || property.children?.length !== 2 || key?.type !== "string" || names.has(key.value)) return fail();
                names.add(key.value);
            }
        }
        if (node.type === "string") new SecureEditorModel(node.value, false);
        if (node.type === "number" && !Number.isFinite(node.value)) return fail();
        stack.push(...node.children ?? []);
    }
    const fields = new Map((root.children ?? []).map(property => [property.children![0].value as string, property.children![1]]));
    const allowed = new Set(["version", "file", "sourceRoot", "sources", "sourcesContent", "names", "mappings"]);
    if ([...fields.keys()].some(name => !allowed.has(name)) || fields.get("version")?.value !== 3) return fail();
    const sources = fields.get("sources"), contents = fields.get("sourcesContent"), names = fields.get("names"), mappings = fields.get("mappings");
    if (sources?.type !== "array" || contents?.type !== "array" || names?.type !== "array" || mappings?.type !== "string") return fail();
    const sourceRows = sources.children ?? [], contentRows = contents.children ?? [], nameRows = names.children ?? [];
    if (sourceRows.length > ARTIFACT_LIMITS.mapSources || sourceRows.length !== contentRows.length
        || sourceRows.some(row => row.type !== "string") || contentRows.some(row => row.type !== "string" && row.type !== "null")
        || nameRows.some(row => row.type !== "string")
        || ["file", "sourceRoot"].some(name => fields.has(name) && fields.get(name)!.type !== "string")) return fail();
    // Metadata is not part of an embedded source view. A recognized secret in
    // those fields withholds the map rather than reporting a clean result.
    const metadata = [...sourceRows, ...nameRows, mappings, ...["file", "sourceRoot"].flatMap(name => fields.has(name) ? [fields.get(name)!] : [])];
    if (metadata.some(row => containsRawSecret(row.value))) return fail();
    const views: ArtifactView[] = []; let decoded = 0;
    for (let index = 0; index < contentRows.length; index++) {
        const content = contentRows[index]; if (content.type === "null") continue;
        const body = content.value as string;
        decoded += Buffer.byteLength(body); if (decoded > ARTIFACT_LIMITS.totalBytes) return fail();
        const extension = /\.([a-z]+)(?:[?#].*)?$/i.exec(sourceRows[index].value)?.[1].toLowerCase() as SourceSyntax | undefined;
        const selected = extension && syntaxes.has(extension) ? extension : syntax("embedded.txt", body);
        const name = relative + "/embedded-" + index + "." + (selected ?? "txt");
        views.push(view(name, body, selected));
    }
    return Object.freeze(views);
}

export function artifactViews(relative: string, text: string): Readonly<{ kind: "text" | "source-map"; views: readonly ArtifactView[] }> {
    try {
        validate(relative, text);
        if (/sourceMappingURL\s*=\s*data:/i.test(text)) return fail();
        if (/\.map$/i.test(relative) || text.trimStart().startsWith("{") || /"(?:sourcesContent|sections)"\s*:/.test(text)) {
            return Object.freeze({ kind: "source-map", views: mapViews(relative, text) });
        }
        const selected = syntax(relative, text), name = relative + "/body." + (selected ?? "txt");
        return Object.freeze({ kind: "text", views: Object.freeze([view(name, text, selected)]) });
    } catch { return fail(); }
}

/** Deterministic canonical placeholders for a newly reviewed public snapshot.
 * No generated file is edited. Maps/linked maps require explicit exclusion. */
export function artifactPublicationText(relative: string, text: string): string {
    try {
        const parsed = artifactViews(relative, text);
        if (parsed.kind === "source-map" || /sourceMappingURL\s*=/i.test(text)) return fail();
        const selected = syntax(relative, text);
        const result = selected ? createSourceSecretPlan(text, selected, GENERATION).maskedText
            : createVaultMigrationPlan(text, false, GENERATION).maskedText;
        if (selected) remainingSourceLiterals(result, selected);
        else if (containsRawSecret(result)) return fail();
        return result;
    } catch { return fail(); }
}
