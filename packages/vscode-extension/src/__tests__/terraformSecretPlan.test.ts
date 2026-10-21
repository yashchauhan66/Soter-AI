import { test } from "node:test";
import assert from "node:assert/strict";
const VALUE = "TEST_ONLY_F22C_PRIVATE_862da714", GENERATION = "23000000-0000-4000-8000-000000000003";
async function module() { const m = await import("../config-scanners/TerraformSecretPlan"); assert.equal(typeof m.createTerraformSecretPlan, "function"); return m; }
async function plan(text: string, format = "terraform", generation = GENERATION) { return (await module()).createTerraformSecretPlan(text, format as never, generation); }
const safeError = (e: unknown) => !String(e).includes(VALUE);

test("F22c maps only saved Terraform/tfvars native and JSON paths with bounded canonical relatives", async () => {
    const { terraformFormatForPath } = await module();
    for (const [name, format] of [["infra/main.tf", "terraform"], ["PROD.TFVARS", "tfvars"], ["main.tf.json", "terraform-json"], ["prod.auto.tfvars.JSON", "tfvars-json"]]) assert.equal(terraformFormatForPath(name), format);
    for (const name of ["state.tfstate", "main.tf.bak", "config.hcl", "a.json", "main.tf.json.backup"]) assert.equal(terraformFormatForPath(name), undefined);
    for (const name of ["../main.tf", "/main.tf", "C:/a.tf", "a\\b.tfvars", "a//b.tf"]) assert.throws(() => terraformFormatForPath(name), safeError);
});

test("F22c provider and nested resource literal credentials preserve public schema without executing it", async () => {
    const text = 'provider "synthetic" {\n  api_key = "' + VALUE + '"\n  region = "public-region"\n}\nresource "synthetic_db" "main" {\n  password = "' + VALUE + '-password"\n  settings {\n    token = "' + VALUE + '-nested"\n    MONKEY = "banana"\n    port = 3000\n  }\n}\n';
    const result = await plan(text); assert.equal(result.candidates.length, 3); assert.equal(result.restoreMode, "checkpoint"); assert.equal(result.exampleText, ""); assert(!result.maskedText.includes(VALUE)); assert.match(result.maskedText, /public-region/); assert.match(result.maskedText, /MONKEY = "banana"/); assert.match(result.maskedText, /port = 3000/);
    for (const c of result.candidates) { assert.equal(text.slice(c.start, c.end), c.replacementText); assert.match(c.placeholder, /^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/); }
});

test("F22c declared variable defaults and output values inherit credential ownership; nested lists and maps are static", async () => {
    const text = 'variable "db_password" {\n type = string\n sensitive = true\n default = "' + VALUE + '-default"\n}\noutput "api_token" { value = "' + VALUE + '-output" }\nlocals {\n credentials = { first = "' + VALUE + '-map", others = ["' + VALUE + '-list"] }\n monkey = "banana"\n}\n';
    const result = await plan(text); assert.equal(result.candidates.length, 4); assert(!result.maskedText.includes(VALUE)); assert.match(result.maskedText, /type = string/); assert.match(result.maskedText, /sensitive = true/);
});

test("F22c static and indented heredocs plus actual comments are logical privately and restore through exact checkpoint", async () => {
    const text = '# API_KEY=' + VALUE + '-comment\npassword = <<EOT\nfirst\n' + VALUE + '-plain\nEOT\nprivate_key = <<-KEY\n    line\n      ' + VALUE + '-indent\n    KEY\nport = 3000\n';
    const result = await plan(text, "tfvars"); assert.equal(result.candidates.length, 3); assert(result.candidates.some(c => c.rawValue === "first\n" + VALUE + "-plain\n")); assert(result.candidates.some(c => c.rawValue === "line\n  " + VALUE + "-indent\n")); assert(!result.maskedText.includes(VALUE)); assert.match(result.maskedText, /port = 3000/); assert.equal(result.restoreMode, "checkpoint");
});

test("F22c quoted HCL escapes differ from JSON and Unicode code points are decoded without templates", async () => {
    const result = await plan('password = "first\\n' + VALUE + '\\u0021\\U0001F642"\n', "tfvars"); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].rawValue, "first\n" + VALUE + "!🙂"); assert(!result.maskedText.includes(VALUE));
    const publicControl = await plan('greeting = "literal $${var.name} and %%{if public}"\nMONKEY = "banana"\n', "tfvars"); assert.equal(publicControl.candidates.length, 0);
    await assert.rejects(plan('password = "bad\\b' + VALUE + '"\n', "tfvars"), safeError);
});

test("F22c interpolation, fallback literals, directives, calls and operators withhold without evaluation or partial output", async () => {
    await module();
    for (const text of ['password = "${var.password}"\n', 'password = "${var.password}-' + VALUE + '"\n', 'password = "%{if true}' + VALUE + '%{endif}"\n', 'password = file("synthetic-no-read")\n', 'password = "' + VALUE + '" + "suffix"\n', 'password = [for x in var.items : x]\n']) await assert.rejects(plan(text, "tfvars"), safeError);
});

test("F22c strict Terraform JSON and tfvars JSON retain structure, public values and canonical markers", async () => {
    const native = { provider: { synthetic: { api_key: VALUE, region: "public-region" } }, variable: { password: { type: "string", default: VALUE + "-default", sensitive: true } } }, text = JSON.stringify(native);
    const result = await plan(text, "terraform-json"); assert.equal(result.candidates.length, 2); assert(!result.maskedText.includes(VALUE)); assert.equal(JSON.parse(result.maskedText).provider.synthetic.region, "public-region"); assert.equal(result.restoreMode, "checkpoint");
    const vars = await plan(JSON.stringify({ password: VALUE, configuration: { token: VALUE + "-nested", port: 3000 }, MONKEY: "banana" }), "tfvars-json"); assert.equal(vars.candidates.length, 2); assert.equal(JSON.parse(vars.maskedText).MONKEY, "banana");
});

test("F22c duplicate keys, malformed native/JSON, foreign top blocks and invalid heredocs withhold", async () => {
    await module();
    for (const text of ['password = "' + VALUE + '"\npassword = "duplicate"\n', 'password = "unterminated\n', 'password = <<EOF\n' + VALUE + '\n', 'password = <<-EOF\n\t' + VALUE + '\nEOF\n', 'password = { token = "' + VALUE + '"\n token = "duplicate" }\n']) await assert.rejects(plan(text, "tfvars"), safeError);
    for (const text of ['{"password":"' + VALUE + '","password":"duplicate"}', '{"password":"' + VALUE + '",}', '{/* comment */ "password":"' + VALUE + '"}', '["' + VALUE + '"]', '{"password": "${var.value}"}']) await assert.rejects(plan(text, "tfvars-json"), safeError);
    await assert.rejects(plan('foreign "scope" { password = "' + VALUE + '" }\n'), safeError); await assert.rejects(plan('variable "name" {}\n', "tfvars"), safeError);
});

test("F22c protected placeholders, public near-matches and declared secret-store references remain useful", async () => {
    const text = 'password = var.password\ntoken = local.runtime_token\nMONKEY = "banana"\nPORT = 3000\nEMPTY = null\nAPI_KEY = "YOUR_API_KEY"\nSECRET = "[SOTERAI_PROTECTED_EXISTING]"\nSTRIPE_PUBLISHABLE_KEY = "pk_test_F22CPUBLICONLY123456"\n';
    const result = await plan(text, "tfvars"); assert.equal(result.candidates.length, 0); assert.equal(result.maskedText, text);
});

test("F22c candidate, text, nesting, UTF8 and generation limits withhold with value-free errors", async () => {
    await module(); for (const text of ['password = "' + VALUE + '\0"', 'password = "\ud800"', 'x'.repeat(65537), 'a = '.repeat(130)]) await assert.rejects(plan(text, "tfvars"), safeError);
    await assert.rejects(plan(Array.from({ length: 129 }, (_, i) => 'password_' + i + ' = "' + VALUE + '-' + i + '"').join("\n"), "tfvars"), safeError);
    await assert.rejects(plan('public = ' + '['.repeat(70) + '"public"' + ']'.repeat(70), "tfvars"), safeError); await assert.rejects(plan('password = "' + VALUE + '"', "tfvars", "invalid-generation"), safeError);
});

test("F22c residual original copies, credential numeric ambiguity and known-shaped labels withhold", async () => {
    await module(); await assert.rejects(plan('password = "' + VALUE + '"\n# unstructured ' + VALUE + '\n', "tfvars"), safeError); await assert.rejects(plan('password = 123456\n', "tfvars"), safeError);
    await assert.rejects(plan('resource "AKIAABCDEFGHIJKLMNOP" "main" {}\n'), safeError);
});

test("F22c masked output reparses idempotently and never invokes a function or config loader", async () => {
    const text = 'password = "' + VALUE + '"\n// TOKEN=' + VALUE + '-comment\n'; const result = await plan(text, "tfvars"); assert.equal(result.candidates.length, 2); assert.equal((await plan(result.maskedText, "tfvars")).candidates.length, 0); assert.equal(result.restoreMode, "checkpoint");
    const globalKey = "F22C_SYNTHETIC_EXECUTION_SENTINEL"; (globalThis as any)[globalKey] = 0; await assert.rejects(plan('password = synthetic_function("' + VALUE + '")\n', "tfvars"), safeError); assert.equal((globalThis as any)[globalKey], 0); delete (globalThis as any)[globalKey];
});

test("F22c deterministic JSON literal corpus preserves independent JSON structure across escapes and nested public controls", async () => {
    const variants = ['plain', 'quoted "text"', 'slash\\path', 'line\nsecond', 'Unicode-🙂', 'tab\ttext'];
    for (let i = 0; i < 72; i++) {
        const value = VALUE + '-' + i + '-' + variants[i % variants.length], input = { password: value, settings: { PORT: 3000 + i, MONKEY: "banana", enabled: true, nothing: null }, list: ["public", i] }, text = JSON.stringify(input, null, i % 2 ? 2 : undefined), result = await plan(text, "tfvars-json");
        assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].rawValue, value); const masked = JSON.parse(result.maskedText); assert.deepEqual(masked.settings, input.settings); assert.deepEqual(masked.list, input.list); assert.equal(masked.password, result.candidates[0].placeholder); assert.equal((await plan(result.maskedText, "tfvars-json")).candidates.length, 0);
    }
});

test("F22c CRLF heredoc checkpoints preserve exact original ranges and string URL syntax never becomes a comment", async () => {
    const text = 'password = <<EOF\r\nfirst\r\n' + VALUE + '\r\nEOF\r\nurl = "https://example.invalid/public"\r\n/* TOKEN=' + VALUE + '-comment */\r\n';
    const result = await plan(text, "tfvars"); assert.equal(result.candidates.length, 2); assert.equal(result.candidates[0].rawValue, 'first\n' + VALUE + '\n'); assert.match(result.maskedText, /url = "https:\/\/example\.invalid\/public"/); for (const candidate of result.candidates) assert.equal(text.slice(candidate.start, candidate.end), candidate.replacementText); assert.equal(result.restoreMode, "checkpoint");
});
