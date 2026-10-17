import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { DEFAULT_PROJECT_POLICY, classifyPath, parseProjectPolicy, isSensitiveFilePath, type ProjectPolicy } from "@soterai/guard-core";
import { readBoundaryFile } from "./readFile";
import { matchesGlob, matchesRule, parseAiIgnore, parseManualRules, mergeManualRules, validateGlob, redactRegions, relativePath, documentDigest, OMITTED, type ManualRules } from "./policy";
import { SENSITIVE_MARKS_KEY, parseSensitiveMarks } from "../project-privacy/SensitiveRestrictions";
import { defaultVersionedPolicy, mergeVersionedPolicies, parseStoredPolicy, parseVersionedPolicy, parseVersionedPolicyText,
    STORED_POLICY_SCHEMA_VERSION, MAX_POLICY_BYTES, versionedPolicyBlocks, versionedPolicySensitive, type VersionedPolicy } from "./VersionedPolicy";
import { assertRestrictionWorkspace, withPendingRestriction } from "./RestrictionOperation";
import { encodeStoredPolicy } from "./VersionedPolicy";
import { createOwnerReviewPlan, OwnerReviewAttempt, parseReviewAudit, validateOwnerReview } from "./OwnerReviewProtocol";

export const RULES_KEY = "soterai.aiForbidden.v1";
const boundaryRulesChanged = new vscode.EventEmitter<string>();
/** Fires the workspace root only after a successful persistent rule change. No content is emitted. */
export const onDidChangeBoundaryRules = boundaryRulesChanged.event;
let state: vscode.Memento | undefined;
let ownerEpoch = 0;
const rootOwnerEpoch = new Map<string, number>();
const ownerSessionChanged = new vscode.EventEmitter<string>();
export const onDidChangeOwnerPolicySession = ownerSessionChanged.event;
interface SessionGrant { binding: string; revision: string; rule: string }
const sessionGrants = new Map<string, SessionGrant[]>();
// A provider reread must not emit another refresh while the root stays invalid.
// The first transition still revokes owned approvals even without session grants.
const unavailableRoots = new Set<string>();
export function revokeOwnerPolicySessions(root?: string): void {
    if (root) { rootOwnerEpoch.set(root, (rootOwnerEpoch.get(root) ?? 0) + 1); sessionGrants.delete(root); ownerSessionChanged.fire(root); }
    else { ownerEpoch++; rootOwnerEpoch.clear(); const roots = [...sessionGrants.keys()]; sessionGrants.clear(); roots.forEach(value => ownerSessionChanged.fire(value)); }
}
export function ownerPolicyReviewEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.policyDrift");
        return vscode.workspace.isTrusted && policyEnabled()
            && (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.policyDrift", true)) === true;
    } catch { return false; }
}
function publicSettings(): unknown {
    const config = vscode.workspace.getConfiguration("soterai");
    return [vscode.workspace.isTrusted, ["lite.policyDrift", "lite.safeConsent", "lite.secureEditor", "lite.vaultMode", "lite.secretMatching", "lite.outputRedactor", "lite.vaultRuntime", "lite.ps51Terminal", "lite.cmdTerminal", "lite.versionedPolicy", "lite.restrictionSave", "hardening.addOnlyPolicy",
        "projectPrivacy.enabled", "projectPrivacy.atomicSensitivePolicy", "projectPrivacy.safeViewComposition", "broker.autoStart",
        "terminal.protectionMode"].map(key => {
        const value = config.inspect(key);
        // Hash only selected scalar safety settings. Never inspect provider/auth configurations.
        const current = value ? value.globalValue ?? value.defaultValue : config.get(key);
        return [key, typeof current === "boolean" || typeof current === "number" || typeof current === "string" ? current : null];
    }), (vscode.extensions.all ?? []).map(extension => [extension.id, extension.packageJSON?.version ?? "unknown"])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))];
}
function ownerBinding(root: string): string {
    assertRestrictionWorkspace(root);
    return documentDigest(JSON.stringify([ownerEpoch, rootOwnerEpoch.get(root) ?? 0, root, exportRootPolicy(root), publicSettings()]));
}
async function policySources(folder: vscode.WorkspaceFolder): Promise<Array<string | undefined>> {
    return Promise.all([optionalPolicyFile(folder, ".aiignore"), optionalPolicyFile(folder, ".soterai/policy.json"),
        optionalPolicyFile(folder, ".soterai/team-policy.json", MAX_POLICY_BYTES)]);
}
export async function ownerPolicyRevision(root: string): Promise<string> {
    const folder = vscode.workspace.workspaceFolders?.find(folder => folder.uri.toString() === root);
    if (!folder || folder.uri.scheme !== "file" || !state) throw new Error("Policy revision unavailable.");
    const before = ownerBinding(root), sources = await policySources(folder);
    if (ownerBinding(root) !== before) throw new Error("Policy changed during revision check.");
    return documentDigest(JSON.stringify([before, documentDigest(JSON.stringify(sources))]));
}
/** Persistent drift baseline excludes process incarnation so restart alone is not an alert. */
export async function protectionDriftFingerprint(root: string): Promise<string> {
    const folder = vscode.workspace.workspaceFolders?.find(folder => folder.uri.toString() === root);
    if (!folder || folder.uri.scheme !== "file") throw new Error("Local policy required.");
    return documentDigest(JSON.stringify([root, exportRootPolicy(root), publicSettings(),
        documentDigest(JSON.stringify(await policySources(folder)))]));
}
const stateWrites = new WeakMap<vscode.Memento, Promise<unknown>>();
let legacyProtected: ((relativePath: string) => boolean) | undefined;
export function setBoundaryProtectedChecker(checker: (relativePath: string) => boolean): void { legacyProtected = checker; }
export function initializeBoundaryState(value: vscode.Memento): void { revokeOwnerPolicySessions(); unavailableRoots.clear(); state = value; }
function readStoredRules(target: vscode.Memento | undefined, root: string): ManualRules {
    if (!target) throw new Error("AI policy storage is unavailable.");
    const all = target?.get<Record<string, unknown>>(RULES_KEY, {});
    if (all !== undefined && (!all || typeof all !== "object" || Array.isArray(all))) throw new Error("Invalid AI policy storage.");
    const legacy = parseSensitiveMarks(target ? target.get(SENSITIVE_MARKS_KEY, {}) : {}, root);
    return mergeManualRules(parseStoredPolicy(all?.[root]).manual, {
        paths: legacy.map(pattern => ({ kind: "file", pattern, sensitive: true })), regions: [],
    });
}
export function storedRules(root: string): ManualRules { return readStoredRules(state, root); }
function writeRules(root: string, update: (rules: ManualRules) => ManualRules): Promise<void> {
    const target = state;
    if (!target) return Promise.reject(new Error("AI policy storage is unavailable."));
    const write = (stateWrites.get(target) ?? Promise.resolve()).then(async () => {
        const all = target.get<Record<string, unknown>>(RULES_KEY, {});
        if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid AI policy storage.");
        const validated = parseManualRules(update(readStoredRules(target, root)));
        const previous = parseStoredPolicy(all[root]);
        const encoded = encodeStoredPolicy({ ...previous, manual: validated });
        parseStoredPolicy(encoded);
        await target.update(RULES_KEY, { ...all, [root]: encoded });
        if (JSON.stringify(all[root]) !== JSON.stringify(encoded)) { revokeOwnerPolicySessions(root); boundaryRulesChanged.fire(root); }
    });
    stateWrites.set(target, write.catch(() => undefined));
    return write;
}
const policyEnabled = () => vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.addOnlyPolicy", true);
const manualMatches = (rel: string, rule: import("./policy").PathRule) =>
    matchesRule(rel.normalize("NFC"), { ...rule, pattern: rule.pattern.normalize("NFC") });
const pathRuleIdentity = (rule: import("./policy").PathRule): string => JSON.stringify([rule.kind,
    rule.kind === "glob" ? validateGlob(rule.pattern.normalize("NFC")).toLowerCase()
        : rule.kind === "folder" && rule.pattern === "." ? "." : relativePath(rule.pattern.normalize("NFC")), rule.sensitive === true]);
export function updateRules(root: string, update: (rules: ManualRules) => ManualRules): Promise<void> {
    if (!policyEnabled()) return Promise.reject(new Error("AI policy updates disabled; context sharing unavailable."));
    return writeRules(root, current => mergeManualRules(current, parseManualRules(update(structuredClone(current)))));
}
export function saveRules(root: string, rules: ManualRules): Promise<void> {
    return updateRules(root, () => rules);
}

export function versionedPolicyEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai");
        const inspected = config.inspect<boolean>("lite.versionedPolicy");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.versionedPolicy", true)) === true;
    } catch { return false; }
}
export function storedVersionedPolicy(root: string): VersionedPolicy | undefined {
    if (!state) throw new Error("AI policy storage is unavailable.");
    const all = state.get<Record<string, unknown>>(RULES_KEY, {});
    if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid AI policy storage.");
    return parseStoredPolicy(all[root]).policy;
}
/** One atomic union in the existing queue. Older readers reject the v2 envelope. */
export async function updateVersionedPolicy(root: string, added: VersionedPolicy): Promise<void> {
    const validated = parseVersionedPolicy(added);
    if (!vscode.workspace.isTrusted || !versionedPolicyEnabled() || !policyEnabled()) throw new Error("Versioned policy setup unavailable.");
    const target = state;
    if (!target) throw new Error("AI policy storage is unavailable.");
    await withPendingRestriction(root, async () => {
        const write = (stateWrites.get(target) ?? Promise.resolve()).then(async () => {
            if (!vscode.workspace.isTrusted || !versionedPolicyEnabled() || !policyEnabled()) throw new Error("Versioned policy setup unavailable.");
            assertRestrictionWorkspace(root);
            const all = target.get<Record<string, unknown>>(RULES_KEY, {});
            if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid AI policy storage.");
            const previous = parseStoredPolicy(all[root]);
            const policy = previous.policy ? mergeVersionedPolicies(previous.policy, validated) : validated;
            const encoded = encodeStoredPolicy({ ...previous, manual: readStoredRules(target, root), policy });
            parseStoredPolicy(encoded);
            if (JSON.stringify(all[root]) === JSON.stringify(encoded)) return;
            await target.update(RULES_KEY, { ...all, [root]: encoded });
            revokeOwnerPolicySessions(root); boundaryRulesChanged.fire(root);
        });
        stateWrites.set(target, write.catch(() => undefined));
        await write;
        assertRestrictionWorkspace(root);
    });
}
/** Portable metadata includes every effective accepted manual and imported deny. */
export function exportRootPolicy(root: string): VersionedPolicy {
    const policy = storedVersionedPolicy(root) ?? parseVersionedPolicy({ schemaVersion: 1, presets: [], rules: { paths: [], regions: [] }, sensitiveGlobs: [] });
    return mergeVersionedPolicies(policy, { schemaVersion: 1, presets: [], rules: storedRules(root), sensitiveGlobs: [] });
}

type OwnerReviewResult = { status: "RELAXED_SESSION" | "CANCELLED" | "FAILED" | "UNAVAILABLE" };
let reviewingOwnerPolicy = false;
class OwnerReviewPreview implements vscode.TextDocumentContentProvider {
    readonly values = new Map<string, string>();
    provideTextDocumentContent(uri: vscode.Uri): string { return this.values.get(uri.toString()) ?? "Owner review expired."; }
}
/** Native owner UI only. Permanent rules and all sensitivity/region treatment remain stored. */
export async function reviewRuleRelaxation(mode: "ordinary" | "sensitive" = "ordinary"): Promise<OwnerReviewResult> {
    if (!ownerPolicyReviewEnabled() || reviewingOwnerPolicy || !["ordinary", "sensitive"].includes(mode)) return { status: "UNAVAILABLE" };
    reviewingOwnerPolicy = true;
    let registration: vscode.Disposable | undefined;
    try {
        const target = state;
        const folder = await vscode.window.showWorkspaceFolderPick();
        if (!folder) return { status: "CANCELLED" };
        const root = folder.uri.toString(); assertRestrictionWorkspace(root);
        const snapshot = await BoundarySnapshot.load();
        if (!target || state !== target || !snapshot.availableForRoot(folder.uri) || !ownerPolicyReviewEnabled()) return { status: "UNAVAILABLE" };
        const rules = storedRules(root), imported = storedVersionedPolicy(root);
        const choices = rules.paths.filter(rule => (mode === "sensitive") === (rule.sensitive === true))
            // Imported deny selectors cannot be removed by a local review.
            .filter(rule => !imported?.rules.paths.some(other => pathRuleIdentity(other) === pathRuleIdentity(rule)))
            .map(rule => ({ label: `${rule.kind}: ${rule.pattern}`, value: JSON.stringify(rule), region: false }));
        if (mode === "sensitive") choices.push(...rules.regions.map(rule => ({ label: `Protected text: ${rule.path} (${rule.start}-${rule.end})`, value: JSON.stringify(rule), region: true })));
        const choice = await vscode.window.showQuickPick(choices, { title: mode === "ordinary" ? "Review a manual deny for this editor session" : "Review sensitive protection for this editor session",
            placeHolder: "Permanent protection returns on restart or drift. Imported/default denies and protected text remain enforced." });
        if (!choice || !choices.includes(choice)) return { status: "CANCELLED" };
        const revision = await ownerPolicyRevision(root), binding = ownerBinding(root);
        const ruleDigest = documentDigest(choice.value), plan = createOwnerReviewPlan(root, ruleDigest, revision, Date.now());
        const attempt = new OwnerReviewAttempt(plan), preview = new OwnerReviewPreview();
        const left = vscode.Uri.parse(`soterai-owner-review:/${plan.nonce}/before.json`), right = vscode.Uri.parse(`soterai-owner-review:/${plan.nonce}/session.json`);
        const permanent = exportRootPolicy(root);
        preview.values.set(left.toString(), JSON.stringify({ permanent, session: { reviewedSelector: null } }, null, 2));
        preview.values.set(right.toString(), JSON.stringify({ permanent, session: { reviewedSelector: JSON.parse(choice.value), lifetime: "this editor session",
            sensitiveTreatment: "retained", protectedRegions: "retained", importedDenies: "retained" } }, null, 2));
        registration = vscode.workspace.registerTextDocumentContentProvider("soterai-owner-review", preview);
        await vscode.commands.executeCommand("vscode.diff", left, right, "SoterAI: review session relaxation");
        const accepted = await vscode.window.showWarningMessage(`Review ${choice.label} in ${folder.name} for this editor session? Review the exact metadata diff. Permanent rules stay saved. Sensitive files still require a masked safe read; protected text and imported/default denies remain withheld. Restart or any protection drift restores the deny. This editor confirmation is not agent-proof.`,
            { modal: true }, "Review session relaxation");
        if (accepted !== "Review session relaxation") return { status: "CANCELLED" };
        const typed = await vscode.window.showInputBox({ title: "Confirm this session review", prompt: `Type exactly: ${plan.challenge}`,
            placeHolder: "Exact confirmation required; review has a 10-second cooldown and expires after 60 seconds.", ignoreFocusOut: true });
        if (typed === undefined) return { status: "CANCELLED" };
        if (typed !== plan.challenge || Date.now() < plan.createdAt || Date.now() >= plan.expiresAt) return { status: "FAILED" };
        if (Date.now() < plan.cooldownUntil) {
            const completed = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Reviewing session protection", cancellable: true },
                async (_progress, token) => {
                    if (token.isCancellationRequested) return false;
                    return new Promise<boolean>(resolve => {
                        const timer = setTimeout(() => { cancel?.dispose(); resolve(!token.isCancellationRequested); }, Math.max(0, plan.cooldownUntil - Date.now()));
                        const cancel = token.onCancellationRequested?.(() => { clearTimeout(timer); resolve(false); });
                    });
                });
            if (!completed) return { status: "CANCELLED" };
        }
        const final = await vscode.window.showWarningMessage("Relax for this editor session? Original restrictions remain saved, sensitive data and protected text stay masked, and all grants end on restart or protection drift. This confirmation is not agent-proof.",
            { modal: true }, "Relax for this editor session");
        if (final !== "Relax for this editor session") return { status: "CANCELLED" };
        const currentRevision = await ownerPolicyRevision(root);
        if (state !== target || !ownerPolicyReviewEnabled() || ownerBinding(root) !== binding
            || !attempt.consume(typed, Date.now(), root, ruleDigest, currentRevision)) return { status: "FAILED" };
        const write = (stateWrites.get(target) ?? Promise.resolve()).then(async () => {
            if (state !== target || !ownerPolicyReviewEnabled() || await ownerPolicyRevision(root) !== revision) throw new Error("Reviewed policy changed.");
            const all = target.get<Record<string, unknown>>(RULES_KEY, {});
            if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid policy storage.");
            const previous = parseStoredPolicy(all[root]);
            const audit = parseReviewAudit({ schemaVersion: 1, records: [...(previous.reviewAudit?.records ?? []),
                { id: plan.nonce, at: Date.now(), mode, ruleDigest, revisionDigest: revision, outcome: "REVIEWED_SESSION" }] });
            const encoded = encodeStoredPolicy({ ...previous, reviewAudit: audit }); parseStoredPolicy(encoded);
            await target.update(RULES_KEY, { ...all, [root]: encoded });
            if (state !== target || !ownerPolicyReviewEnabled() || ownerBinding(root) !== binding || await ownerPolicyRevision(root) !== revision
                || !validateOwnerReview(plan, typed, Date.now(), root, ruleDigest, revision)) throw new Error("Reviewed policy changed after persistence.");
            const grants = sessionGrants.get(root) ?? [];
            grants.push({ binding, revision, rule: choice.region ? `region:${ruleDigest}` : pathRuleIdentity(JSON.parse(choice.value)) }); sessionGrants.set(root, grants);
            ownerSessionChanged.fire(root);
        });
        stateWrites.set(target, write.catch(() => undefined)); await write;
        void vscode.window.showInformationMessage("Session review saved. Permanent denies remain; sensitive contents and protected text stay masked. Restart or protection drift ends this session permission.");
        return { status: "RELAXED_SESSION" };
    } catch {
        void vscode.window.showErrorMessage("SoterAI could not complete the session review. Existing restrictions remain. Check policy drift, review expiry and storage.");
        return { status: ownerPolicyReviewEnabled() ? "FAILED" : "UNAVAILABLE" };
    } finally { registration?.dispose(); reviewingOwnerPolicy = false; }
}

interface RootPolicy { folder: vscode.WorkspaceFolder; globs: string[]; manual: ManualRules; invalid: boolean; project: ProjectPolicy; versioned?: VersionedPolicy; sourceDigest?: string }

async function optionalPolicyFile(folder: vscode.WorkspaceFolder, rel: string, limit = 64 * 1024): Promise<string | undefined> {
    const target = path.join(folder.uri.fsPath, rel);
    try { await lstat(target); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
    return readBoundaryFile(folder.uri.fsPath, target, limit);
}

/** Immutable policy per collection. Invalid/unreadable existing policy denies that root. */
export class BoundarySnapshot {
    private constructor(private readonly roots: RootPolicy[]) {}

    /** Exact-root validity for UI configuration reporting; this does not establish an OS boundary. */
    availableForRoot(uri: vscode.Uri): boolean {
        return uri.scheme === "file" && this.roots.some(root => root.folder.uri.toString() === uri.toString() && !root.invalid);
    }

    static async load(): Promise<BoundarySnapshot> {
        const roots = await Promise.all((vscode.workspace.workspaceFolders ?? []).map(async folder => {
            const root: RootPolicy = {
                folder, globs: [...DEFAULT_PROJECT_POLICY.protectedFiles, ".git/", ".aiignore", ".soterai/", ".soterai-policy.json"],
                manual: { paths: [], regions: [] }, invalid: folder.uri.scheme !== "file" || !policyEnabled(),
                project: structuredClone(DEFAULT_PROJECT_POLICY),
            };
            try {
                root.manual = storedRules(folder.uri.toString());
                // Retain the legacy record, but commit its stronger treatment before any managed release.
                const persisted = parseStoredPolicy(state?.get<Record<string, unknown>>(RULES_KEY, {})?.[folder.uri.toString()]).manual;
                if (JSON.stringify(persisted) !== JSON.stringify(root.manual)) {
                    await updateRules(folder.uri.toString(), rules => rules);
                    root.manual = storedRules(folder.uri.toString());
                }
                const ignore = await optionalPolicyFile(folder, ".aiignore");
                const acceptedGlobs = ignore === undefined ? [] : parseAiIgnore(ignore);
                const project = await optionalPolicyFile(folder, ".soterai/policy.json");
                let retainedSensitivity: string[] = [];
                if (project !== undefined) {
                    const parsed: unknown = JSON.parse(project);
                    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid project policy.");
                    const protectedFiles = (parsed as { protectedFiles?: unknown })?.protectedFiles;
                    if (protectedFiles !== undefined) {
                        if (!Array.isArray(protectedFiles) || protectedFiles.some(p => typeof p !== "string" || /[\r\n]/.test(p))) throw new Error("Invalid project policy.");
                        if (protectedFiles.length > 256 || protectedFiles.some(p => p.length > 256 || !p.trim())) throw new Error("Invalid project policy.");
                    }
                    const sensitive = (parsed as { sensitivePaths?: unknown }).sensitivePaths;
                    if (sensitive !== undefined && (!Array.isArray(sensitive)
                        || sensitive.length > 256 || sensitive.some(p => typeof p !== "string" || !p.trim() || p.length > 256))) throw new Error("Invalid sensitive paths.");
                    root.project = parseProjectPolicy(parsed);
                    retainedSensitivity = [...root.project.protectedFiles, ...root.project.sensitivePaths].map(validateGlob);
                    acceptedGlobs.push(...root.project.protectedFiles.map(validateGlob));
                    if (root.project.aiContext.sensitivePathAction === "block") acceptedGlobs.push(...root.project.sensitivePaths.map(validateGlob));
                    if (root.project.aiContext.defaultAction === "block") acceptedGlobs.push("**");
                }
                if (acceptedGlobs.length && policyEnabled()) {
                    await updateRules(folder.uri.toString(), rules => ({ ...rules,
                        paths: [...rules.paths, ...acceptedGlobs.map(pattern => ({ kind: "glob" as const, pattern }))],
                    }));
                    root.manual = storedRules(folder.uri.toString());
                }
                root.versioned = storedVersionedPolicy(folder.uri.toString());
                const teamText = await optionalPolicyFile(folder, ".soterai/team-policy.json", MAX_POLICY_BYTES);
                root.sourceDigest = documentDigest(JSON.stringify([ignore, project, teamText]));
                const team = teamText === undefined ? undefined : parseVersionedPolicyText(teamText);
                if (versionedPolicyEnabled()) {
                    let added = defaultVersionedPolicy();
                    if (retainedSensitivity.length) added = mergeVersionedPolicies(added, { schemaVersion: 1, presets: [], rules: { paths: [], regions: [] }, sensitiveGlobs: retainedSensitivity });
                    if (team) added = mergeVersionedPolicies(added, team);
                    const merged = root.versioned ? mergeVersionedPolicies(root.versioned, added) : added;
                    if (JSON.stringify(merged) !== JSON.stringify(root.versioned)) await updateVersionedPolicy(folder.uri.toString(), added);
                    root.versioned = storedVersionedPolicy(folder.uri.toString());
                    root.manual = storedRules(folder.uri.toString());
                } else if (team && (!root.versioned || JSON.stringify(mergeVersionedPolicies(root.versioned, team)) !== JSON.stringify(root.versioned))) {
                    // New team requirements cannot be silently ignored while setup is withdrawn.
                    root.invalid = true;
                }
            } catch { root.invalid = true; }
            const key = folder.uri.toString();
            if (root.invalid) {
                if (!unavailableRoots.has(key)) {
                    unavailableRoots.add(key);
                    revokeOwnerPolicySessions(key);
                }
            } else unavailableRoots.delete(key);
            if (sessionGrants.has(folder.uri.toString())) {
                try {
                    const binding = ownerBinding(folder.uri.toString()), revision = documentDigest(JSON.stringify([binding, root.sourceDigest]));
                    if (sessionGrants.get(folder.uri.toString())!.some(grant => grant.binding !== binding || grant.revision !== revision)) revokeOwnerPolicySessions(folder.uri.toString());
                } catch { revokeOwnerPolicySessions(folder.uri.toString()); }
            }
            return root;
        }));
        return new BoundarySnapshot(roots);
    }

    private locate(uri: vscode.Uri): { root: RootPolicy; rel: string } | undefined {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        const root = this.roots.find(entry => entry.folder.uri.toString() === folder?.uri.toString());
        if (!root || uri.scheme !== "file") { if (sessionGrants.size) revokeOwnerPolicySessions(); return undefined; }
        try { return { root, rel: relativePath(path.relative(root.folder.uri.fsPath, uri.fsPath)) }; }
        catch { return undefined; }
    }

    blocks(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return true;
        if (isSensitiveFilePath(entry.rel)) return true;
        if (legacyProtected?.(vscode.workspace.asRelativePath(uri))) return true;
        const classification = classifyPath(entry.rel, entry.root.project);
        return entry.root.globs.some(glob => matchesGlob(entry.rel, glob))
            || !!entry.root.versioned && versionedPolicyBlocks(entry.rel, entry.root.versioned)
            || entry.root.manual.paths.some(rule => manualMatches(entry.rel, rule) && !this.sessionPaused(entry.root, rule))
            || classification.level === "protected" || classification.action === "block";
    }

    private sessionPaused(root: RootPolicy, rule: import("./policy").PathRule): boolean {
        // A sensitive owner review never makes a default context read raw.
        if (rule.sensitive === true) return false;
        const key = root.folder.uri.toString(), grants = sessionGrants.get(key);
        if (!grants?.length) return false;
        try {
            if (!ownerPolicyReviewEnabled() || grants.some(grant => grant.binding !== ownerBinding(key))) { revokeOwnerPolicySessions(key); return false; }
            return grants.some(grant => grant.rule === pathRuleIdentity(rule));
        } catch { revokeOwnerPolicySessions(key); return false; }
    }

    classify(uri: vscode.Uri) {
        const entry = this.locate(uri);
        return classifyPath(entry?.rel ?? "", entry?.root.project ?? DEFAULT_PROJECT_POLICY);
    }

    /** Sensitivity and deny share the same immutable policy and access revision. */
    isSensitive(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        return !entry || entry.root.invalid || isSensitiveFilePath(entry.rel)
            || !!entry.root.versioned && versionedPolicySensitive(entry.rel, entry.root.versioned)
            || entry.root.manual.paths.some(rule => rule.sensitive === true && manualMatches(entry.rel, rule))
            || [...entry.root.project.protectedFiles, ...entry.root.project.sensitivePaths]
                .some(pattern => matchesGlob(entry.rel, validateGlob(pattern)));
    }

    hasRegions(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        return !!entry && [...entry.root.manual.regions, ...entry.root.versioned?.rules.regions ?? []]
            .some(r => relativePath(r.path.normalize("NFC")) === entry.rel.normalize("NFC"));
    }

    /** Approval cannot override an invalid/disabled policy. Used by the explicit safe reader only. */
    accessRevision(uri: vscode.Uri): string | undefined {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return undefined;
        return documentDigest(JSON.stringify([entry.root.folder.uri.toString(), entry.root.globs,
            entry.root.manual, entry.root.project, entry.root.versioned, sessionGrants.get(entry.root.folder.uri.toString()) ?? [],
            legacyProtected?.(vscode.workspace.asRelativePath(uri)) === true]));
    }

    /** A one-time approved view still enforces protected regions; existing default reads remain denied. */
    private regions(root: RootPolicy) {
        return [...root.manual.regions, ...(root.versioned?.rules.regions ?? [])]
            .map(region => ({ ...region, path: region.path.normalize("NFC") }));
    }
    approvedRegionView(uri: vscode.Uri, text: string): string {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return OMITTED;
        return redactRegions(entry.rel.normalize("NFC"), text, this.regions(entry.root));
    }

    sanitize(uri: vscode.Uri, text: string): string {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        return this.approvedRegionView(uri, text);
    }

    selection(uri: vscode.Uri, text: string, start: number, end: number): string {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        return redactRegions(entry.rel.normalize("NFC"), text, this.regions(entry.root), start, end);
    }

    async read(uri: vscode.Uri): Promise<string> {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        if (!sessionGrants.has(entry.root.folder.uri.toString())) return this.sanitize(uri, await readBoundaryFile(entry.root.folder.uri.fsPath, uri.fsPath));
        const current = await BoundarySnapshot.load();
        if (current.blocks(uri)) return OMITTED;
        const text = await readBoundaryFile(entry.root.folder.uri.fsPath, uri.fsPath);
        const after = await BoundarySnapshot.load();
        return after.sanitize(uri, text);
    }
}

/** Apply path/region policy to the original document before extracting a shareable selection. */
export async function applySelectionBoundary(editor: vscode.TextEditor): Promise<string> {
    try {
        const boundary = await BoundarySnapshot.load();
        if (boundary.blocks(editor.document.uri)) return OMITTED;
        await boundary.read(editor.document.uri);
        const text = editor.document.getText();
        if (Buffer.byteLength(text, "utf8") > 64 * 1024) return OMITTED;
        return boundary.selection(editor.document.uri, text,
            editor.document.offsetAt(editor.selection.start), editor.document.offsetAt(editor.selection.end));
    } catch { return OMITTED; }
}
