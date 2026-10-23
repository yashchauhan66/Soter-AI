import { test } from "node:test";
import assert from "node:assert/strict";

const VALUE = "TEST_ONLY_F22H_PRIVATE_7c2a91e5";
const GENERATION = "28000000-0000-4000-8000-000000000008";
type Format = "mcp-jsonc" | "mcp-toml";
async function mcpModule() {
    const module = await import("../config-scanners/McpSecretPlan");
    assert.equal(typeof module.createMcpSecretPlan, "function");
    assert.equal(typeof module.mcpFormatForPath, "function");
    return module;
}
async function plan(text: string, format: Format = "mcp-jsonc", generation = GENERATION) {
    return (await mcpModule()).createMcpSecretPlan(text, format, generation);
}
const safeError = (error: unknown) => !String(error).includes(VALUE);

test("F22h finite project MCP JSONC/TOML paths and discovery exclude arbitrary settings or configs", async () => {
    const { mcpFormatForPath, MCP_WORKSPACE_GLOBS } = await mcpModule();
    for (const name of [".mcp.json", "mcp.json", "nested/MCP_CONFIG.JSON", "project/cline_mcp_settings.json", "copies/claude_desktop_config.json", ".gemini/settings.json", "nested/.CLAUDE/SETTINGS.JSON", ".claude/settings.local.json"])
        assert.equal(mcpFormatForPath(name), "mcp-jsonc");
    for (const name of ["mcp.toml", "nested/.MCP.TOML", "project/.codex/config.toml"])
        assert.equal(mcpFormatForPath(name), "mcp-toml");
    for (const name of ["settings.json", "config.toml", ".vscode/settings.json", ".gemini/settings.local.json", ".codex/nested/config.toml", "mcp.jsonc", "mcp.yaml", "foreign.json"])
        assert.equal(mcpFormatForPath(name), undefined);
    for (const name of ["../mcp.json", "/mcp.json", "C:/mcp.json", "nested\\mcp.json", "a//mcp.json", "./mcp.toml", "a/../mcp.toml"])
        assert.throws(() => mcpFormatForPath(name), safeError);
    assert(Array.isArray(MCP_WORKSPACE_GLOBS));
    assert(MCP_WORKSPACE_GLOBS.length > 0);
    assert(MCP_WORKSPACE_GLOBS.every((pattern: string) => typeof pattern === "string" && pattern.length > 0 && pattern !== "**/*"));
});

test("F22h JSONC env headers URL and adjacent/inline args yield private whole-string checkpoint candidates", async () => {
    const text = JSON.stringify({ mcpServers: { TOKEN: {
        command: "node", args: ["server.js", "--token", VALUE + "-arg", "--api-key=" + VALUE + "-inline", "--port", "3000"],
        env: { API_KEY: VALUE + "-env", PORT: "3000" }, headers: { Authorization: "Basic " + VALUE + "-header" },
        url: "https://example.invalid/mcp?access_token=" + VALUE + "-url",
    } } });
    const result = await plan(text);
    assert.equal(result.candidates.length, 5);
    assert(!result.maskedText.includes(VALUE));
    assert.equal(result.restoreMode, "checkpoint");
    assert.equal(result.exampleText, "");
    assert(result.candidates.every(candidate => /^(?:MCP_SECRET|MCP_PRIVATE_KEY)$/.test(candidate.key)));
    const masked = JSON.parse(result.maskedText);
    assert.equal(masked.mcpServers.TOKEN.command, "node");
    assert.equal(masked.mcpServers.TOKEN.env.PORT, "3000");
    assert(masked.mcpServers.TOKEN.args.includes("--port"));
    assert.equal((await plan(result.maskedText)).candidates.length, 0);
});

test("F22h JSONC exact server labels public configs and whole finite variable references stay unchanged", async () => {
    const text = '{// public MCP copy\r\n"servers":{"API_KEY":{"command":"node","args":["server.js","--port","3000"],"env":{"TOKEN":"${TOKEN}","API_KEY":"${env:API_KEY}"},"headers":{"Authorization":"${input:ownerToken}"}}},"mcpServers":{"TOKEN":{"url":"${command:extension.endpoint}"}},}\r\n';
    const result = await plan(text);
    assert.equal(result.candidates.length, 0);
    assert.equal(result.maskedText, text);
});

test("F22h JSONC root prompt input password booleans are public while password/credential defaults are private", async () => {
    const text = JSON.stringify({ inputs: [
        { id: "ownerValue", type: "promptString", description: "Owner credential", password: true, default: VALUE + "-password" },
        { id: "API_KEY", type: "promptString", default: VALUE + "-credential" },
        { id: "sourceFile", type: "promptString", password: false, default: "server.js" },
    ], servers: { public: { command: "node", args: ["${input:ownerValue}"] } } });
    const result = await plan(text);
    assert.equal(result.candidates.length, 2);
    assert(!result.maskedText.includes(VALUE));
    const masked = JSON.parse(result.maskedText);
    assert.equal(masked.inputs[0].password, true);
    assert.equal(masked.inputs[2].password, false);
    assert.equal(masked.inputs[2].default, "server.js");
    assert.equal((await plan(result.maskedText)).candidates.length, 0);
});

test("F22h JSONC multiline private-key spans preserve CRLF and exact quoted replacement bytes", async () => {
    const key = "-----BEGIN PRIVATE KEY-----\n" + VALUE + "-pem\n-----END PRIVATE KEY-----";
    const text = '{\r\n"mcpServers":{"public":{"env":{"PRIVATE_KEY":' + JSON.stringify(key) + '},"command":"node"}},\r\n"PORT":3000,\r\n}\r\n';
    const result = await plan(text);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].key, "MCP_PRIVATE_KEY");
    assert.equal(result.candidates[0].rawValue, key);
    for (const candidate of result.candidates) assert.equal(text.slice(candidate.start, candidate.end), candidate.replacementText);
    assert.match(result.maskedText, /\r\n"PORT":3000,\r\n/);
    assert.equal((await plan(result.maskedText)).candidates.length, 0);
});

test("F22h JSONC canonical line/block credential comments remain idempotent without concealing unsupported comment credentials", async () => {
    const text = "// TOKEN=" + VALUE + "-line\r\n{ /* PASSWORD=" + VALUE + "-block */ \"servers\":{}, // public note\r\n}\r\n";
    const result = await plan(text);
    assert.equal(result.candidates.length, 2);
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /public note\r\n/);
    const second = await plan(result.maskedText), third = await plan(second.maskedText);
    assert.equal(second.candidates.length, 0);
    assert.equal(third.candidates.length, 0);
    assert.equal(third.maskedText, result.maskedText);
    await assert.rejects(plan("// public prefix --token " + VALUE + "\n{}"), safeError);
});

test("F22h JSONC duplicate decoded keys malformed syntax and unsupported roots withhold complete plans", async () => {
    await mcpModule();
    for (const text of ['{"TOKEN":"' + VALUE + '","\\u0054OKEN":"other"}', '{"servers":{} "TOKEN":"' + VALUE + '"}', '{"servers":{}} {}', '["public"]', '{"TOKEN":"unterminated', '{/* unterminated', '{"x":NaN}', '{"x":01}'])
        await assert.rejects(plan(text), safeError);
});

test("F22h JSONC structural exceptions never admit credential collections or nonstring adjacent arguments", async () => {
    await mcpModule();
    for (const text of [
        JSON.stringify({ servers: { public: { env: { TOKEN: { nested: VALUE } } } } }),
        JSON.stringify({ env: { password: true } }),
        JSON.stringify({ env: { servers: { TOKEN: { nested: VALUE } } } }),
        ...[null, true, 123, { nested: VALUE }, [VALUE]].map(value => JSON.stringify({ servers: { public: { args: ["--token", value] } } })),
        JSON.stringify({ servers: { public: { args: ["--password"] } } }),
    ]) await assert.rejects(plan(text), safeError);
});

test("F22h TOML Codex tables quoted labels dotted keys inline tables headers URLs and arguments mask whole values", async () => {
    const text = '[mcp_servers."TOKEN"]\ncommand = "node"\nargs = ["server.js", "--token", "' + VALUE + '-arg", "--api-key=' + VALUE + '-inline", "--port", "3000"]\nurl = "https://example.invalid/mcp?access_token=' + VALUE + '-url"\nenv = { API_KEY = \'' + VALUE + '-env\', PORT = "3000" }\nhttp_headers = { Authorization = "Basic ' + VALUE + '-header" }\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 5);
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /command = "node"/);
    assert.match(result.maskedText, /PORT = "3000"/);
    assert.match(result.maskedText, /--port/);
    assert.equal(result.restoreMode, "checkpoint");
    assert.equal(result.exampleText, "");
    assert(result.candidates.every(candidate => /^(?:MCP_SECRET|MCP_PRIVATE_KEY)$/.test(candidate.key)));
    for (const candidate of result.candidates) assert.equal(text.slice(candidate.start, candidate.end), candidate.replacementText);
    assert.equal((await plan(result.maskedText, "mcp-toml")).candidates.length, 0);
});

test("F22h TOML basic literal and multiline strings retain public CRLF bytes and private-key checkpoint spans", async () => {
    const text = '[mcp_servers.public]\r\ncommand = "node"\r\nenv.API_KEY = \'' + VALUE + '-literal\'\r\nenv.PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----\r\n' + VALUE + '-pem\r\n-----END PRIVATE KEY-----"""\r\nPORT = 3000\r\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 2);
    assert(result.candidates.some(candidate => candidate.key === "MCP_PRIVATE_KEY"));
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /\r\nPORT = 3000\r\n/);
    for (const candidate of result.candidates) assert.equal(text.slice(candidate.start, candidate.end), candidate.replacementText);
    const second = await plan(result.maskedText, "mcp-toml");
    assert.equal(second.candidates.length, 0);
    assert.equal(second.maskedText, result.maskedText);
});

test("F22h TOML public controls and exact environment/header bearer references remain unresolved names", async () => {
    const text = '[mcp_servers.public]\ncommand="node"\nargs=["server.js","--port","3000"]\nenabled=true\nretry_count=3\nretry_delay=1.5\nenv_vars=["TOKEN","PUBLIC_NAME"]\nenv_http_headers={Authorization="AUTH_TOKEN"}\nbearer_token_env_var="TOKEN"\nenv.TOKEN="${TOKEN}"\nenv.API_KEY="${env:API_KEY}"\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 0);
    assert.equal(result.maskedText, text);
});

test("F22h TOML duplicates decoded names collisions table redefinitions and unsupported dates/array tables withhold", async () => {
    await mcpModule();
    for (const text of [
        'TOKEN="' + VALUE + '"\n"\\u0054OKEN"="other"\n',
        'x="public"\n[x]\ny="public"\n',
        '[mcp_servers.public]\ncommand="node"\n[mcp_servers.public]\nargs=[]\n',
        '[[mcp_servers.public]]\nTOKEN="' + VALUE + '"\n',
        'created=2026-10-22T00:00:00Z\n', 'x=nan\n', 'x=inf\n', 'TOKEN="unterminated\n', 'x={a="public",a="other"}\n',
    ]) await assert.rejects(plan(text, "mcp-toml"), safeError);
});

test("F22h TOML canonical credential comments mask exact spans and remain idempotent", async () => {
    const text = '# TOKEN=' + VALUE + '-comment\r\n[mcp_servers.public]\r\ncommand="node" # ordinary public note\r\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 1);
    assert(!result.maskedText.includes(VALUE));
    assert.match(result.maskedText, /# ordinary public note\r\n/);
    const second = await plan(result.maskedText, "mcp-toml");
    assert.equal(second.candidates.length, 0);
    assert.equal(second.maskedText, result.maskedText);
    await assert.rejects(plan('# public prefix --token ' + VALUE + '\nPORT=3000\n', "mcp-toml"), safeError);
});

test("F22h mixed unknown expressions unsupported reference collections and nonstring TOML args withhold", async () => {
    await mcpModule();
    for (const raw of ["prefix${TOKEN}" + VALUE, "${TOKEN:-" + VALUE + "}", "${unknown:VALUE}", "prefix[SOTERAI_PROTECTED_EXISTING]" + VALUE]) {
        await assert.rejects(plan(JSON.stringify({ TOKEN: raw })), safeError);
        await assert.rejects(plan('TOKEN=' + JSON.stringify(raw) + '\n', "mcp-toml"), safeError);
    }
    for (const text of ['[mcp_servers.public]\nbearer_token_env_var="not an identifier"\n', '[mcp_servers.public]\nenv_vars=["not an identifier"]\n', '[mcp_servers.public]\nenv_vars=[true]\n', '[mcp_servers.public]\nenv_http_headers={Authorization="not an identifier"}\n', '[mcp_servers.public]\nbearer_token_env_var=["TOKEN"]\n', '[mcp_servers.public]\nargs=["--token",false]\n'])
        await assert.rejects(plan(text, "mcp-toml"), safeError);
});

test("F22h exact structural reference exceptions do not extend into env lookalikes or relax Editor expressions", async () => {
    await mcpModule();
    await assert.rejects(plan(JSON.stringify({ env: { inputs: [{ password: true, default: VALUE }] } })), safeError);
    const knownShape = "ghp_" + "b".repeat(36);
    const text = '[mcp_servers.public.env]\nenv_vars=["' + knownShape + '"]\nenv_http_headers={Authorization="Basic ' + VALUE + '-header"}\nbearer_token_env_var="' + VALUE + '-literal"\n';
    const result = await plan(text, "mcp-toml");
    assert.equal(result.candidates.length, 3);
    assert(!result.maskedText.includes(knownShape));
    assert(!result.maskedText.includes(VALUE));
    assert.equal((await plan(result.maskedText, "mcp-toml")).candidates.length, 0);
    const editor = await import("../config-scanners/EditorSecretPlan");
    assert.throws(() => editor.createEditorSecretPlan(JSON.stringify({ TOKEN: "${TOKEN}" }), "editor-jsonc", GENERATION), safeError);
});

test("F22h decoded known-value residual copies in public names scalars and comments refuse complete plans", async () => {
    await mcpModule();
    const encoded = VALUE.replaceAll("T", "\\u0054");
    for (const text of ['{"PASSWORD":' + JSON.stringify(VALUE) + ',"description":"prefix' + encoded + 'suffix"}', '{"PASSWORD":' + JSON.stringify(VALUE) + ',"' + encoded + '":"public"}', '{"PASSWORD":' + JSON.stringify(VALUE) + '} // prefix' + VALUE + 'suffix'])
        await assert.rejects(plan(text), safeError);
    for (const text of ['PASSWORD=' + JSON.stringify(VALUE) + '\ndescription="prefix' + encoded + 'suffix"\n', 'PASSWORD=' + JSON.stringify(VALUE) + '\n"' + encoded + '"="public"\n', 'PASSWORD=' + JSON.stringify(VALUE) + '\n# prefix' + VALUE + 'suffix\n'])
        await assert.rejects(plan(text, "mcp-toml"), safeError);
});

test("F22h UTF8 controls text nesting lexical/node and candidate budgets refuse without value-bearing errors", async () => {
    await mcpModule();
    const pairs: Array<[Format, string[]]> = [
        ["mcp-jsonc", ['{"TOKEN":"' + VALUE + '\\u0000"}', '{"x":"\\uD800"}', 'x'.repeat(65537), '{"x":'.repeat(70) + '"public"' + '}'.repeat(70), '{"x":[' + '0,'.repeat(17000) + '0]}', JSON.stringify(Object.fromEntries(Array.from({ length: 129 }, (_, i) => ["TOKEN_" + i, VALUE + "-" + i]))) ]],
        ["mcp-toml", ['TOKEN="' + VALUE + '\\u0000"\n', 'x="\\uD800"\n', 'x'.repeat(65537), 'x=' + '['.repeat(70) + '"public"' + ']'.repeat(70), 'x=[' + '0,'.repeat(17000) + '0]\n', Array.from({ length: 129 }, (_, i) => 'TOKEN_' + i + '="' + VALUE + '-' + i + '"').join('\n') ]],
    ];
    for (const [format, texts] of pairs) for (const text of texts) await assert.rejects(plan(text, format), safeError);
});

test("F22h fixed formats generation and repeated known values retain private custody with no example text", async () => {
    const module = await mcpModule();
    for (const [format, text] of [["mcp-jsonc", JSON.stringify({ PASSWORD: VALUE, description: VALUE })], ["mcp-toml", 'PASSWORD="' + VALUE + '"\ndescription="' + VALUE + '"\n']] as const) {
        const result = await plan(text, format);
        assert.equal(result.candidates.length, 2);
        assert(!result.maskedText.includes(VALUE));
        assert.equal(result.exampleText, "");
        assert.equal(result.restoreMode, "checkpoint");
        assert.throws(() => module.createMcpSecretPlan(text, format, "invalid"), safeError);
    }
    assert.throws(() => (module.createMcpSecretPlan as any)("{}", "unexpected", GENERATION), safeError);
});

test("F22h deterministic JSONC/TOML corpus preserves public arguments and is idempotent", async () => {
    for (let i = 0; i < 32; i++) {
        const inputs: Array<[Format, string]> = [
            ["mcp-jsonc", JSON.stringify({ servers: { ["public" + i]: { command: "node", args: ["server.js", "--token", VALUE + "-" + i, "--port", String(3000 + i)] } } })],
            ["mcp-toml", '[mcp_servers.public' + i + ']\ncommand="node"\nargs=["server.js","--token","' + VALUE + '-' + i + '","--port","' + (3000 + i) + '"]\n'],
        ];
        for (const [format, text] of inputs) {
            const result = await plan(text, format);
            assert.equal(result.candidates.length, 1);
            assert(!result.maskedText.includes(VALUE));
            assert.match(result.maskedText, new RegExp(String(3000 + i)));
            const second = await plan(result.maskedText, format);
            assert.equal(second.candidates.length, 0);
            assert.equal(second.maskedText, result.maskedText);
        }
    }
});
