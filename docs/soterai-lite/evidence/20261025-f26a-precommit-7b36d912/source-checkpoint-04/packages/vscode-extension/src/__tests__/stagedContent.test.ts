import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import childProcess from "node:child_process";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";

// F26a frozen, pre-production contract. Synthetic in-memory data only. This
// component has no index, Git, hook, vault lease, credential validity or ALLOW
// authority. Root must capture its missing-module baseline before production.
const PROVIDER = "sk-proj-" + "SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
const GITHUB = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const HIGH = "Aa0Bb1Cc2Dd3Ee4Ff5Gg6Hh7Ii8Jj9Kk";
const OPAQUE = "a".repeat(40);
const PRIVATE_PATH = "synthetic-private-owner-7b36d912/staged.txt";
const LIMIT = 65536;
type Status = "CLEAN" | "CANDIDATE" | "UNAVAILABLE";
type Result = Readonly<{ status: Status }>;
type Inspect = (source: string, raw: Buffer) => Result;
async function implementation(): Promise<Inspect> {
    const module = await import("../history-hooks/StagedContent");
    assert(typeof module.inspectStagedBlob === "function", "The frozen staged content entry point must exist.");
    return module.inspectStagedBlob as Inspect;
}
function inspect(fn: Inspect, source: string, input: Buffer | string, expected: Status): Result {
    const raw = typeof input === "string" ? Buffer.from(input, "utf8") : input;
    const before = Buffer.from(raw);
    let result: Result;
    try { result = fn(source, raw); }
    catch { assert.fail("Content admission must return a fixed unavailable status, without input-bearing exceptions."); }
    assert(raw.equals(before), "Private classification must not modify caller-owned staged bytes.");
    assert(!!result && typeof result === "object" && !Array.isArray(result), "Classification must return a record.");
    const keys = Reflect.ownKeys(result), descriptors = Object.getOwnPropertyDescriptors(result);
    assert(keys.length === 1 && keys[0] === "status", "Only a fixed status may leave private staged analysis; no paths, values, findings or ledger fields.");
    assert(!!descriptors.status && !descriptors.status.get && !descriptors.status.set, "Status must be a plain data property.");
    assert(["CLEAN", "CANDIDATE", "UNAVAILABLE"].includes(result.status), "Classification must use the frozen status enum.");
    assert(result.status === expected, "The complete staged blob must have the expected fixed classification.");
    const encoded = JSON.stringify(result);
    for (const value of [PROVIDER, GITHUB, OPAQUE, PRIVATE_PATH]) {
        assert(!encoded.includes(value), "Private content and source names must not enter public classification.");
        assert(!encoded.includes(Buffer.from(value).toString("base64")), "Encoded private content must not enter public classification.");
    }
    return result;
}
const percentAll = (value: string) => [...Buffer.from(value)].map(byte => "%" + byte.toString(16).padStart(2, "0")).join("");

test("F26a staged generic public text, Markdown, logs and extensionless notes have useful clean outcomes", async () => {
    const fn = await implementation();
    for (const source of ["docs/public.txt", "docs/README.md", "logs/public.log", "LICENSE", ".gitignore"])
        inspect(fn, source, "Public setup notes.\nUse the local public port 3000.\n", "CLEAN");
});

test("F26a staged empty generic blobs and normal Unicode remain clean", async () => {
    const fn = await implementation();
    inspect(fn, "empty.txt", "", "CLEAN");
    inspect(fn, "public.md", "Public caf\u00e9 \u{1f9ed}\n\tPublic tab and newline.\r\n", "CLEAN");
});

test("F26a staged recognized provider fixtures use the canonical matcher with an empty registration set", async () => {
    const fn = await implementation();
    for (const value of [PROVIDER, GITHUB]) {
        const canonical = new RegisteredSecretMatcher([]).inspectRequest(["Public prefix " + value + " public suffix."]);
        assert(canonical.status === "MATCHED" && canonical.matches.some(match => match.kind === "provider"), "The synthetic fixture must be a canonical provider canary.");
        assert(canonical.matches.every(match => match.kind !== "registered"), "This fixture grants no registration coverage.");
        inspect(fn, PRIVATE_PATH, "Public prefix " + value + " public suffix.\n", "CANDIDATE");
    }
});

test("F26a staged empty-registration recognition covers canonical credential-context entropy", async () => {
    const fn = await implementation(), text = "api_key=" + HIGH;
    const canonical = new RegisteredSecretMatcher([]).inspectRequest([text]);
    assert(canonical.status === "MATCHED" && canonical.matches.some(match => match.kind === "entropy"), "Use the existing canonical entropy fixture and context.");
    inspect(fn, "entropy.txt", text, "CANDIDATE");
});

test("F26a staged low-entropy opaque text is an explicit unregistered negative control", async () => {
    const fn = await implementation();
    const canonical = new RegisteredSecretMatcher([]).inspectRequest([OPAQUE]);
    assert(canonical.status === "CLEAN", "An arbitrary low-entropy opaque registration must not be implied by heuristic scanning.");
    inspect(fn, "opaque.txt", OPAQUE, "CLEAN");
});

for (const [label, encode] of [
    ["base64", (value: string) => Buffer.from(value).toString("base64")],
    ["base64url", (value: string) => Buffer.from(value).toString("base64url")],
    ["hex", (value: string) => Buffer.from(value).toString("hex")],
    ["URL", percentAll],
    ["JSON Unicode string", (value: string) => '"' + [...value].map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("") + '"'],
] as const) {
    test("F26a staged canonical single-layer " + label + " provider recognition has a public control", async () => {
        const fn = await implementation(), encoded = encode(PROVIDER), publicEncoded = encode("Useful ordinary public control.");
        assert(new RegisteredSecretMatcher([]).inspectRequest([encoded]).status === "MATCHED", "Encoded synthetic provider must be recognized by the canonical matcher.");
        inspect(fn, "encoded.txt", encoded, "CANDIDATE");
        inspect(fn, "public-encoded.txt", publicEncoded, "CLEAN");
    });
}

test("F26a staged dotenv static credential names supply canonical context without a vault registration", async () => {
    const fn = await implementation();
    for (const source of [".env", "nested/.env.local"])
        inspect(fn, source, "PASSWORD=" + OPAQUE + "\nPORT=3000\nMONKEY=banana\n", "CANDIDATE");
});

test("F26a staged dotenv public values, exact templates and existing protected markers remain clean", async () => {
    const fn = await implementation();
    inspect(fn, ".env.example", "PORT=3000\nMONKEY=banana\nAPI_KEY=YOUR_API_KEY_HERE\nAUTH_TOKEN=${AUTH_TOKEN}\nPASSWORD=[MASKED]\nSECRET=[SOTERAI_PROTECTED_EXISTING]\nSTRIPE_PUBLISHABLE_KEY=pk_test_F21PUBLICSYNTHETICONLY123456\n", "CLEAN");
});

for (const [source, text] of [
    ["src/owner.js", 'const password = "' + OPAQUE + '";\n'],
    ["src/owner.ts", 'const apiKey: string = "' + OPAQUE + '";\n'],
    ["src/view.jsx", 'const View = () => <Client token="' + OPAQUE + '" />;\n'],
    ["src/view.tsx", 'const View = () => <Client apiKey="' + OPAQUE + '" />;\n'],
    ["src/owner.mjs", 'export const password = "' + OPAQUE + '";\n'],
    ["src/owner.cjs", 'const password = "' + OPAQUE + '";\nmodule.exports = {};\n'],
] as const) {
    test("F26a staged " + source + " uses the declared canonical source grammar and credential context", async () => {
        inspect(await implementation(), source, text, "CANDIDATE");
    });
}

test("F26a staged public source and direct environment references remain parse-only clean controls", async () => {
    const fn = await implementation();
    inspect(fn, "src/public.ts", 'const PORT: number = 3000; const MONKEY = "banana"; const API_KEY = "YOUR_API_KEY_HERE"; const password = process.env.PASSWORD;\n', "CLEAN");
});

test("F26a staged escaped source password literals are classified after fixed-parser decoding", async () => {
    const fn = await implementation(), escaped = OPAQUE.replaceAll("a", "\\u0061");
    inspect(fn, "src/decoded.ts", 'const password: string = "' + escaped + '";\n', "CANDIDATE");
});

const configs: ReadonlyArray<readonly [string, string]> = [
    ["config.json", JSON.stringify({ nested: { password: OPAQUE }, port: 3000 })],
    ["credentials/service-account.json", JSON.stringify({ type: "authorized_user", client_id: "public-client-id", client_secret: OPAQUE })],
    ["compose.yml", 'services:\n  api:\n    image: public-image:1\n    environment:\n      PASSWORD: "' + OPAQUE + '"\n      PORT: "3000"\n'],
    ["Dockerfile", "FROM public-image:1\nENV PASSWORD=" + OPAQUE + "\n"],
    ["infra/production.tfvars", 'password = "' + OPAQUE + '"\nPORT = 3000\n'],
    ["infra/production.tfvars.json", JSON.stringify({ password: OPAQUE, PORT: 3000 })],
    [".npmrc", "registry=https://registry.example.invalid/\n//registry.example.invalid/:_authToken=" + OPAQUE + "\n"],
    [".pypirc", "[pypi]\nrepository=https://upload.example.invalid/legacy/\nusername=__token__\npassword=" + OPAQUE + "\n"],
    [".github/workflows/build.yml", "name: Public CI\nenv:\n  PASSWORD: " + OPAQUE + "\njobs: {}\n"],
    [".vscode/tasks.json", '{// public JSONC\n"version":"2.0.0","tasks":[{"label":"public","command":"node","args":["app.js","--token",' + JSON.stringify(OPAQUE) + ']}],}\n'],
    ["mcp.json", JSON.stringify({ mcpServers: { public: { command: "node", args: ["server.js"], env: { PASSWORD: OPAQUE } } } })],
    ["mcp.toml", '[mcp_servers.public]\ncommand = "node"\nargs = ["server.js"]\n[mcp_servers.public.env]\nPASSWORD = "' + OPAQUE + '"\n'],
];
for (const [source, text] of configs) {
    test("F26a staged recognized " + source + " reuses canonical family credential context", async () => {
        inspect(await implementation(), source, text, "CANDIDATE");
    });
}

test("F26a staged JSON Unicode-escaped credential names and values are semantic private inputs", async () => {
    const fn = await implementation(), escaped = OPAQUE.replaceAll("a", "\\u0061");
    inspect(fn, "config.json", '{"nested":{"pass\\u0077ord":"' + escaped + '"},"PORT":3000}', "CANDIDATE");
});

test("F26a staged public JSON identifiers, public keys and exact placeholders remain clean", async () => {
    const fn = await implementation();
    inspect(fn, "public.json", JSON.stringify({ private_key_id: "ordinary-public-id", client_id: "public-id", monkey: "banana", token_uri: "https://oauth.example.invalid/token", API_KEY: "YOUR_API_KEY_HERE", PASSWORD: "[MASKED]", public_key: "-----BEGIN PUBLIC KEY-----\nPUBLIC_EXAMPLE_ONLY\n-----END PUBLIC KEY-----" }), "CLEAN");
});

test("F26a staged declared malformed JSON and late source syntax errors withhold earlier matching prefixes", async () => {
    const fn = await implementation();
    for (const [source, text] of [
        ["broken.json", '{"password":' + JSON.stringify(PROVIDER) + ',"late":'],
        ["broken.json", '{"password":' + JSON.stringify(PROVIDER) + '} trailing'],
        ["broken.ts", 'const password = "' + PROVIDER + '"; const ='],
        ["broken.tsx", 'const password = "' + PROVIDER + '"; const View = <Client'],
    ]) inspect(fn, source, text, "UNAVAILABLE");
});

test("F26a staged duplicate decoded JSON fields and nonfinite numbers are unavailable atomically", async () => {
    const fn = await implementation();
    for (const text of ['{"password":' + JSON.stringify(PROVIDER) + ',"pass\\u0077ord":"public"}', '{"password":' + JSON.stringify(PROVIDER) + ',"n":1e999}', '{"nested":{"x":1,"x":2}}'])
        inspect(fn, "strict.json", text, "UNAVAILABLE");
});

test("F26a staged unsupported source credential computations do not fall back to raw-prefix classification", async () => {
    const fn = await implementation();
    for (const text of ['const password = "' + PROVIDER + '" + suffix;', 'const password = getCredential("' + PROVIDER + '");', 'const password = `' + PROVIDER + '${suffix}`;'])
        inspect(fn, "computed.ts", text, "UNAVAILABLE");
});

test("F26a staged unsupported source formats and foreign YAML remain unavailable", async () => {
    const fn = await implementation();
    for (const source of ["owner.py", "owner.sh", "owner.rs", "owner.wasm", "unknown.bak"])
        inspect(fn, source, "Public text " + PROVIDER, "UNAVAILABLE");
    inspect(fn, "foreign.yaml", "foreign:\n  password: " + PROVIDER + "\n", "UNAVAILABLE");
});

test("F26a staged known config family parse failures are unavailable despite an earlier provider canary", async () => {
    const fn = await implementation();
    for (const [source, text] of [
        [".npmrc", "_authToken=" + PROVIDER + "\nbroken line\n"],
        ["production.tfvars", 'password = "' + PROVIDER + '"\nlate = file("synthetic-never-read")\n'],
        ["compose.yml", "services:\n  api:\n    environment:\n      PASSWORD: " + PROVIDER + "\n      PASSWORD: duplicate\n"],
        [".github/workflows/build.yml", "env: {TOKEN: " + PROVIDER + "}\n---\npublic: true\n"],
        [".vscode/tasks.json", '{"password":' + JSON.stringify(PROVIDER) + ',"late":}'],
        ["mcp.toml", '[mcp_servers.public.env]\nPASSWORD="' + PROVIDER + '"\nPASSWORD="duplicate"\n'],
    ]) inspect(fn, source, text, "UNAVAILABLE");
});

test("F26a staged raw-byte size admission is inclusive at64KiB for ASCII and multibyte public text", async () => {
    const fn = await implementation();
    for (const text of [".".repeat(LIMIT), "\u00e9".repeat(LIMIT / 2), "\u{1f9ed}".repeat(LIMIT / 4)]) {
        assert(Buffer.byteLength(text, "utf8") === LIMIT, "The synthetic public fixture must exercise exactly64KiB.");
        inspect(fn, "boundary.txt", text, "CLEAN");
        inspect(fn, "boundary.txt", text + ".", "UNAVAILABLE");
    }
});

test("F26a staged oversize and invalid late bytes withhold whole matching prefixes without truncation", async () => {
    const fn = await implementation();
    inspect(fn, "oversize.txt", PROVIDER + "\n" + ".".repeat(LIMIT), "UNAVAILABLE");
    inspect(fn, "late-invalid.txt", Buffer.concat([Buffer.from(PROVIDER + "\n"), Buffer.from([0xc3])]), "UNAVAILABLE");
    inspect(fn, "late-binary.txt", Buffer.concat([Buffer.from(PROVIDER + "\n"), Buffer.from([0])]), "UNAVAILABLE");
});

test("F26a staged canonical matcher work exhaustion becomes unavailable rather than a partial clean result", async () => {
    const fn = await implementation(), text = '"public"\n'.repeat(3000);
    assert(Buffer.byteLength(text) < LIMIT, "Matcher work exhaustion must be independent of the raw-byte cap.");
    assert(new RegisteredSecretMatcher([]).inspectRequest([text]).status === "WITHHELD", "This synthetic fixture must exhaust the existing canonical matcher budget.");
    inspect(fn, "bounded-work.txt", text, "UNAVAILABLE");
});

test("F26a staged fatal UTF8 admission rejects overlong truncated surrogate and out-of-range encodings", async () => {
    const fn = await implementation();
    for (const bytes of [[0xc0, 0xaf], [0xe2, 0x82], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xff]])
        inspect(fn, "invalid.txt", Buffer.from(bytes), "UNAVAILABLE");
});

test("F26a staged unsupported controls and bidi characters are unavailable on otherwise clean and matching input", async () => {
    const fn = await implementation();
    for (const control of ["\0", "\x01", "\x0b", "\x1b", "\x7f", "\u0085", "\u061c", "\u200e", "\u202e", "\u2066"])
        for (const prefix of ["Public text ", PROVIDER + " "]) inspect(fn, "control.txt", prefix + control, "UNAVAILABLE");
});

test("F26a staged decoded JSON unsafe controls and lone surrogates cannot become clean or partial candidates", async () => {
    const fn = await implementation();
    for (const escaped of ["\\u0000", "\\u001b", "\\u202e", "\\ud800", "\\udc00"])
        inspect(fn, "decoded.json", '{"password":' + JSON.stringify(PROVIDER) + ',"late":"' + escaped + '"}', "UNAVAILABLE");
});

test("F26a staged unsafe source paths never grant format or content admission", async () => {
    const fn = await implementation();
    for (const source of ["", "/public.txt", "C:/public.txt", "../public.txt", "nested/../public.txt", "./public.txt", "nested//public.txt", "nested\\public.txt", "public.txt:stream", "NUL.txt", "CON", "public.txt.", "public.txt ", "public\n.txt", "public\u202e.txt", "x".repeat(2049) + ".txt"])
        inspect(fn, source, "Public text", "UNAVAILABLE");
});

test("F26a staged source identity and blob runtime types reject coercion without invoking caller hooks", async () => {
    const fn = await implementation(); let coercions = 0;
    const hostile = { toString() { coercions++; throw Error("Synthetic coercion must not run."); }, valueOf() { coercions++; throw Error("Synthetic coercion must not run."); } };
    for (const [source, raw] of [[hostile, Buffer.from("public")], ["public.txt", hostile], ["public.txt", "public"], ["public.txt", new Uint8Array([65])], ["public.txt", null]]) {
        let result: Result;
        try { result = fn(source as never, raw as never); }
        catch { assert.fail("Invalid caller types must return a fixed unavailable record without coercion or exceptions."); }
        assert(result && Reflect.ownKeys(result).length === 1 && result.status === "UNAVAILABLE", "Only generic unavailable status may leave invalid input admission.");
    }
    assert(coercions === 0, "Runtime admission must not coerce caller objects.");
});

test("F26a staged request-local decisions retain no earlier candidate and no caller Buffer ownership", async () => {
    const fn = await implementation(), before = inspect(fn, "public.txt", "Useful public text.", "CLEAN");
    const buffer = Buffer.from(PROVIDER), original = Buffer.from(buffer);
    inspect(fn, PRIVATE_PATH, buffer, "CANDIDATE");
    assert(buffer.equals(original), "Candidate detection must leave original staged bytes untouched.");
    const after = inspect(fn, "public.txt", "Useful public text.", "CLEAN");
    assert(JSON.stringify(before) === JSON.stringify(after), "Classification must not retain prior private request state.");
});

test("F26a staged parsing does not evaluate source or follow config references and never reads files or starts children", async t => {
    const fn = await implementation(); let reads = 0, requests = 0, spawns = 0;
    const noRead = () => { reads++; throw Error("Synthetic staged parsing forbids all reference reads."); };
    const noRequest = () => { requests++; throw Error("Synthetic staged parsing forbids all requests."); };
    t.mock.method(fs, "readFileSync", noRead); t.mock.method(fs, "openSync", noRead);
    t.mock.method(fsp, "readFile", async () => noRead()); t.mock.method(fsp, "open", async () => noRead());
    t.mock.method(http, "request", noRequest); t.mock.method(http, "get", noRequest);
    t.mock.method(https, "request", noRequest); t.mock.method(https, "get", noRequest);
    t.mock.method(childProcess, "spawn", () => { spawns++; throw Error("Synthetic staged parsing forbids child creation."); });
    t.mock.method(childProcess, "spawnSync", () => { spawns++; throw Error("Synthetic staged parsing forbids child creation."); });
    const state = globalThis as typeof globalThis & { __F26A_STAGED_EXECUTED?: boolean };
    state.__F26A_STAGED_EXECUTED = false;
    try {
        inspect(fn, "inert.ts", "globalThis.__F26A_STAGED_EXECUTED = true; const PORT = 3000;\n", "CLEAN");
        inspect(fn, "mcp.json", JSON.stringify({ servers: { public: { command: "node", args: ["https://example.invalid/never-read.js"], env: { TOKEN: "${TOKEN}" } } } }), "CLEAN");
        assert(state.__F26A_STAGED_EXECUTED === false, "Fixed source parsing must not execute source input.");
        assert(reads === 0 && requests === 0 && spawns === 0, "Private content classification must use only caller-supplied bytes.");
    } finally { delete state.__F26A_STAGED_EXECUTED; }
});
