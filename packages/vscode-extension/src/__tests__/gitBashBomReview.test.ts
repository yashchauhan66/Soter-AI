import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";
const VALUE = "\ufeffsynthetic-f13-leading-bom-private-canary-R73", MASK = "[REDACTED_SECRET_OUTPUT]";
for (const shell of ["cmd", "gitBash"] as const) test(`F13-BOM-${shell} leading BOM remains registered data before F08`, async () => {
    const Factory = shell === "cmd" ? (await import("../terminal/CmdWorker")).CmdWorker : (await import("../terminal/GitBashWorker")).GitBashWorker;
    const child = Object.assign(new EventEmitter(), { pid: 43177, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { assert.fail("No process killing authorized"); } }); child.stdin.resume();
    const worker = new Factory({ id: "ba131313-aabb-4cc0-8dd0-111111111111", executable: shell === "cmd" ? "C:\\Windows\\System32\\cmd.exe" : "C:\\Program Files\\Git\\usr\\bin\\bash.exe", root: resolve(tmpdir()), operation: { kind: "PUBLIC", action: "version", args: [] }, parentEnvironment: { SystemRoot: "C:\\Windows" }, output: new StreamingOutputRedactor([VALUE]), enabled: () => true }, {
        spawn: (() => { queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess; }) as unknown as typeof spawn,
    });
    await worker.start(); child.stdout.end(Buffer.from(VALUE + "\n", shell === "cmd" ? "utf16le" : "utf8")); child.stderr.end(); await new Promise<void>(done => setImmediate(done)); child.emit("close", 0);
    const result = await worker.completion; assert.ok(result.output.status === "WITHHELD" || result.output.stdout === MASK, "Leading BOM must not remove part of a registered synthetic value before filtering");
});
