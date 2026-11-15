import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { buildOwnerHookEnvironment } from "./OwnerHookProtocol";

export interface CheckedOwnerHookContext {
    readonly root: string; readonly metadata: CheckedGitMetadata; readonly environment: Readonly<NodeJS.ProcessEnv>; available(): boolean;
}
const genuine = new WeakSet<object>();
export function isCheckedOwnerHookContext(value: unknown): value is CheckedOwnerHookContext { return !!value && typeof value === "object" && genuine.has(value); }
const stamp = (value: Readonly<NodeJS.ProcessEnv>): string => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

/** Fresh exact-root metadata plus the separate captured OWNER discovery env.
 * This does not witness global hook selection: requery the owner projection
 * after review and around mutation, rather than treating scanner config as it. */
export async function prepareCheckedOwnerHookContext(root: string, ambient: NodeJS.ProcessEnv,
    enabled: () => boolean): Promise<CheckedOwnerHookContext | undefined> {
    let live = true;
    const guard = () => { if (!live) return false; try { live = enabled() === true; } catch { live = false; } return live; };
    try {
        if (!guard()) return undefined;
        const environment = buildOwnerHookEnvironment(ambient); if (!environment) return undefined;
        const before = stamp(environment), metadata = await prepareCheckedGitMetadata(root, ambient, guard);
        if (!metadata || !guard()) return undefined;
        const available = () => {
            if (!guard()) return false;
            try { const current = buildOwnerHookEnvironment(ambient); live = !!current && stamp(current) === before && metadata.available() && live; }
            catch { live = false; } return live;
        };
        const context = Object.freeze({ root, metadata, environment, available });
        if (!available()) return undefined; genuine.add(context); return context;
    } catch { live = false; return undefined; }
}
