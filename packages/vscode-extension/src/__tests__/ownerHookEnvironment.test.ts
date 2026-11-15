import assert from "node:assert/strict";
import { test } from "node:test";

// F26a TEST-FIRST pure owner-discovery environment projection. Never reads an
// actual environment, user config, profile, filesystem or Git executable.
const PRIVATE = "TEST_ONLY_F26A_OWNER_ENV_PRIVATE_d3710b62";
type Build = (ambient: NodeJS.ProcessEnv) => Readonly<NodeJS.ProcessEnv> | undefined;
const fixed = Object.freeze({ GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "", PAGER: "",
    GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_PROTOCOL_FROM_USER: "0", LC_ALL: "C", LANG: "C" });
const base = (): NodeJS.ProcessEnv => ({ HOME: "C:\\Synthetic Owner Home", USERPROFILE: "C:\\Synthetic Owner Profile",
    XDG_CONFIG_HOME: "C:\\Synthetic Owner XDG", SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", COMSPEC: "C:\\Windows\\System32\\cmd.exe",
    HOMEDRIVE: "C:", HOMEPATH: "\\Synthetic Owner Profile" });
async function implementation(): Promise<Build> {
    const source = "../history-hooks/OwnerHookProtocol";
    const value = await import(source) as { buildOwnerHookEnvironment?: Build };
    assert.equal(typeof value.buildOwnerHookEnvironment, "function"); return value.buildOwnerHookEnvironment!;
}
function unavailable(build: Build, ambient: unknown): void {
    let actual: unknown; assert.doesNotThrow(() => { actual = build(ambient as NodeJS.ProcessEnv); }); assert.equal(actual, undefined);
}

test("F26a owner environment preserves exact permitted discovery context and fixed noninteractive controls", async () => {
    const build = await implementation(), ambient = base(), before = { ...ambient }, value = build(ambient);
    assert.deepEqual(value, { ...before, ...fixed }); assert.ok(Object.isFrozen(value)); assert.deepEqual(ambient, before);
});

test("F26a owner environment accepts usable HOME or USERPROFILE without inventing another profile", async () => {
    const build = await implementation();
    assert.deepEqual(build({ HOME: "C:\\Synthetic Home" }), { HOME: "C:\\Synthetic Home", ...fixed });
    assert.deepEqual(build({ USERPROFILE: "D:\\Synthetic Profile" }), { USERPROFILE: "D:\\Synthetic Profile", ...fixed });
    unavailable(build, {}); unavailable(build, { HOMEDRIVE: "C:", HOMEPATH: "\\Synthetic Profile" });
});

test("F26a owner environment preserves explicit global system selectors and NOSYSTEM1 as current owner context", async () => {
    const build = await implementation(), ambient = { ...base(), GIT_CONFIG_GLOBAL: "C:\\Synthetic Missing Global\\config",
        GIT_CONFIG_SYSTEM: "D:\\Synthetic Missing System\\config", GIT_CONFIG_NOSYSTEM: "1" };
    assert.deepEqual(build(ambient), { ...ambient, ...fixed });
});

test("F26a owner environment accepts only exact NOSYSTEM1 rather than truthy coercion", async () => {
    const build = await implementation();
    for (const value of ["", "0", "true", "TRUE", "yes", "1 ", " 1", "01"]) unavailable(build, { ...base(), GIT_CONFIG_NOSYSTEM: value });
    unavailable(build, { ...base(), GIT_CONFIG_NOSYSTEM: 1 });
});

test("F26a owner environment rejects every other ambient Git selector or command injection", async () => {
    const build = await implementation();
    for (const name of ["GIT_CONFIG", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_DIR", "GIT_WORK_TREE",
        "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CEILING_DIRECTORIES", "GIT_EXEC_PATH", "GIT_PAGER", "GIT_FUTURE_SELECTOR"])
        unavailable(build, { ...base(), [name]: PRIVATE });
});

test("F26a owner environment catches case-insensitive Git injection and case-ambiguous discovery names", async () => {
    const build = await implementation();
    for (const name of ["git_config", "Git_Config_Count", "git_config_parameters", "gIt_InDeX_FiLe", "Git_Dir", "git_work_tree"])
        unavailable(build, { ...base(), [name]: PRIVATE });
    unavailable(build, { ...base(), home: "D:\\Conflicting Home" });
    unavailable(build, { ...base(), git_config_global: "C:\\One", GIT_CONFIG_GLOBAL: "C:\\Two" });
});

test("F26a owner environment omits PATH Node startup credentials and generic values without mutating them", async () => {
    const build = await implementation(), ambient = { ...base(), PATH: PRIVATE, NODE_OPTIONS: PRIVATE, NODE_PATH: PRIVATE, ELECTRON_RUN_AS_NODE: PRIVATE,
        OPENAI_API_KEY: PRIVATE, AWS_SECRET_ACCESS_KEY: PRIVATE, HTTP_PROXY: PRIVATE, SSH_ASKPASS: PRIVATE, CUSTOM: PRIVATE, PAGER: PRIVATE, LANG: PRIVATE };
    const value = build(ambient); assert.deepEqual(value, { ...base(), ...fixed }); assert.ok(!JSON.stringify(value).includes(PRIVATE));
    assert.equal(ambient.NODE_OPTIONS, PRIVATE); assert.equal(ambient.PAGER, PRIVATE);
});

test("F26a owner environment refuses invalid canonical Windows discovery and runtime paths", async () => {
    const build = await implementation();
    for (const field of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "SystemRoot", "WINDIR", "COMSPEC"])
        for (const value of ["", "relative", "C:relative", "C:/forward", "C:\\Synthetic\\..\\Escape", "C:\\Synthetic\\.\\Home", "\\\\server\\share", "C:\\Synthetic\\NUL.txt",
            "C:\\Synthetic\\file.", "C:\\Synthetic\\file ", "C:\\Synthetic\\x:stream", "C:\\Synthetic\\HOME~1", "C:\\Synthetic\\x\u202e", "C:\\Synthetic\nhome"])
            unavailable(build, { ...base(), [field]: value });
});

test("F26a owner environment validates optional HOMEDRIVE and HOMEPATH literally", async () => {
    const build = await implementation();
    for (const value of ["", "C", "C:\\", "C:/", "C:extra", "\\\\server", "C:\n"]) unavailable(build, { ...base(), HOMEDRIVE: value });
    for (const value of ["", "relative", "C:\\Profile", "\\\\server\\share", "\\Synthetic\\..\\Other", "\\Synthetic\\NUL", "\\Synthetic\\file.", "\\Synthetic\nProfile"])
        unavailable(build, { ...base(), HOMEPATH: value });
});

test("F26a owner environment requires a plain own record without accessors symbols or inherited authority", async () => {
    const build = await implementation(); let reads = 0;
    const accessor = { ...base() }; Object.defineProperty(accessor, "IGNORED", { enumerable: true, get() { reads++; throw Error(PRIVATE); } });
    const inherited = Object.create({ HOME: "C:\\Inherited Profile" });
    const symbol = { ...base(), [Symbol("hidden")]: PRIVATE };
    for (const value of [null, undefined, [], new Date(0), new String("ambient"), inherited, accessor, symbol]) unavailable(build, value);
    assert.equal(reads, 0);
});

test("F26a owner environment refuses proxies and nonstring values without coercion", async () => {
    const build = await implementation(); let traps = 0;
    const proxy = new Proxy({}, { ownKeys() { traps++; throw Error(PRIVATE); }, get() { traps++; throw Error(PRIVATE); }, getPrototypeOf() { traps++; throw Error(PRIVATE); } });
    const poison = Object.create(null); Object.defineProperty(poison, Symbol.toPrimitive, { get() { traps++; throw Error(PRIVATE); } });
    unavailable(build, proxy); unavailable(build, { ...base(), HOME: poison }); unavailable(build, { ...base(), HOME: 123 });
    assert.equal(traps, 0);
});

test("F26a owner environment is pure projection even when every permitted config file is nonexistent", async () => {
    const build = await implementation(), ambient = { HOME: "C:\\Synthetic Missing Home ef06", GIT_CONFIG_GLOBAL: "C:\\Synthetic Missing Global ef06\\config",
        GIT_CONFIG_SYSTEM: "D:\\Synthetic Missing System ef06\\config", GIT_CONFIG_NOSYSTEM: "1" };
    const value = build(ambient); assert.deepEqual(value, { ...ambient, ...fixed }); assert.ok(Object.isFrozen(value));
});
