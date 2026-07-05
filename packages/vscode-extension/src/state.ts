import * as vscode from "vscode";
import { DecisionEngine, PolicyEvaluator, HashCache, GuardDecision, Finding, RedactedEvent } from "@soterai/guard-core";

export class ExtensionState {
    private static instance: ExtensionState;
    public engine!: DecisionEngine;
    public currentFindings: Finding[] = [];
    public scannedFiles = new Map<string, GuardDecision>();
    public latestDecision: GuardDecision | undefined;

    private constructor() {
        this.initEngine();
    }

    public static getInstance(): ExtensionState {
        if (!ExtensionState.instance) {
            ExtensionState.instance = new ExtensionState();
        }
        return ExtensionState.instance;
    }

    public initEngine(): void {
        const config = vscode.workspace.getConfiguration("soterai");
        const mode = config.get<"local" | "team" | "enterprise">("policy.mode", "local");

        const evaluator = new PolicyEvaluator({ mode });
        const cache = new HashCache();
        this.engine = new DecisionEngine({ policyEvaluator: evaluator, hashCache: cache });
    }

    public async getCloudToken(context: vscode.ExtensionContext): Promise<string | undefined> {
        return await context.secrets.get("soterai.cloudToken");
    }

    public async setCloudToken(context: vscode.ExtensionContext, token: string): Promise<void> {
        await context.secrets.store("soterai.cloudToken", token);
    }

    public async clearCloudToken(context: vscode.ExtensionContext): Promise<void> {
        await context.secrets.delete("soterai.cloudToken");
    }

    public isWorkspaceTrusted(): boolean {
        return vscode.workspace.isTrusted;
    }
}
