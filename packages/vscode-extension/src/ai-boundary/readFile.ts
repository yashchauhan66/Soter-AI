import { open, constants } from "node:fs/promises";
import { verifyExistingPath } from "../security/FileSystemPathPolicy";

/** Bounded regular-file read; aliases and multiple hardlinks fail closed. Not an OS sandbox. */
export async function readBoundaryFile(root: string, target: string, limit = 64 * 1024): Promise<string> {
    const canonical = await verifyExistingPath(root, target);
    const file = await open(canonical, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > limit) throw new Error("Unsafe or oversized context file.");
        const bytes = Buffer.alloc(limit + 1);
        let length = 0;
        while (length < bytes.length) {
            const read = await file.read(bytes, length, bytes.length - length, null);
            if (!read.bytesRead) break;
            length += read.bytesRead;
        }
        if (length > limit) throw new Error("Context file exceeded its size limit.");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
        if (text.includes("\0")) throw new Error("Binary context is unsupported.");
        return text;
    } finally {
        await file.close();
    }
}
