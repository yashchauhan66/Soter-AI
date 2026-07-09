import * as vscode from "vscode";
import { AISentinel } from "./AISentinel";
import { escapeHtml, showInfoWebview, getNonce } from "../firewall/util";

export function registerSentinelCommands(context: vscode.ExtensionContext, sentinel: AISentinel): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.enableAISentinel", () => {
        sentinel.enable();
        vscode.window.showInformationMessage("SoterAI AI Activity Sentinel enabled. Monitoring high-risk files and changes.");
    });

    reg("soterai.disableAISentinel", () => {
        sentinel.disable();
        vscode.window.showInformationMessage("SoterAI AI Activity Sentinel disabled.");
    });

    reg("soterai.showAITimeline", () => {
        const events = sentinel.getEvents().slice(-100).reverse();
        const rows = events.map((e) => {
            const riskClass = e.risk === "critical" ? "block" : e.risk === "high" ? "block" : e.risk === "medium" ? "warn" : "allow";
            return `<tr><td>${new Date(e.timestamp).toLocaleTimeString()}</td><td>${escapeHtml(e.type)}</td><td><span class="badge ${riskClass}">${escapeHtml(e.risk.toUpperCase())}</span></td><td>${escapeHtml(e.source)}</td><td>${escapeHtml(e.decision)}</td><td>${escapeHtml(e.redactedEvidence)}</td></tr>`;
        }).join("");

        showInfoWebview("soteraiSentinelTimeline", "SoterAI: AI Activity Timeline",
            `<h1>AI Activity Timeline</h1><p>${events.length} recent event(s)${sentinel.isEnabled ? " (Sentinel active)" : " (Sentinel inactive)"}.</p>
            <table><tr><th>Time</th><th>Type</th><th>Risk</th><th>Source</th><th>Decision</th><th>Evidence</th></tr>${rows || "<tr><td colspan='6'>No events recorded.</td></tr>"}</table>
            <p class="note">Events are stored locally. No raw secrets are logged. Only redacted evidence is shown.</p>`
        );
    });

    reg("soterai.exportAIActivityReport", () => {
        const report = sentinel.exportReport();
        const doc = vscode.workspace.openTextDocument({ content: report, language: "json" });
        doc.then((d) => vscode.window.showTextDocument(d));
        vscode.window.showInformationMessage("AI Activity report exported (redacted, no raw secrets).");
    });

    reg("soterai.clearAIActivityEvents", () => {
        sentinel.clearEvents();
        vscode.window.showInformationMessage("AI Activity events cleared.");
    });
}
