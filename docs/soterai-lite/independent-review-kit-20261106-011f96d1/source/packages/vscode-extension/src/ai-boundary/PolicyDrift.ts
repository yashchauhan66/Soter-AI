import * as vscode from "vscode";
import { BoundarySnapshot, ownerPolicyReviewEnabled, protectionDriftFingerprint, revokeOwnerPolicySessions, onDidChangeBoundaryRules } from "./BoundarySnapshot";
import { onDidChangeManualRestriction } from "./RestrictionOperation";

export const DRIFT_BASELINE_KEY = "soterai.lite.policyDrift.v1";
export interface DriftBaseline { schemaVersion: 1; roots: Record<string, string> }
export function parseDriftBaseline(raw: unknown): DriftBaseline {
    const text = JSON.stringify(raw);
    if (!text || Buffer.byteLength(text, "utf8") > 32768 || !raw || typeof raw !== "object" || Array.isArray(raw)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) throw new Error("Invalid drift baseline.");
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).length !== 2 || Object.keys(value).some(key => !["schemaVersion", "roots"].includes(key)) || value.schemaVersion !== 1
        || !value.roots || typeof value.roots !== "object" || Array.isArray(value.roots)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value.roots))) throw new Error("Invalid drift baseline schema.");
    const entries = Object.entries(value.roots);
    if (entries.length > 64 || entries.some(([root, digest]) => !root || /[\r\n\0]/.test(root) || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))) throw new Error("Invalid drift root metadata.");
    return { schemaVersion: 1, roots: Object.fromEntries(entries) };
}
export function compareDrift(previous: DriftBaseline, current: DriftBaseline): { changed: string[]; added: string[]; removed: string[] } {
    const a = parseDriftBaseline(previous).roots, b = parseDriftBaseline(current).roots;
    return { changed: Object.keys(b).filter(root => Object.hasOwn(a, root) && a[root] !== b[root]).sort(),
        added: Object.keys(b).filter(root => !Object.hasOwn(a, root)).sort(), removed: Object.keys(a).filter(root => !Object.hasOwn(b, root)).sort() };
}
type DriftResult = { status: "BASELINE_SAVED" | "UNCHANGED" | "DRIFT" | "UNAVAILABLE" | "FAILED"; changedRoots?: string[] };
const checks = new WeakMap<vscode.Memento, Promise<DriftResult>>();
/** Bounded policy/source/public-version metadata only; no source file, env or auth values. */
export async function checkPolicyDrift(context: Pick<vscode.ExtensionContext, "workspaceState">): Promise<DriftResult> {
    if (!ownerPolicyReviewEnabled() || !vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFolders.some(folder => folder.uri.scheme !== "file")) {
        revokeOwnerPolicySessions(); return { status: "UNAVAILABLE" };
    }
    const target = context.workspaceState;
    const pending = checks.get(target); if (pending) return pending;
    const run = (async (): Promise<DriftResult> => {
        try {
            const roots = vscode.workspace.workspaceFolders!.map(folder => folder.uri.toString()).sort();
            const snapshot = await BoundarySnapshot.load();
            if (vscode.workspace.workspaceFolders!.some(folder => !snapshot.availableForRoot(folder.uri))) throw new Error("Policy unavailable.");
            const current = parseDriftBaseline({ schemaVersion: 1, roots: Object.fromEntries(await Promise.all(roots.map(async root => [root, await protectionDriftFingerprint(root)]))) });
            const raw = target.get<unknown>(DRIFT_BASELINE_KEY);
            const previous = raw === undefined ? undefined : parseDriftBaseline(raw);
            const delta = previous ? compareDrift(previous, current) : undefined;
            const changedRoots = delta ? [...delta.changed, ...delta.added, ...delta.removed].sort() : [];
            if (previous && !changedRoots.length) return { status: "UNCHANGED" };
            // The fresh snapshot already validates every active grant against its
            // exact current policy/config/source revision. A delayed historical
            // baseline check must not revoke a review of that newer revision.
            delta?.removed.forEach(root => revokeOwnerPolicySessions(root));
            await target.update(DRIFT_BASELINE_KEY, current);
            const afterRoots = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.toString()).sort();
            if (!ownerPolicyReviewEnabled() || JSON.stringify(afterRoots) !== JSON.stringify(roots)
                || (await Promise.all(roots.map(async root => await protectionDriftFingerprint(root) === current.roots[root]))).some(equal => !equal)) throw new Error("Protection changed during drift persistence.");
            if (previous) {
                void vscode.window.showWarningMessage(`SoterAI detected protection drift in ${changedRoots.length} project(s). Protection was rechecked and stale session permissions revoked. Review policy, safety settings and installed AI extension versions; permanent denies remain. Same-user settings are not agent-proof.`);
                return { status: "DRIFT", changedRoots };
            }
            return { status: "BASELINE_SAVED" };
        } catch {
            revokeOwnerPolicySessions();
            void vscode.window.showWarningMessage("SoterAI protection drift verification is unavailable. Session permissions were revoked; existing restrictions remain. Check policy format, workspace trust and storage.");
            return { status: "FAILED" };
        }
    })();
    checks.set(target, run);
    try { return await run; } finally { if (checks.get(target) === run) checks.delete(target); }
}
/** Starts once per activation and disposes all owned timers/watchers. Native events revoke before async checks. */
export function registerPolicyDriftMonitor(context: vscode.ExtensionContext): void {
    let disposed = false, debounce: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
        if (disposed) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => { if (!disposed && ownerPolicyReviewEnabled()) void checkPolicyDrift(context); }, 1000);
        debounce.unref?.();
    };
    const changed = () => { revokeOwnerPolicySessions(); schedule(); };
    const watcher = vscode.workspace.createFileSystemWatcher("**/{.aiignore,policy.json,team-policy.json}");
    const periodic = setInterval(() => { if (!disposed && ownerPolicyReviewEnabled()) void checkPolicyDrift(context); }, 60_000); periodic.unref?.();
    context.subscriptions.push(watcher, watcher.onDidCreate(changed), watcher.onDidChange(changed), watcher.onDidDelete(changed),
        vscode.workspace.onDidChangeConfiguration(changed), vscode.workspace.onDidChangeWorkspaceFolders(changed),
        vscode.workspace.onDidGrantWorkspaceTrust(changed), vscode.extensions.onDidChange(changed), onDidChangeBoundaryRules(schedule),
        onDidChangeManualRestriction(root => { revokeOwnerPolicySessions(root); schedule(); }),
        new vscode.Disposable(() => { disposed = true; clearInterval(periodic); if (debounce) clearTimeout(debounce); revokeOwnerPolicySessions(); }));
    schedule();
}
