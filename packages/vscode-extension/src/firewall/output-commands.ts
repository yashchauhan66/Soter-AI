import * as vscode from "vscode";
import { scanAIOutput, hashContent } from "@soterai/guard-core";
import { type FirewallDeps } from "./shared";
import { PolicyStore } from "./PolicyStore";
import { LedgerStore } from "./LedgerStore";
import { workspacePseudoId } from "./util";

export function registerOutputCommands(deps: FirewallDeps): void {
    const { context, refreshViews, vault, canary } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const scanOutput = async (source: "clipboard" | "selection" | "input") => {
        let text = "";
        if (source === "selection" && vscode.window.activeTextEditor) {
            const ed = vscode.window.activeTextEditor;
            text = ed.document.getText(ed.selection);
        } else if (source === "clipboard") {
            text = await vscode.env.clipboard.readText();
        } else {
            text = (await vscode.window.showInputBox({
                title: "SoterAI: Scan AI Output",
                prompt: "Paste the AI output to scan locally (nothing leaves your machine).",
                ignoreFocusOut: true,
            })) ?? "";
        }
        if (!text.trim()) return void vscode.window.showWarningMessage("No AI output to scan.");

        const canaries = await canary.loadForScan();
        const placeholders = await vault.knownPlaceholders();
        const result = scanAIOutput(text, { canaries, placeholders });

        const policy = await PolicyStore.load();
        await LedgerStore.append({
            eventId: `out_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType: result.canaryLeaked ? "canary_leak" : "output_scanned",
            action: result.decision,
            severity: result.canaryLeaked ? "critical" : result.riskScore >= 70 ? "high" : "low",
            riskScore: result.riskScore,
            categories: result.categories,
            contentHashes: [await hashContent(text)],
            policyVersion: String(policy.version),
            redactedEvidencePreview: result.evidencePreview,
        });

        if (result.canaryLeaked) {
            vscode.window.showErrorMessage(
                `[SoterAI CRITICAL] A SoterAI canary appeared in this AI output — an AI tool likely read protected context. (${result.leakedCanaries
                    .map((h) => h.redactedPreview)
                    .join(", ")})`,
            );
        } else if (result.decision === "block") {
            vscode.window.showErrorMessage(`[SoterAI BLOCK] AI output looks unsafe (risk ${result.riskScore}). ${result.evidencePreview}`);
        } else if (result.riskScore > 0) {
            vscode.window.showWarningMessage(`[SoterAI WARN] AI output findings (risk ${result.riskScore}): ${result.evidencePreview}`);
        } else {
            vscode.window.showInformationMessage("AI output looks clean — no secrets, canaries, or exfiltration signs.");
        }
        refreshViews();
    };

    reg("soterai.scanAIOutput", () => scanOutput("input"));
    reg("soterai.compareOutputAgainstContext", () => scanOutput("clipboard"));
    reg("soterai.checkOutputForLeakage", () => scanOutput("selection"));
}
