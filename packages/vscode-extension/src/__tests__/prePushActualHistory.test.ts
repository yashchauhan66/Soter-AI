import assert from "node:assert/strict";
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { deflateSync } from "node:zlib";
import { prepareCheckedPushRefs } from "../history-hooks/CheckedPushRefs";
import { PrePushGitProcess } from "../history-hooks/PrePushGitProcess";
import { PrePushScan } from "../history-hooks/PrePushScan";

// Actual installed fixed Git performs READ-ONLY version/rev-list/ls-tree/cat-file.
// The fixture writes its own valid loose objects. No Git initialization, commit,
// push, shell, hook execution, network, profile reuse, cleanup or signal occurs.
const options = { skip: process.platform !== "win32" };
const base = "D:\\SoterAI-Lite-test-profiles\\f03-unit-temp";
const git = "C:\\Program Files\\Git\\cmd\\git.exe";
const gitSha256 = "da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f";
const zero = "0".repeat(40);
const synthetic = "sk-proj-" + "SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
type Entry = { name: string; oid: string; mode?: "100644" | "100755" | "120000" | "160000" };
type Observation = { operation: string; close: boolean; stdoutEOF: boolean; stderrEOF: boolean; exit: number | null; signal: NodeJS.Signals | null; signalsRequested: number };

function installedPin(): void {
    assert.equal(realpathSync(git).toLowerCase(), git.toLowerCase());
    const before = lstatSync(git, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink());
    assert(before.nlink === 1n || before.nlink === 2n, "only the exact pinned installed Git may have its known second link");
    assert.equal(createHash("sha256").update(readFileSync(git)).digest("hex"), gitSha256);
    const after = lstatSync(git, { bigint: true });
    for (const field of ["dev", "ino", "size", "mtimeNs", "ctimeNs", "birthtimeNs", "nlink"] as const) assert.equal(after[field], before[field]);
}
async function repository() {
    installedPin();
    assert.equal(realpathSync(base).toLowerCase(), base.toLowerCase());
    const root = await mkdtemp(join(base, "soter-f26b-real-history-"));
    for (const directory of ["objects/info", "objects/pack", "refs/heads", "hooks", "info"])
        await mkdir(join(root, ".git", ...directory.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n autocrlf = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "info", "exclude"), "", { flag: "wx" });
    const created = new Set<string>(); let serial = 0;
    async function object(kind: "blob" | "tree" | "commit" | "tag", body: Buffer | string): Promise<string> {
        const bytes = Buffer.from(body), raw = Buffer.concat([Buffer.from(`${kind} ${bytes.length}\0`), bytes]);
        const oid = createHash("sha1").update(raw).digest("hex");
        if (!created.has(oid)) {
            await mkdir(join(root, ".git", "objects", oid.slice(0, 2)), { recursive: true });
            await writeFile(join(root, ".git", "objects", oid.slice(0, 2), oid.slice(2)), deflateSync(raw), { flag: "wx" }); created.add(oid);
        }
        return oid;
    }
    async function blob(body: string | Buffer) { return object("blob", body); }
    async function tree(entries: Entry[]) {
        const ordered = entries.slice().sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
        return object("tree", Buffer.concat(ordered.flatMap(row => [Buffer.from(`${row.mode ?? "100644"} ${row.name}\0`), Buffer.from(row.oid, "hex")])));
    }
    async function commit(entries: Entry[], parents: string[] = []) {
        const treeOid = await tree(entries), ordinal = ++serial;
        return object("commit", `tree ${treeOid}\n${parents.map(p => `parent ${p}\n`).join("")}author Synthetic F26b <f26b@example.invalid> ${1700000000 + ordinal} +0000\ncommitter Synthetic F26b <f26b@example.invalid> ${1700000000 + ordinal} +0000\n\nSynthetic history ${ordinal}\n`);
    }
    return { root, blob, tree, commit, object };
}
type Repo = Awaited<ReturnType<typeof repository>>;
async function scan(repo: Repo, tips: string[], context: TestContext, overrides: { raw?: Buffer; ambient?: NodeJS.ProcessEnv } = {}) {
    const raw = overrides.raw ?? Buffer.from(tips.map((tip, i) => `refs/heads/source${i} ${tip} refs/heads/target${i} ${zero}\n`).join(""));
    // Hash-only comparison: Node's assertion formatter must never receive
    // ambient values, including when the preservation assertion fails.
    const environmentDigest = () => createHash("sha256").update(JSON.stringify(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
    const parentEnvironment = environmentDigest();
    const refs = await prepareCheckedPushRefs(repo.root, raw, overrides.ambient ?? { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(refs, "manually authored isolated real Git objects must admit checked metadata");
    const children: Observation[] = [], operations: string[] = [];
    const worker = new PrePushScan({ refs, valid: () => true, deadline: performance.now() + 60000,
        createProcess(input) {
            operations.push(input.operation.kind);
            return new PrePushGitProcess({ ...input, spawn: ((file: string, args: readonly string[], settings: SpawnOptions) => {
                assert.equal(file, git); assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true);
                assert.equal(settings.cwd, input.operation.kind === "version" ? refs.metadata.job : repo.root);
                assert.deepEqual(settings.env, refs.environment);
                for (const forbidden of ["PATH", "NODE_OPTIONS", "OPENAI_API_KEY", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG_COUNT"])
                    assert.equal(settings.env?.[forbidden], undefined);
                for (const forbidden of ["signal", "timeout", "killSignal"]) assert.equal((settings as Record<string, unknown>)[forbidden], undefined);
                assert(args.includes("--no-lazy-fetch") && args.includes("--no-replace-objects") && args.includes("--no-optional-locks"));
                assert(args.includes("protocol.allow=never") && args.includes("core.hooksPath=" + join(refs.metadata.job, "empty-hooks")));
                if (input.operation.kind === "version") assert.deepEqual(args.slice(-1), ["--version"]);
                else if (input.operation.kind === "commits") assert.deepEqual(args.slice(-4), ["rev-list", "--max-count=33", "--stdin", "--"]);
                else if (input.operation.kind === "tree") assert.deepEqual(args.slice(-7), ["ls-tree", "-r", "-z", "--full-tree", "--long", input.operation.oid, "--"]);
                else assert.deepEqual(args.slice(-2), ["cat-file", "--batch"]);
                const child = spawn(file, args as string[], settings), observed: Observation = { operation: input.operation.kind,
                    close: false, stdoutEOF: false, stderrEOF: false, exit: null, signal: null, signalsRequested: 0 };
                children.push(observed);
                child.kill = (() => { observed.signalsRequested++; throw Error("No process signals are authorized."); }) as ChildProcess["kill"];
                assert(child.stdout && child.stderr);
                child.stdout.once("end", () => observed.stdoutEOF = true); child.stderr.once("end", () => observed.stderrEOF = true);
                child.once("close", (code, signal) => { observed.close = true; observed.exit = code; observed.signal = signal; });
                return child;
            }) as typeof spawn });
        } });
    const result = await worker.start(); await worker.closed;
    assert.equal(worker.busy, false); assert(refs.available()); assert.equal(environmentDigest(), parentEnvironment);
    for (const child of children) { assert(child.close && child.stdoutEOF && child.stderrEOF); assert.equal(child.signal, null); assert.equal(child.signalsRequested, 0); }
    assert.deepEqual(Object.keys(result), ["status"]); assert(!JSON.stringify(result).includes(synthetic));
    installedPin();
    context.diagnostic(JSON.stringify({ fixture: repo.root, status: result.status, operations, children, scope: "actual fixed READ_ONLY Git; manual synthetic objects; no push; no response seams" }));
    return { result, worker, operations, children };
}

test("F26b actual Git completely scans a public branch and releases only its held ALLOW", options, async t => {
    const repo = await repository(), text = await repo.blob("Useful public example.\n"), tip = await repo.commit([{ name: "public.txt", oid: text }]);
    const run = await scan(repo, [tip], t); assert.deepEqual(run.result, { status: "ALLOW" }); assert(run.worker.canRelease(run.result));
    assert(!run.worker.canRelease({ status: "ALLOW" })); assert.deepEqual(run.operations, ["version", "commits", "tree", "batch"]);
    assert(run.children.every(child => child.exit === 0)); assert(!existsSync(join(repo.root, "public.txt")), "no worktree input is needed");
});
test("F26b actual Git blocks a secret deleted from the proposed tip", options, async t => {
    const repo = await repository(), secret = await repo.blob(synthetic), clean = await repo.blob("Public replacement.\n");
    const old = await repo.commit([{ name: "removed.txt", oid: secret }]), tip = await repo.commit([{ name: "public.txt", oid: clean }], [old]);
    const run = await scan(repo, [tip], t); assert.equal(run.result.status, "BLOCK"); assert.equal(run.operations.filter(x => x === "tree").length, 2);
});
test("F26b actual Git retains the removed secret under rename and rewritten tip content", options, async t => {
    const repo = await repository(), secret = await repo.blob(synthetic), clean = await repo.blob("Public later contents.\n");
    const old = await repo.commit([{ name: "original.txt", oid: secret }]), rename = await repo.commit([{ name: "renamed.txt", oid: secret }], [old]);
    const tip = await repo.commit([{ name: "renamed.txt", oid: clean }], [rename]), run = await scan(repo, [tip], t);
    assert.equal(run.result.status, "BLOCK"); assert.equal(run.operations.filter(x => x === "tree").length, 3);
});
test("F26b actual Git traverses both merge parents including a removed side-branch secret", options, async t => {
    const repo = await repository(), publicOid = await repo.blob("Public branch data.\n"), secret = await repo.blob(synthetic);
    const base = await repo.commit([{ name: "base.txt", oid: publicOid }]), left = await repo.commit([{ name: "left.txt", oid: publicOid }], [base]);
    const right = await repo.commit([{ name: "side.txt", oid: secret }], [base]), merge = await repo.commit([{ name: "merged.txt", oid: publicOid }], [left, right]);
    const run = await scan(repo, [merge], t); assert.equal(run.result.status, "BLOCK"); assert.equal(run.operations.filter(x => x === "tree").length, 4);
});
test("F26b actual Git does not trust the remote tip to exclude already remote secret history", options, async t => {
    const repo = await repository(), secret = await repo.blob(synthetic), publicOid = await repo.blob("Public tip.\n");
    const old = await repo.commit([{ name: "old.txt", oid: secret }]), tip = await repo.commit([{ name: "public.txt", oid: publicOid }], [old]);
    const raw = Buffer.from(`HEAD ${tip} refs/heads/main ${old}\n`), run = await scan(repo, [tip], t, { raw }); assert.equal(run.result.status, "BLOCK");
});
test("F26b actual Git includes every proposed branch tip and withholds a secret on the second", options, async t => {
    const repo = await repository(), clean = await repo.blob("Public first branch.\n"), secret = await repo.blob(synthetic);
    const a = await repo.commit([{ name: "public.txt", oid: clean }]), b = await repo.commit([{ name: "secret.txt", oid: secret }]);
    const run = await scan(repo, [a, b], t); assert.equal(run.result.status, "BLOCK"); assert.equal(run.operations.filter(x => x === "tree").length, 2);
});
test("F26b actual Git33-commit sentinel withholds before any tree or content read", options, async t => {
    const repo = await repository(), publicOid = await repo.blob("Public history.\n"); let tip: string | undefined;
    for (let i = 0; i < 33; i++) tip = await repo.commit([{ name: "public.txt", oid: publicOid }], tip ? [tip] : []);
    const run = await scan(repo, [tip!], t); assert.equal(run.result.status, "UNAVAILABLE"); assert.deepEqual(run.operations, ["version", "commits"]);
});
test("F26b actual Git oversized blob withholds before a batch content read", options, async t => {
    const repo = await repository(), oid = await repo.blob(Buffer.alloc(65537, 65)), tip = await repo.commit([{ name: "public.txt", oid }]);
    const run = await scan(repo, [tip], t); assert.equal(run.result.status, "UNAVAILABLE"); assert(!run.operations.includes("batch"));
});
test("F26b actual Git unknown extension or binary makes the whole history unavailable", options, async t => {
    for (const [name, value] of [["unknown.xyz", Buffer.from("Public unknown format.")], ["binary.txt", Buffer.from([0, 1, 2])]] as const) {
        const repo = await repository(), oid = await repo.blob(value), tip = await repo.commit([{ name, oid }]);
        assert.equal((await scan(repo, [tip], t)).result.status, "UNAVAILABLE");
    }
});
test("F26b actual Git symlink and gitlink modes cannot be silently excluded", options, async t => {
    for (const mode of ["120000", "160000"] as const) {
        const repo = await repository(), oid = mode === "120000" ? await repo.blob("synthetic-target.txt") : await repo.commit([]);
        const tip = await repo.commit([{ name: "unsupported", mode, oid }]), run = await scan(repo, [tip], t);
        assert.equal(run.result.status, "UNAVAILABLE"); assert(!run.operations.includes("batch"));
    }
});
test("F26b actual Git missing and malformed commit objects withhold without a clean-prefix result", options, async t => {
    const absent = await repository(); assert.equal((await scan(absent, ["1".repeat(40)], t)).result.status, "UNAVAILABLE");
    const malformed = await repository(), oid = await malformed.object("commit", "Not a Git commit body.\n");
    assert.equal((await scan(malformed, [oid], t)).result.status, "UNAVAILABLE");
});
test("F26b actual Git malformed tree pathname withholds before blob content", options, async t => {
    const repo = await repository(), oid = await repo.blob("Public synthetic text.\n"), tip = await repo.commit([{ name: "bad\nname.txt", oid }]);
    const run = await scan(repo, [tip], t); assert.equal(run.result.status, "UNAVAILABLE"); assert(!run.operations.includes("batch"));
});
test("F26b actual Git ignores poisoned ambient selectors and preserves the parent environment", options, async t => {
    const repo = await repository(), oid = await repo.blob("Useful public example.\n"), tip = await repo.commit([{ name: "public.txt", oid }]);
    const ambient = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC, PATH: "TEST_ONLY_POISON",
        NODE_OPTIONS: "TEST_ONLY_POISON", GIT_DIR: "TEST_ONLY_POISON", GIT_WORK_TREE: "TEST_ONLY_POISON", GIT_INDEX_FILE: "TEST_ONLY_POISON",
        GIT_OBJECT_DIRECTORY: "TEST_ONLY_POISON", GIT_ALTERNATE_OBJECT_DIRECTORIES: "TEST_ONLY_POISON", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "TEST_ONLY_POISON" };
    assert.equal((await scan(repo, [tip], t, { ambient })).result.status, "ALLOW");
});
test("F26b actual Git empty and deletion-only proposals perform no object traversal", options, async t => {
    for (const raw of [Buffer.alloc(0), Buffer.from(`(delete) ${zero} refs/heads/main ${"1".repeat(40)}\n`)]) {
        const run = await scan(await repository(), [], t, { raw }); assert.equal(run.result.status, "ALLOW"); assert.deepEqual(run.operations, ["version"]);
    }
});
