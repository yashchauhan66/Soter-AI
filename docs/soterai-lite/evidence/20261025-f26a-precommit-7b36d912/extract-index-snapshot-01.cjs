const fs = require('node:fs'), crypto = require('node:crypto');
const base = 'packages/vscode-extension/src/history-hooks/';
const original = fs.readFileSync(base + 'CheckedHookIndex.ts', 'utf8');
if (crypto.createHash('sha256').update(original).digest('hex') !== '9e63a7e21062611d4862bad4156117f42bca4c4855ddbed554b64a18d57a35ca') throw Error('Snapshot extraction source changed.');
const begin = original.indexOf('const genuine ='), end = original.indexOf('/** Builds new metadata authority');
if (begin < 0 || end < begin) throw Error('Snapshot extraction markers unavailable.');
let snapshot = original.slice(begin, end)
  .replace('const genuine = new WeakSet<object>(), sha =', 'const sha =')
  .replace(/^export function isCheckedHookIndex[^\r\n]*\r?\n/m, '');
snapshot += '\n/** Identity-only refresh of an already parsed bounded index. */\nexport function captureHookIndexIdentity(root: string, indexPath: unknown): string | undefined {\n    try { return capture(root, selected(root, indexPath)).stamp; } catch { return undefined; }\n}\n';
const header = 'import { createHash } from "node:crypto";\nimport { lstatSync, realpathSync, readFileSync } from "node:fs";\nimport * as path from "node:path";\nimport { TextDecoder } from "node:util";\nimport { parseStagedEntries, PRE_COMMIT_LIMITS, type StagedEntry } from "./PreCommitProtocol";\n\n';
fs.writeFileSync(base + 'HookIndexSnapshot.ts', header + snapshot, { flag: 'wx' });
// The single canonical parser/capture moves intact; both owner and client use it.
const factory = `import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
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
`;
fs.writeFileSync(base + 'CheckedHookIndex.ts', factory);
console.log('Canonical index snapshot extracted; behavior verification pending.');
