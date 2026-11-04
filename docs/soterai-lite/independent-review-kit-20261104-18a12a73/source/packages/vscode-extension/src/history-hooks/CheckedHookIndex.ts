import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import type { StagedEntry } from "./PreCommitProtocol";
import { captureHookIndex, captureHookIndexIdentity } from "./HookIndexSnapshot";
export { captureHookIndex } from "./HookIndexSnapshot";

export interface CheckedHookIndex {
    readonly root: string; readonly indexFile: string; readonly metadata: CheckedGitMetadata;
    readonly indexSha256: string; readonly indexIdentity: string;
    readonly environment: NodeJS.ProcessEnv; readonly entries: readonly StagedEntry[]; available(): boolean;
}
const genuine = new WeakSet<object>();
export function isCheckedHookIndex(value: unknown): value is CheckedHookIndex { return !!value && typeof value === "object" && genuine.has(value); }
/** Fresh exact-root metadata authority; snapshots alone grant no owner lease. */
export async function prepareCheckedHookIndex(root: string, indexPath: unknown, ambient: NodeJS.ProcessEnv,
    enabled: () => boolean): Promise<CheckedHookIndex | undefined> {
    let live = true;
    const guard = () => { if (!live) return false; try { live = enabled() === true; } catch { live = false; } return live; };
    try {
        if (!guard()) return undefined;
        const before = captureHookIndex(root, indexPath); if (!before) return undefined;
        const metadata = await prepareCheckedGitMetadata(root, ambient, guard);
        if (!metadata || !guard()) return undefined;
        const environment = Object.freeze({ ...metadata.environment, GIT_INDEX_FILE: before.indexFile });
        const available = () => {
            if (!guard()) return false;
            try { live = metadata.available() && captureHookIndexIdentity(root, before.indexFile) === before.indexIdentity; } catch { live = false; }
            return live;
        };
        const descriptor = Object.freeze({ root, indexFile: before.indexFile, metadata, environment, entries: before.entries,
            indexSha256: before.indexSha256, indexIdentity: before.indexIdentity, available });
        if (!available()) return undefined; genuine.add(descriptor); return descriptor;
    } catch { live = false; return undefined; }
}
