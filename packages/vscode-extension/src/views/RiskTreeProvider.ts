import * as vscode from "vscode";
import { ExtensionState } from "../state";
import type { Finding } from "@soterai/guard-core";

export class RiskTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private viewId: string;

    constructor(viewId: string) {
        this.viewId = viewId;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
            return Promise.resolve(element.children || []);
        }

        const state = ExtensionState.getInstance();
        const config = vscode.workspace.getConfiguration("soterai");

        if (this.viewId === "soterai-project-risk") {
            const scannedCount = state.scannedFiles.size;
            const latestRisk = state.latestDecision ? state.latestDecision.riskScore : 0;
            const items: TreeItem[] = [
                new TreeItem(`Overall Risk Status: ${latestRisk >= 70 ? "🔴 High" : latestRisk >= 35 ? "🟡 Medium" : "🟢 Low"}`, vscode.TreeItemCollapsibleState.None),
                new TreeItem(`Workspace Risk Score: ${latestRisk}/100`, vscode.TreeItemCollapsibleState.None),
                new TreeItem(`Scanned Files Tracked: ${scannedCount}`, vscode.TreeItemCollapsibleState.None),
            ];
            return Promise.resolve(items);
        }

        if (this.viewId === "soterai-latest-findings") {
            const decision = state.latestDecision;
            if (!decision || !decision.findings.length) {
                return Promise.resolve([new TreeItem("No threat findings match context", vscode.TreeItemCollapsibleState.None)]);
            }
            const items = decision.findings.map((f: Finding) => {
                const leaf = [
                    new TreeItem(`Category: ${f.category}`, vscode.TreeItemCollapsibleState.None),
                    new TreeItem(`Location: [${f.start}, ${f.end}]`, vscode.TreeItemCollapsibleState.None),
                    new TreeItem(`Redacted: ${f.redactedEvidence}`, vscode.TreeItemCollapsibleState.None),
                ];
                return new TreeItem(`[${f.severity.toUpperCase()}] ${f.title}`, vscode.TreeItemCollapsibleState.Collapsed, leaf);
            });
            return Promise.resolve(items);
        }

        if (this.viewId === "soterai-policy-status") {
            const cloudEnabled = config.get("cloud.enabled", false);
            const policyMode = config.get("policy.mode", "local");
            const items: TreeItem[] = [
                new TreeItem(`Policy Mode: ${policyMode.toUpperCase()}`, vscode.TreeItemCollapsibleState.None),
                new TreeItem(`Cloud Integration: ${cloudEnabled ? "Sync Enabled" : "Offline / Disabled"}`, vscode.TreeItemCollapsibleState.None),
                new TreeItem(`Rule Cache Status: Fresh (Updated Locally)`, vscode.TreeItemCollapsibleState.None),
            ];
            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly children?: TreeItem[]
    ) {
        super(label, collapsibleState);
    }
}
