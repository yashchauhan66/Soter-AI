import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { parseVaultAppDescriptor, VAULT_RUNTIME_LIMITS, vaultEnvironmentNameAllowed } from "../../../core/src/VaultAppDescriptor";

// F09 descriptor contract: synthetic public launch metadata only. No filesystem,
// vault, environment, VS Code host, application process or child runtime access.
const ROOT = process.platform === "win32" ? "D:\\SoterAI-F09-fixtures\\project" : "/soterai-f09-fixtures/project";
const GENERATION = "A3427B3646BA4D8482E5C5DFB5BA5DD1";
const ID = "a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1";
const placeholder = (ordinal: number) => `[SOTERAI_PROTECTED_${GENERATION}_${ordinal}]`;
function fixture() {
    return { schemaVersion: 1, id: ID, root: ROOT, program: path.join(ROOT, "app.cjs"), cwd: ROOT,
        source: path.join(ROOT, ".env"), programDigest: "a".repeat(64), args: ["--mode", "public"],
        selections: [{ name: "DATABASE_URL", placeholder: placeholder(0) }] };
}
function rejected(value: unknown): void {
    let result: ReturnType<typeof parseVaultAppDescriptor>;
    assert.doesNotThrow(() => { result = parseVaultAppDescriptor(value); });
    assert.equal(result!, undefined);
}
function accepted(value: unknown) {
    const parsed = parseVaultAppDescriptor(value); assert.ok(parsed);
    assert.ok(Object.isFrozen(parsed)); assert.ok(Object.isFrozen(parsed.args)); assert.ok(Object.isFrozen(parsed.selections));
    for (const selection of parsed.selections) assert.ok(Object.isFrozen(selection));
    return parsed;
}

test("F09-D01 exported runtime limits remain exact and frozen", () => {
    assert.ok(Object.isFrozen(VAULT_RUNTIME_LIMITS));
    assert.deepEqual(VAULT_RUNTIME_LIMITS, { maxArgs: 16, maxArgBytes: 1024, maxArgumentBytes: 8192,
        maxSelections: 32, maxDescriptors: 16, maxJobs: 4, maxRuntimeMs: 300000, stopGraceMs: 1000, maxDescriptorBytes: 32768 });
});

test("F09-D02 a valid descriptor preserves only the exact public own-data shape and freezes every collection", () => {
    const value = fixture(), parsed = accepted(value);
    assert.deepEqual(JSON.parse(JSON.stringify(parsed)), value);
    assert.deepEqual(Object.keys(parsed).sort(), ["schemaVersion", "id", "root", "program", "cwd", "source", "programDigest", "args", "selections"].sort());
    assert.deepEqual(Object.keys(parsed.selections[0]).sort(), ["name", "placeholder"]);
    assert.equal(Reflect.set(parsed, "program", path.join(ROOT, "other.cjs")), false);
    assert.equal(Reflect.set(parsed.args, "0", "changed"), false);
    assert.equal(Reflect.set(parsed.selections[0], "name", "CHANGED"), false);
});

test("F09-D03 supported JavaScript entry extensions and Unicode paths remain useful literal metadata", () => {
    for (const extension of [".js", ".cjs", ".mjs"]) {
        const value = fixture(); value.program = path.join(ROOT, "public É🔐", "entry" + extension);
        value.cwd = path.join(ROOT, "public É🔐"); accepted(value);
    }
    const value = fixture(); value.root = path.join(ROOT, "Cafe\u0301"); value.cwd = value.root;
    value.program = path.join(value.root, "app.js"); value.source = path.join(value.root, ".env");
    assert.equal(accepted(value).root, value.root, "Path parsing must not silently normalize Unicode identity.");
});

test("F09-D04 unknown or missing descriptor fields and unsupported schemas reject without returning partial metadata", () => {
    const required = Object.keys(fixture());
    for (const key of required) { const value = { ...fixture() } as Record<string, unknown>; delete value[key]; rejected(value); }
    for (const [key, data] of [["env", { DATABASE_URL: "SYNTHETIC_RAW_NOT_A_DESCRIPTOR_FIELD" }],
        ["shell", true], ["executable", "node"], ["options", {}], ["value", "SYNTHETIC_RAW_NOT_A_DESCRIPTOR_FIELD"]] as const)
        rejected({ ...fixture(), [key]: data });
    for (const schemaVersion of [0, 2, "1", null, NaN]) rejected({ ...fixture(), schemaVersion });
});

test("F09-D05 non-record values and custom prototypes are not descriptors", () => {
    for (const value of [null, undefined, true, 1, "descriptor", [], new Date(), new String("descriptor"),
        Object.assign(Object.create({ inherited: "unreviewed" }), fixture())]) rejected(value);
});

test("F09-D06 top-level accessors, symbol fields and non-enumerable extras reject without invoking getters", () => {
    let reads = 0;
    const getter = fixture(); Object.defineProperty(getter, "program", { enumerable: true, get() { reads++; return path.join(ROOT, "app.cjs"); } });
    rejected(getter); assert.equal(reads, 0);
    const symbol = fixture(); Object.defineProperty(symbol, Symbol("hidden"), { value: "unreviewed", enumerable: true }); rejected(symbol);
    const hidden = fixture(); Object.defineProperty(hidden, "env", { value: {}, enumerable: false }); rejected(hidden);
});

test("F09-D07 selection records have exact own-data shape and never invoke accessor values", () => {
    for (const selection of [{ name: "DATABASE_URL" }, { placeholder: placeholder(0) },
        { name: "DATABASE_URL", placeholder: placeholder(0), value: "SYNTHETIC_RAW_NOT_ALLOWED" },
        Object.assign(Object.create({ inherited: true }), { name: "DATABASE_URL", placeholder: placeholder(0) })])
        rejected({ ...fixture(), selections: [selection] });
    let reads = 0; const selection = { name: "DATABASE_URL" };
    Object.defineProperty(selection, "placeholder", { enumerable: true, get() { reads++; return placeholder(0); } });
    rejected({ ...fixture(), selections: [selection] }); assert.equal(reads, 0);
    const hidden = { name: "DATABASE_URL", placeholder: placeholder(0) };
    Object.defineProperty(hidden, "rawValue", { value: "SYNTHETIC_RAW_NOT_ALLOWED", enumerable: false });
    rejected({ ...fixture(), selections: [hidden] });
});

test("F09-D08 collection shape rejects holes, extra fields and accessor elements", () => {
    const sparseArgs = Array(1); rejected({ ...fixture(), args: sparseArgs });
    const sparseSelections = Array(1); rejected({ ...fixture(), selections: sparseSelections });
    const args = ["public"]; Object.defineProperty(args, "env", { value: "unreviewed", enumerable: true }); rejected({ ...fixture(), args });
    const selections = fixture().selections; Object.defineProperty(selections, Symbol("hidden"), { value: true }); rejected({ ...fixture(), selections });
    let reads = 0; const accessor = ["public"];
    Object.defineProperty(accessor, "0", { enumerable: true, get() { reads++; return "public"; } });
    rejected({ ...fixture(), args: accessor }); assert.equal(reads, 0);
});

test("F09-D09 UUIDv4 and lowercase public-program digest validation have paired controls", () => {
    accepted(fixture());
    for (const id of ["", "not-a-uuid", ID.replace("-4d84-", "-3d84-"), ID.replace("-82e5-", "-12e5-"), ID + "suffix"])
        rejected({ ...fixture(), id });
    for (const programDigest of ["A".repeat(64), "a".repeat(63), "a".repeat(65), "g".repeat(64), "sha256:" + "a".repeat(64)])
        rejected({ ...fixture(), programDigest });
});

test("F09-D10 every launch path is absolute, local, normalized and free of control characters", () => {
    for (const field of ["root", "program", "cwd", "source"] as const) {
        for (const invalid of ["relative/path", "file:///synthetic/project/app.js", "\\\\server\\share\\app.js",
            path.join(ROOT, "prefix") + path.sep + ".." + path.sep + "app.js", ROOT + path.sep + "." + path.sep + "app.js",
            path.join(ROOT, "app\u0000.js"), path.join(ROOT, "app\n.js")]) rejected({ ...fixture(), [field]: invalid });
    }
});

test("F09-D11 program, source and cwd reject sibling-prefix and traversal escapes outside the selected root", () => {
    for (const field of ["program", "source", "cwd"] as const) {
        rejected({ ...fixture(), [field]: path.join(ROOT + "-sibling", field === "program" ? "app.js" : "item") });
        rejected({ ...fixture(), [field]: path.resolve(ROOT, "..", field === "program" ? "outside.js" : "outside") });
    }
    accepted({ ...fixture(), cwd: ROOT });
});

test("F09-D12 path UTF-16 length is inclusive without consulting the filesystem", () => {
    const prefix = ROOT + path.sep, exact = prefix + "p".repeat(4096 - prefix.length - 4) + ".cjs";
    assert.equal(exact.length, 4096); accepted({ ...fixture(), program: exact });
    rejected({ ...fixture(), program: exact.slice(0, -4) + "p.cjs" });
});

test("F09-D13 only supported app entry extensions are accepted", () => {
    for (const name of ["app", "app.ts", "app.exe", "app.cmd", "app.ps1", "app.js.txt", "app.js "])
        rejected({ ...fixture(), program: path.join(ROOT, name) });
});

test("F09-D14 literal arguments preserve spaces, quotes, shell punctuation and empty arguments without substitution", () => {
    const args = ["", "public value", "'single' and \"double\"", "$PUBLIC_VALUE", "--flag=value", "a|b;&c>d", "https://example.invalid/public?a=1&b=2", "É🔐"];
    assert.deepEqual(accepted({ ...fixture(), args }).args, args);
});

test("F09-D15 interpolation, NUL and control arguments reject the complete descriptor", () => {
    for (const arg of ["${DATABASE_URL}", "prefix${name}suffix", "$(public)", "prefix$(public)", "`public`",
        "a\u0000b", "a\nb", "a\rb", "a\tb", "a\u007fb", "a\u009bb"])
        rejected({ ...fixture(), args: ["public", arg] });
    for (const args of ["literal", null, [1], [null], [{}]]) rejected({ ...fixture(), args });
});

test("F09-D16 argument count and per-argument UTF-8 bytes have inclusive limits", () => {
    accepted({ ...fixture(), args: Array.from({ length: 16 }, (_, index) => "public-" + index) });
    rejected({ ...fixture(), args: Array.from({ length: 17 }, () => "public") });
    const exact = "é".repeat(512); assert.equal(Buffer.byteLength(exact), 1024);
    accepted({ ...fixture(), args: [exact] }); rejected({ ...fixture(), args: [exact + "x"] });
});

test("F09-D17 aggregate argument bytes are inclusive independently of individual and count limits", () => {
    const args = Array.from({ length: 16 }, () => "p".repeat(512));
    assert.equal(args.reduce((sum, arg) => sum + Buffer.byteLength(arg), 0), 8192); accepted({ ...fixture(), args });
    rejected({ ...fixture(), args: [args[0] + "x", ...args.slice(1)] });
});

test("F09-D18 public environment names use the exact identifier grammar and 128-character limit", () => {
    for (const name of ["DATABASE_URL", "DB_PASSWORD", "SERVICE_TOKEN", "PORT", "_PRIVATE_2", "MY_NODE_OPTIONS", "HTTP_PROXY_HINT", "my_SOTERAI_TOKEN", "D" + "_".repeat(127)]) {
        assert.equal(vaultEnvironmentNameAllowed(name), true); accepted({ ...fixture(), selections: [{ name, placeholder: placeholder(0) }] });
    }
    for (const name of ["", "2DATABASE", "DB-NAME", "DB.NAME", "DB NAME", "É_SECRET", "DB\u0000KEY", "D".repeat(129)]) {
        assert.equal(vaultEnvironmentNameAllowed(name), false); rejected({ ...fixture(), selections: [{ name, placeholder: placeholder(0) }] });
    }
});

for (const [family, names] of [
    ["parent paths", ["PATH", "PATHEXT", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SystemRoot", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR"]],
    ["Node and Electron", ["NODE_OPTIONS", "NODE_PATH", "NODE_EXTRA_CA_CERTS", "ELECTRON_RUN_AS_NODE", "ELECTRON_ENABLE_LOGGING"]],
    ["native loaders", ["LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH"]],
    ["shells", ["BASH_ENV", "ENV", "ZDOTDIR", "PSMODULEPATH"]],
    ["language loaders", ["PYTHON", "PYTHONPATH", "RUBYOPT", "PERL5OPT", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "CLASSPATH"]],
    ["proxies and SoterAI controls", ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "SOTERAI_BROKER_TOKEN", "SOTERAI_VAULT_RUNTIME"]],
] as const) {
    test(`F09-D19 ${family} environment names reject case-insensitively`, () => {
        for (const name of names) for (const spelling of [name, name.toLowerCase(), [...name].map((char, index) => index % 2 ? char.toLowerCase() : char.toUpperCase()).join("")]) {
            assert.equal(vaultEnvironmentNameAllowed(spelling), false);
            rejected({ ...fixture(), selections: [{ name: spelling, placeholder: placeholder(0) }] });
        }
    });
}

test("F09-D20 selections must be nonempty and fit the exact inclusive selection count", () => {
    rejected({ ...fixture(), selections: [] });
    const selections = Array.from({ length: 32 }, (_, index) => ({ name: "VALUE_" + index, placeholder: placeholder(index) }));
    accepted({ ...fixture(), selections }); rejected({ ...fixture(), selections: [...selections, { name: "VALUE_32", placeholder: placeholder(32) }] });
    for (const selections of [null, "DATABASE_URL", [null], ["DATABASE_URL"]]) rejected({ ...fixture(), selections });
});

test("F09-D21 selections reject duplicate names in any case and duplicate placeholders", () => {
    for (const name of ["DATABASE_URL", "database_url", "Database_Url"])
        rejected({ ...fixture(), selections: [...fixture().selections, { name, placeholder: placeholder(1) }] });
    rejected({ ...fixture(), selections: [...fixture().selections, { name: "OTHER_VALUE", placeholder: placeholder(0) }] });
    accepted({ ...fixture(), selections: [...fixture().selections, { name: "OTHER_VALUE", placeholder: placeholder(1) }] });
});

test("F09-D22 exact F06 uppercase placeholders accept ordinal zero and 255", () => {
    for (const ordinal of [0, 1, 9, 10, 255]) accepted({ ...fixture(), selections: [{ name: "DATABASE_URL", placeholder: placeholder(ordinal) }] });
});

test("F09-D23 legacy, altered, noncanonical and out-of-range placeholders cannot select runtime values", () => {
    for (const token of ["[SOTERAI_PROTECTED_DATABASE_URL]", placeholder(0).toLowerCase(), placeholder(0).replace(GENERATION, ID.toUpperCase()),
        placeholder(0).replace(GENERATION, GENERATION + "A"), placeholder(0).replace(GENERATION, "G".repeat(32)),
        placeholder(256), placeholder(-1), placeholder(0).replace("_0]", "_00]"), placeholder(1).replace("_1]", "_01]"),
        placeholder(1).replace("_1]", "_+1]"), "prefix" + placeholder(0), placeholder(0) + "suffix", " " + placeholder(0),
        "postgresql://synthetic.invalid/not-a-placeholder"])
        rejected({ ...fixture(), selections: [{ name: "DATABASE_URL", placeholder: token }] });
});

test("F09-D24 descriptor JSON UTF-8 size is inclusive while all individual limits remain valid", () => {
    const value = fixture(), root = path.join(ROOT, "é".repeat(2000));
    value.root = root; value.cwd = root; value.source = path.join(root, ".env"); value.program = path.join(root, "app.cjs");
    value.args = Array.from({ length: 8 }, () => "p".repeat(1024));
    value.selections = Array.from({ length: 32 }, (_, index) => ({ name: ("VALUE_" + index).padEnd(128, "A"), placeholder: placeholder(index) }));
    const padding = 32768 - Buffer.byteLength(JSON.stringify(value), "utf8");
    assert.ok(padding >= 0); value.program = path.join(root, "p".repeat(padding) + "app.cjs");
    assert.ok(value.program.length < 4096); assert.equal(Buffer.byteLength(JSON.stringify(value), "utf8"), 32768);
    accepted(value);
    const over = { ...value, program: path.join(root, "p".repeat(padding + 1) + "app.cjs") };
    assert.equal(Buffer.byteLength(JSON.stringify(over), "utf8"), 32769); assert.ok(over.program.length <= 4096); rejected(over);
});

test("F09-D25 hostile toJSON functions do not run or replace unreviewed input", () => {
    let calls = 0;
    const value = { ...fixture(), toJSON() { calls++; return fixture(); } };
    rejected(value); assert.equal(calls, 0);
});
