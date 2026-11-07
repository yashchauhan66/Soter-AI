import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rename, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";

// F26a TEST-FIRST genuine owner discovery capability. Manual retained ordinary
// synthetic metadata only. No Git, child, normal profile or real config is read.
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const PRIVATE = "TEST_ONLY_F26A_OWNER_CONTEXT_PRIVATE_27e08c41", GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const options = { skip: process.platform !== "win32" };
type Metadata = Readonly<{ executable: string; job: string; environment: NodeJS.ProcessEnv; available(): boolean }>;
type Context = Readonly<{ root: string; metadata: Metadata; environment: Readonly<NodeJS.ProcessEnv>; available(): boolean }>;
interface API { prepareCheckedOwnerHookContext(root: string, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Context | undefined>; isCheckedOwnerHookContext(value: unknown): boolean }
async function implementation(): Promise<API> {
    const source = "../history-hooks/CheckedOwnerHookContext", value = await import(source) as Partial<API>;
    assert.equal(typeof value.prepareCheckedOwnerHookContext, "function"); assert.equal(typeof value.isCheckedOwnerHookContext, "function"); return value as API;
}
async function repository() {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-owner-context-")), git = join(root, ".git");
    for (const name of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(git, ...name.split("/")), { recursive: true });
    await writeFile(join(git, "config"), CONFIG, { flag: "wx" }); await writeFile(join(git, "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const header = Buffer.alloc(12); header.write("DIRC"); header.writeUInt32BE(2, 4);
    await writeFile(join(git, "index"), Buffer.concat([header, createHash("sha1").update(header).digest()]), { flag: "wx" });
    const ambient: NodeJS.ProcessEnv = { HOME: join(root, "synthetic-profile"), USERPROFILE: join(root, "synthetic-profile"),
        XDG_CONFIG_HOME: join(root, "synthetic-xdg"), GIT_CONFIG_GLOBAL: join(root, "synthetic-global"), GIT_CONFIG_SYSTEM: join(root, "synthetic-system"),
        GIT_CONFIG_NOSYSTEM: "1", SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", COMSPEC: "C:\\Windows\\System32\\cmd.exe",
        PATH: PRIVATE, NODE_OPTIONS: PRIVATE, NODE_PATH: PRIVATE, OPENAI_API_KEY: PRIVATE };
    return { root, git, ambient };
}
async function prepared(api: API, enabled = () => true) {
    const f = await repository(), context = await api.prepareCheckedOwnerHookContext(f.root, f.ambient, enabled);
    assert.ok(context, "ordinary manual synthetic root must acquire owner context"); return { ...f, context };
}
function watchReads<T>(file: string, work: () => Promise<T>): Promise<{ value: T; reads: number }> {
    const fs = require("node:fs") as { readFileSync: typeof import("node:fs").readFileSync };
    const original = fs.readFileSync; let reads = 0;
    fs.readFileSync = ((...args: Parameters<typeof original>) => { if (typeof args[0] === "string" && resolve(args[0]).toLowerCase() === resolve(file).toLowerCase()) reads++; return original(...args); }) as typeof original;
    syncBuiltinESMExports(); return work().then(value => ({ value, reads })).finally(() => { fs.readFileSync = original; syncBuiltinESMExports(); });
}
async function move(root: string, source: string, target: string): Promise<void> {
    for (const file of [source, target]) { const rel = relative(resolve(root), resolve(file)); assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep)); }
    await rename(source, target);
}

test("F26a owner context internally acquires genuine exact-root metadata and a frozen capability", options, async () => {
    const api = await implementation(), f = await prepared(api), metadata = await import("../terminal/CheckedGitMetadata");
    assert.equal(f.context.root, f.root); assert.equal(api.isCheckedOwnerHookContext(f.context), true); assert.equal(f.context.available(), true);
    assert.equal(metadata.isCheckedGitMetadata(f.context.metadata), true); assert.equal(f.context.metadata.executable, GIT);
    assert.ok(Object.isFrozen(f.context)); assert.ok(Object.isFrozen(f.context.environment));
});

test("F26a owner context environment is exact owner projection rather than isolated scanner environment", options, async () => {
    const api = await implementation(), f = await prepared(api), projection = await import("../history-hooks/OwnerHookProtocol");
    assert.deepEqual(f.context.environment, projection.buildOwnerHookEnvironment(f.ambient));
    assert.notDeepEqual(f.context.environment, f.context.metadata.environment); assert.equal(f.context.environment.HOME, f.ambient.HOME);
    assert.equal(f.context.environment.GIT_CONFIG_GLOBAL, f.ambient.GIT_CONFIG_GLOBAL); assert.equal(f.context.environment.GIT_CONFIG_SYSTEM, f.ambient.GIT_CONFIG_SYSTEM);
    for (const name of ["PATH", "NODE_OPTIONS", "NODE_PATH", "OPENAI_API_KEY", "GIT_INDEX_FILE"]) assert.equal(f.context.environment[name], undefined);
    assert.ok(!Object.values(f.context.environment).includes(PRIVATE));
});

test("F26a owner context creates fresh metadata separately for each exact root", options, async () => {
    const api = await implementation(), first = await prepared(api), again = await api.prepareCheckedOwnerHookContext(first.root, first.ambient, () => true), second = await prepared(api);
    assert.ok(again); assert.notEqual(first.context.metadata, again.metadata); assert.notEqual(first.context.metadata.job, again.metadata.job);
    assert.notEqual(first.context.metadata, second.context.metadata); assert.notEqual(first.context.metadata.job, second.context.metadata.job);
    assert.equal(first.context.root, first.root); assert.equal(again.root, first.root); assert.equal(second.context.root, second.root); assert.notEqual(first.root, second.root);
    assert.equal(first.context.available(), true); assert.equal(again.available(), true); assert.equal(second.context.available(), true);
});

test("F26a owner context rejects lookalikes unrelated metadata accessors and proxies without traps", options, async () => {
    const api = await implementation(), f = await prepared(api); let traps = 0;
    const proxy = new Proxy(f.context, { get() { traps++; throw Error(PRIVATE); }, getPrototypeOf() { traps++; throw Error(PRIVATE); } });
    const accessor = { get available() { traps++; throw Error(PRIVATE); } };
    for (const value of [null, undefined, {}, { ...f.context }, f.context.metadata, proxy, accessor]) assert.equal(api.isCheckedOwnerHookContext(value), false);
    assert.equal(traps, 0);
});

test("F26a owner context disabled or throwing authority refuses before local config reads", options, async () => {
    const api = await implementation(), f = await repository();
    for (const enabled of [() => false, () => { throw Error(PRIVATE); }]) {
        const seen = await watchReads(join(f.git, "config"), () => api.prepareCheckedOwnerHookContext(f.root, f.ambient, enabled));
        assert.equal(seen.value, undefined); assert.equal(seen.reads, 0);
    }
});

test("F26a owner context refuses ambient selectors and invalid roots instead of borrowing authority", options, async () => {
    const api = await implementation(), f = await repository();
    for (const extra of [{ GIT_CONFIG: PRIVATE }, { GIT_CONFIG_COUNT: "0" }, { GIT_INDEX_FILE: PRIVATE }, { HOME: "relative" }])
        assert.equal(await api.prepareCheckedOwnerHookContext(f.root, { ...f.ambient, ...extra }, () => true), undefined);
    for (const root of ["relative", f.root + "\\..\\" + f.root.split("\\").at(-1), "\\\\server\\share"])
        assert.equal(await api.prepareCheckedOwnerHookContext(root, f.ambient, () => true), undefined);
});

test("F26a owner context disable then reenable cannot revive its prepared capability", options, async () => {
    const api = await implementation(); let enabled = true; const f = await prepared(api, () => enabled);
    enabled = false; assert.equal(f.context.available(), false); enabled = true; assert.equal(f.context.available(), false);
});

test("F26a owner context throwing authority remains sticky after the callback recovers", options, async () => {
    const api = await implementation(); let fail = false; const f = await prepared(api, () => { if (fail) throw Error(PRIVATE); return true; });
    fail = true; assert.equal(f.context.available(), false); fail = false; assert.equal(f.context.available(), false);
});

test("F26a owner context local config drift stays withdrawn after exact bytes are restored", options, async () => {
    const api = await implementation(), f = await prepared(api);
    await writeFile(join(f.git, "config"), CONFIG + "[core]\n hooksPath = .synthetic-hooks\n"); assert.equal(f.context.available(), false);
    await writeFile(join(f.git, "config"), CONFIG); assert.equal(f.context.available(), false);
});

test("F26a owner context also requires unchanged private metadata job authority", options, async () => {
    const api = await implementation(), f = await prepared(api), file = join(f.context.metadata.job, "empty.gitconfig");
    await writeFile(file, PRIVATE); assert.equal(f.context.available(), false); await writeFile(file, ""); assert.equal(f.context.available(), false);
});

test("F26a owner context rejects a replaced git ancestor junction without restoring availability", options, async () => {
    const api = await implementation(), f = await prepared(api), retained = join(f.root, ".git.retained");
    await move(f.root, f.git, retained); await symlink(retained, f.git, "junction"); assert.equal(f.context.available(), false);
});

test("F26a owner context withdraws on observed pinned Git identity drift without altering the executable", options, async () => {
    const api = await implementation(), f = await prepared(api), fs = require("node:fs") as { lstatSync: typeof import("node:fs").lstatSync };
    const original = fs.lstatSync;
    try {
        fs.lstatSync = ((...args: Parameters<typeof original>) => {
            const stat = original(...args);
            if (typeof args[0] === "string" && resolve(args[0]).toLowerCase() === resolve(GIT).toLowerCase())
                return Object.assign(Object.create(stat), { mtimeMs: Number(stat.mtimeMs) + 1 });
            return stat;
        }) as typeof original;
        syncBuiltinESMExports(); assert.equal(f.context.available(), false);
    } finally { fs.lstatSync = original; syncBuiltinESMExports(); }
    assert.equal(f.context.available(), false, "restored observation cannot revive old authority");
});
