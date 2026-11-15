import { parse } from "@babel/parser";
import { VAULT_APP_ARTIFACT_LIMITS, vaultArtifactSpecifier } from "../../../core/src/VaultAppArtifact";

const fail = (): never => { throw Error("Managed application artifact unavailable. Use static CommonJS imports and supported runtime operations."); };
interface Ast { type: string; [key: string]: unknown }
const node = (value: unknown): Ast | undefined => value && typeof value === "object" && typeof (value as Ast).type === "string" ? value as Ast : undefined;
const identifier = (value: unknown, name: string): boolean => node(value)?.type === "Identifier" && node(value)?.name === name;
const propertyName = (value: unknown): string | undefined => {
    const n = node(value); return n?.type === "Identifier" && typeof n.name === "string" ? n.name
        : n?.type === "StringLiteral" && typeof n.value === "string" ? n.value : undefined;
};

/** Fixed grammar, never executes project code or consults package/config files.
 * Only direct literal require calls are supported; no filesystem resolver runs.
 * This is a dependency contract, not a sandbox for hostile approved JavaScript. */
export function artifactImports(source: string): readonly string[] {
    try {
        if (typeof source !== "string" || Buffer.byteLength(source) > VAULT_APP_ARTIFACT_LIMITS.fileBytes) return fail();
        const tree = parse(source, { sourceType: "commonjs", errorRecovery: false, createImportExpressions: true });
        const pending: Array<{ value: Ast; parent?: Ast; key?: string }> = [{ value: tree as unknown as Ast }];
        const imports = new Set<string>(); let work = 0;
        while (pending.length) {
            if (++work > VAULT_APP_ARTIFACT_LIMITS.astNodes) return fail();
            const { value: n, parent, key } = pending.pop()!;
            if (n.type.startsWith("Import") || n.type.startsWith("Export") || n.type === "WithStatement") return fail();
            if (n.type === "Identifier" && n.name === "require") {
                // Reject aliasing, require.resolve/cache/extensions, reassignment,
                // shadowed require bindings, optional calls and reflective access.
                if (parent?.type !== "CallExpression" || key !== "callee" || parent.optional) return fail();
                const args = parent.arguments as unknown[], argument = args?.length === 1 ? node(args[0]) : undefined;
                if (argument?.type !== "StringLiteral" || typeof argument.value !== "string") return fail();
                imports.add(vaultArtifactSpecifier(argument.value));
                if (imports.size > VAULT_APP_ARTIFACT_LIMITS.imports) return fail();
            }
            if (n.type === "Identifier" && ["eval", "Function", "WebAssembly"].includes(String(n.name))) return fail();
            if (n.type === "MemberExpression" || n.type === "OptionalMemberExpression") {
                const property = propertyName(n.property);
                // Normal exports and documented process output/env APIs remain
                // available. Alternate loaders and code-generation primitives do not.
                if (property && ["require", "_compile", "_load", "createRequire", "mainModule", "getBuiltinModule", "binding", "dlopen", "constructor"].includes(property)) return fail();
                if (identifier(n.object, "module") && (n.computed || property !== "exports")) return fail();
                if (identifier(n.object, "process") && (n.computed || !["env", "stdout", "stderr", "argv", "exitCode", "nextTick", "hrtime", "uptime", "version", "versions", "platform", "arch"].includes(property ?? ""))) return fail();
                if (identifier(n.object, "global") || identifier(n.object, "globalThis")) return fail();
            }
            for (const [field, value] of Object.entries(n)) {
                if (["loc", "extra", "comments", "leadingComments", "trailingComments", "innerComments", "tokens", "errors"].includes(field)) continue;
                if (Array.isArray(value)) {
                    for (const item of value) { const child = node(item); if (child) pending.push({ value: child, parent: n, key: field }); }
                } else { const child = node(value); if (child) pending.push({ value: child, parent: n, key: field }); }
            }
        }
        return Object.freeze([...imports].sort());
    } catch { return fail(); }
}
