import assert from "node:assert/strict";
import { test } from "node:test";

// F26a TEST-FIRST owner projection framing. Synthetic bytes and Windows path
// literals only: no Git, config-file, filesystem, history or child execution.
// Scope/origin separators match root's owner-config-framing-witness-01.json.
const ROOT = "C:\\Synthetic Owner Repo", PRIVATE = "TEST_ONLY_F26A_OWNER_CONFIG_PRIVATE_0a3f8219";
type Selection = Readonly<{ hooksRelative: string }>;
type Parse = (raw: Buffer, root: string) => Selection | undefined;
async function implementation(): Promise<Parse> {
    const source = "../history-hooks/OwnerHookProtocol";
    const value = await import(source) as { parseOwnerHookConfig?: Parse };
    assert.equal(typeof value.parseOwnerHookConfig, "function"); return value.parseOwnerHookConfig!;
}
// Actual pinned-Git --null --show-scope --show-origin --get-regexp frame.
const record = (value = ".hooks", origin = "file:.git/config", scope = "local", key = "core.hookspath"): Buffer =>
    Buffer.from(scope + "\0" + origin + "\0" + key + "\n" + value + "\0", "utf8");
function unavailable(parse: Parse, value: unknown, root: unknown = ROOT): void {
    let actual: unknown; assert.doesNotThrow(() => { actual = parse(value as Buffer, root as string); }); assert.equal(actual, undefined);
}

test("F26a owner projection empty bytes selects only frozen default hooks metadata", async () => {
    const parse = await implementation(), result = parse(Buffer.alloc(0), ROOT);
    assert.deepEqual(result, { hooksRelative: ".git/hooks" }); assert.ok(Object.isFrozen(result));
    assert.deepEqual(Object.keys(result!), ["hooksRelative"]);
});

test("F26a owner projection accepts one exact local relative config-origin frame", async () => {
    const parse = await implementation(), raw = record(".synthetic-hooks"), before = Buffer.from(raw), result = parse(raw, ROOT);
    assert.equal(raw.length, 55, "exact root-owned pinned-Git local projection bytes");
    assert.deepEqual(result, { hooksRelative: ".synthetic-hooks" }); assert.ok(Object.isFrozen(result)); assert.ok(raw.equals(before));
    assert.ok(!JSON.stringify(result).includes("file:")); assert.ok(!JSON.stringify(result).includes("core.hookspath"));
});

test("F26a owner projection accepts the exact canonical absolute local config origin", async () => {
    const parse = await implementation();
    assert.deepEqual(parse(record("hooks/custom", "file:" + ROOT + "\\.git\\config"), ROOT), { hooksRelative: "hooks/custom" });
});

test("F26a owner projection preserves literal in-root git custom spaces and Unicode components", async () => {
    const parse = await implementation();
    for (const hooksRelative of [".git/custom-hooks", ".husky", "my hooks/pre commit", "hooks/unicode-\u00e9", "-hooks", "nested/a..b"])
        assert.deepEqual(parse(record(hooksRelative), ROOT), { hooksRelative });
});

test("F26a owner projection refuses nonlocal scopes instead of pretending the default is active", async () => {
    const parse = await implementation();
    for (const scope of ["system", "global", "command", "worktree", "unknown", "LOCAL", ""])
        unavailable(parse, record(".hooks", "file:.git/config", scope));
    unavailable(parse, Buffer.concat([record(), record("outside", "file:C:/Synthetic/global", "global")]));
});

test("F26a owner projection refuses every include worktree or unrecognized queried key", async () => {
    const parse = await implementation();
    for (const key of ["include.path", "includeif.gitdir:C:/Synthetic/.path", "includeif.onbranch:main.path", "extensions.worktreeconfig", "core.other", "Core.HooksPath", ""])
        unavailable(parse, record(PRIVATE, "file:.git/config", "local", key));
});

test("F26a owner projection withholds duplicates mixed records and seventeenth records as a whole", async () => {
    const parse = await implementation();
    for (const count of [2, 16, 17]) unavailable(parse, Buffer.concat(Array.from({ length: count }, () => record())));
    unavailable(parse, Buffer.concat([record(), record(PRIVATE, "file:.git/config", "local", "include.path")]));
});

test("F26a owner projection binds local origin to exact root config without aliases or siblings", async () => {
    const parse = await implementation();
    for (const origin of ["file:../.git/config", "file:.git/./config", "file:.git\\config", "file:.GIT/config", "file:" + ROOT + "2\\.git\\config",
        "file:" + ROOT + "\\.git\\other", "file:" + ROOT + "\\.git\\config.", "command line:", "standard input", "blob:HEAD:config", "file:"])
        unavailable(parse, record(".hooks", origin));
});

test("F26a owner projection refuses absolute outside empty or noncanonical hooks paths", async () => {
    const parse = await implementation();
    for (const path of ["", ".", "..", "../hooks", "a/../hooks", "a/./hooks", "a//hooks", "a/", "/hooks", "C:\\hooks", "C:/hooks",
        "\\\\server\\share", "//server/share", "~/.hooks", "%(prefix)/hooks", "a\\hooks"])
        unavailable(parse, record(path));
});

test("F26a owner projection refuses device ADS short-alias trailing and control components", async () => {
    const parse = await implementation();
    for (const path of ["a/NUL", "a/CON.txt", "a/COM1", "a/LPT9.txt", "a/file:stream", "a/HOOKS~1", "a/file.", "a/file ", "a/<hooks>",
        "a/ho\noks", "a/ho\roks", "a/ho\toks", "a/ho\u202eoks", "a/ho\u0000oks"])
        unavailable(parse, record(path));
});

test("F26a owner projection requires exact separators complete records and final EOF", async () => {
    const parse = await implementation(), good = record();
    for (const raw of [good.subarray(0, -1), Buffer.concat([good, Buffer.from("\n")]), Buffer.concat([good, Buffer.from([0])]),
        Buffer.from("local\0file:.git/config\0core.hookspath\0.hooks\0"), Buffer.from("file:.git/config\0local\0core.hookspath\n.hooks\0"),
        Buffer.from("local\0file:.git/config\0core.hookspath\n.hooks\n\0"), Buffer.from("local\0file:.git/config\0core.hookspath\n.hooks\0tail"),
        Buffer.from("local\0file:.git/config\0"), Buffer.from([0])]) unavailable(parse, raw);
});

test("F26a owner projection fatally rejects malformed UTF8 BOM and raw bytes beyond64KiB", async () => {
    const parse = await implementation(), good = record();
    for (const raw of [Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), good]), Buffer.from([0xff]),
        Buffer.concat([good.subarray(0, -1), Buffer.from([0xc3, 0x28, 0])]), Buffer.alloc(65537, 0x61)]) unavailable(parse, raw);
});

test("F26a owner projection refuses coercion proxies and nonBuffer views before caller traps", async () => {
    const parse = await implementation(); let traps = 0;
    const proxy = new Proxy({}, { get() { traps++; throw Error(PRIVATE); }, getPrototypeOf() { traps++; throw Error(PRIVATE); } });
    const poison = Object.create(null); Object.defineProperty(poison, Symbol.toPrimitive, { get() { traps++; throw Error(PRIVATE); } });
    for (const raw of [null, undefined, {}, proxy, poison, record().toString(), new Uint8Array(record())]) unavailable(parse, raw);
    const buffer = record(); for (const field of ["length", "toString", "subarray"]) Object.defineProperty(buffer, field, { get() { traps++; throw Error(PRIVATE); } });
    assert.deepEqual(parse(buffer, ROOT), { hooksRelative: ".hooks" });
    for (const root of [proxy, poison, "relative", "C:relative", "C:\\Synthetic\\..\\Elsewhere", "\\\\server\\share", "C:\\NUL.txt"])
        unavailable(parse, Buffer.alloc(0), root);
    assert.equal(traps, 0);
});

test("F26a owner projection is pure metadata and does not require root or config files to exist", async () => {
    const parse = await implementation(), missing = "C:\\Synthetic Missing Owner 47b9c1";
    assert.deepEqual(parse(Buffer.alloc(0), missing), { hooksRelative: ".git/hooks" });
    assert.deepEqual(parse(record(".git/custom-hooks", "file:.git/config"), missing), { hooksRelative: ".git/custom-hooks" });
});
