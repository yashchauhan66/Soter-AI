import { parse, type ParserOptions } from "@babel/parser";
import { applyPlaceholders, classifySecretType, extractVaultCandidates } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { hygieneCredentialName, isHygieneCandidate } from "../hygiene/HygieneCandidatePolicy";
import type { PrivateVaultCandidate, PrivateVaultPlan } from "../firewall/VaultMigrationPlan";

export type SourceSyntax = "js" | "jsx" | "ts" | "tsx" | "mjs" | "cjs";
const SYNTAXES = ["js", "jsx", "ts", "tsx", "mjs", "cjs"] as const;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = (): never => { throw Error("Source syntax, expression or size is unsupported; existing files are preserved."); };
interface Ast { type: string; start?: number | null; end?: number | null; [key: string]: unknown }
const ast = (value: unknown): Ast | undefined => value && typeof value === "object" && typeof (value as Ast).type === "string" ? value as Ast : undefined;
function name(value: unknown): string {
    const n = ast(value), result = n?.type === "Identifier" || n?.type === "JSXIdentifier" ? n.name : n?.type === "StringLiteral" ? n.value : undefined;
    return typeof result === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(result) ? result : "";
}
function assignedName(n: unknown): string {
    const target = ast(n);
    return target?.type === "MemberExpression" || target?.type === "OptionalMemberExpression" ? name(target.property) : name(target);
}
function environmentReference(n: Ast): boolean {
    const object = ast(n.object), base = ast(object?.object);
    return n.type === "MemberExpression" && !n.computed && !!name(n.property) && object?.type === "MemberExpression" && !object.computed
        && name(object.property) === "env" && base?.type === "Identifier" && base.name === "process";
}
export function sourceSyntaxForPath(relative: string): SourceSyntax | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative)
        || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) return fail();
    const extension = relative.slice(relative.lastIndexOf(".") + 1).toLowerCase();
    return SYNTAXES.includes(extension as SourceSyntax) ? extension as SourceSyntax : undefined;
}
function options(syntax: SourceSyntax): ParserOptions {
    return { sourceType: syntax === "mjs" ? "module" : syntax === "cjs" ? "commonjs" : "unambiguous", errorRecovery: false,
        plugins: syntax === "ts" ? ["typescript"] : syntax === "tsx" ? ["typescript", "jsx"] : syntax === "jsx" ? ["jsx"] : [] };
}

/** Parse only, with fixed grammar and no project config, imports or evaluation.
 * This private plan contains original values solely for canonical encrypted custody. */
export function createSourceSecretPlan(text: string, syntax: SourceSyntax, generation: string): PrivateVaultPlan {
    try {
        if (!SYNTAXES.includes(syntax) || typeof generation !== "string" || !UUID.test(generation)) return fail();
        new SecureEditorModel(text, false);
        const tree = parse(text, options(syntax)), candidates: PrivateVaultCandidate[] = [];
        const add = (key: string, rawValue: string, start: number, end: number) => {
            new SecureEditorModel(rawValue, false);
            if (!isHygieneCandidate(key, rawValue)) return;
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length || candidates.length >= 128) return fail();
            candidates.push({ key: key || "SOURCE_LITERAL", rawValue, start, end, type: classifySecretType(key, rawValue), placeholder: "", replacementText: text.slice(start, end) });
        };
        const pending: Array<{ node: Ast; hint: string }> = [{ node: tree as unknown as Ast, hint: "" }];
        let work = 0;
        while (pending.length) {
            if (++work > 16384) return fail();
            const { node: n, hint } = pending.pop()!;
            if (n.type === "TaggedTemplateExpression") {
                const template = ast(n.quasi), quasis = template?.quasis as Ast[] | undefined;
                if (hygieneCredentialName(hint) || quasis?.some(q => {
                    const v = q.value as { cooked?: unknown; raw?: unknown };
                    return typeof v?.cooked === "string" && isHygieneCandidate("", v.cooked) || typeof v?.raw === "string" && isHygieneCandidate("", v.raw);
                })) return fail();
            }
            if (n.type === "StringLiteral" || n.type === "DirectiveLiteral") {
                if (typeof n.value !== "string" || !Number.isInteger(n.start) || !Number.isInteger(n.end)) return fail();
                add(hint, n.value, n.start! + 1, n.end! - 1); continue;
            }
            if (n.type === "TemplateLiteral") {
                const quasis = n.quasis as Ast[], expressions = n.expressions as Ast[];
                if (!Array.isArray(quasis) || !Array.isArray(expressions)) return fail();
                if (expressions.length) {
                    if (hygieneCredentialName(hint) || quasis.some(q => {
                        const v = q.value as { cooked?: unknown; raw?: unknown };
                        return typeof v?.cooked === "string" && isHygieneCandidate("", v.cooked) || typeof v?.raw === "string" && isHygieneCandidate("", v.raw);
                    })) return fail();
                } else {
                    const cooked = (quasis[0]?.value as { cooked?: unknown })?.cooked;
                    if (typeof cooked !== "string") return fail();
                    add(hint, cooked, n.start! + 1, n.end! - 1); continue;
                }
            }
            // Credential ownership passes only through fixed transparent forms.
            if (hygieneCredentialName(hint) && !["ObjectExpression", "ArrayExpression", "LogicalExpression", "ParenthesizedExpression", "TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSSatisfiesExpression", "JSXExpressionContainer", "NullLiteral", "NumericLiteral", "BooleanLiteral"].includes(n.type)
                && !environmentReference(n)) return fail();
            for (const [field, value] of Object.entries(n)) {
                if (["loc", "extra", "comments", "leadingComments", "trailingComments", "innerComments", "tokens", "errors"].includes(field)) continue;
                // Property names, import/export specifiers and type declarations are not values.
                if ((["ObjectProperty", "ObjectMethod", "ClassProperty", "ClassMethod", "ClassPrivateProperty", "ClassPrivateMethod"].includes(n.type) && field === "key")
                    || (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(n.type) && field === "source")
                    || field === "typeAnnotation" || field === "typeParameters" || field === "typeArguments" || n.type.startsWith("TS") && !["TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSSatisfiesExpression"].includes(n.type)) continue;
                let childHint = "";
                if (n.type === "VariableDeclarator" && field === "init") childHint = name(n.id);
                else if ((n.type === "ObjectProperty" || n.type === "ClassProperty" || n.type === "ClassPrivateProperty") && field === "value") childHint = name(n.key);
                else if ((n.type === "AssignmentExpression" || n.type === "AssignmentPattern") && field === "right") childHint = assignedName(n.left);
                else if (n.type === "JSXAttribute" && field === "value") childHint = name(n.name);
                else if ((["ParenthesizedExpression", "TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSSatisfiesExpression", "JSXExpressionContainer"].includes(n.type) && field === "expression")
                    || n.type === "LogicalExpression" && (field === "left" || field === "right") || n.type === "ArrayExpression" && field === "elements") childHint = hint;
                for (const child of Array.isArray(value) ? value : [value]) { const next = ast(child); if (next) pending.push({ node: next, hint: childHint }); }
            }
        }
        for (const comment of tree.comments ?? []) {
            if (typeof comment.value !== "string" || typeof comment.start !== "number") return fail();
            for (const c of extractVaultCandidates(comment.value)) add(c.key, c.rawValue, comment.start + 2 + c.start, comment.start + 2 + c.end);
        }
        candidates.sort((a, b) => a.start - b.start);
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (i && c.start < candidates[i - 1].end) return fail();
            c.placeholder = `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${i}]`;
            if (text.includes(c.placeholder)) return fail();
        }
        const maskedText = applyPlaceholders(text, candidates);
        if (candidates.some(c => maskedText.includes(c.rawValue) || maskedText.includes(c.replacementText))) return fail();
        new SecureEditorModel(maskedText, false); parse(maskedText, options(syntax));
        return { maskedText, exampleText: "", candidates };
    } catch { return fail(); }
}
