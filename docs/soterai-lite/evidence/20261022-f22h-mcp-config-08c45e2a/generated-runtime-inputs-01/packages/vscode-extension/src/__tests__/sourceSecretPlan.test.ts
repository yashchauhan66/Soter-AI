import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "@babel/parser";
const VALUE = "TEST_ONLY_F22A_PRIVATE_73e94c06", GENERATION = "22000000-0000-4000-8000-000000000001", TOKEN = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
async function plan(text: string, syntax = "js", generation = GENERATION) { const m = await import("../config-scanners/SourceSecretPlan"); return m.createSourceSecretPlan(text, syntax as never, generation); }
function restore(text: string, candidates: Array<{ placeholder: string; replacementText: string }>) { for (const c of candidates) text = text.split(c.placeholder).join(c.replacementText); return text; }
const safeError = (e: unknown) => !String(e).includes(VALUE) && !String(e).includes(TOKEN);

test("F22a syntax mapping admits only declared local relative source formats", async () => {
    const { sourceSyntaxForPath } = await import("../config-scanners/SourceSecretPlan");
    for (const [source, syntax] of [["src/a.js", "js"], ["app/a.JSX", "jsx"], ["a.ts", "ts"], ["a.tsx", "tsx"], ["a.mjs", "mjs"], ["a.cjs", "cjs"]]) assert.equal(sourceSyntaxForPath(source), syntax);
    for (const source of ["a.py", "a.json", "a.yaml", "a.ts.txt"]) assert.equal(sourceSyntaxForPath(source), undefined);
    for (const source of ["../a.js", "C:/a.js", "a\\b.js", "a.js\n"]) assert.throws(() => sourceSyntaxForPath(source), safeError);
});
test("F22a parses literal declarations/properties/member assignments and preserves public code", async () => {
    const text = 'const apiKey = "' + VALUE + '";\nconst c = { service_token: "' + VALUE + '-2" };\nc.password = "' + VALUE + '-3";\nconst PORT="3000"; const MONKEY="banana";';
    const result = await plan(text); assert.equal(result.candidates.length, 3); assert.equal(result.exampleText, ""); assert(!result.maskedText.includes(VALUE)); assert.match(result.maskedText, /MONKEY="banana"/); parse(result.maskedText); assert.equal(restore(result.maskedText, result.candidates), text);
});
test("F22a TS annotations and JSX attribute literals use the matching fixed parser syntax", async () => {
    for (const [syntax, text] of [["ts", 'const apiKey: string = "' + VALUE + '";'], ["tsx", 'const View = () => <Client apiKey="' + VALUE + '" />;'], ["jsx", 'const View = () => <Client token="' + VALUE + '" />;']]) {
        const result = await plan(text, syntax); assert.equal(result.candidates.length, 1); assert(!result.maskedText.includes(VALUE)); assert.equal(restore(result.maskedText, result.candidates), text); parse(result.maskedText, { plugins: syntax === "ts" ? ["typescript"] : syntax === "tsx" ? ["typescript", "jsx"] : ["jsx"] });
    }
});
test("F22a standalone provider strings are detected while imports, regex literals and public templates remain", async () => {
    const text = 'import lib from "public-module";\nconst entries=["' + TOKEN + '"];\nconst API_KEY="YOUR_API_KEY_HERE"; const STRIPE_PUBLISHABLE_KEY="pk_test_F22PUBLICONLY123456"; const regex=/API_KEY=PUBLIC_PATTERN/;';
    const result = await plan(text, "mjs"); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].rawValue, TOKEN); assert.match(result.maskedText, /YOUR_API_KEY_HERE/); assert.match(result.maskedText, /pk_test_F22PUBLICONLY/); assert.equal(restore(result.maskedText, result.candidates), text);
});
test("F22a decoded escaped logical values preserve exact source representation for disclosure restore", async () => {
    const text = 'const password = "first\\n' + VALUE + '\\u0021";'; const result = await plan(text); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].rawValue, "first\n" + VALUE + "!"); assert.equal(result.candidates[0].replacementText, "first\\n" + VALUE + "\\u0021"); parse(result.maskedText); assert.equal(restore(result.maskedText, result.candidates), text);
});
test("F22a no-substitution multiline templates and canonical comment candidates round trip", async () => {
    const text = 'const secret = `first\n' + VALUE + '\nlast`;\n// API_KEY=' + VALUE + '-comment\n// public guide API_KEY=YOUR_API_KEY_HERE\n'; const result = await plan(text); assert.equal(result.candidates.length, 2); assert(!result.maskedText.includes(VALUE)); parse(result.maskedText); assert.equal(restore(result.maskedText, result.candidates), text);
});
test("F22a malformed and secret-bearing interpolated source refuses with generic errors and no execution", async () => {
    (globalThis as any).__f22executed = false;
    await assert.rejects(plan('const apiKey = "' + VALUE + '"; const ='), safeError);
    await assert.rejects(plan('const apiKey = `' + VALUE + '${suffix}`;'), safeError);
    const publicCode = 'globalThis.__f22executed = true; const PORT = "3000";'; const result = await plan(publicCode); assert.equal(result.candidates.length, 0); assert.equal((globalThis as any).__f22executed, false); delete (globalThis as any).__f22executed;
});
test("F22a bounded input, syntax/generation, candidate and AST work budgets refuse safely", async () => {
    const { createSourceSecretPlan } = await import("../config-scanners/SourceSecretPlan"); assert.equal(typeof createSourceSecretPlan, "function");
    for (const [text, syntax, generation] of [["P".repeat(65537), "js", GENERATION], ["const x=\0;", "js", GENERATION], ["const x='\ud800';", "js", GENERATION], ["const x=1;", "python", GENERATION], ["const x=1;", "js", "invalid"]]) await assert.rejects(plan(text, syntax, generation), safeError);
    await assert.rejects(plan(Array.from({ length: 129 }, (_, i) => 'const API_KEY_' + i + '="' + VALUE + i + '";').join("\n")), safeError);
});
test("F22a a remaining original in an unselected source span withholds migration", async () => {
    const { createSourceSecretPlan } = await import("../config-scanners/SourceSecretPlan"); assert.equal(typeof createSourceSecretPlan, "function");
    await assert.rejects(plan('const API_KEY="' + VALUE + '";\n// duplicate raw original: ' + VALUE + '\n'), safeError);
});

test("F22a source ownership handles transparent TS wrappers and fallback literals without borrowing unrelated names", async () => {
    const text = 'const apiKey = ("' + VALUE + '" as string)!; const config = { password: process.env.PASSWORD || "' + VALUE + '-fallback" }; const makeConfig = () => "public literal";';
    const result = await plan(text, "ts"); assert.equal(result.candidates.length, 2); assert.match(result.maskedText, /public literal/); assert.equal(restore(result.maskedText, result.candidates), text);
});
test("F22a unsupported computed credentials and invalid cooked strings withhold with no raw error", async () => {
    const { createSourceSecretPlan } = await import("../config-scanners/SourceSecretPlan"); assert.equal(typeof createSourceSecretPlan, "function");
    for (const text of ['const apiKey = "' + VALUE + '" + suffix;', 'const apiKey = getCredential("' + VALUE + '");', 'const password = "\\uD800";', 'const password = "\\x00";', 'const password = tag`' + VALUE + '`;']) await assert.rejects(plan(text), safeError);
});
test("F22a comments and repeated selected values retain independent exact source positions", async () => {
    const text = '/*\nAPI_KEY=' + VALUE + '\n*/\nconst password="' + VALUE + '"; const token="' + VALUE + '";';
    const result = await plan(text); assert.equal(result.candidates.length, 3); assert.equal(new Set(result.candidates.map(c => c.placeholder)).size, 3); assert.equal(restore(result.maskedText, result.candidates), text); parse(result.maskedText);
});
test("F22a masked source is valid and idempotent, exact original returns only through private restore plan", async () => {
    const text = 'const credentials = { apiKey: "' + VALUE + '", port: "3000" };\n'; const first = await plan(text), second = await plan(first.maskedText); assert.equal(first.candidates.length, 1); assert.equal(second.candidates.length, 0); assert.equal(second.maskedText, first.maskedText); assert.equal(restore(first.maskedText, first.candidates), text);
    for (const c of first.candidates) { assert.equal(text.slice(c.start, c.end), c.replacementText); assert.match(c.placeholder, /^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/); }
});

test("F22a standalone credentials inside tagged templates are explicitly unsupported", async () => {
    const { createSourceSecretPlan } = await import("../config-scanners/SourceSecretPlan"); assert.equal(typeof createSourceSecretPlan, "function");
    await assert.rejects(plan('const text = tag`' + TOKEN + '`;'), safeError);
});
test("F22a AST budget and non-source relative paths refuse without parser diagnostics", async () => {
    const { createSourceSecretPlan, sourceSyntaxForPath } = await import("../config-scanners/SourceSecretPlan"); assert.equal(typeof createSourceSecretPlan, "function");
    await assert.rejects(plan('const a=[' + '0,'.repeat(16500) + '];'), safeError);
    for (const relative of ["/a.js", "a//b.ts", "./a.ts", "a/../b.ts", "a/./b.ts", "a/" + "P".repeat(2049) + ".ts"]) assert.throws(() => sourceSyntaxForPath(relative), safeError);
});
