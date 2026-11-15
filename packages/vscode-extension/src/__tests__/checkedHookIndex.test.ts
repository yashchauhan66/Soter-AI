import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rename, link, symlink } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { tmpdir } from "node:os";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";

// F26a TEST-FIRST: manual SHA1 DIRC fixtures only. No Git, child, source-body
// scan, network, normal profile, deletion or signals. Every fixture is retained.
const CONFIG = "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tfilemode = false\n\tlogallrefupdates = true\n";
const PRIVATE = "TEST_ONLY_F26A_INDEX_PRIVATE_91d8c270";
const PUBLIC_OID = "1".repeat(40), ALTERNATIVE_OID = "c".repeat(40);
const options = { skip: process.platform !== "win32" };
type Row = Readonly<{ path: string; oid: string; mode: "100644" | "100755" }>;
type Metadata = Readonly<{ executable: string; job: string; environment: NodeJS.ProcessEnv; available(): boolean }>;
type Descriptor = Readonly<{ root: string; indexFile: string; metadata: Metadata; environment: NodeJS.ProcessEnv;
    entries: readonly Row[]; available(): boolean }>;
type Implementation = {
    prepareCheckedHookIndex(root: string, indexPath: unknown, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Descriptor | undefined>;
    isCheckedHookIndex(value: unknown): boolean;
};
interface EntryInput { path: string | Buffer; oid?: string; mode?: number; flags?: number; nameLength?: number }
interface Extension { name: string; bytes: Buffer; declaredLength?: number }
const PUBLIC: EntryInput = { path: "public.txt", oid: PUBLIC_OID };
const seal = (body: Buffer): Buffer => Buffer.concat([body, createHash("sha1").update(body).digest()]);
function index(entries: readonly EntryInput[] = [PUBLIC], settings: { version?: number; count?: number; extensions?: readonly Extension[] } = {}): Buffer {
    const header = Buffer.alloc(12); header.write("DIRC", 0, "ascii");
    header.writeUInt32BE(settings.version ?? 2, 4); header.writeUInt32BE(settings.count ?? entries.length, 8);
    const rows = entries.map(entry => {
        const name = Buffer.isBuffer(entry.path) ? entry.path : Buffer.from(entry.path, "utf8"), fixed = Buffer.alloc(62);
        fixed.writeUInt32BE(entry.mode ?? 0o100644, 24);
        Buffer.from(entry.oid ?? PUBLIC_OID, "hex").copy(fixed, 40, 0, 20);
        fixed.writeUInt16BE((entry.flags ?? 0) | (entry.nameLength ?? Math.min(name.length, 0xfff)), 60);
        const size = Math.ceil((62 + name.length + 1) / 8) * 8;
        return Buffer.concat([fixed, name, Buffer.alloc(size - 62 - name.length)]);
    });
    const extensions = (settings.extensions ?? []).map(extension => {
        const frame = Buffer.alloc(8); frame.write(extension.name, 0, 4, "ascii");
        frame.writeUInt32BE(extension.declaredLength ?? extension.bytes.length, 4);
        return Buffer.concat([frame, extension.bytes]);
    });
    return seal(Buffer.concat([header, ...rows, ...extensions]));
}
function mutate(source: Buffer, apply: (body: Buffer) => void): Buffer {
    const body = Buffer.from(source.subarray(0, -20)); apply(body); return seal(body);
}
const ambient = (): NodeJS.ProcessEnv => ({ SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
    PATH: PRIVATE, NODE_OPTIONS: PRIVATE, NODE_PATH: PRIVATE, OPENAI_API_KEY: PRIVATE, HOME: PRIVATE, USERPROFILE: PRIVATE,
    GIT_INDEX_FILE: PRIVATE, GIT_DIR: PRIVATE, GIT_WORK_TREE: PRIVATE, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.hooksPath",
    GIT_CONFIG_VALUE_0: PRIVATE, GIT_CONFIG_SYSTEM: PRIVATE, GIT_CONFIG_GLOBAL: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: PRIVATE, HTTP_PROXY: PRIVATE, SSH_ASKPASS: PRIVATE });
async function implementation(): Promise<Implementation> {
    const value = await import("../history-hooks/CheckedHookIndex");
    assert.equal(typeof value.prepareCheckedHookIndex, "function");
    assert.equal(typeof value.isCheckedHookIndex, "function"); return value;
}
async function repository(settings: { defaultBytes?: Buffer | null; alternative?: Buffer; config?: string } = {}) {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-index-")), git = join(root, ".git");
    await mkdir(join(git, "objects", "info"), { recursive: true });
    await mkdir(join(git, "objects", "pack"), { recursive: true });
    await mkdir(join(git, "refs", "heads"), { recursive: true });
    await writeFile(join(git, "config"), settings.config ?? CONFIG, { flag: "wx" });
    await writeFile(join(git, "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    if (settings.defaultBytes !== null) await writeFile(join(git, "index"), settings.defaultBytes ?? index(), { flag: "wx" });
    if (settings.alternative !== undefined) await writeFile(join(git, "index.lock"), settings.alternative, { flag: "wx" });
    return { root, git, indexFile: join(git, "index"), alternative: join(git, "index.lock") };
}
async function prepared(m: Implementation, settings: Parameters<typeof repository>[0] = {}, selected: unknown = undefined, enabled = () => true) {
    const f = await repository(settings);
    const d = await m.prepareCheckedHookIndex(f.root, selected, ambient(), enabled);
    assert.ok(d, "ordinary synthetic effective index must acquire a genuine capability"); return { ...f, descriptor: d };
}
async function alternativeRefused(m: Implementation, bytes: Buffer): Promise<void> {
    const f = await repository({ alternative: bytes });
    assert.equal(await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true), undefined,
        "invalid explicit alternative must not fall back to the valid public default");
}
function containedMove(root: string, source: string, destination: string): Promise<void> {
    for (const target of [source, destination]) {
        const rel = relative(resolve(root), resolve(target));
        assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep), "retained fixture move must stay inside its known root");
    }
    return rename(source, destination);
}
async function watchReads<T>(targets: readonly string[], work: () => Promise<T>): Promise<{ result: T; reads: number }> {
    const fs = require("node:fs") as { readFileSync: typeof import("node:fs").readFileSync; openSync: typeof import("node:fs").openSync };
    const read = fs.readFileSync, open = fs.openSync; let reads = 0;
    const watched = (value: unknown) => typeof value === "string" && targets.some(target => resolve(target).toLowerCase() === resolve(value).toLowerCase());
    try {
        fs.readFileSync = ((...args: Parameters<typeof read>) => { if (watched(args[0])) reads++; return read(...args); }) as typeof read;
        fs.openSync = ((...args: Parameters<typeof open>) => { if (watched(args[0])) reads++; return open(...args); }) as typeof open;
        syncBuiltinESMExports(); return { result: await work(), get reads() { return reads; } };
    } finally { fs.readFileSync = read; fs.openSync = open; syncBuiltinESMExports(); }
}
function sizedPath(bytes: number, ordinal: number): string {
    const prefix = "r" + String(ordinal).padStart(3, "0") + "/", parts: string[] = []; let remaining = bytes - prefix.length;
    while (remaining > 200) { parts.push("a".repeat(200)); remaining -= 201; }
    parts.push("a".repeat(remaining)); return prefix + parts.join("/");
}

test("F26a checked index internally prepares genuine root-bound metadata and an immutable default descriptor", options, async () => {
    const m = await implementation(), f = await prepared(m), d = f.descriptor;
    const metadata = await import("../terminal/CheckedGitMetadata");
    assert.equal(d.root, f.root); assert.equal(d.indexFile, f.indexFile);
    assert.equal(metadata.isCheckedGitMetadata(d.metadata), true); assert.equal(d.metadata.available(), true);
    assert.equal(m.isCheckedHookIndex(d), true); assert.equal(d.available(), true);
    assert.ok(Object.isFrozen(d)); assert.ok(Object.isFrozen(d.environment)); assert.ok(Object.isFrozen(d.entries)); assert.ok(Object.isFrozen(d.entries[0]));
    assert.deepEqual(d.entries, [{ path: "public.txt", oid: PUBLIC_OID, mode: "100644" }]);
});

test("F26a checked index admits v2 v3 and an explicit empty-tree index", options, async () => {
    const m = await implementation();
    for (const version of [2, 3]) {
        const f = await prepared(m, { defaultBytes: index([], { version }) });
        assert.deepEqual(f.descriptor.entries, []); assert.equal(f.descriptor.available(), true);
    }
});

test("F26a checked index selects the exact absolute alternative rather than a public default", options, async () => {
    const m = await implementation(), alternative = index([{ path: "config/alternative.env", oid: ALTERNATIVE_OID }]);
    const f = await repository({ alternative }), d = await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true);
    assert.ok(d); assert.equal(d.indexFile, f.alternative);
    assert.deepEqual(d.entries, [{ path: "config/alternative.env", oid: ALTERNATIVE_OID, mode: "100644" }]);
    assert.equal(d.environment.GIT_INDEX_FILE, f.alternative); assert.equal(d.available(), true);
});

test("F26a checked index admits an exact root-relative index.lock containing executable entries", options, async () => {
    const m = await implementation(), f = await repository({ alternative: index([{ path: "scripts/public.sh", mode: 0o100755 }]) });
    const d = await m.prepareCheckedHookIndex(f.root, ".git/index.lock", ambient(), () => true);
    assert.ok(d); assert.equal(d.indexFile, f.alternative); assert.equal(d.entries[0].mode, "100755");
});

test("F26a checked index preserves Unicode spaces leading dashes and repeated OID contexts", options, async () => {
    const m = await implementation(), paths = ["-public.txt", "public space/read me.txt", "unicode/हिन्दी-é.txt"];
    const f = await prepared(m, { defaultBytes: index(paths.map(path => ({ path }))) });
    assert.deepEqual(f.descriptor.entries.map(row => row.path), paths);
});

test("F26a checked index environment is exactly real metadata environment plus its validated absolute index", options, async () => {
    const m = await implementation(), f = await prepared(m), d = f.descriptor;
    const expectedEnvironment: NodeJS.ProcessEnv = { ...d.metadata.environment, GIT_INDEX_FILE: f.indexFile };
    assert.deepEqual(d.environment, expectedEnvironment);
    assert.ok(!Object.values(d.environment).includes(PRIVATE));
    assert.equal(d.environment.PATH, undefined); assert.equal(d.environment.NODE_OPTIONS, undefined); assert.equal(d.environment.OPENAI_API_KEY, undefined);
});

test("F26a checked index does not mistake an inert bounded hooksPath for unsupported metadata", options, async () => {
    const m = await implementation(), f = await prepared(m, { config: CONFIG + "\thooksPath = .hooks\n" });
    assert.equal(f.descriptor.available(), true);
});

test("F26a checked index capability rejects structural clones accessors proxies and unrelated genuine metadata", options, async () => {
    const m = await implementation(), f = await prepared(m); let reads = 0;
    const forged = { ...f.descriptor }, accessor = { get available() { reads++; throw Error(PRIVATE); } };
    for (const value of [undefined, null, {}, forged, accessor, f.descriptor.metadata, new Proxy(f.descriptor, { get() { reads++; throw Error(PRIVATE); } })])
        assert.equal(m.isCheckedHookIndex(value), false);
    assert.equal(reads, 0);
});

test("F26a checked index returns unavailable before every index read when disabled", options, async () => {
    const m = await implementation(), f = await repository({ alternative: index([{ path: "alternative.txt", oid: ALTERNATIVE_OID }]) });
    const observation = await watchReads([f.indexFile, f.alternative], () => m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => false));
    assert.equal(observation.result, undefined); assert.equal(observation.reads, 0);
});

test("F26a checked index rejects missing default and missing explicit alternative without inventing an empty tree", options, async () => {
    const m = await implementation(), absent = await repository({ defaultBytes: null }), normal = await repository();
    assert.equal(await m.prepareCheckedHookIndex(absent.root, undefined, ambient(), () => true), undefined);
    assert.equal(await m.prepareCheckedHookIndex(normal.root, join(normal.git, "missing-index"), ambient(), () => true), undefined);
});

test("F26a checked index rejects outside and worktree paths before reading them or falling back", options, async () => {
    const m = await implementation(), f = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f26a-index-outside-"));
    const outsideIndex = join(outside, "index"), worktreeIndex = join(f.root, "worktree-index");
    await writeFile(outsideIndex, index(), { flag: "wx" }); await writeFile(worktreeIndex, index(), { flag: "wx" });
    const observation = await watchReads([outsideIndex, worktreeIndex], async () => {
        for (const candidate of [outsideIndex, worktreeIndex, "worktree-index"])
            assert.equal(await m.prepareCheckedHookIndex(f.root, candidate, ambient(), () => true), undefined);
    });
    assert.equal(observation.reads, 0);
});

test("F26a checked index refuses unsafe absolute relative ADS control and short-alias selectors", options, async () => {
    const m = await implementation(), f = await repository({ alternative: index() });
    for (const candidate of ["", ".", "..", ".git/../.git/index.lock", ".git/./index.lock", ".git//index.lock", ".git/index.lock/",
        ".git\\index.lock", "C:index", "//server/share/index", "\\\\server\\share\\index", ".git/index.lock:stream", ".git/index.lock.",
        ".git/index.lock ", ".git/INDEX~1", ".git/CON", ".git/index\nlock", ".git/index\u202elock"])
        assert.equal(await m.prepareCheckedHookIndex(f.root, candidate, ambient(), () => true), undefined);
});

test("F26a checked index rejects nonstring selectors without invoking coercion or accessors", options, async () => {
    const m = await implementation(), f = await repository(); let reads = 0;
    const poison = Object.create(null);
    for (const key of ["toString", "valueOf", Symbol.toPrimitive])
        Object.defineProperty(poison, key, { get() { reads++; throw Error(PRIVATE); } });
    for (const candidate of [null, true, 1, 1n, Symbol("public"), [], {}, new String(".git/index"), poison])
        assert.equal(await m.prepareCheckedHookIndex(f.root, candidate, ambient(), () => true), undefined);
    assert.equal(reads, 0);
});

test("F26a checked index refuses nonabsolute root and invalid real metadata", options, async () => {
    const m = await implementation(), f = await repository({ config: CONFIG + "[include]\n\tpath = ../must-not-read\n" });
    assert.equal(await m.prepareCheckedHookIndex("relative", undefined, ambient(), () => true), undefined);
    assert.equal(await m.prepareCheckedHookIndex(f.root, undefined, ambient(), () => true), undefined);
});

test("F26a checked index supports128 entries and withholds129 rather than returning a prefix", options, async () => {
    const m = await implementation();
    const valid = await prepared(m, { defaultBytes: index(Array.from({ length: 128 }, (_, ordinal) => ({ path: "public/entry-" + ordinal + ".txt" }))) });
    assert.equal(valid.descriptor.entries.length, 128);
    await alternativeRefused(m, index(Array.from({ length: 129 }, (_, ordinal) => ({ path: "public/entry-" + ordinal + ".txt" }))));
});

test("F26a checked index preserves the canonical256KiB derived-listing boundary", options, async () => {
    const m = await implementation(), rows = Array.from({ length: 128 }, (_, ordinal) => ({ path: sizedPath(1997, ordinal) }));
    const f = await prepared(m, { defaultBytes: index(rows) }); assert.equal(f.descriptor.entries.length, 128);
    rows[0] = { path: sizedPath(1998, 0) }; await alternativeRefused(m, index(rows));
});

test("F26a checked index bounds raw index bytes independently of entry and listing counts", options, async () => {
    const m = await implementation(), exact = index([], { extensions: [{ name: "TREE", bytes: Buffer.alloc(4194304 - 40) }] });
    assert.equal(exact.length, 4194304);
    const f = await repository({ alternative: exact }), d = await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true);
    assert.ok(d); assert.deepEqual(d.entries, []);
    await alternativeRefused(m, index([], { extensions: [{ name: "TREE", bytes: Buffer.alloc(4194305 - 40) }] }));
});

test("F26a checked index verifies signature version count and checksum instead of trusting a public default", options, async () => {
    const m = await implementation(), good = index();
    const damagedChecksum = Buffer.from(good); damagedChecksum[damagedChecksum.length - 1] ^= 1;
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(31), damagedChecksum,
        mutate(good, body => body.write("FAKE", 0, "ascii")), index([PUBLIC], { version: 1 }), index([PUBLIC], { version: 4 }),
        index([PUBLIC], { count: 0 }), index([PUBLIC], { count: 2 }), good.subarray(0, -1)])
        await alternativeRefused(m, bytes);
});

test("F26a checked index refuses nonzero stages extended entries symlinks submodules and nonregular modes", options, async () => {
    const m = await implementation();
    for (const flags of [0x1000, 0x2000, 0x3000, 0x4000]) await alternativeRefused(m, index([{ path: "public.txt", flags }]));
    for (const mode of [0o120000, 0o160000, 0o040000, 0o100600, 0o100664, 0])
        await alternativeRefused(m, index([{ path: "public.txt", mode }]));
});

test("F26a checked index requires exact path-length flags zero padding and complete entry bodies", options, async () => {
    const m = await implementation(), good = index([{ path: "pp" }]);
    for (const bytes of [index([{ path: "public.txt", nameLength: 1 }]), index([{ path: "public.txt", nameLength: 0xfff }]),
        mutate(good, body => { body[12 + 65] = 1; }), seal(good.subarray(0, -21))])
        await alternativeRefused(m, bytes);
});

test("F26a checked index admits only framed unique TREE and REUC extension records", options, async () => {
    const m = await implementation(), extensions = [{ name: "TREE", bytes: Buffer.from("\0-1 0\n") }, { name: "REUC", bytes: Buffer.alloc(0) }];
    const f = await repository({ alternative: index([PUBLIC], { extensions }) });
    assert.ok(await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true));
    for (const list of [[{ name: "link", bytes: Buffer.alloc(0) }], [{ name: "UNKN", bytes: Buffer.alloc(0) }],
        [{ name: "TREE", bytes: Buffer.alloc(0), declaredLength: 1 }], [extensions[0], extensions[0]]])
        await alternativeRefused(m, index([PUBLIC], { extensions: list }));
    await alternativeRefused(m, seal(Buffer.concat([index().subarray(0, -20), Buffer.from("TREE")])));
});

test("F26a checked index derives safe paths through the canonical parser instead of accepting native index aliases", options, async () => {
    const m = await implementation();
    for (const path of ["../private.txt", "a/../private.txt", "a//b", "a\\b", ".git/config", "a/CON.txt", "a/SAFE~1.TXT", "a/file.", "a/file ", "a/file:stream"])
        await alternativeRefused(m, index([{ path }]));
    for (const rows of [[{ path: "A.txt" }, { path: "a.TXT" }], [{ path: "a" }, { path: "a/b" }],
        [{ path: "caf\u00e9.txt" }, { path: "cafe\u0301.txt" }]]) await alternativeRefused(m, index(rows));
});

test("F26a checked index fatally rejects invalid UTF8 and embedded NUL rather than truncating a private name", options, async () => {
    const m = await implementation();
    for (const name of [Buffer.from([0xc3, 0x28]), Buffer.from([0xed, 0xa0, 0x80]), Buffer.from("public\0" + PRIVATE)])
        await alternativeRefused(m, index([{ path: name }]));
});

test("F26a checked index never reads worktree bodies while preparing or recapturing entries", options, async () => {
    const m = await implementation(), f = await repository(), source = join(f.root, "public.txt");
    await writeFile(source, PRIVATE, { flag: "wx" });
    const observation = await watchReads([source], async () => {
        const d = await m.prepareCheckedHookIndex(f.root, undefined, ambient(), () => true); assert.ok(d); assert.equal(d.available(), true);
    });
    assert.equal(observation.reads, 0);
});

test("F26a checked index rejects a hardlinked selected file and retains both synthetic links", options, async () => {
    const m = await implementation(), f = await repository(), hardlink = join(f.git, "linked-index");
    await link(f.indexFile, hardlink);
    assert.equal(await m.prepareCheckedHookIndex(f.root, hardlink, ambient(), () => true), undefined);
});

test("F26a checked index refuses a junction selector without reading its outside target", options, async () => {
    const m = await implementation(), f = await repository(), target = await mkdtemp(join(tmpdir(), "soter-f26a-index-junction-target-"));
    const outside = join(target, "index"); await writeFile(outside, index(), { flag: "wx" });
    await symlink(target, join(f.git, "junction"), "junction");
    const observation = await watchReads([outside, join(f.git, "junction", "index")], () =>
        m.prepareCheckedHookIndex(f.root, join(f.git, "junction", "index"), ambient(), () => true));
    assert.equal(observation.result, undefined); assert.equal(observation.reads, 0);
});

test("F26a checked index flag withdrawal and later reenable cannot revive a prepared capability", options, async () => {
    const m = await implementation(); let enabled = true;
    const f = await prepared(m, {}, undefined, () => enabled), d = f.descriptor;
    assert.equal(d.available(), true); enabled = false; assert.equal(d.available(), false); enabled = true; assert.equal(d.available(), false);
});

test("F26a checked index throwing authority is unavailable and remains withdrawn", options, async () => {
    const m = await implementation(); let fail = false;
    const f = await prepared(m, {}, undefined, () => { if (fail) throw Error(PRIVATE); return true; });
    fail = true; assert.equal(f.descriptor.available(), false); fail = false; assert.equal(f.descriptor.available(), false);
});

test("F26a checked index exact alternative byte drift withdraws even if the old default stays public", options, async () => {
    const m = await implementation(), original = index([{ path: "alternative.txt", oid: ALTERNATIVE_OID }]), f = await repository({ alternative: original });
    const d = await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true); assert.ok(d);
    await writeFile(f.alternative, index([{ path: "alternative.txt", oid: "d".repeat(40) }])); assert.equal(d.available(), false);
    await writeFile(f.alternative, original); assert.equal(d.available(), false);
    assert.equal(Buffer.compare(await readFile(f.indexFile), index()), 0, "public default must remain untouched");
});

test("F26a checked index identity replacement withdraws even for byte-identical replacement", options, async () => {
    const m = await implementation(), bytes = index([{ path: "alternative.txt", oid: ALTERNATIVE_OID }]), f = await repository({ alternative: bytes });
    const d = await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true); assert.ok(d);
    await containedMove(f.root, f.alternative, join(f.git, "index.lock.retained"));
    await writeFile(f.alternative, bytes, { flag: "wx" }); assert.equal(d.available(), false);
});

test("F26a checked index missing selected file never falls back during recapture", options, async () => {
    const m = await implementation(), f = await repository({ alternative: index([{ path: "alternative.txt", oid: ALTERNATIVE_OID }]) });
    const d = await m.prepareCheckedHookIndex(f.root, f.alternative, ambient(), () => true); assert.ok(d);
    await containedMove(f.root, f.alternative, join(f.git, "index.lock.retained")); assert.equal(d.available(), false);
});

test("F26a checked index metadata config drift withdraws the aggregate without editing shared metadata code", options, async () => {
    const m = await implementation(), f = await prepared(m);
    await writeFile(join(f.git, "config"), CONFIG + "\tautocrlf = false\n"); assert.equal(f.descriptor.available(), false);
    await writeFile(join(f.git, "config"), CONFIG); assert.equal(f.descriptor.available(), false);
});

test("F26a checked index parent replacement by a retained junction withdraws canonical authority", options, async () => {
    const m = await implementation(), f = await prepared(m), retained = join(f.root, ".git.retained");
    await containedMove(f.root, f.git, retained); await symlink(retained, f.git, "junction"); assert.equal(f.descriptor.available(), false);
});
