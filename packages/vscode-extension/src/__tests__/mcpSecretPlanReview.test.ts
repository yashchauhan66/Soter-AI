import { test } from "node:test";
import assert from "node:assert/strict";

const VALUE = "TEST_ONLY_F22H_REVIEW_PRIVATE_4e91b8c2";
const GENERATION = "28000000-0000-4000-8000-000000000008";
type Format = "mcp-jsonc" | "mcp-toml";
async function module() {
    const loaded = await import("../config-scanners/McpSecretPlan");
    assert.equal(typeof loaded.createMcpSecretPlan, "function");
    return loaded;
}
async function plan(text: string, format: Format = "mcp-jsonc") {
    return (await module()).createMcpSecretPlan(text, format, GENERATION);
}
const safeError = (error: unknown) => !String(error).includes(VALUE);

test("F22h review prompt-input exceptions require a real root array and remain independent of default/password order", async () => {
    const control = JSON.stringify({ inputs: [{ default: VALUE, password: true, id: "ownerValue", type: "promptString" }] });
    const result = await plan(control);
    assert.equal(result.candidates.length, 1);
    assert(!result.maskedText.includes(VALUE));
    assert.equal(JSON.parse(result.maskedText).inputs[0].password, true);
    assert.equal((await plan(result.maskedText)).candidates.length, 0);
    for (const input of [
        { inputs: { "0": { default: VALUE, password: true } } },
        { inputs: { named: { password: true, default: VALUE } } },
        { inputs: [{ nested: { password: true, default: VALUE } }] },
        { servers: { public: { inputs: [{ password: true, default: VALUE }] } } },
    ]) await assert.rejects(plan(JSON.stringify(input)), safeError);
});

test("F22h review TOML quoted dotted names stay distinct from real dotted paths and nested server tables", async () => {
    const text = '"public.name"="literal"\npublic.name="nested"\n[mcp_servers."group.public"]\nenv.TOKEN="' + VALUE + '"\n[mcp_servers.group.public]\nenv.PORT="3000"\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 1);
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /"public\.name"="literal"/);
    assert.match(result.maskedText, /public\.name="nested"/);
    assert.match(result.maskedText, /\[mcp_servers\."group\.public"\]/);
    assert.match(result.maskedText, /\[mcp_servers\.group\.public\]/);
    assert.match(result.maskedText, /env\.PORT="3000"/);
    assert.equal((await plan(result.maskedText, "mcp-toml")).candidates.length, 0);
});

test("F22h review TOML inline/dotted collisions withhold while implicit parent headers and disjoint inline dotted fields work", async () => {
    const control = '[mcp_servers.public.env]\nTOKEN="' + VALUE + '"\n[mcp_servers.public]\ncommand="node"\npublic_options={a.b="one",a.c="two"}\n';
    const result = await plan(control, "mcp-toml");
    assert.equal(result.candidates.length, 1);
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /public_options=\{a\.b="one",a\.c="two"\}/);
    for (const text of [
        'a.b="one"\na={c="two"}\n',
        'a={b="one"}\na.c="two"\n',
        'a={b={c="one"}}\n[a.b]\nd="two"\n',
        'a={b.c="one",b={d="two"}}\n',
        'a={b={c="one"},b.d="two"}\n',
        '"a"="one"\n"\\u0061"="two"\n',
    ]) await assert.rejects(plan(text, "mcp-toml"), safeError);
});

test("F22h review TOML numeric lexical rules distinguish finite public values from malformed radix prefixes and separators", async () => {
    const control = '[mcp_servers.public]\ncommand="node"\na=0xCA_FE\nb=0o17\nc=0b10\nd=1_000\ne=-12\nf=1.25e+2\n"1.2"="literal"\n1.2="nested"\n';
    const result = await plan(control, "mcp-toml");
    assert.equal(result.candidates.length, 0);
    assert.equal(result.maskedText, control);
    for (const raw of ["0X1", "0O7", "0B1", "01", "1_", "1__0", "0x_1", "1._0", "1e", "+0x1"])
        await assert.rejects(plan('x=' + raw + '\n', "mcp-toml"), safeError);
});

test("F22h review TOML quoted hashes multiline CRLF and basic-string continuations preserve exact private spans", async () => {
    const text = '[mcp_servers.public]\r\ncommand=\'node#literal\'\r\nenv.TOKEN=\'' + VALUE + '#literal\'\r\npublic_note="""line#one\r\nline#two"""\r\nenv.PASSWORD="""TEST_ONLY_F22H_REVIEW_\\\r\n    PRIVATE_4e91b8c2-continuation"""\r\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 2);
    assert(result.candidates.some(candidate => candidate.rawValue === VALUE + "-continuation"));
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /command='node#literal'\r\n/);
    assert.match(result.maskedText, /public_note="""line#one\r\nline#two"""\r\n/);
    for (const candidate of result.candidates) assert.equal(text.slice(candidate.start, candidate.end), candidate.replacementText);
    const second = await plan(result.maskedText, "mcp-toml");
    assert.equal(second.candidates.length, 0);
    assert.equal(second.maskedText, result.maskedText);
});

test("F22h review TOML decoded continuation residuals withhold without treating quoted hashes as comments", async () => {
    await module();
    const text = 'PASSWORD="' + VALUE + '"\ndescription="""prefixTEST_ONLY_F22H_REVIEW_\\\r\n  PRIVATE_4e91b8c2suffix"""\n';
    await assert.rejects(plan(text, "mcp-toml"), safeError);
    const control = 'description="public#literal"\n# ordinary public note\n';
    assert.equal((await plan(control, "mcp-toml")).maskedText, control);
});

test("F22h review exact marker/reference controls never conceal complete known values in decoded property names", async () => {
    const jsonControl = JSON.stringify({ TOKEN: "${TOKEN}", API_KEY: "[SOTERAI_PROTECTED_EXISTING]", public_name: "ordinary" });
    assert.equal((await plan(jsonControl)).maskedText, jsonControl);
    const tomlControl = 'TOKEN="${TOKEN}"\nAPI_KEY="[SOTERAI_PROTECTED_EXISTING]"\npublic_name="ordinary"\n';
    assert.equal((await plan(tomlControl, "mcp-toml")).maskedText, tomlControl);
    for (const name of ["${" + VALUE + "}", "[SOTERAI_PROTECTED_" + VALUE + "]", "prefix" + VALUE + "suffix"]) {
        await assert.rejects(plan(JSON.stringify({ PASSWORD: VALUE, [name]: "public" })), safeError);
        await assert.rejects(plan('PASSWORD="' + VALUE + '"\n' + JSON.stringify(name) + '="public"\n', "mcp-toml"), safeError);
    }
});

test("F22h review TOML reference declarations require exact server paths even when quoted path lookalikes are present", async () => {
    const control = '[mcp_servers.public]\nenv_vars=["TOKEN"]\nenv_http_headers={Authorization="AUTH_TOKEN"}\nbearer_token_env_var="TOKEN"\n';
    assert.equal((await plan(control, "mcp-toml")).maskedText, control);
    const lookalike = '["mcp_servers.public"]\nbearer_token_env_var="' + VALUE + '"\n';
    const result = await plan(lookalike, "mcp-toml");
    assert.equal(result.candidates.length, 1);
    assert(!result.maskedText.includes(VALUE));
    assert.equal((await plan(result.maskedText, "mcp-toml")).candidates.length, 0);
    for (const text of ['[mcp_servers.public]\nenv_vars=[{TOKEN="public"}]\n', '[mcp_servers.public]\nenv_http_headers={Authorization={name="TOKEN"}}\n'])
        await assert.rejects(plan(text, "mcp-toml"), safeError);
});
