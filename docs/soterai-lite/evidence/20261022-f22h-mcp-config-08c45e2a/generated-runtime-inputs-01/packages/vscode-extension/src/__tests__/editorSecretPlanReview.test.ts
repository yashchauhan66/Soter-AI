import { test } from "node:test";
import assert from "node:assert/strict";

const VALUE = "TEST_ONLY_F22G_REVIEW_PRIVATE_52d8b1a7";
const GENERATION = "27000000-0000-4000-8000-000000000007";
async function plan(text: string) {
    const module = await import("../config-scanners/EditorSecretPlan");
    assert.equal(typeof module.createEditorSecretPlan, "function");
    return module.createEditorSecretPlan(text, "editor-jsonc", GENERATION);
}
const safeError = (error: unknown) => !String(error).includes(VALUE);

test("F22g review canonical credential comments remain safe and idempotent across repeated planning", async () => {
    const text = "// TOKEN=" + VALUE + "-line\r\n{ /* PASSWORD=" + VALUE + "-block */ \"PORT\":3000, // public commentary\r\n}\r\n";
    const first = await plan(text);
    assert.equal(first.candidates.length, 2);
    assert(!first.maskedText.includes(VALUE));
    assert.match(first.maskedText, /\"PORT\":3000, \/\/ public commentary\r\n/);
    assert.equal(first.restoreMode, "checkpoint");
    const second = await plan(first.maskedText);
    assert.equal(second.candidates.length, 0);
    assert.equal(second.maskedText, first.maskedText);
    const third = await plan(second.maskedText);
    assert.equal(third.candidates.length, 0);
    assert.equal(third.maskedText, first.maskedText);
    // A recognized command credential with no supported exact comment span
    // still withholds; accepting protected comments must not hide this case.
    await assert.rejects(plan("// public prefix --token " + VALUE + "\n{}"), safeError);
});

test("F22g review actual Authorization fields mask whole values while labels and exact references remain useful", async () => {
    const text = JSON.stringify({
        Authorization: "Basic " + VALUE + "-header",
        "http.proxyAuthorization": "Basic " + VALUE + "-proxy",
        name: "Authorization",
        label: "http.proxyAuthorization",
    });
    const result = await plan(text);
    assert.equal(result.candidates.length, 2);
    assert(result.candidates.some(candidate => candidate.rawValue === "Basic " + VALUE + "-header"));
    assert(result.candidates.some(candidate => candidate.rawValue === "Basic " + VALUE + "-proxy"));
    assert(!result.maskedText.includes(VALUE));
    const masked = JSON.parse(result.maskedText);
    assert.equal(masked.name, "Authorization");
    assert.equal(masked.label, "http.proxyAuthorization");
    assert.equal((await plan(result.maskedText)).candidates.length, 0);
    const references = JSON.stringify({
        Authorization: "${env:AUTHORIZATION}",
        "http.proxyAuthorization": "${input:proxyAuth}",
        name: "Authorization",
        label: "http.proxyAuthorization",
    });
    const controls = await plan(references);
    assert.equal(controls.candidates.length, 0);
    assert.equal(controls.maskedText, references);
});

test("F22g review exact root public token-color maps stay useful without exempting their secret children or env collections", async () => {
    const publicText = JSON.stringify({
        "editor.tokenColorCustomizations": { comments: "#00ff00" },
        "editor.semanticTokenColorCustomizations": { enabled: true, rules: { "variable.readonly": "#00ffff" } },
    });
    const publicPlan = await plan(publicText);
    assert.equal(publicPlan.candidates.length, 0);
    assert.equal(publicPlan.maskedText, publicText);
    const knownShape = "ghp_" + "a".repeat(36);
    const secretPlan = await plan(JSON.stringify({ "editor.tokenColorCustomizations": { comments: knownShape } }));
    assert.equal(secretPlan.candidates.length, 1);
    assert(!secretPlan.maskedText.includes(knownShape));
    assert.equal((await plan(secretPlan.maskedText)).candidates.length, 0);
    await assert.rejects(plan(JSON.stringify({ env: { TOKEN: { nested: VALUE } } })), safeError);
    // These exceptions describe root settings, not arbitrary nested env names.
    await assert.rejects(plan(JSON.stringify({ env: { "editor.tokenColorCustomizations": { comments: "#00ff00" } } })), safeError);
});

test("F22g review every nonstring adjacent credential argument withholds while ordinary null properties remain useful", async () => {
    for (const value of [null, true, 123, { nested: VALUE }, [VALUE]]) {
        await assert.rejects(plan(JSON.stringify({ tasks: [{ command: "node", args: ["app.js", "--token", value] }] })), safeError);
    }
    const publicText = JSON.stringify({ presentation: { optionalPublicValue: null }, tasks: [{ label: "public", command: "node", args: ["app.js"] }] });
    const publicPlan = await plan(publicText);
    assert.equal(publicPlan.candidates.length, 0);
    assert.equal(publicPlan.maskedText, publicText);
});

test("F22g review a canonical comment never hides a separate unsupported credential argument",async()=>{await assert.rejects(plan("/* TOKEN="+VALUE+"\npublic command --token TEST_ONLY_F22G_OTHER_COMMENT_6c1b\n*/\n{}"),safeError)});
