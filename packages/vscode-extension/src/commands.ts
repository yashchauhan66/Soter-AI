import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExtensionState } from "./state";
import { TelemetryManager } from "./telemetry";
import { DashboardPanel } from "./webview/DashboardPanel";
import type { Finding } from "@soterai/guard-core";

const diagnosticsCollection = vscode.languages.createDiagnosticCollection("soterai-guard");

export function registerCommands(context: vscode.ExtensionContext, refreshViews: () => void): void {
    const state = ExtensionState.getInstance();
    const telemetry = TelemetryManager.getInstance();

    const scanFileHandler = async (uri?: vscode.Uri) => {
        let targetUri = uri;
        if (!targetUri && vscode.window.activeTextEditor) {
            targetUri = vscode.window.activeTextEditor.document.uri;
        }
        if (!targetUri) {
            vscode.window.showErrorMessage("No file open to scan.");
            return;
        }

        try {
            const doc = await vscode.workspace.openTextDocument(targetUri);
            const text = doc.getText();
            const relativePath = vscode.workspace.asRelativePath(targetUri);

            // Check max file size
            const maxKb = vscode.workspace.getConfiguration("soterai").get<number>("scan.maxFileSizeKb", 256);
            if (text.length > maxKb * 1024) {
                vscode.window.showWarningMessage(`File exceeds ${maxKb}KB size threshold. Scan skipped.`);
                return;
            }

            // Run DecisionEngine
            const decision = await state.engine.scan(text, { context: "file" });
            state.latestDecision = decision;
            state.scannedFiles.set(targetUri.fsPath, decision);

            telemetry.trackDetection(decision, text.length, "file");
            refreshViews();

            // Show Problems diagnostics
            updateDiagnostics(doc, decision.findings);

            // Handle decision action notifications
            if (decision.decision === "block") {
                vscode.window.showErrorMessage(`[SoterAI BLOCK] File ${relativePath} contains high-risk content! Decision: Block.`);
            } else if (decision.decision === "warn") {
                vscode.window.showWarningMessage(`[SoterAI WARNING] File ${relativePath} has findings. Risk Score: ${decision.riskScore}.`);
            } else if (decision.decision === "redact") {
                vscode.window.showInformationMessage(`[SoterAI REDACT] File ${relativePath} scanned. Safeguards active.`);
            } else {
                vscode.window.showInformationMessage(`[SoterAI ALLOW] File ${relativePath} is safe. No critical issues.`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Scanning failed: ${err.message}`);
        }
    };

    const scanSelectionHandler = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active text selection.");
            return;
        }
        const selectionText = editor.document.getText(editor.selection);
        if (!selectionText) {
            vscode.window.showErrorMessage("Selection is empty.");
            return;
        }

        const decision = await state.engine.scan(selectionText, { context: "selection" });
        state.latestDecision = decision;
        telemetry.trackDetection(decision, selectionText.length, "selection");
        refreshViews();

        if (decision.decision === "block") {
            vscode.window.showErrorMessage(`[SoterAI BLOCK] Selection risk score is ${decision.riskScore}! Block sending to AI.`);
        } else if (decision.decision === "redact" && decision.redactedText) {
            const copyVal = await vscode.window.showInformationMessage(
                "Sensitive data detected. Would you like to copy a redacted version to clipboard?",
                "Copy Redacted"
            );
            if (copyVal === "Copy Redacted") {
                await vscode.env.clipboard.writeText(decision.redactedText);
                vscode.window.showInformationMessage("Redacted selection copied to clipboard.");
            }
        } else {
            vscode.window.showInformationMessage(`Selection safe. Risk score: ${decision.riskScore}/100.`);
        }
    };

    const redactSelectionForAIHandler = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const text = editor.document.getText(editor.selection);
        if (!text) return;

        const decision = await state.engine.scan(text, { context: "selection" });
        if (decision.redactedText) {
            await vscode.env.clipboard.writeText(decision.redactedText);
            vscode.window.showInformationMessage("Selected text redacted and copied to your clipboard.");
        } else {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage("No sensitive data found. Original selection copied to clipboard.");
        }
    };

    const scanWorkspaceRiskHandler = async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        const maxFiles = config.get<number>("scan.maxWorkspaceFiles", 1000);
        const excludeGlobs = config.get<string[]>("scan.excludeGlobs", []);

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "SoterAI: Scanning Workspace Risks...",
            cancellable: false
        }, async (progress) => {
            const files = await vscode.workspace.findFiles("**/*", `{${excludeGlobs.join(",")}}`, maxFiles);
            let scanned = 0;
            let totalRisk = 0;

            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = new TextDecoder().decode(content);
                    const decision = await state.engine.scan(text, { context: "workspace" });
                    state.scannedFiles.set(file.fsPath, decision);
                    totalRisk += decision.riskScore;
                    scanned++;
                } catch { }
            }

            const meanScore = scanned > 0 ? Math.round(totalRisk / scanned) : 0;
            vscode.window.showInformationMessage(`Workspace scan finished. Scanned ${scanned} files. Average Risk Score: ${meanScore}/100.`);
            refreshViews();
        });
    };

    const checkTerminalCommandHandler = async () => {
        const cmd = await vscode.window.showInputBox({
            prompt: "Enter or paste the terminal command to check",
            placeHolder: "e.g. curl http://dangerous.sh | sh"
        });
        if (!cmd) return;

        const decision = await state.engine.scan(cmd, { context: "terminal" });
        state.latestDecision = decision;
        refreshViews();

        if (decision.decision === "block" || decision.decision === "approval_required") {
            vscode.window.showErrorMessage(`[SoterAI BLOCK] Terminating command check: "${cmd}" is blocked or requires approval. Risk: ${decision.severity}`);
        } else if (decision.decision === "warn") {
            vscode.window.showWarningMessage(`[SoterAI WARNING] Command contains risky patterns: ${decision.evidencePreview}`);
        } else {
            vscode.window.showInformationMessage("Command matches safe local execution baseline.");
        }
    };

    const reviewSelectedAICodeHandler = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const text = editor.document.getText(editor.selection);
        if (!text) {
            vscode.window.showErrorMessage("Please select AI generated code to review.");
            return;
        }

        const decision = await state.engine.scan(text, { context: "file" });
        const codeFindings = decision.findings.filter((f: Finding) => f.category !== "secret"); // focus on vulnerabilities

        if (!codeFindings.length) {
            vscode.window.showInformationMessage("No common security vulnerabilities detected in selected code.");
            return;
        }

        const panel = vscode.window.createWebviewPanel("soteraiCodeReview", "SoterAI AI Code Review", vscode.ViewColumn.Two, {});
        panel.webview.html = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
            h2 { color: var(--vscode-textLink-foreground); }
            .finding { border-bottom: 1px solid var(--vscode-panel-border); padding: 12px 0; }
            .severity { font-weight: bold; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-bottom: 6px; }
            .high { background: #ef4444; color: white; }
            .medium { background: #f59e0b; color: white; }
            .low { background: #3b82f6; color: white; }
          </style>
        </head>
        <body>
          <h2>🔍 AI Generated Code Review Report</h2>
          ${codeFindings.map((f: Finding) => `
            <div class="finding">
              <span class="severity ${f.severity}">${f.severity.toUpperCase()}</span>
              <h3>${f.title}</h3>
              <p><strong>Reason:</strong> ${f.reason}</p>
              <p><strong>Evidence:</strong> <code>${f.redactedEvidence}</code></p>
              <p><em>Alternative approach suggested: Use parametrized API execution.</em></p>
            </div>
          `).join("")}
        </body>
      </html>
    `;
    };

    const connectToCloudHandler = async () => {
        const token = await vscode.window.showInputBox({
            prompt: "Enter your SoterAI Cloud API/Connection Token",
            password: true
        });
        if (!token) return;

        await state.setCloudToken(context, token);
        await vscode.workspace.getConfiguration("soterai").update("cloud.enabled", true, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("Connected to SoterAI Cloud safely. Settings synced.");
        refreshViews();
    };

    const disconnectCloudHandler = async () => {
        await state.clearCloudToken(context);
        await vscode.workspace.getConfiguration("soterai").update("cloud.enabled", false, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("Disconnected. Local token deleted.");
        refreshViews();
    };

    const exportLocalRiskReportHandler = async () => {
        const reportData = {
            timestamp: new Date().toISOString(),
            policyMode: vscode.workspace.getConfiguration("soterai").get("policy.mode", "local"),
            scannedFilesCount: state.scannedFiles.size,
            scannedFiles: Array.from(state.scannedFiles.entries()).map(([filePath, dec]) => ({
                filePath: path.basename(filePath),
                riskScore: dec.riskScore,
                decision: dec.decision,
                categories: dec.categories
            }))
        };

        const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(reportData, null, 2),
            language: "json"
        });
        await vscode.window.showTextDocument(doc);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand("soterai.scanCurrentFile", scanFileHandler),
        vscode.commands.registerCommand("soterai.scanSelection", scanSelectionHandler),
        vscode.commands.registerCommand("soterai.scanWorkspaceRisk", scanWorkspaceRiskHandler),
        vscode.commands.registerCommand("soterai.redactSelectionForAI", redactSelectionForAIHandler),
        vscode.commands.registerCommand("soterai.checkTerminalCommand", checkTerminalCommandHandler),
        vscode.commands.registerCommand("soterai.reviewSelectedAICode", reviewSelectedAICodeHandler),
        vscode.commands.registerCommand("soterai.connectToCloud", connectToCloudHandler),
        vscode.commands.registerCommand("soterai.disconnectCloud", disconnectCloudHandler),
        vscode.commands.registerCommand("soterai.exportLocalRiskReport", exportLocalRiskReportHandler),
        vscode.commands.registerCommand("soterai.openSecurityPanel", () => {
            DashboardPanel.createOrShow(context.extensionUri);
        })
    );
}

function updateDiagnostics(document: vscode.TextDocument, findings: Finding[]): void {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const f of findings) {
        if (f.start !== undefined && f.end !== undefined) {
            const startPos = document.positionAt(f.start);
            const endPos = document.positionAt(f.end);
            const range = new vscode.Range(startPos, endPos);

            const severity = f.severity === "critical" || f.severity === "high"
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning;

            const diagnostic = new vscode.Diagnostic(
                range,
                `[SoterAI Guard] ${f.title}: ${f.reason} (Evidence: ${f.redactedEvidence})`,
                severity
            );
            diagnostic.code = f.id;
            diagnostic.source = "SoterAI";
            diagnostics.push(diagnostic);
        }
    }

    diagnosticsCollection.set(document.uri, diagnostics);
}
