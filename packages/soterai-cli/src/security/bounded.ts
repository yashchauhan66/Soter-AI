import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

export const digest = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
export async function readStable(file: string, limit = 65536): Promise<Buffer> {
    const before = await fs.lstat(file);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > limit) throw Error("UNAVAILABLE");
    const handle = await fs.open(file, "r");
    try {
        const opened = await handle.stat();
        if (opened.ino !== before.ino || opened.size !== before.size || !opened.isFile() || opened.nlink !== 1) throw Error("UNAVAILABLE");
        const buffer = Buffer.alloc(opened.size + 1); let offset = 0;
        while (offset < buffer.length) { const read = await handle.read(buffer, offset, buffer.length - offset, offset); if (!read.bytesRead) break; offset += read.bytesRead; }
        const after = await handle.stat(), linked = await fs.lstat(file);
        if (offset !== opened.size || after.ctimeMs !== opened.ctimeMs || after.mtimeMs !== opened.mtimeMs || after.size !== opened.size
            || linked.isSymbolicLink() || linked.ino !== opened.ino || linked.nlink !== 1) throw Error("UNAVAILABLE");
        return buffer.subarray(0, offset);
    } finally { await handle.close(); }
}
export function exactObject(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))) throw Error("INVALID");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (required.some(key => !Object.hasOwn(descriptors, key)) || Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || ![...required, ...optional].includes(key) || !("value" in descriptors[key]))) throw Error("INVALID");
}
export interface ProcessRequest { executable: string; args: string[]; env: NodeJS.ProcessEnv; input?: Buffer; timeoutMs?: number; maxOutputBytes?: number }
export type ProcessRunner = (request: ProcessRequest) => Promise<Buffer>;
/** No shell, inherited environment, raw error, retry, or unbounded collection. */
export const boundedProcess: ProcessRunner = request => new Promise((resolve, reject) => {
    let finished = false, size = 0;
    const chunks: Buffer[] = [];
    const child = spawn(request.executable, request.args, { shell: false, windowsHide: true, env: request.env, cwd: path.dirname(request.executable), stdio: ["pipe", "pipe", "pipe"] });
    const finish = (ok: boolean, code = "PROCESS_EXIT_NONZERO") => { if (finished) return; finished = true; clearTimeout(timer); if (!ok) child.kill(); ok ? resolve(Buffer.concat(chunks)) : reject(Object.assign(Error("PROCESS_UNAVAILABLE"),{code})); };
    const timer = setTimeout(() => finish(false,"PROCESS_TIMEOUT"), request.timeoutMs ?? 15000);
    child.stdout.on("data", (chunk: Buffer) => { size += chunk.length; if (size > (request.maxOutputBytes ?? 262144)) finish(false,"PROCESS_OUTPUT_LIMIT"); else chunks.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { size += chunk.length; if (size > (request.maxOutputBytes ?? 262144)) finish(false,"PROCESS_OUTPUT_LIMIT"); });
    child.on("error", () => finish(false,"PROCESS_SPAWN_FAILED"));
    child.on("close", code => finish(code === 0));
    child.stdin.on("error", () => finish(false,"PROCESS_INPUT_PIPE_FAILED"));
    child.stdin.end(request.input);
});
export async function durableCreate(file: string, bytes: Buffer): Promise<void> {
    const handle = await fs.open(file, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    // Failure remains fail-closed; do not remove a claim or ignore an unsupported sync.
    const directory = await fs.open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
}
