import { open, constants, type FileHandle } from "node:fs/promises";
import { captureReadPath, revalidateReadPath, sameReadFile, regularReadFile } from "../security/FileSystemPathPolicy";
import { acquireBoundaryRead, READ_RELIABILITY_LIMITS } from "../security/ReadReliability";

/** Bounded regular-file read; aliases and multiple hardlinks fail closed. Not an OS sandbox. */
export async function readBoundaryFile(root: string, target: string, limit = 64 * 1024,
    options: { signal?: AbortSignal } = {}): Promise<string> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > READ_RELIABILITY_LIMITS.readBytes) throw new Error("Unsupported managed read budget.");
    const lease = acquireBoundaryRead(options.signal);
    const operation = async () => {
      let file: FileHandle | undefined;
      try {
        lease.check(); const snapshot = await captureReadPath(root, target, lease.check); lease.check();
        await revalidateReadPath(snapshot, lease.check); lease.check();
        file = await open(snapshot.canonical, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
        lease.check(); const stat = await file.stat({ bigint: true }); lease.check();
        if (!regularReadFile(stat, limit) || !sameReadFile(snapshot.file, stat, true)) throw new Error("Unsafe or changed context file.");
        const bytes = Buffer.alloc(Math.min(limit + 1, Number(stat.size) + 1));
        let length = 0;
        while (length < bytes.length) {
            lease.check(); const read = await file.read(bytes, length, bytes.length - length, length); lease.check();
            if (!read.bytesRead) break;
            length += read.bytesRead;
        }
        const finished = await file.stat({ bigint: true }); lease.check();
        if (length > limit || BigInt(length) !== stat.size || !regularReadFile(finished, limit) || !sameReadFile(stat, finished)) throw new Error("Context file changed during read.");
        await revalidateReadPath(snapshot, lease.check); lease.check();
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
        if (text.includes("\0")) throw new Error("Binary context is unsupported.");
        await file.close(); file = undefined;
        await revalidateReadPath(snapshot, lease.check); lease.check();
        return text;
      } finally {
        try { if (file) { await file.close(); file = undefined; } }
        finally { if (file) lease.closureFailed(); else lease.release(); }
      }
    };
    // Expiration withholds immediately. Physical I/O keeps its slot until its
    // real finally/close settles; cancelling cannot create unbounded new reads.
    return Promise.race([Promise.resolve().then(operation), lease.expired]);
}
