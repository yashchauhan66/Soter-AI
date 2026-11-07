import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = path.resolve(__dirname, "../../../..");
const home = path.join(repo, "docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912");
const moduleUrl = pathToFileURL(path.join(repo, "packages/vscode-extension/src/history-hooks/OwnerHookProtocol.ts")).href;
const probe = `
const imported = await import(process.env.SOTERAI_F26A_ENV_MODULE);
const build = imported.buildOwnerHookEnvironment ?? imported.default?.buildOwnerHookEnvironment;
if (typeof build !== 'function') throw Error('Missing real source export.');
const original = JSON.stringify(process.env);
const projected = build(process.env);
const forged = Object.assign(Object.create(Object.getPrototypeOf(process.env)), process.env);
const forgedRejected = build(forged) === undefined;
const proxyRejected = build(new Proxy(process.env, {})) === undefined;
const untouched = JSON.stringify(process.env) === original;
process.env.GIT_DIR = 'C:\\\\SyntheticForbiddenSelector';
const selectorRejected = build(process.env) === undefined;
delete process.env.GIT_DIR;
const restored = JSON.stringify(process.env) === original;
process.stdout.write(JSON.stringify({ nativePrototypeOrdinary: [Object.prototype, null].includes(Object.getPrototypeOf(process.env)),
 accepted: !!projected, preservedHome: projected?.HOME === process.env.HOME,
 preservedGlobal: projected?.GIT_CONFIG_GLOBAL === process.env.GIT_CONFIG_GLOBAL,
 finiteControls: projected?.GIT_TERMINAL_PROMPT === '0' && projected?.GIT_PROTOCOL_FROM_USER === '0',
 preloadOmitted: projected?.NODE_OPTIONS === undefined && projected?.PATH === undefined,
 forgedRejected, proxyRejected, selectorRejected, untouched, restored }));
`;

for (const runtime of [
    { name: "node", executable: process.execPath },
    { name: "code-node", executable: "C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" },
]) test("actual synthetic " + runtime.name + " environment admits its genuine native object and rejects forged authority", { skip: process.platform !== "win32" }, async () => {
    assert(existsSync(runtime.executable));
    const directory = await mkdtemp(path.join(home, "native-env-real-runtime-"));
    await mkdir(path.join(directory, "Temp"));
    const globalConfig = path.join(directory, "empty-global.gitconfig"), systemConfig = path.join(directory, "empty-system.gitconfig");
    await writeFile(globalConfig, "", { flag: "wx" }); await writeFile(systemConfig, "", { flag: "wx" });
    const env: NodeJS.ProcessEnv = { HOME: directory, USERPROFILE: directory, XDG_CONFIG_HOME: directory,
        GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_SYSTEM: systemConfig, GIT_CONFIG_NOSYSTEM: "1",
        TEMP: path.join(directory, "Temp"), TMP: path.join(directory, "Temp"), SOTERAI_F26A_ENV_MODULE: moduleUrl };
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[name] !== undefined) env[name] = process.env[name];
    if (runtime.name === "code-node") env.ELECTRON_RUN_AS_NODE = "1";
    const child = spawn(runtime.executable, ["--import", "tsx", "--input-type=module", "--eval", probe], {
        cwd: repo, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let signalsRequested = 0, stdoutEOF = false, stderrEOF = false, closed = false, code: number | null = null;
    let signal: NodeJS.Signals | null = null, overflow = false, failed = false, outBytes = 0, errBytes = 0;
    const out: Buffer[] = [], err: Buffer[] = [];
    child.kill = () => { signalsRequested++; throw Error("Signals forbidden in native environment component probe."); };
    await new Promise<void>(resolve => {
        const finish = () => { if (closed && stdoutEOF && stderrEOF) resolve(); };
        child.once("error", () => { failed = true; });
        child.once("close", (value, received) => { closed = true; code = value; signal = received; finish(); });
        for (const [stream, target, name] of [[child.stdout, out, "stdout"], [child.stderr, err, "stderr"]] as const) {
            stream.on("data", (chunk: Buffer) => {
                const count = name === "stdout" ? outBytes += chunk.length : errBytes += chunk.length;
                if (count > 32768) overflow = true; else target.push(Buffer.from(chunk));
            });
            stream.once("end", () => { if (name === "stdout") stdoutEOF = true; else stderrEOF = true; finish(); });
            stream.once("error", () => { failed = true; });
        }
    });
    const stdout = Buffer.concat(out), stderr = Buffer.concat(err);
    await writeFile(path.join(directory, "stdout.txt"), stdout, { flag: "wx" });
    await writeFile(path.join(directory, "stderr.txt"), stderr, { flag: "wx" });
    await writeFile(path.join(directory, "closure.json"), JSON.stringify({ componentOnly: true, runtime: runtime.name,
        executable: runtime.executable, closed, code, signal, stdoutEOF, stderrEOF, signalsRequested, overflow, failed }) + "\n", { flag: "wx" });
    assert.equal(signalsRequested, 0); assert.equal(signal, null); assert.equal(overflow, false); assert.equal(failed, false); assert.equal(code, 0);
    assert.equal(stderr.length, 0);
    const value = JSON.parse(stdout.toString("utf8"));
    assert.equal(value.untouched, true); assert.equal(value.restored, true);
    assert.equal(value.proxyRejected, true); assert.equal(value.selectorRejected, true);
    assert.equal(value.forgedRejected, !value.nativePrototypeOrdinary);
    assert.equal(value.accepted, true, "A real native process.env is valid owner-discovery input, including its runtime-specific prototype.");
    assert.equal(value.preservedHome, true); assert.equal(value.preservedGlobal, true);
    assert.equal(value.finiteControls, true); assert.equal(value.preloadOmitted, true);
});
