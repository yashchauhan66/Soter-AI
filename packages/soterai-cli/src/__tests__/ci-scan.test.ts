import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { scanDirectory, scanExitCode } from "../ci/scan";
import { sarifReport } from "../ci/report";
import { runCiCommand } from "../ci/command";
import { parseSecretScanPolicy } from "../../../guard-core/src/SecretScanPolicy";
import { RegisteredSecretMatcher as coreMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { RegisteredSecretMatcher as sharedMatcher } from "../../../guard-core/src/RegisteredSecretMatcher";
const secret = "BlueMango7!", registered = "registered_private_ci_value_123456";
async function fixture(files: Record<string, string | Buffer>) {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-p3-ci-"));
    for (const [name, value] of Object.entries(files)) { const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); }
    return root; // Retained: the user requested no project/file cleanup.
}
test("CLI and IDE use the same registered matcher class", () => assert.equal(coreMatcher, sharedMatcher));
test("headless source scan is deterministic and explicitly declares exclusions", async () => {
    const root = await fixture({ "src/main.js": "console.log('public')", "node_modules/vendor/index.js": "DB_PASSWORD=" + secret });
    const one = await scanDirectory(root), two = await scanDirectory(root);
    assert.deepEqual(one, two); assert.equal(one.status, "clean"); assert.equal(one.scannedFiles, 1); assert.equal(one.excludedEntries, 1);
    assert.match(one.snapshotSha256!, /^[a-f0-9]{64}$/);
});
test("P0 prefixed password and registered encodings are found without raw JSON/SARIF evidence", async () => {
    const root = await fixture({ "config.txt": `DB_PASSWORD=${secret}`, "encoded.txt": Buffer.from(registered).toString("base64") });
    const report = await scanDirectory(root, {}, [registered]);
    assert.equal(scanExitCode(report), 1); assert.ok(report.findings.some(f => f.ruleId === "password_assignment")); assert.ok(report.findings.some(f => f.ruleId === "registered_secret"));
    assert.equal(report.snapshotSha256, undefined);
    for (const serialized of [JSON.stringify(report), JSON.stringify(sarifReport(report))]) { assert.ok(!serialized.includes(secret)); assert.ok(!serialized.includes(registered)); }
});
test("secret-bearing filenames are replaced with deterministic opaque locations", async () => {
    const root = await fixture({ [`DB_PASSWORD=${secret}.txt`]: `DB_PASSWORD=${secret}` });
    const report = await scanDirectory(root);
    assert.equal(report.findings[0].path, "withheld-path-1"); assert.ok(!JSON.stringify(report).includes(secret));
});

test("a secret in a filename cannot enter an admitted snapshot even when its content is public", async () => {
    const captured: string[] = [];
    const root = await fixture({ [`DB_PASSWORD=${secret}.txt`]: "public", "safe.js": "console.log('public')" });
    const report = await scanDirectory(root, {}, [], { onFile: name => captured.push(name) });
    assert.equal(report.status, "findings");
    assert.ok(!captured.some(name => name.includes(secret)));
    assert.deepEqual(captured, ["safe.js"]);
    assert.ok(!JSON.stringify(report).includes(secret));
});
test("unread archives, invalid UTF-8 and size exhaustion cannot produce a clean artifact", async () => {
    for (const files of [{ "output.tar": "public" }, { "binary.txt": Buffer.from([0xff, 0xfe]) }, { "large.js": "X".repeat(131073) }]) {
        const report = await scanDirectory(await fixture(files), { mode: "artifact" });
        assert.equal(scanExitCode(report), 2); assert.equal(report.snapshotSha256, undefined);
    }
});
test("incomplete takes precedence over findings and file/entry limits are explicit", async () => {
    const root = await fixture({ "a.txt": `DB_PASSWORD=${secret}`, "b.bin": Buffer.from([0]) });
    const report = await scanDirectory(root); assert.equal(report.status, "incomplete"); assert.ok(report.findings.length); assert.equal(scanExitCode(report), 2);
    assert.equal((await scanDirectory(root, { maxFiles: 1 })).status, "incomplete");
    assert.equal((await scanDirectory(root, { maxEntries: 1 })).status, "incomplete");
});

test("cancellation during the final file cannot issue a clean snapshot", async () => {
    const controller = new AbortController();
    const root = await fixture({ "last.js": "console.log('public')" });
    const report = await scanDirectory(root, { mode: "artifact" }, [], {
        signal: controller.signal,
        onFile: () => controller.abort(),
    });
    assert.equal(report.status, "incomplete");
    assert.equal(scanExitCode(report), 2);
    assert.ok(report.diagnostics.some(item => item.code === "CANCELLED"));
    assert.equal(report.snapshotSha256, undefined);
});

test("a time budget exhausted on the final file cannot issue a clean snapshot", async t => {
    const root = await fixture({ "last.js": "console.log('public')" });
    let now = 1000;
    t.mock.method(Date, "now", () => now);
    const report = await scanDirectory(root, { mode: "artifact", maxMilliseconds: 10 }, [], {
        onFile: () => { now += 11; },
    });
    assert.equal(report.status, "incomplete");
    assert.equal(scanExitCode(report), 2);
    assert.ok(report.diagnostics.some(item => item.code === "TIME_LIMIT"));
    assert.equal(report.snapshotSha256, undefined);
});
test("approved opaque asset requires its exact digest and cannot allow an archive", async () => {
    const bytes = Buffer.from([137,80,78,71,0,255]), root = await fixture({ "logo.png": bytes });
    const policy = { mode: "artifact", trustedOpaqueFiles: [{ path: "logo.png", sha256: createHash("sha256").update(bytes).digest("hex") }] };
    assert.equal((await scanDirectory(root, policy)).status, "clean");
    await fs.appendFile(path.join(root, "logo.png"), "changed"); assert.equal((await scanDirectory(root, policy)).status, "incomplete");
    assert.throws(() => parseSecretScanPolicy({ trustedOpaqueFiles: [{ path: "image.tar", sha256: "a".repeat(64) }] }));
});
test("hard-linked files and invalid registries fail closed", async () => {
    const root = await fixture({ "a.txt": "public" }); await fs.link(path.join(root, "a.txt"), path.join(root, "b.txt"));
    assert.equal((await scanDirectory(root)).status, "incomplete");
    assert.equal((await scanDirectory(await fixture({}), {}, ["1234"])).status, "incomplete");
    assert.equal((await scanDirectory(await fixture({}), { mode: "artifact" })).status, "incomplete");
});
test("policy cannot silently exclude dotenv, execute config or accept unknown settings", () => {
    for (const input of [{ excludedDirectories: [".env"] }, { mode: "artifact", excludedDirectories: ["node_modules"] }, { run: "anything" }, { maxFileBytes: Infinity }]) assert.throws(() => parseSecretScanPolicy(input));
});
test("CLI returns gate exit codes and refuses to overwrite an existing report", async () => {
    const root = await fixture({ "main.js": "public" }), output: string[] = [];
    const deps = { cwd: root, out: (s:string) => output.push(s), err: (s:string) => output.push(s), readStdin: async () => "[]" };
    assert.equal(await runCiCommand(["scan", "--root", "."], deps), 0);
    await fs.writeFile(path.join(root,"report.json"),"preserved");
    assert.equal(await runCiCommand(["scan", "--output", "report.json"], deps), 2);
    assert.equal(await fs.readFile(path.join(root,"report.json"),"utf8"),"preserved");
    assert.equal(await runCiCommand(["scan", "--secret", secret], deps), 2);
    assert.ok(!output.join("").includes(secret));
});
test("native CI registered input refuses excess bytes without waiting for stdin EOF", async () => {
    const root = await fixture({ "main.js": "console.log('public')" });
    const repo = path.resolve(__dirname, "../../../..");
    const script = "const {run,defaultDeps}=require('./packages/soterai-cli/src/run.ts');" +
        "run(['ci','scan','--registered-stdin'],defaultDeps({cwd:process.argv[1]})).then(code=>{process.exitCode=code;});";
    const child = spawn(process.execPath, ["--import", "tsx", "--eval", script, root],
        { cwd: repo, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", timedOut = false;
    child.stdout.on("data", bytes => { output += bytes; }); child.stderr.on("data", bytes => { output += bytes; });
    child.stdin.on("error", () => {});
    const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 10000);
    child.stdin.write(Buffer.alloc(131073, 0x78)); // Keep the pipe open: rejection must happen during collection.
    let code;
    try { code = await completion; } finally { clearTimeout(timer); child.stdin.destroy(); }
    assert.equal(timedOut, false, "oversized registered input waited for EOF instead of enforcing its byte budget");
    assert.equal(code, 2); assert.match(output, /CI scan unavailable/);
    assert.ok(output.length < 2048);
});
