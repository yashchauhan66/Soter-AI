"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.cwd();
const input = path.join(root, "packages/vscode-extension/src/__tests__/preCommitGitProcess.test.ts");
const output = path.join(root, "packages/vscode-extension/src/__tests__/prePushGitProcess.test.ts");
const before = fs.readFileSync(input, "utf8");
let text = before.replaceAll("F26a", "F26b").replaceAll("F26A", "F26B")
    .replaceAll("PreCommitGitProcess", "PrePushGitProcess")
    .replaceAll("syntheticIndex", "syntheticRefs")
    .replaceAll("soter-f26a-process-", "soter-f26b-process-")
    .replaceAll("checked-index", "checked-refs")
    .replaceAll("index.indexFile", "join(index.root, '.git', 'config')");
const start = text.indexOf("// F26b TEST-FIRST");
const end = text.indexOf("class Child extends EventEmitter");
if (start < 0 || end < start) throw Error("Missing established lifecycle fixture boundaries");
text = text.slice(0, start) + `// Genuine retained synthetic repository metadata with explicitly FAKE children.
// This file tests the finite process lifecycle; actual read-only Git lives in
// prePushActualHistory.test.ts. No hook, owner push, network or process signal.
import type { CheckedPushRefs } from "../history-hooks/CheckedPushRefs";
const PRIVATE = "TEST_ONLY_F26B_PROCESS_PRIVATE_d7309b41";
const GIT = "C:\\\\Program Files\\\\Git\\\\cmd\\\\git.exe";
const OBJECT = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "abcdef0123456789abcdef0123456789abcdef01";
const VERSION = Buffer.from("git version 2.53.0.windows.1\\n");
const CONFIG = "[core]\\n repositoryformatversion = 0\\n bare = false\\n";
const options = { skip: process.platform !== "win32" };
type Index = CheckedPushRefs;
type Result = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options { refs: Index; operation: unknown; valid: () => boolean; deadline: number; now?: () => number; spawn?: typeof spawn }
interface Worker { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
type Factory = new (options: Options) => Worker;
type Call = { file: string; args: readonly string[]; options: Record<string, any> };
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
const oid = (ordinal: number) => ordinal.toString(16).padStart(40, "0");
async function syntheticRefs(raw = Buffer.from(\`refs/heads/main \${OBJECT} refs/heads/main \${"0".repeat(40)}\\n\`)): Promise<Index> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26b-process-"));
    for (const directory of ["objects/info", "objects/pack", "refs/heads"])
        await mkdir(join(root, ".git", ...directory.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\\n", { flag: "wx" });
    const { prepareCheckedPushRefs } = await import("../history-hooks/CheckedPushRefs");
    const value = await prepareCheckedPushRefs(root, raw, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        COMSPEC: process.env.COMSPEC, PATH: PRIVATE, NODE_OPTIONS: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_INDEX_FILE: PRIVATE,
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: PRIVATE, GIT_CONFIG_VALUE_0: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE }, () => true);
    assert.ok(value, "synthetic transcript must acquire a genuine checked capability"); return value;
}
` + text.slice(end);
text = text.replace("({ index, operation, valid:", "({ refs: index, operation, valid:")
    .replace("{ index: fake as Index }", "{ refs: fake as Index }")
    .replace("assert.equal(call.options.env.GIT_INDEX_FILE, join(index.root, '.git', 'config'));", "assert.equal(call.options.env.GIT_INDEX_FILE, undefined);");
const bodies = new Map(text.matchAll(/test\("([^"]+)"[\s\S]*?(?=\r?\ntest\(|$)/g));
function replaceTest(name, replacement) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp('test\\("' + escaped + '"[\\s\\S]*?(?=\\r?\\ntest\\(|$)');
    if (!expression.test(text)) throw Error("Missing lifecycle test: " + name);
    text = text.replace(expression, replacement + "\n");
}
replaceTest("F26b entries process uses the actual checked root and literal stage-NUL suffix", `test("F26b tree reader has one checked OID and fixed literal recursive NUL suffix", options, async () => {
    const f = await fixture({ kind: "tree", oid: OBJECT }), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.equal(f.calls[0].options.cwd, f.index.root);
    assert.deepEqual(f.calls[0].args.slice(-8), ["ls-tree", "-r", "-z", "--full-tree", "--long", OBJECT, "--"].slice(-8));
    assert.equal(f.child.input.length, 0); await f.child.finish(); assert.equal((await result).status, "COMPLETE"); f.noActions();
});`);
replaceTest("F26b sizes process puts validated IDs only in private stdin with a fixed batch-check suffix", `test("F26b commits reader puts distinct proposed tips only in private stdin", options, async () => {
    const raw = Buffer.from(\`refs/heads/main \${OBJECT} refs/heads/main \${"0".repeat(40)}\\nrefs/heads/side \${OBJECT} refs/heads/side \${"0".repeat(40)}\\nrefs/heads/other \${OTHER} refs/heads/other \${"0".repeat(40)}\\n\`);
    const f = await fixture({ kind: "commits" }, {}, await syntheticRefs(raw)), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.equal(f.calls[0].options.cwd, f.index.root);
    assert.deepEqual(f.calls[0].args.slice(-4), ["rev-list", "--max-count=33", "--stdin", "--"]);
    assert.equal(Buffer.concat(f.child.input).toString("ascii"), OBJECT + "\\n" + OTHER + "\\n");
    assert.equal(f.child.stdin.writableEnded, true); assert.ok(!f.calls[0].args.includes(OBJECT));
    await f.child.finish(); await result; f.noActions();
});`);
text = text.replace('[[{ kind: "version" }, 4096], [{ kind: "entries" }, 262144], [{ kind: "sizes", oids: [OBJECT] }, 12288],',
    '[[{ kind: "version" }, 4096], [{ kind: "commits" }, 4096], [{ kind: "tree", oid: OBJECT }, 262144],');
replaceTest("F26b process admits128 unique size IDs and the exact1MiB declared batch budget", `test("F26b process admits128 unique blob IDs and the exact1MiB declared batch budget", options, async () => {
    const index = await syntheticRefs();
    for (const operation of [{ kind: "batch", objects: Array.from({ length: 128 }, (_, at) => ({ oid: oid(at + 1), size: 0 })) },
        { kind: "batch", objects: Array.from({ length: 16 }, (_, at) => ({ oid: oid(at + 1), size: 65536 })) }]) {
        const f = await fixture(operation, {}, index), { result } = await f.begin(); await f.child.finish(); assert.equal((await result).status, "COMPLETE"); f.noActions();
    }
});`);
replaceTest("F26b process rejects malformed duplicate empty oversized and option-looking OID arrays", `test("F26b tree reader refuses malformed noncanonical and option-looking IDs before spawn", options, async () => {
    const index = await syntheticRefs();
    for (const value of [undefined, null, 1, [], OBJECT.toUpperCase(), "a".repeat(39), "a".repeat(64), "--batch", "HEAD:public.txt", PRIVATE]) {
        const f = await fixture({ kind: "tree", oid: value }, {}, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});`);
replaceTest("F26b process never evaluates accessor operation array or object fields", `test("F26b process never evaluates proxy or accessor operation array and object fields", options, async () => {
    const index = await syntheticRefs(); let reads = 0;
    const getter = () => { reads++; throw Error(PRIVATE); };
    const operation = Object.defineProperty({}, "kind", { enumerable: true, get: getter });
    const objects = Object.defineProperty([{ oid: OBJECT, size: 1 }], "0", { enumerable: true, get: getter });
    const object = Object.defineProperty({ size: 1 }, "oid", { enumerable: true, get: getter });
    const proxy = new Proxy({ kind: "version" }, { get: getter, ownKeys: getter });
    for (const value of [operation, proxy, { kind: "batch", objects }, { kind: "batch", objects: [object] }]) {
        const f = await fixture(value, {}, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed;
    }
    assert.equal(reads, 0);
});`);
text = text.replaceAll("before.index.indexFile", "join(before.index.root, '.git', 'config')")
    .replaceAll("during.index.indexFile", "join(during.index.root, '.git', 'config')");
// These replacements happen after the generic index expression replacement.
text = text.replaceAll("before.join(index.root, '.git', 'config')", "join(before.index.root, '.git', 'config')")
    .replaceAll("during.join(index.root, '.git', 'config')", "join(during.index.root, '.git', 'config')");
text += `\ntest("F26b delete-only transcripts cannot request a fabricated commits traversal", options, async () => {
    for (const raw of [Buffer.alloc(0), Buffer.from(\`(delete) \${"0".repeat(40)} refs/heads/main \${OBJECT}\\n\`)]) {
        const f = await fixture({ kind: "commits" }, {}, await syntheticRefs(raw)); unavailable(await f.start(), "UNAVAILABLE");
        assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});\n`;
fs.writeFileSync(output, text, { flag: "wx" });
fs.writeFileSync(path.join(__dirname, "git-reader-derivation-01.json"), JSON.stringify({ source: input, sourceSha256: crypto.createHash("sha256").update(before).digest("hex"),
    target: output, targetSha256: crypto.createHash("sha256").update(text).digest("hex"),
    scope: "genuine synthetic metadata; fake spawn and fake lifecycle only; F26b operation-specific fixed arguments and private stdin controls", tests: (text.match(/^test\(/gm) || []).length }, null, 2) + "\n", { flag: "wx" });
