import * as vscode from "vscode";
import * as path from "node:path";
import { storedRules, onDidChangeBoundaryRules, onDidChangeOwnerPolicySession } from "../ai-boundary/BoundarySnapshot";
import { onDidChangeManualRestriction } from "../ai-boundary/RestrictionOperation";
import { matchesRule, relativePath } from "../ai-boundary/policy";
import { loadPrivacyVerification } from "../project-privacy/VerificationEvidence";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";
import type { AISentinel } from "../sentinel/AISentinel";
import { CENTER_WORKFLOWS, centerEnglish, protectionCenterRows, type CenterFacts, type CenterRow, type CenterRows, type CenterSection } from "./ProtectionCenterModel";
import { ProtectionCenterSession } from "./ProtectionCenterSession";
import { protectionCenterEnabled } from "./ProtectionCenterFlags";

const t = (message: string, ...args: Array<string | number>) => {
    try { return vscode.l10n.t(message, ...args); } catch { return centerEnglish(message, ...args); }
};
const empty = (): CenterFacts => ({ enabled: protectionCenterEnabled(), trusted: vscode.workspace.isTrusted, workspaceCount: 0,
    unavailable: true, restrictions: [], activity: [], activityEnabled: false, broker: "unavailable", evidence: { state: "UNAVAILABLE", surfaces: [], fullClaim: "BLOCKED" } });

class CenterTree implements vscode.TreeDataProvider<CenterRow>, vscode.Disposable {
    private readonly changed = new vscode.EventEmitter<CenterRow | undefined>();
    readonly onDidChangeTreeData = this.changed.event;
    private rows: ReadonlyArray<CenterRow> = [];
    replace(rows: ReadonlyArray<CenterRow>): void { this.rows = rows; this.changed.fire(undefined); }
    getChildren(element?: CenterRow): CenterRow[] { return element ? [] : [...this.rows]; }
    getTreeItem(row: CenterRow): vscode.TreeItem {
        const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
        item.description = row.description;
        item.tooltip = row.description ? `${row.label}\n${row.description}` : row.label;
        item.iconPath = new vscode.ThemeIcon(row.icon);
        item.accessibilityInformation = { label: row.description ? `${row.label}. ${row.description}` : row.label, role: "treeitem" };
        item.contextValue = row.action === "manage" ? "soterai.savedRestriction" : "soterai.protectionCenterInfo";
        if (row.action) item.command = { command: "soterai.protectionCenterAction", title: row.label, arguments: [row.action] };
        return item;
    }
    dispose(): void { this.rows = []; this.changed.dispose(); }
}
export interface ProtectionCenterDependencies {
    sentinel: Pick<AISentinel, "getEvents" | "isEnabled">;
    brokerState(): string;
}
export interface ProtectionCenterHandle extends vscode.Disposable { refresh(): Promise<void> }

/** Native presentation. Never scans contents, writes policy or changes a vendor/profile. */
export function registerProtectionCenter(context: vscode.ExtensionContext, deps: ProtectionCenterDependencies): ProtectionCenterHandle {
    const resources: vscode.Disposable[] = [], trees = { protected: new CenterTree(), activity: new CenterTree(), coverage: new CenterTree() };
    const decorationChanged = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    let disposed = false, choosing = false, visibleViews = 0;
    const visibility = new Map<string, boolean>();
    const publish = (rows: CenterRows) => {
        if (disposed) return;
        for (const section of Object.keys(trees) as CenterSection[]) trees[section].replace(rows[section]);
        decorationChanged.fire(undefined);
    };
    const load = async (): Promise<CenterFacts> => {
        const result = empty(), folders = vscode.workspace.workspaceFolders ?? [];
        result.workspaceCount = folders.filter(folder => folder.uri.scheme === "file").length;
        result.unavailable = folders.some(folder => folder.uri.scheme !== "file") || folders.length > 32;
        if (!result.enabled || !result.trusted) return result;
        const restrictions: CenterFacts["restrictions"][number][] = [];
        // Only accepted explicit metadata is read. BoundarySnapshot.load can
        // enroll additive policy, so it is deliberately not a presentation read.
        for (const folder of folders.slice(0, 32)) {
            if (folder.uri.scheme !== "file") continue;
            const rules = storedRules(folder.uri.toString());
            for (const rule of rules.paths) if (restrictions.length < 257) restrictions.push({ project: folder.name, kind: rule.kind, pattern: rule.pattern, sensitive: rule.sensitive === true });
            for (const region of rules.regions) if (restrictions.length < 257) restrictions.push({ project: folder.name, kind: "region", pattern: region.path, sensitive: true });
        }
        result.restrictions = restrictions;
        result.activityEnabled = selfHygieneEnabled() && deps.sentinel.isEnabled;
        result.activity = result.activityEnabled ? deps.sentinel.getEvents().slice(-100) : [];
        result.evidence = loadPrivacyVerification(context.extensionPath, vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.runtimeEvidence", true));
        result.broker = deps.brokerState();
        return result;
    };
    const session = new ProtectionCenterSession({ enabled: protectionCenterEnabled, trusted: () => vscode.workspace.isTrusted,
        load, execute: command => Promise.resolve(vscode.commands.executeCommand(command)), publish, translate: t,
        outcome: status => {
            if (status === "FAILED" || status === "INCOMPLETE") void Promise.resolve(vscode.window.showWarningMessage(t("The reviewed action did not complete. Existing protection and recovery records are retained."))).catch(() => {});
            else if (status === "UNVERIFIED") void Promise.resolve(vscode.window.showInformationMessage(t("The owning workflow did not return a verified result. Review its status before relying on the change."))).catch(() => {});
        } });
    const refresh = async () => {
        if (disposed) return;
        await vscode.commands.executeCommand("setContext", "soterai.protectionCenter", protectionCenterEnabled());
        await session.refresh();
    };
    const changed = () => { session.invalidate(); void refresh().catch(() => { /* Fixed unavailable presentation; no raw errors. */ }); };
    for (const [section, id, title] of [["protected", "soterai-protected-items", "Protected items"], ["activity", "soterai-protection-activity", "Activity"], ["coverage", "soterai-protection-coverage", "Coverage"]] as const) {
        const view = vscode.window.createTreeView(id, { treeDataProvider: trees[section], showCollapseAll: false, canSelectMany: false });
        view.title = t(title);
        visibility.set(id, view.visible === true);visibleViews = [...visibility.values()].filter(Boolean).length;
        resources.push(view, trees[section], view.onDidChangeVisibility(event => {
            visibility.set(id, event.visible); visibleViews = [...visibility.values()].filter(Boolean).length;
            if (event.visible) void refresh().catch(() => {});
        }));
    }
    const decoration: vscode.FileDecorationProvider = {
        onDidChangeFileDecorations: decorationChanged.event,
        provideFileDecoration(uri) {
            if (disposed || !protectionCenterEnabled() || !vscode.workspace.isTrusted || uri.scheme !== "file") return;
            const folder = vscode.workspace.getWorkspaceFolder(uri);if (!folder || folder.uri.scheme !== "file") return;
            try {
                const selected = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/").normalize("NFC"), rules = storedRules(folder.uri.toString());
                const rel = selected ? relativePath(selected) : undefined;
                if (rules.paths.some(rule => rel === undefined ? rule.kind === "folder" && rule.pattern === "." : matchesRule(rel, { ...rule, pattern: rule.pattern.normalize("NFC") }))
                    || (rel !== undefined && rules.regions.some(region => relativePath(region.path.normalize("NFC")) === rel)))
                    return { badge: "🔒", tooltip: t("Saved SoterAI restriction; managed routes only."), propagate: false };
            } catch { return; }
            return;
        },
    };
    const registeredDecoration = vscode.window.registerFileDecorationProvider?.(decoration);
    if (registeredDecoration) resources.push(registeredDecoration);
    resources.push(decorationChanged);
    const chooseWorkflow = async () => {
        if (disposed || choosing || !protectionCenterEnabled() || !vscode.workspace.isTrusted) return { status: "UNAVAILABLE" };
        const epoch = session.epoch;
        choosing = true;
        try {
            const choices = CENTER_WORKFLOWS.flatMap(item => [{ label: t("Review setup: {0}…", item.label), description: t("Optional change with its own preview and approval"), action: item.apply },
                { label: t("Restore: {0}…", item.label), description: t("Reviewed recovery; existing owner verifies the saved receipt"), action: item.restore }]);
            const choice = await vscode.window.showQuickPick(choices, { title: t("Protection Center: optional setup and restore"), placeHolder: t("Choose one reviewed workflow; nothing is changed by opening this list"), matchOnDescription: true });
            if (!choice) return { status: "CANCELLED" };
            if (!choices.includes(choice) || disposed || session.epoch !== epoch || !protectionCenterEnabled() || !vscode.workspace.isTrusted) return { status: "UNAVAILABLE" };
            return await session.run(choice.action);
        } catch { return { status: "INCOMPLETE" }; }
        finally { choosing = false; }
    };
    const reg = (name: string, action: (...args: unknown[]) => unknown) => resources.push(vscode.commands.registerCommand(name, async (...args: unknown[]) => {
        if (disposed) return { status: "UNAVAILABLE" };
        try { return await action(...args); } catch { return { status: "INCOMPLETE" }; }
    }));
    reg("soterai.openProtectionCenter", async () => {
        if (disposed || !protectionCenterEnabled()) return { status: "UNAVAILABLE" };
        await refresh();await vscode.commands.executeCommand("soterai-protected-items.focus");return { status: "OPENED" };
    });
    reg("soterai.refreshProtectionCenter", async () => { await refresh();return { status: disposed || !protectionCenterEnabled() ? "UNAVAILABLE" : "REFRESHED" }; });
    reg("soterai.protectionCenterAction", (action: unknown) => action === "workflows" ? chooseWorkflow() : session.run(action));
    resources.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) changed(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(changed), vscode.workspace.onDidGrantWorkspaceTrust(changed),
        onDidChangeBoundaryRules(changed), onDidChangeOwnerPolicySession(changed), onDidChangeManualRestriction(changed));
    // Existing Sentinel has no public event emitter. A visible native tree gets
    // a bounded periodic metadata refresh; no new scanner or child is created.
    const timer = setInterval(() => { if (visibleViews && protectionCenterEnabled()) void refresh().catch(() => {}); }, 30000);
    timer.unref?.();
    const handle: ProtectionCenterHandle = { refresh, dispose() {
        if (disposed) return;
        disposed = true;clearInterval(timer);session.dispose();for (const resource of resources.reverse()) resource.dispose();
        void vscode.commands.executeCommand("setContext", "soterai.protectionCenter", false).then(undefined, () => {});
    } };
    context.subscriptions.push(handle);
    publish(protectionCenterRows(empty(), Date.now(), t));
    void refresh().catch(() => {});
    return handle;
}
