// Local tests only. No provider credentials, deployments or external model requests.
import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const extension = path.join(repo, "packages/vscode-extension");
const output = path.join(repo, "docs/secretguard/evidence");
await mkdir(output, { recursive: true });

async function testFiles(dir, recursive = true) {
    const files = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) files.push(...await testFiles(full));
        else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(full);
    }
    return files.sort();
}
async function run(name, args, cwd) {
    const start = Date.now();
    const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", chunk => { log += chunk; });
    child.stderr.on("data", chunk => { log += chunk; });
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    await writeFile(path.join(output, `${name}.txt`), log);
    const count = key => Number(log.match(new RegExp(`^# ${key} (\\d+)$`, "m"))?.[1] ?? 0);
    const result = { name, exitCode: code, tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped"), durationMs: Date.now() - start };
    console.log(JSON.stringify(result));
    return result;
}
const tsc = path.join(repo, "node_modules/typescript/bin/tsc");
const core = path.join(repo, "packages/guard-core");
const broker = path.join(repo, "apps/local-ai-broker");
const build = await run("core-build", [tsc, "-p", "tsconfig.json"], core);
if (build.exitCode !== 0) process.exit(1);
const specs = [
    ["extension-typecheck", [tsc, "--noEmit", "-p", "tsconfig.json"], extension],
    ["broker-typecheck", [tsc, "--noEmit", "-p", "tsconfig.json"], broker],
    ["core-tests", ["--import", "tsx", "--test", ...await testFiles(path.join(core, "src/__tests__"))], core],
    ["broker-tests", ["--import", "tsx", "--test", ...await testFiles(path.join(broker, "src/__tests__"))], broker],
    ["extension-tests", ["--import", "tsx", "--test", ...await testFiles(path.join(extension, "src/__tests__"), false)], extension],
    ["phase2-canaries", ["--import", "tsx", "--test", ...await testFiles(path.join(extension, "src/__tests__/phase2"))], extension],
];
// Bound concurrency: security tests include real HTTP subprocesses and timing checks.
const results = [build];
for (let i = 0; i < specs.length; i += 2) {
    const batch = await Promise.allSettled(specs.slice(i, i + 2).map(([name, args, cwd]) => run(name, args, cwd)));
    for (const result of batch) {
        if (result.status === "rejected") throw result.reason;
        results.push(result.value);
    }
}
await writeFile(path.join(output, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), platform: process.platform, node: process.version, results }, null, 2) + "\n");
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
