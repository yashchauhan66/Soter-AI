import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rename, symlink, link, chmod, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";

// F26a TEST-FIRST synchronous hook CAS. All filesystem work belongs to retained
// marked synthetic roots. No Git, hook, child, normal config, ACL or OS change.
// Only explicit matching write(undefined,undefined) may undo the selected leaf.
const ORIGINAL = Buffer.from("#!/bin/sh\n# TEST_ONLY_PRIVATE_ORIGINAL_94c8d13a\nexit 7\n");
const GENERATED = Buffer.from("#!/bin/sh\n# generated synthetic guard\nexit 0\n");
const UNKNOWN = Buffer.from("#!/bin/sh\n# concurrent synthetic owner edit\nexit 3\n");
const options = { skip: process.platform !== "win32" };
type Snapshot = Readonly<{ bytes: Buffer | undefined; mode: number | undefined; identity: string }>;
type Capability = Readonly<{ root: string; file: string; read(): Snapshot | undefined; write(expected: Snapshot, bytes: Buffer | undefined, mode: number | undefined): boolean }>;
interface API { prepareCheckedHookFile(root: string, hooksRelative: string, enabled: () => boolean): Capability | undefined; isCheckedHookFile(value: unknown): boolean }
async function implementation(): Promise<API> {
    const source = "../history-hooks/CheckedHookFile", value = await import(source) as Partial<API>;
    assert.equal(typeof value.prepareCheckedHookFile, "function"); assert.equal(typeof value.isCheckedHookFile, "function"); return value as API;
}
async function fixture(hooksRelative = ".git/hooks", before?: Buffer) {
    const container = await mkdtemp(join(tmpdir(), "soter-f26a-hook-file-")), root = join(container, "repo"), git = join(root, ".git");
    await mkdir(git, { recursive: true });
    const config = join(git, "config"), head = join(git, "HEAD"), index = join(git, "index"), body = join(root, "public.txt");
    await writeFile(config, "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(head, "ref: refs/heads/main\n", { flag: "wx" }); await writeFile(index, "synthetic utility must not parse index", { flag: "wx" });
    await writeFile(body, "Public unrelated body stays unchanged.\n", { flag: "wx" });
    const directory = join(root, ...hooksRelative.split("/")), file = join(directory, "pre-commit");
    if (before !== undefined) { await mkdir(directory, { recursive: true }); await writeFile(file, before, { flag: "wx" }); }
    return { container, root, git, directory, file, hooksRelative, protectedFiles: [config, head, index, body], mode: (await lstat(body)).mode & 0o777 };
}
function snapshot(cap: Capability): Snapshot {
    const value = cap.read(); assert.ok(value); assert.ok(Object.isFrozen(value)); assert.match(value.identity, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(value).sort(), ["bytes", "identity", "mode"]); return value;
}
function prepare(api: API, f: Awaited<ReturnType<typeof fixture>>, enabled = () => true): Capability {
    const cap = api.prepareCheckedHookFile(f.root, f.hooksRelative, enabled); assert.ok(cap); assert.ok(Object.isFrozen(cap)); return cap;
}
function isInside(root: string, file: string): boolean { const rel = relative(resolve(root), resolve(file)); return !!rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep); }
async function move(root: string, source: string, target: string): Promise<void> { assert.ok(isInside(root, source) && isInside(root, target), "exact synthetic move endpoints must be inside the named fixture container"); await rename(source, target); }
async function absent(file: string): Promise<boolean> { try { await lstat(file); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; throw error; } }
function refused(api: API, root: string, hooksRelative: string): void { const cap = api.prepareCheckedHookFile(root, hooksRelative, () => true); if (cap) assert.equal(cap.read(), undefined); }
function withFs<T>(wrappers: Record<string, (original: (...args: any[]) => any, fs: Record<string, any>) => (...args: any[]) => any>, work: () => T): T {
    const fs = require("node:fs") as Record<string, any>, saved = new Map<string, any>();
    try { for (const [name, wrap] of Object.entries(wrappers)) { const original = fs[name]; saved.set(name, original); fs[name] = wrap(original, fs); } syncBuiltinESMExports(); return work(); }
    finally { for (const [name, original] of saved) fs[name] = original; syncBuiltinESMExports(); }
}
function countIO<T>(root: string, work: () => T): { value: T; calls: number } {
    let calls = 0; const wrappers: Parameters<typeof withFs>[0] = {};
    const observed = (args: any[]) => typeof args[0] === "number" || typeof args[0] === "string" && (resolve(args[0]).toLowerCase() === resolve(root).toLowerCase() || isInside(root, args[0]));
    for (const name of ["openSync", "readFileSync", "readSync", "fstatSync", "lstatSync", "statSync", "realpathSync", "writeFileSync", "writeSync", "mkdirSync", "renameSync", "unlinkSync", "chmodSync"])
        wrappers[name] = (original, fs) => { const wrap = (...args: any[]) => { if (observed(args)) calls++; return Reflect.apply(original, fs, args); };
            Object.assign(wrap, original); if (typeof (original as any).native === "function") (wrap as any).native = (...args: any[]) => { if (observed(args)) calls++; return (original as any).native(...args); }; return wrap; };
    const value = withFs(wrappers, work); return { value, calls };
}

test("F26a hook file reads default and custom absence without creating missing parents", options, async () => {
    const api = await implementation(); for (const hooksRelative of [".git/hooks", "custom/nested hooks", ".git/custom-hooks"]) {
        const f = await fixture(hooksRelative), beforeRoot = await readdir(f.root), beforeGit = await readdir(f.git), cap = prepare(api, f), value = snapshot(cap);
        assert.equal(cap.root, f.root); assert.equal(cap.file, f.file); assert.equal(value.bytes, undefined); assert.equal(value.mode, undefined);
        assert.equal(await absent(f.directory), true); assert.deepEqual(await readdir(f.root), beforeRoot); assert.deepEqual(await readdir(f.git), beforeGit);
    }
});

test("F26a hook file private read returns frozen metadata actual mode and independently copied binary bytes", options, async () => {
    const api = await implementation(), bytes = Buffer.from([0, 0xff, 10, 13, 0x61]), f = await fixture(".git/hooks", bytes), cap = prepare(api, f), first = snapshot(cap), second = snapshot(cap);
    assert.ok(first.bytes?.equals(bytes)); assert.ok(second.bytes?.equals(bytes)); assert.notEqual(first.bytes, second.bytes); assert.equal(first.identity, second.identity);
    assert.equal(first.mode, (await lstat(f.file)).mode & 0o777); first.bytes!.fill(0); assert.ok((await readFile(f.file)).equals(bytes)); assert.ok(second.bytes!.equals(bytes));
});

test("F26a hook file brand rejects clones accessors and proxies without reading caller properties", options, async () => {
    const api = await implementation(), f = await fixture(), cap = prepare(api, f); let traps = 0;
    const proxy = new Proxy(cap, { get() { traps++; throw Error("Synthetic trap"); } }), accessor = { get file() { traps++; throw Error("Synthetic trap"); } };
    for (const value of [undefined, null, {}, { ...cap }, proxy, accessor]) assert.equal(api.isCheckedHookFile(value), false);
    assert.equal(api.isCheckedHookFile(cap), true); assert.equal(traps, 0);
});

test("F26a hook file authorized create replace and exact undo affect only the selected leaf", options, async () => {
    const api = await implementation(), f = await fixture("custom/nested hooks"), protectedBefore = await Promise.all(f.protectedFiles.map(file => readFile(file))), cap = prepare(api, f);
    assert.equal(cap.write(snapshot(cap), GENERATED, f.mode), true); assert.ok((await readFile(f.file)).equals(GENERATED));
    const current = snapshot(cap); assert.equal(current.mode, (await lstat(f.file)).mode & 0o777); assert.equal(cap.write(current, Buffer.from("#!/bin/sh\nexit 2\n"), current.mode), true);
    assert.equal(cap.write(snapshot(cap), undefined, undefined), true); assert.equal(await absent(f.file), true); assert.equal((await lstat(f.directory)).isDirectory(), true);
    for (const [n, file] of f.protectedFiles.entries()) assert.ok((await readFile(file)).equals(protectedBefore[n]));
});

test("F26a hook file preserves existing private bytes and observed mode through reviewed replace and restore", options, async () => {
    const api = await implementation(), f = await fixture(".git/hooks", ORIGINAL), cap = prepare(api, f), original = snapshot(cap);
    assert.ok(original.bytes?.equals(ORIGINAL)); assert.equal(cap.write(original, GENERATED, original.mode), true);
    assert.equal((await lstat(f.file)).mode & 0o777, original.mode); assert.equal(cap.write(snapshot(cap), original.bytes, original.mode), true);
    assert.ok((await readFile(f.file)).equals(ORIGINAL)); assert.equal((await lstat(f.file)).mode & 0o777, original.mode);
    assert.ok(original.bytes?.equals(ORIGINAL));
});

test("F26a hook file foreign cloned or proxy snapshots refuse with zero filesystem I/O", options, async () => {
    const api = await implementation(), f = await fixture(".git/hooks", ORIGINAL), cap = prepare(api, f), own = snapshot(cap), otherCap = prepare(api, f), other = snapshot(otherCap); let traps = 0;
    const proxy = new Proxy(own, { get() { traps++; throw Error("Snapshot trap"); } }), accessor = { get bytes() { traps++; throw Error("Snapshot trap"); } };
    const seen = countIO(f.root, () => { for (const invalid of [null, undefined, {}, { ...own }, other, proxy, accessor]) assert.equal(cap.write(invalid as Snapshot, GENERATED, own.mode), false); });
    assert.equal(seen.calls, 0); assert.equal(traps, 0); assert.ok((await readFile(f.file)).equals(ORIGINAL));
    own.bytes!.fill(0); assert.equal(cap.write(own, GENERATED, own.mode), false); assert.ok((await readFile(f.file)).equals(ORIGINAL));
});

test("F26a hook file stale byte mode and equal-byte atomic replacement snapshots cannot overwrite owner changes", options, async () => {
    const api = await implementation();
    const bytes = await fixture(".git/hooks", ORIGINAL), byteCap = prepare(api, bytes), before = snapshot(byteCap);
    await writeFile(bytes.file, UNKNOWN); assert.equal(byteCap.write(before, GENERATED, before.mode), false); assert.ok((await readFile(bytes.file)).equals(UNKNOWN));
    await writeFile(bytes.file, ORIGINAL); assert.equal(byteCap.write(before, GENERATED, before.mode), false);
    const mode = await fixture(".git/hooks", ORIGINAL), modeCap = prepare(api, mode), prior = snapshot(modeCap);
    try { await chmod(mode.file, 0o444); assert.notEqual((await lstat(mode.file)).mode & 0o777, prior.mode, "fixture must observe an actual read-only transition"); assert.equal(modeCap.write(prior, GENERATED, prior.mode), false); }
    finally { await chmod(mode.file, prior.mode!); }
    const replaced = await fixture(".git/hooks", ORIGINAL), replaceCap = prepare(api, replaced), old = snapshot(replaceCap), incoming = join(replaced.directory, "synthetic-incoming");
    await writeFile(incoming, ORIGINAL, { flag: "wx" }); await move(replaced.container, incoming, replaced.file);
    assert.equal(replaceCap.write(old, GENERATED, old.mode), false); assert.ok((await readFile(replaced.file)).equals(ORIGINAL));
});

test("F26a hook file snapshots authorize one CAS and remain stale after original bytes return", options, async () => {
    const api = await implementation(), f = await fixture(".git/hooks", ORIGINAL), cap = prepare(api, f), old = snapshot(cap);
    assert.equal(cap.write(old, Buffer.from(ORIGINAL), old.mode), true); assert.equal(cap.write(old, GENERATED, old.mode), false);
    const current = snapshot(cap); assert.equal(cap.write(current, GENERATED, current.mode), true); assert.equal(cap.write(snapshot(cap), ORIGINAL, current.mode), true);
    assert.equal(cap.write(old, GENERATED, old.mode), false); assert.ok((await readFile(f.file)).equals(ORIGINAL));
});

test("F26a hook file disabled or throwing guard is sticky and never bypassed by later reenable", options, async () => {
    const api = await implementation(), f = await fixture(".git/hooks", ORIGINAL); assert.equal(api.prepareCheckedHookFile(f.root, f.hooksRelative, () => false), undefined);
    let enabled = true; const cap = prepare(api, f, () => enabled), old = snapshot(cap); enabled = false; assert.equal(cap.read(), undefined); assert.equal(cap.write(old, GENERATED, old.mode), false);
    enabled = true; assert.equal(cap.read(), undefined); assert.equal(cap.write(old, GENERATED, old.mode), false);
    let throws = false; const guarded = prepare(api, f, () => { if (throws) throw Error("Synthetic guard"); return true; }); snapshot(guarded); throws = true; assert.equal(guarded.read(), undefined); throws = false; assert.equal(guarded.read(), undefined);
    assert.ok((await readFile(f.file)).equals(ORIGINAL));
});

test("F26a hook file captured root or git ancestor replacement withdraws the old capability", options, async () => {
    const api = await implementation(), rootCase = await fixture(".git/hooks", ORIGINAL), rootCap = prepare(api, rootCase), oldRoot = snapshot(rootCap);
    await move(rootCase.container, rootCase.root, join(rootCase.container, "retained-root")); await mkdir(rootCase.directory, { recursive: true }); await writeFile(rootCase.file, ORIGINAL, { flag: "wx" });
    assert.equal(rootCap.read(), undefined); assert.equal(rootCap.write(oldRoot, GENERATED, oldRoot.mode), false); assert.ok((await readFile(rootCase.file)).equals(ORIGINAL));
    const gitCase = await fixture(".git/hooks", ORIGINAL), gitCap = prepare(api, gitCase), oldGit = snapshot(gitCap), retained = join(gitCase.root, ".git.retained");
    await move(gitCase.container, gitCase.git, retained); await symlink(retained, gitCase.git, "junction"); assert.equal(gitCap.read(), undefined); assert.equal(gitCap.write(oldGit, GENERATED, oldGit.mode), false);
    assert.ok((await readFile(join(retained, "hooks", "pre-commit"))).equals(ORIGINAL));
});

test("F26a hook file refuses parent junctions aliased roots and hardlinked leaves without touching targets", options, async () => {
    const api = await implementation(), f = await fixture(), outside = await mkdtemp(join(tmpdir(), "soter-f26a-hook-outside-")), target = join(outside, "pre-commit");
    await writeFile(target, ORIGINAL, { flag: "wx" }); await symlink(outside, f.directory, "junction"); refused(api, f.root, f.hooksRelative); assert.ok((await readFile(target)).equals(ORIGINAL));
    const alias = join(f.container, "alias"); await symlink(f.root, alias, "junction"); refused(api, alias, f.hooksRelative);
    const linked = await fixture(".git/hooks", ORIGINAL), second = join(linked.directory, "retained-link"); await link(linked.file, second); refused(api, linked.root, linked.hooksRelative);
    assert.ok((await readFile(second)).equals(ORIGINAL)); assert.ok((await readFile(linked.file)).equals(ORIGINAL));
});

test("F26a hook file admits exact98304 binary bytes and refuses invalid next buffers and modes", options, async () => {
    const api = await implementation(), exact = Buffer.alloc(98304); exact[98303] = 0xff;
    const f = await fixture(".git/hooks", exact), cap = prepare(api, f), value = snapshot(cap); assert.ok(value.bytes?.equals(exact));
    assert.equal(cap.write(value, Buffer.from(exact), value.mode), true); const current = snapshot(cap);
    for (const bytes of [Buffer.alloc(98305), new Uint8Array(1), {}, "text"]) assert.equal(cap.write(current, bytes as Buffer, current.mode), false);
    let traps = 0; const proxy = new Proxy(Buffer.from(GENERATED), { get() { traps++; throw Error("Buffer trap"); } });
    assert.equal(cap.write(current, proxy, current.mode), false); assert.equal(traps, 0);
    for (const mode of [undefined, -1, 0o1000, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(cap.write(current, GENERATED, mode), false);
    assert.equal(cap.write(current, undefined, current.mode), false); assert.ok((await readFile(f.file)).equals(exact));
    const oversized = await fixture(".git/hooks", Buffer.alloc(98305)); refused(api, oversized.root, oversized.hooksRelative);
});

test("F26a hook file rejects invalid roots and noncanonical selectors without coercion or fallback", options, async () => {
    const api = await implementation(), f = await fixture(); let traps = 0;
    const poison = new Proxy({}, { get() { traps++; throw Error("Selector trap"); }, getPrototypeOf() { traps++; throw Error("Selector trap"); } });
    for (const selector of [undefined, null, poison, "", ".", "..", "../hooks", "a/../hooks", "a/./hooks", "a//hooks", "a/", "a\\hooks", "C:\\hooks", "/hooks", "//server/share",
        "~/.hooks", "%(prefix)/hooks", "a/NUL", "a/file:stream", "a/HOOKS~1", "a/file.", "a/file ", "a/ho\noks", "a/ho\u202eoks"])
        assert.equal(api.prepareCheckedHookFile(f.root, selector as string, () => true), undefined);
    for (const root of [undefined, poison, "relative", "C:relative", "\\\\server\\share", f.root + "\\..\\repo"])
        assert.equal(api.prepareCheckedHookFile(root as string, ".git/hooks", () => true), undefined);
    const noGit = await mkdtemp(join(tmpdir(), "soter-f26a-hook-no-git-")); assert.equal(api.prepareCheckedHookFile(noGit, ".git/hooks", () => true), undefined);
    assert.equal(traps, 0); assert.equal(await absent(f.directory), true);
});

test("F26a hook file staged CAS preserves unknown edits cleans only owned staging and reports late withdrawal honestly", options, async () => {
    const api = await implementation(), f = await fixture(".git/hooks", ORIGINAL), cap = prepare(api, f), protectedBefore = await Promise.all(f.protectedFiles.map(file => readFile(file)));
    const keep = join(f.directory, "keep.txt"); await writeFile(keep, "Unrelated synthetic file.\n", { flag: "wx" });
    assert.equal(cap.write(snapshot(cap), GENERATED, f.mode), true); assert.deepEqual((await readdir(f.directory)).sort(), ["keep.txt", "pre-commit"]);
    const old = snapshot(cap); let injected = false;
    const isStage = (file: unknown) => typeof file === "string" && resolve(dirname(file)).toLowerCase() === resolve(f.directory).toLowerCase() && resolve(file).toLowerCase() !== resolve(f.file).toLowerCase() && resolve(file).toLowerCase() !== resolve(keep).toLowerCase();
    const result = withFs({
        openSync: (original, fs) => (...args) => { const fd = Reflect.apply(original, fs, args), flags = args[1];
            const exclusive = typeof flags === "string" ? flags.includes("wx") : typeof flags === "number" && !!(flags & fs.constants.O_EXCL) && !!(flags & fs.constants.O_CREAT);
            if (!injected && isStage(args[0]) && exclusive) { injected = true; fs.writeFileSync(f.file, UNKNOWN); } return fd; },
        writeFileSync: (original, fs) => (...args) => { const value = Reflect.apply(original, fs, args), flag = args[2]?.flag;
            if (!injected && isStage(args[0]) && typeof flag === "string" && flag.includes("wx")) { injected = true; Reflect.apply(original, fs, [f.file, UNKNOWN]); } return value; }
    }, () => cap.write(old, Buffer.from("#!/bin/sh\n# next generated guard\nexit 0\n"), old.mode));
    assert.equal(injected, true, "fixture must observe the exclusively created same-dir generated stage"); assert.equal(result, false); assert.ok((await readFile(f.file)).equals(UNKNOWN));
    assert.deepEqual((await readdir(f.directory)).sort(), ["keep.txt", "pre-commit"]); assert.equal((await readFile(keep, "utf8")), "Unrelated synthetic file.\n");
    for (const [n, file] of f.protectedFiles.entries()) assert.ok((await readFile(file)).equals(protectedBefore[n]));
    const late = await fixture(".git/hooks", ORIGINAL); let enabled = true, renamed = false; const lateCap = prepare(api, late, () => enabled), expected = snapshot(lateCap);
    const lateResult = withFs({ renameSync: (original, fs) => (...args) => { const value = Reflect.apply(original, fs, args); if (typeof args[1] === "string" && resolve(args[1]).toLowerCase() === resolve(late.file).toLowerCase()) { renamed = true; enabled = false; } return value; } }, () => lateCap.write(expected, GENERATED, expected.mode));
    assert.equal(renamed, true); assert.equal(lateResult, false); assert.equal(lateCap.read(), undefined);
    const actual = await readFile(late.file); assert.ok(actual.equals(ORIGINAL) || actual.equals(GENERATED), "false after late withdrawal is not a claim of no mutation or an OS boundary");
});
