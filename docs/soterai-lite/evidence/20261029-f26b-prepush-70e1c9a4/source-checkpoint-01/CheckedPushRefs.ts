import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { parsePrePushTranscript, prePushTranscriptDigest, type PrePushUpdate } from "./PrePushProtocol";

export interface CheckedPushRefs { readonly root: string; readonly metadata: CheckedGitMetadata; readonly environment: NodeJS.ProcessEnv;
    readonly updates: readonly Readonly<PrePushUpdate>[]; readonly transcriptSha256: string; available(): boolean }
const genuine = new WeakSet<object>();
export function isCheckedPushRefs(value: unknown): value is CheckedPushRefs { return !!value && typeof value === "object" && genuine.has(value); }
/** The hook transcript is private immutable metadata, not an argv/ref-expression
 * capability. A separate genuine fixed Git descriptor protects each read. */
export async function prepareCheckedPushRefs(root: string, raw: Buffer, ambient: NodeJS.ProcessEnv,
    enabled: () => boolean): Promise<CheckedPushRefs | undefined> {
    let live = true;
    const guard = () => { if (!live) return false; try { live = enabled() === true; } catch { live = false; } return live; };
    try {
        if (!guard()) return undefined;
        const updates = parsePrePushTranscript(raw), transcriptSha256 = prePushTranscriptDigest(raw);
        if (!updates || !transcriptSha256) return undefined;
        const metadata = await prepareCheckedGitMetadata(root, ambient, guard); if (!metadata || !guard()) return undefined;
        const available = () => { if (!guard()) return false; try { live = metadata.available() && guard(); } catch { live = false; } return live; };
        const refs = Object.freeze({ root, metadata, environment: metadata.environment, updates, transcriptSha256, available });
        if (!available()) return undefined; genuine.add(refs); return refs;
    } catch { live = false; return undefined; }
}
