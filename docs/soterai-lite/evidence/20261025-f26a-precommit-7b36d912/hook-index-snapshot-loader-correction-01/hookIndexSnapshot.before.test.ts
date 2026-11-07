import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rename, link, symlink, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";

// F26a TEST-FIRST additive snapshot contract. Manual synthetic SHA1 DIRC only;
// no Git/child/network/normal-profile access or fixture deletion. Retain all roots.
const PRIVATE = "TEST_ONLY_F26A_SNAPSHOT_PRIVATE_4e08ac71";
const OID = "1".repeat(40), OTHER = "d".repeat(40);
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const options = { skip: process.platform !== "win32" };
type Row = Readonly<{ path: string; oid: string; mode: "100644" | "100755" }>;
type Snapshot = Readonly<{ indexFile: string; indexSha256: string; indexIdentity: string; entries: readonly Row[] }>;
type Descriptor = Snapshot & Readonly<{ root: string; metadata: unknown; environment: NodeJS.ProcessEnv; available(): boolean }>;
type Implementation = {
    captureHookIndex(root: string, indexPath: unknown): Snapshot | undefined;
    prepareCheckedHookIndex(root: string, indexPath: unknown, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Descriptor | undefined>;
    isCheckedHookIndex(value: unknown): boolean;
};
interface Entry { path: string; oid?: string; mode?: number; flags?: number }
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const seal = (body: Buffer): Buffer => Buffer.concat([body, createHash("sha1").update(body).digest()]);
function index(rows: readonly Entry[] = [{ path: "public.txt" }], version = 2, extension?: string): Buffer {
    const header = Buffer.alloc(12); header.write("DIRC", 0, "ascii");
    header.writeUInt32BE(version, 4); header.writeUInt32BE(rows.length, 8);
    const entries = rows.map(row => {
        const name = Buffer.from(row.path, "utf8"), fixed = Buffer.alloc(62);
        fixed.writeUInt32BE(row.mode ?? 0o100644, 24);
        Buffer.from(row.oid ?? OID, "hex").copy(fixed, 40, 0, 20);
        fixed.writeUInt16BE((row.flags ?? 0) | name.length, 60);
        return Buffer.concat([fixed, name, Buffer.alloc(Math.ceil((63 + name.length) / 8) * 8 - 62 - name.length)]);
    });
    const extra = Buffer.alloc(extension ? 8 : 0); if (extension) extra.write(extension, 0, 4, "ascii");
    return seal(Buffer.concat([header, ...entries, extra]));
}
async function implementation(): Promise<Implementation> {
    // Do not statically reference the additive export: absent-API baseline must
    // execute as an assertion failure, not fail module linking or typechecking.
    const value = await import("../history-hooks/CheckedHookIndex") as unknown as Partial<Implementation>;
    assert.equal(typeof value.captureHookIndex, "function", "additive captureHookIndex API must exist");
    assert.equal(typeof value.prepareCheckedHookIndex, "function"); assert.equal(typeof value.isCheckedHookIndex, "function");
    return value as Implementation;
}
async function repository(bytes: Buffer | null = index(), alternative?: Buffer) {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-snapshot-")), git = join(root, ".git");
    await mkdir(join(git, "objects", "info"), { recursive: true });
    await mkdir(join(git, "objects", "pack"), { recursive: true });
    await mkdir(join(git, "refs", "heads"), { recursive: true });
    await writeFile(join(git, "config"), CONFIG, { flag: "wx" });
    await writeFile(join(git, "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    if (bytes !== null) await writeFile(join(git, "index"), bytes, { flag: "wx" });
    if (alternative) await writeFile(join(git, "index.lock"), alternative, { flag: "wx" });
    return { root, git, indexFile: join(git, "index"), alternative: join(git, "index.lock") };
}
function captured(m: Implementation, root: string, selected: unknown = undefined): Snapshot {
    const value = m.captureHookIndex(root, selected); assert.ok(value, "valid retained synthetic index must capture");
    assert.match(value.indexSha256, /^[a-f0-9]{64}$/); assert.match(value.indexIdentity, /^[a-f0-9]{64}$/);
    assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(value.entries));
    for (const row of value.entries) assert.ok(Object.isFrozen(row));
    return value;
}
function inside(root: string, file: string): void {
    const rel = relative(resolve(root), resolve(file));
    assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep), "synthetic move must remain in its exact retained fixture root");
}
async function move(root: string, source: string, target: string): Promise<void> { inside(root, source); inside(root, target); await rename(source, target); }
async function replaceIndex(f: Awaited<ReturnType<typeof repository>>, bytes: Buffer): Promise<void> {
    const incoming = join(f.git, "index.incoming"), retained = join(f.git, "index.before-replacement");
    await writeFile(retained, await readFile(f.indexFile), { flag: "wx" });
    await writeFile(incoming, bytes, { flag: "wx" }); await move(f.root, incoming, f.indexFile);
}
function watchReads<T>(targets: readonly string[], work: () => T): { result: T; reads: number } {
    const fs = require("node:fs") as { readFileSync: typeof import("node:fs").readFileSync; openSync: typeof import("node:fs").openSync };
    const read = fs.readFileSync, open = fs.openSync; let reads = 0;
    const watched = (value: unknown) => typeof value === "string" && targets.some(target => resolve(value).toLowerCase() === resolve(target).toLowerCase());
    try {
        fs.readFileSync = ((...args: Parameters<typeof read>) => { if (watched(args[0])) reads++; return read(...args); }) as typeof read;
        fs.openSync = ((...args: Parameters<typeof open>) => { if (watched(args[0])) reads++; return open(...args); }) as typeof open;
        syncBuiltinESMExports(); const result = work(); return { result, reads };
    } finally { fs.readFileSync = read; fs.openSync = open; syncBuiltinESMExports(); }
}
const ambient = (): NodeJS.ProcessEnv => ({ SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
    NODE_OPTIONS: PRIVATE, NODE_PATH: PRIVATE, GIT_INDEX_FILE: PRIVATE, PATH: PRIVATE });

test("F26a snapshot captures exact index SHA256 and deeply frozen staged entries without granting capability", options, async () => {
    const m = await implementation(), bytes = index([{ path: "public.txt" }, { path: "scripts/public.sh", oid: OTHER, mode: 0o100755 }]), f = await repository(bytes);
    const value = captured(m, f.root);
    assert.deepEqual(Object.keys(value).sort(), ["entries", "indexFile", "indexIdentity", "indexSha256"]);
    assert.equal(value.indexFile, f.indexFile); assert.equal(value.indexSha256, digest(bytes));
    assert.deepEqual(value.entries, [{ path: "public.txt", oid: OID, mode: "100644" }, { path: "scripts/public.sh", oid: OTHER, mode: "100755" }]);
    assert.equal(m.isCheckedHookIndex(value), false, "synchronous snapshot is data, not genuine metadata authority");
});

test("F26a snapshot has stable identity and digest across unchanged recaptures", options, async () => {
    const m = await implementation(), f = await repository(), before = captured(m, f.root), after = captured(m, f.root);
    assert.deepEqual(after, before); assert.equal(after.indexIdentity, before.indexIdentity);
});

test("F26a snapshot accepts supported v2 v3 and empty indexes with their own exact byte hashes", options, async () => {
    const m = await implementation();
    for (const version of [2, 3]) {
        const bytes = index([], version), f = await repository(bytes), value = captured(m, f.root);
        assert.equal(value.indexSha256, digest(bytes)); assert.deepEqual(value.entries, []);
    }
});

test("F26a snapshot binds absolute and canonical root-relative selectors to the actual alternative", options, async () => {
    const m = await implementation(), bytes = index([{ path: "alternative.txt", oid: OTHER }]), f = await repository(index(), bytes);
    const absolute = captured(m, f.root, f.alternative), relative = captured(m, f.root, ".git/index.lock");
    assert.deepEqual(relative, absolute); assert.equal(absolute.indexFile, f.alternative); assert.equal(absolute.indexSha256, digest(bytes));
    assert.notEqual(absolute.indexSha256, captured(m, f.root).indexSha256);
});

test("F26a snapshot byte drift changes digest and identity while old frozen observations stay unchanged", options, async () => {
    const m = await implementation(), first = index(), f = await repository(first), before = captured(m, f.root);
    const next = index([{ path: "public.txt", oid: OTHER }]); await writeFile(f.indexFile, next);
    const after = captured(m, f.root); assert.equal(after.indexSha256, digest(next)); assert.notEqual(after.indexSha256, before.indexSha256);
    assert.notEqual(after.indexIdentity, before.indexIdentity); assert.equal(before.indexSha256, digest(first)); assert.equal(before.entries[0].oid, OID);
});

test("F26a snapshot distinguishes byte-identical atomic index replacement from unchanged identity", options, async () => {
    const m = await implementation(), bytes = index(), f = await repository(bytes), before = captured(m, f.root);
    const original = await lstat(f.indexFile); await replaceIndex(f, bytes); const after = captured(m, f.root);
    assert.notEqual((await lstat(f.indexFile)).ino, original.ino, "fixture must replace the underlying file");
    assert.equal(after.indexSha256, before.indexSha256); assert.notEqual(after.indexIdentity, before.indexIdentity);
});

test("F26a snapshot identity covers parent git replacement even when the same index file survives", options, async () => {
    const m = await implementation(), f = await repository(), before = captured(m, f.root), original = await lstat(f.indexFile);
    const retained = join(f.root, ".git.retained"); await move(f.root, f.git, retained); await mkdir(f.git);
    await move(f.root, join(retained, "index"), f.indexFile);
    assert.equal((await lstat(f.indexFile)).ino, original.ino, "only the parent identity changed");
    const after = captured(m, f.root); assert.equal(after.indexSha256, before.indexSha256); assert.notEqual(after.indexIdentity, before.indexIdentity);
});

test("F26a snapshot refuses a junction symlink replacing git without reading its index target", options, async () => {
    const m = await implementation(), f = await repository(), retained = join(f.root, ".git.retained");
    await move(f.root, f.git, retained); await symlink(retained, f.git, "junction");
    const watched = watchReads([f.indexFile, join(retained, "index")], () => m.captureHookIndex(f.root, undefined));
    assert.equal(watched.result, undefined); assert.equal(watched.reads, 0);
});

test("F26a snapshot refuses a symlink junction root instead of canonicalizing it to another authority", options, async () => {
    const m = await implementation(), f = await repository(), container = await mkdtemp(join(tmpdir(), "soter-f26a-snapshot-alias-"));
    const alias = join(container, "root"); await symlink(f.root, alias, "junction");
    const watched = watchReads([f.indexFile, join(alias, ".git", "index")], () => m.captureHookIndex(alias, undefined));
    assert.equal(watched.result, undefined); assert.equal(watched.reads, 0);
});

test("F26a snapshot refuses a hardlinked alternative without falling back to the valid default", options, async () => {
    const m = await implementation(), f = await repository(index(), index([{ path: "alternative.txt", oid: OTHER }]));
    const linked = join(f.git, "linked-index"); await link(f.alternative, linked);
    assert.equal(m.captureHookIndex(f.root, linked), undefined); assert.equal(m.captureHookIndex(f.root, f.alternative), undefined);
    assert.equal(captured(m, f.root).indexSha256, digest(index()));
});

test("F26a snapshot missing default or explicit alternative never invents an empty or fallback index", options, async () => {
    const m = await implementation(), missing = await repository(null), f = await repository();
    assert.equal(m.captureHookIndex(missing.root, undefined), undefined);
    assert.equal(m.captureHookIndex(f.root, join(f.git, "missing")), undefined);
    assert.equal(m.captureHookIndex(f.root, ".git/missing"), undefined);
});

test("F26a snapshot rejects invalid selectors without caller coercion getters or default fallback", options, async () => {
    const m = await implementation(), f = await repository(); let accesses = 0;
    const poison = Object.create(null);
    for (const key of ["toString", "valueOf", Symbol.toPrimitive]) Object.defineProperty(poison, key, { get() { accesses++; throw Error(PRIVATE); } });
    for (const selected of [null, true, 0, 1n, Symbol("index"), [], {}, new String(".git/index"), poison, "", ".git/index\n", ".git/index\u202e"])
        assert.equal(m.captureHookIndex(f.root, selected), undefined);
    assert.equal(accesses, 0); assert.equal(captured(m, f.root).indexFile, f.indexFile);
});

test("F26a snapshot refuses outside worktree noncanonical ADS and short-alias index paths before content reads", options, async () => {
    const m = await implementation(), f = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f26a-snapshot-outside-"));
    const external = join(outside, "index"), source = join(f.root, "worktree-index");
    await writeFile(external, index(), { flag: "wx" }); await writeFile(source, index(), { flag: "wx" });
    const watched = watchReads([external, source], () => {
        for (const selected of [external, source, "worktree-index", ".git/../.git/index", ".git/./index", ".git//index", ".git\\index",
            ".git/index:stream", ".git/INDEX~1", ".git/index.", ".git/index ", "//server/share/index", "C:index"])
            assert.equal(m.captureHookIndex(f.root, selected), undefined);
        assert.equal(m.captureHookIndex("relative-root", undefined), undefined);
    });
    assert.equal(watched.reads, 0);
});

test("F26a snapshot refuses corrupt or unsupported DIRC bytes rather than hashing them into authority", options, async () => {
    const m = await implementation(), good = index(), badChecksum = Buffer.from(good); badChecksum[badChecksum.length - 1] ^= 1;
    for (const bytes of [Buffer.alloc(0), good.subarray(0, -1), badChecksum, index([], 4), index([], 2, "link"),
        index([{ path: "public.txt", flags: 0x1000 }]), index([{ path: "public.txt", mode: 0o120000 }]), index([{ path: "public.txt", mode: 0o160000 }])]) {
        const f = await repository(index(), bytes); assert.equal(m.captureHookIndex(f.root, f.alternative), undefined);
    }
});

test("F26a snapshot preserves strict staged path and complete entry-count refusal", options, async () => {
    const m = await implementation();
    for (const rows of [[{ path: "../outside" }], [{ path: ".git/config" }], [{ path: "A" }, { path: "a" }],
        [{ path: "a" }, { path: "a/b" }], Array.from({ length: 129 }, (_, n) => ({ path: "public-" + n }))]) {
        const f = await repository(index(), index(rows)); assert.equal(m.captureHookIndex(f.root, f.alternative), undefined);
    }
});

test("F26a snapshot captures independently of metadata factory or child launch authority", options, async () => {
    const m = await implementation(), f = await repository(), metadata = require("../terminal/CheckedGitMetadata") as {
        prepareCheckedGitMetadata: typeof import("../terminal/CheckedGitMetadata").prepareCheckedGitMetadata };
    const children = require("node:child_process") as { spawn: typeof import("node:child_process").spawn };
    const prepare = metadata.prepareCheckedGitMetadata, spawn = children.spawn; let preparations = 0, launches = 0;
    try {
        metadata.prepareCheckedGitMetadata = (() => { preparations++; throw Error("Snapshot cannot prepare metadata."); }) as typeof prepare;
        children.spawn = (() => { launches++; throw Error("Snapshot cannot launch children."); }) as typeof spawn;
        syncBuiltinESMExports(); const value = captured(m, f.root); assert.equal(value.indexSha256, digest(index()));
        assert.equal(preparations, 0); assert.equal(launches, 0);
    } finally { metadata.prepareCheckedGitMetadata = prepare; children.spawn = spawn; syncBuiltinESMExports(); }
});

test("F26a snapshot never reads staged worktree bodies or includes their bytes in its result", options, async () => {
    const m = await implementation(), f = await repository(), source = join(f.root, "public.txt");
    await writeFile(source, PRIVATE, { flag: "wx" });
    const watched = watchReads([source], () => { const before = captured(m, f.root), after = captured(m, f.root); assert.deepEqual(after, before); return after; });
    assert.equal(watched.reads, 0); assert.ok(!JSON.stringify(watched.result).includes(PRIVATE));
});

test("F26a genuine index descriptor exposes the exact same frozen digest identity and entries as capture", options, async () => {
    const m = await implementation(), f = await repository(), before = captured(m, f.root);
    const descriptor = await m.prepareCheckedHookIndex(f.root, undefined, ambient(), () => true); assert.ok(descriptor);
    assert.equal(m.isCheckedHookIndex(descriptor), true); assert.equal(descriptor.available(), true); assert.ok(Object.isFrozen(descriptor));
    assert.equal(descriptor.indexFile, before.indexFile); assert.equal(descriptor.indexSha256, before.indexSha256); assert.equal(descriptor.indexIdentity, before.indexIdentity);
    assert.deepEqual(descriptor.entries, before.entries); assert.ok(Object.isFrozen(descriptor.entries));
    const metadata = await import("../terminal/CheckedGitMetadata"); assert.equal(metadata.isCheckedGitMetadata(descriptor.metadata), true);
});

test("F26a genuine descriptor retains its old snapshot and sticky withdrawal after byte drift is restored", options, async () => {
    const m = await implementation(), first = index(), f = await repository(first), descriptor = await m.prepareCheckedHookIndex(f.root, undefined, ambient(), () => true);
    assert.ok(descriptor); const original = captured(m, f.root);
    await writeFile(f.indexFile, index([{ path: "public.txt", oid: OTHER }])); assert.equal(descriptor.available(), false);
    assert.notEqual(captured(m, f.root).indexSha256, descriptor.indexSha256);
    await writeFile(f.indexFile, first); assert.equal(descriptor.available(), false); assert.equal(descriptor.indexSha256, original.indexSha256);
    assert.equal(descriptor.indexIdentity, original.indexIdentity); assert.deepEqual(descriptor.entries, original.entries);
});

test("F26a genuine descriptor binds file identity even when replacement has identical digest and entries", options, async () => {
    const m = await implementation(), bytes = index(), f = await repository(bytes), descriptor = await m.prepareCheckedHookIndex(f.root, undefined, ambient(), () => true);
    assert.ok(descriptor); const before = captured(m, f.root); await replaceIndex(f, bytes);
    const after = captured(m, f.root); assert.equal(after.indexSha256, descriptor.indexSha256); assert.deepEqual(after.entries, descriptor.entries);
    assert.notEqual(after.indexIdentity, before.indexIdentity); assert.equal(descriptor.indexIdentity, before.indexIdentity);
    assert.equal(descriptor.available(), false); assert.equal(descriptor.available(), false);
});
