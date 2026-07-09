import * as vscode from "vscode";
import {
    buildSafeContext,
    buildDebugPrompt,
    buildCodeReviewPrompt,
    buildDeploymentPrompt,
    buildErrorFixPrompt,
    buildArchitecturePrompt,
    redactForSharing,
    hashContent,
    type ContextItem,
    type SafeContext,
    type ProjectPolicy,
} from "@soterai/guard-core";
import { type FirewallDeps, APPROVAL_STATE_ID, type ApprovalSession } from "./shared";
import { PolicyStore } from "./PolicyStore";
import { LedgerStore } from "./LedgerStore";
import { gatherContext } from "./ContextGatherer";
import { escapeHtml, showInfoWebview, workspacePseudoId } from "./util";
import { getBrokerManager } from "../broker/BrokerManager";

export function registerContextCommands(deps: FirewallDeps): void {
    const { context, refreshViews } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const buildAndRecord = async (policy: ProjectPolicy): Promise<{ items: ContextItem[]; safe: SafeContext }> => {
        const items = await gatherContext();
        const safe = buildSafeContext(items, policy);
        const hashes = await Promise.all(items.map((i) => hashContent(i.content)));
        await LedgerStore.append({
            eventId: `ctx_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType: "context_built",
            action: safe.summary.blocked > 0 ? "block" : safe.summary.approvalRequired > 0 ? "approval_required" : "allow",
            severity: safe.summary.blocked > 0 ? "high" : "medium",
            riskScore: safe.summary.blocked * 20 + safe.summary.approvalRequired * 10,
            categories: [...new Set(safe.decisions.map((d) => d.level))],
            filePaths: safe.decisions.map((d) => d.path),
            contentHashes: hashes,
            policyVersion: String(policy.version),
            redactedEvidencePreview: `${safe.summary.included} included, ${safe.summary.blocked} blocked, ${safe.summary.approvalRequired} need approval`,
        });
        const broker = getBrokerManager();
        if (broker) {
            await broker.recordMemoryEvent({
                kind: safe.summary.blocked > 0 ? "context_blocked" : "context_built",
                source: "safe-context-builder",
                decision: safe.summary.blocked > 0 ? "block" : safe.summary.approvalRequired > 0 ? "approval_required" : "allow",
                riskScore: safe.summary.blocked * 20 + safe.summary.approvalRequired * 10,
                categories: [...new Set(safe.decisions.map((d) => d.level))],
                filePaths: safe.decisions.map((d) => d.path),
                protectedFileAttempt: safe.summary.blocked > 0,
                redactedEvidence: `${safe.summary.included} included, ${safe.summary.blocked} blocked, ${safe.summary.approvalRequired} need approval`,
            }).catch(() => { /* Ledger remains available if the optional broker is unavailable. */ });
        }
        return { items, safe };
    };

    const inspectAIContext = async () => {
        const policy = await PolicyStore.load();
        const { safe } = await buildAndRecord(policy);
        const rows = safe.decisions
            .map(
                (d) =>
                    `<tr><td><code>${escapeHtml(d.path)}</code></td><td>${escapeHtml(d.kind)}</td>` +
                    `<td><span class="badge ${escapeHtml(d.level)}">${escapeHtml(d.level)}</span></td>` +
                    `<td><span class="badge ${escapeHtml(d.action)}">${escapeHtml(d.action)}</span></td>` +
                    `<td>${d.rawIncluded ? "raw" : d.included ? "redacted" : "excluded"}</td>` +
                    `<td>${escapeHtml(d.reason)}</td><td><code>${escapeHtml(d.safePreview)}</code></td></tr>`,
            )
            .join("");
        showInfoWebview(
            "soteraiInspectContext",
            "SoterAI: Inspect AI Context",
            `<h1>🔎 AI Context Inspection</h1>
         <p>What SoterAI would include if you build a safe context now: <strong>${safe.summary.included} included</strong>,
         <strong>${safe.summary.blocked} blocked</strong>, <strong>${safe.summary.approvalRequired} need approval</strong>.</p>
         <table><tr><th>Path</th><th>Source</th><th>Level</th><th>Action</th><th>Included</th><th>Reason</th><th>Safe preview</th></tr>${rows}</table>
         <p class="note">Protected files are excluded; sensitive files are summarized. No raw secrets are ever included in the safe context.</p>`,
        );
    };

    const buildSafeAIContext = async (): Promise<string | undefined> => {
        const policy = await PolicyStore.load();
        const { safe } = await buildAndRecord(policy);
        return safe.safeText;
    };

    const copySafeAIContext = async () => {
        const text = await buildSafeAIContext();
        if (!text) return;
        await vscode.env.clipboard.writeText(redactForSharing(text));
        vscode.window.showInformationMessage("Safe AI context copied to clipboard (secrets redacted, protected files excluded).");
    };

    const approveContextSession = async () => {
        const policy = await PolicyStore.load();
        const minutes = policy.aiContext.allowSessionMinutes;
        const session: ApprovalSession = { id: `appr_${Date.now()}`, expiresAt: Date.now() + minutes * 60_000 };
        await context.globalState.update(APPROVAL_STATE_ID, session);
        await LedgerStore.append({
            eventId: session.id,
            workspacePseudoId: await workspacePseudoId(),
            eventType: "context_approved",
            action: "allow",
            severity: "info",
            riskScore: 0,
            policyVersion: String(policy.version),
            approvalSessionId: session.id,
            redactedEvidencePreview: `approved for ${minutes} min`,
        });
        vscode.window.showInformationMessage(`Sensitive AI context approved for ${minutes} minutes.`);
        refreshViews();
    };

    const clearContextApproval = async () => {
        await context.globalState.update(APPROVAL_STATE_ID, undefined);
        vscode.window.showInformationMessage("AI context approval session cleared.");
        refreshViews();
    };

    const buildPromptCommand = (kind: string, fn: (i: ContextItem[], p: ProjectPolicy, task: string) => string) => async () => {
        const policy = await PolicyStore.load();
        const items = await gatherContext();
        const task = (await vscode.window.showInputBox({
            title: `SoterAI: Build Safe ${kind} Prompt`,
            prompt: "Optional: describe the task (no secrets — this is included verbatim).",
            ignoreFocusOut: true,
        })) ?? "";
        const prompt = redactForSharing(fn(items, policy, task));
        await vscode.env.clipboard.writeText(prompt);
        await LedgerStore.append({
            eventId: `prompt_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType: "context_built",
            action: "redact",
            severity: "low",
            riskScore: 5,
            categories: [kind.toLowerCase()],
            policyVersion: String(policy.version),
            redactedEvidencePreview: `safe ${kind} prompt copied`,
        });
        vscode.window.showInformationMessage(`Safe ${kind} prompt copied to clipboard.`);
    };

    reg("soterai.inspectAIContext", inspectAIContext);
    reg("soterai.buildSafeAIContext", async () => {
        const t = await buildSafeAIContext();
        if (t) {
            const doc = await vscode.workspace.openTextDocument({ content: t, language: "markdown" });
            await vscode.window.showTextDocument(doc);
        }
    });
    reg("soterai.copySafeAIContext", copySafeAIContext);
    reg("soterai.approveContextSession", approveContextSession);
    reg("soterai.clearContextApproval", clearContextApproval);

    reg("soterai.buildSafeDebugPrompt", buildPromptCommand("Debug", buildDebugPrompt));
    reg("soterai.buildSafeCodeReviewPrompt", buildPromptCommand("Code Review", buildCodeReviewPrompt));
    reg("soterai.buildSafeDeploymentPrompt", buildPromptCommand("Deployment", buildDeploymentPrompt));
    reg("soterai.buildSafeErrorFixPrompt", buildPromptCommand("Error Fix", buildErrorFixPrompt));
    reg("soterai.buildSafeArchitecturePrompt", buildPromptCommand("Architecture", buildArchitecturePrompt));
}
