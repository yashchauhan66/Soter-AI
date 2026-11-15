import { createHash, randomUUID } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, type Stats } from "node:fs";
import { request as httpRequest } from "node:http";
import * as path from "node:path";
import { captureHookIndex } from "./HookIndexSnapshot";
import { parseHookClientPin } from "./PreCommitHookText";
import { verifyHookDecision, verifyHookDescriptor } from "./PreCommitWire";

interface Options {
    runtime?: string; worker?: string; now?: () => number;
    request?: (endpoint: string, rawRequest: Buffer, deadline: number) => Promise<Buffer | undefined>;
}
type Outcome = "ALLOW" | "BLOCK" | "UNAVAILABLE";
const unavailable = (): never => { throw Error("Pre-commit unavailable."); };
const sha = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const statIdentity = (stat: Stats): string => JSON.stringify([stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs, stat.ctimeMs, stat.nlink, stat.mode]);
export function hookArtifactIdentity(file: string, cap: number): string {
    if (!path.isAbsolute(file) || !same(realpathSync(file), file)) return unavailable();
    const parents: unknown[] = []; let cursor = path.dirname(file);
    for (;;) {
        const stat = lstatSync(cursor); if (!stat.isDirectory() || stat.isSymbolicLink()) return unavailable();
        parents.push([stat.ino, stat.birthtimeMs]); const next = path.dirname(cursor); if (next === cursor) break; cursor = next;
    }
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > cap) return unavailable();
    return sha(JSON.stringify([file, parents, statIdentity(stat)]));
}
/** Bounded synchronous file observation, using constant-size hash reads even
 * for the installed runtime. No execute, descriptor-selected path or write. */
export function observeHookArtifact(file: string, cap: number, valid: () => boolean, body = false): Readonly<{ stamp: string; digest: string; bytes?: Buffer }> {
    if (!valid()) return unavailable();
    const before = hookArtifactIdentity(file, cap), fd = openSync(file, "r"), chunk = Buffer.alloc(65536), copies: Buffer[] = [];
    try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > cap || statIdentity(stat) !== statIdentity(lstatSync(file))) return unavailable();
        const hash = createHash("sha256"); let offset = 0;
        while (offset < stat.size) {
            if (!valid()) return unavailable();
            const size = readSync(fd, chunk, 0, Math.min(chunk.length, stat.size - offset), offset);
            if (size <= 0) return unavailable(); hash.update(chunk.subarray(0, size));
            if (body) copies.push(Buffer.from(chunk.subarray(0, size))); offset += size;
        }
        if (statIdentity(fstatSync(fd)) !== statIdentity(stat) || hookArtifactIdentity(file, cap) !== before || !valid()) return unavailable();
        return Object.freeze({ stamp: before, digest: hash.digest("hex"), ...(body ? { bytes: Buffer.concat(copies) } : {}) });
    } finally { closeSync(fd); chunk.fill(0); copies.forEach(bytes => bytes.fill(0)); }
}
function requestOwner(endpoint: string, body: Buffer, deadline: number, ownership: { cancel?: () => void }): Promise<Buffer | undefined> {
    return new Promise(resolve => {
        const chunks: Buffer[] = []; let count = 0, settled = false;
        const finish = (value?: Buffer) => { if (!settled) { settled = true; chunks.forEach(chunk => chunk.fill(0)); resolve(value); } };
        try {
            const url = new URL(endpoint);
            // The verified descriptor already enforces these; repeat before I/O.
            if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/pre-commit" || url.search || url.hash || url.username || url.password) { finish(); return; }
            const req = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), method: "POST", path: "/pre-commit", agent: false,
                maxHeaderSize: 4096, headers: { "Content-Type": "application/json", "Content-Length": String(body.length), "Connection": "close" } }, res => {
                const length = res.headers["content-length"], seen = new Set<string>(); let duplicates = false;
                for (let i = 0; i < res.rawHeaders.length; i += 2) { const key = res.rawHeaders[i].toLowerCase(); if (seen.has(key)) duplicates = true; seen.add(key); }
                if (res.statusCode !== 200 || duplicates || res.headers["content-type"] !== "application/json" || res.headers["transfer-encoding"] !== undefined
                    || typeof length !== "string" || !/^[1-9][0-9]{0,3}$/.test(length) || Number(length) > 8192) { finish(); req.destroy(); return; }
                res.on("data", (chunk: Buffer) => {
                    count += chunk.length; if (count > 8192 || count > Number(length)) { finish(); req.destroy(); }
                    else if (!settled) chunks.push(Buffer.from(chunk));
                });
                res.once("end", () => finish(count === Number(length) ? Buffer.concat(chunks) : undefined));
                res.once("error", () => finish()); res.once("aborted", () => finish());
            });
            ownership.cancel = () => { finish(); req.destroy(); };
            req.setTimeout(Math.max(1, Math.min(60000, deadline - performance.now())), ownership.cancel);
            req.once("error", () => finish()); req.end(body);
        } catch { finish(); }
    });
}

/** Minimal finite packaged verifier. Test seams are not accepted by the hook
 * executable. Final signature/index/artifact checks and result have no await. */
export async function runPreCommitClient(rawPin: Buffer, indexPath: unknown, options: Options = {}): Promise<Outcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ownership: { cancel?: () => void } = {};
    try {
        if (process.platform !== "win32") return "UNAVAILABLE";
        const pin = parseHookClientPin(rawPin); if (!pin) return "UNAVAILABLE";
        if (!same(options.runtime ?? process.execPath, pin.runtime) || !same(options.worker ?? __filename, pin.worker)) return "UNAVAILABLE";
        const clock = options.now ?? (() => performance.now()), start = clock(), deadline = start + 60000;
        if (!Number.isFinite(start) || !Number.isFinite(deadline)) return "UNAVAILABLE";
        let last = start, live = true;
        const valid = () => {
            if (!live) return false;
            try { const now = clock(); live = Number.isFinite(now) && now >= last && now >= start && now < deadline; last = now; }
            catch { live = false; } return live;
        };
        const runtime = observeHookArtifact(pin.runtime, 536870912, valid), worker = observeHookArtifact(pin.worker, 2097152, valid);
        if (runtime.digest !== pin.runtimeSha256 || worker.digest !== pin.workerSha256) return "UNAVAILABLE";
        const endpoint = observeHookArtifact(pin.descriptor, 8192, valid, true);
        const descriptor = verifyHookDescriptor(endpoint.bytes, pin.publicKey, { root: pin.root, generation: pin.generation,
            workerSha256: pin.workerSha256, runtimeSha256: pin.runtimeSha256 });
        if (!descriptor || !valid()) return "UNAVAILABLE";
        const index = captureHookIndex(pin.root, indexPath); if (!index || !valid()) return "UNAVAILABLE";
        const nonce = randomUUID(), body = Buffer.from(JSON.stringify({ version: 1, generation: pin.generation, session: descriptor.session,
            nonce, indexFile: indexPath === undefined ? ".git/index" : indexPath }));
        const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => { ownership.cancel?.(); resolve(undefined); }, Math.max(1, deadline - clock())); });
        const request = options.request ?? ((endpoint: string, raw: Buffer, bound: number) => requestOwner(endpoint, raw, bound, ownership));
        const reply = await Promise.race([request(descriptor.endpoint, body, deadline), timeout]);
        clearTimeout(timer);
        if (!reply || !valid()) return "UNAVAILABLE";
        const decision = verifyHookDecision(reply, pin.publicKey, { root: pin.root, generation: pin.generation, session: descriptor.session, nonce });
        if (!decision || !["ALLOW", "BLOCK"].includes(decision.status) || decision.indexSha256 !== index.indexSha256 || decision.indexIdentity !== index.indexIdentity) return "UNAVAILABLE";
        // All remaining operations are synchronous. Replacement with identical
        // bytes still revokes identity, including endpoint/session replacement.
        const finalIndex = captureHookIndex(pin.root, indexPath), finalEndpoint = observeHookArtifact(pin.descriptor, 8192, valid, true);
        const finalWorker = observeHookArtifact(pin.worker, 2097152, valid), finalRuntime = observeHookArtifact(pin.runtime, 536870912, valid);
        if (!finalIndex || finalIndex.indexFile !== index.indexFile || finalIndex.indexSha256 !== index.indexSha256 || finalIndex.indexIdentity !== index.indexIdentity
            || finalEndpoint.stamp !== endpoint.stamp || finalEndpoint.digest !== endpoint.digest
            || finalWorker.stamp !== worker.stamp || finalWorker.digest !== worker.digest
            || finalRuntime.stamp !== runtime.stamp || finalRuntime.digest !== runtime.digest || !valid()) return "UNAVAILABLE";
        return decision.status as "ALLOW" | "BLOCK";
    } catch { return "UNAVAILABLE"; } finally {
        clearTimeout(timer);
        try { ownership.cancel?.(); } catch { /* Only this client's HTTP transport. */ }
    }
}
