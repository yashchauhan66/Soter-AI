import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import * as path from "node:path";

/** Physical directory identity only; never reads worktree contents or grants a
 * Git/owner capability. Native bigint inode values avoid numeric aliasing. */
export function pushRootIdentity(root: string): string | undefined {
    try {
        if (process.platform !== "win32" || typeof root !== "string" || root.length > 2048 || !/^[a-z]:[\\/]/i.test(root)
            || /[\p{Cc}\p{Cf}]/u.test(root) || path.normalize(root) !== root || realpathSync(root).toLowerCase() !== root.toLowerCase()) return undefined;
        const rows: Array<{ directory: string; identity: string }> = [];
        const identity = (directory: string) => {
            const stat = lstatSync(directory, { bigint: true }); if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error();
            return [stat.dev, stat.ino, stat.birthtimeNs].map(value => value.toString()).join(":");
        };
        for (let directory = root;;) {
            rows.push({ directory, identity: identity(directory) });
            const parent = path.dirname(directory); if (directory === parent) break; directory = parent;
        }
        if (rows.some(row => identity(row.directory) !== row.identity)) return undefined;
        return createHash("sha256").update(JSON.stringify(rows.map(row => [row.directory.toLowerCase(), row.identity]))).digest("hex");
    } catch { return undefined; }
}
