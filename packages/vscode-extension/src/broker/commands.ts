import * as vscode from "vscode";
import { generateSafeModePolicy, redactForSharing } from "@soterai/guard-core";
import { BrokerManager } from "./BrokerManager";
import { escapeHtml, showInfoWebview } from "../firewall/util";

interface BrokerEvent {
    eventId: string;
    sessionId?: string;
    timestamp: string;
    eventType: string;
    decision: string;
    riskScore: number;
    categories: string[];
    redactedEvidence?: string;
    contentHash?: string;
}

export function registerBrokerCommands(context: vscode.ExtensionContext, manager: BrokerManager, refresh: () => void): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    const started = async () => { const status = await manager.start(); refresh(); return status; };

    reg("soterai.startLocalAIBroker", async () => { const s = await started(); vscode.window.showInformationMessage(`SoterAI Local AI Broker running at ${s.url} (authenticated, local-only).`); });
    reg("soterai.stopLocalAIBroker", async () => { await manager.stop(); refresh(); vscode.window.showInformationMessage("SoterAI Local AI Broker stopped."); });
    reg("soterai.restartLocalAIBroker", async () => { const s = await manager.restart(); refresh(); vscode.window.showInformationMessage(`SoterAI Local AI Broker restarted at ${s.url}.`); });
    reg("soterai.showBrokerStatus", async () => {
        const s = await manager.status();
        vscode.window.showInformationMessage(s.running ? `Broker running at ${s.url}; Safe Mode ${s.safeMode?.enabled ? s.safeMode.level : "off"}; Memory ${s.memorySessionId ? "active" : "idle"}.` : `Broker stopped (configured URL ${s.url}).`);
    });
    reg("soterai.configureAIBroker", async () => {
        if (!vscode.workspace.isTrusted) return void vscode.window.showWarningMessage("Provider routing configuration requires a trusted workspace. Local scanning remains available.");
        const config = vscode.workspace.getConfiguration("soterai");
        const port = await vscode.window.showInputBox({ title: "SoterAI Broker Port", value: String(manager.port), validateInput: (v) => Number(v) >= 1024 && Number(v) <= 65535 ? undefined : "Use a port from 1024 to 65535" });
        if (!port) return;
        const openAI = await vscode.window.showInputBox({ title: "OpenAI-compatible upstream endpoint", value: config.get("broker.openAIProviderUrl", ""), placeHolder: "https://api.openai.com/v1/chat/completions" });
        const anthropic = await vscode.window.showInputBox({ title: "Anthropic-compatible upstream endpoint", value: config.get("broker.anthropicProviderUrl", ""), placeHolder: "https://api.anthropic.com/v1/messages" });
        const key = await vscode.window.showInputBox({ title: "Provider API key (stored in SecretStorage)", password: true });
        await config.update("broker.port", Number(port), vscode.ConfigurationTarget.Global);
        await config.update("broker.openAIProviderUrl", openAI ?? "", vscode.ConfigurationTarget.Global);
        await config.update("broker.anthropicProviderUrl", anthropic ?? "", vscode.ConfigurationTarget.Global);
        if (key) await context.secrets.store("soterai.providerApiKey", key);
        vscode.window.showInformationMessage("Broker configuration saved locally. Restart the broker to apply it.");
    });
    reg("soterai.copyOpenAIBrokerUrl", async () => { await vscode.env.clipboard.writeText(`${manager.url}/v1/ai/openai-compatible`); vscode.window.showInformationMessage("OpenAI-compatible broker base URL copied."); });
    reg("soterai.copyAnthropicBrokerUrl", async () => { await vscode.env.clipboard.writeText(`${manager.url}/v1/ai/anthropic-compatible`); vscode.window.showInformationMessage("Anthropic-compatible broker base URL copied."); });
    reg("soterai.testBrokerProtection", async () => {
        await started();
        const result = await manager.request<{ decision: string; redacted: boolean }>("/v1/scan", { method: "POST", body: JSON.stringify({ content: "OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnopqrstuv" }) });
        if (result.decision === "allow" && !result.redacted) throw new Error("Broker self-test did not protect the test secret");
        vscode.window.showInformationMessage(`Broker protection self-test passed (${result.decision}).`);
    });
    reg("soterai.rotateBrokerToken", async () => { await manager.rotateToken(); vscode.window.showInformationMessage("Local broker token rotated. It was not displayed or logged."); });
    reg("soterai.clearBrokerToken", async () => { await manager.clearToken(); refresh(); vscode.window.showInformationMessage("Local broker token cleared; a new token will be generated on next start."); });

    const setSafeMode = async (enabled: boolean, level?: string) => {
        await started();
        await manager.request(enabled ? "/v1/safe-mode/enable" : "/v1/safe-mode/disable", { method: "POST", body: JSON.stringify({ level }) });
        await context.globalState.update("soterai.safeMode", enabled ? { enabled, level } : { enabled: false, level });
        refresh();
    };
    reg("soterai.enableAISafeMode", async () => {
        const level = await vscode.window.showQuickPick(["developer", "strict", "enterprise"], { title: "Enable AI Safe Mode", placeHolder: "Choose a protection level" });
        if (!level) return;
        await setSafeMode(true, level);
        vscode.window.showInformationMessage(`SoterAI AI Safe Mode enabled (${level}).`);
    });
    reg("soterai.disableAISafeMode", async () => { await setSafeMode(false); vscode.window.showInformationMessage("SoterAI AI Safe Mode disabled."); });
    reg("soterai.showAISafeModeRules", async () => {
        const status = await manager.status();
        const level = (status.safeMode?.level === "strict" || status.safeMode?.level === "enterprise") ? status.safeMode.level : "developer";
        const rules = generateSafeModePolicy(level).rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");
        showInfoWebview("soteraiSafeModeRules", "SoterAI: AI Safe Mode Rules", `<h1>AI Safe Mode — ${escapeHtml(level)}</h1><ul>${rules}</ul><p class="note">Safe Mode governs SoterAI-routed context and brokered traffic. It cannot observe AI traffic that bypasses SoterAI.</p>`);
    });
    reg("soterai.configureSafeMode", () => vscode.commands.executeCommand("soterai.enableAISafeMode"));

    reg("soterai.startAIMemorySession", async () => { const id = await manager.startMemorySession(); refresh(); vscode.window.showInformationMessage(`AI Memory session started (${id.slice(0, 8)}…).`); });
    reg("soterai.endAIMemorySession", async () => { await manager.endMemorySession(); refresh(); vscode.window.showInformationMessage("AI Memory session ended."); });
    reg("soterai.clearAIMemorySession", async () => { await manager.clearMemorySession(); refresh(); vscode.window.showInformationMessage("AI Memory session cleared."); });
    const loadExport = async () => { await started(); return manager.request<{ events: BrokerEvent[]; memory: { sessions: Array<Record<string, unknown>> } }>("/v1/events/export-redacted", { method: "POST" }); };
    reg("soterai.openAIMemoryInspector", async () => {
        const data = await loadExport();
        const rows = data.events.slice().reverse().map((e) => `<tr><td>${escapeHtml(e.timestamp)}</td><td>${escapeHtml(e.eventType)}</td><td><span class="badge ${escapeHtml(e.decision)}">${escapeHtml(e.decision)}</span></td><td>${escapeHtml(e.riskScore)}</td><td>${escapeHtml(e.categories.join(", "))}</td><td>${escapeHtml(e.redactedEvidence ?? "")}</td></tr>`).join("");
        showInfoWebview("soteraiMemoryInspector", "SoterAI: AI Memory Inspector", `<h1>AI Memory Inspector</h1><p>${data.memory.sessions.length} broker/SoterAI memory session(s). Brokered and manual events are labeled by event type.</p><table><tr><th>Time</th><th>Event</th><th>Decision</th><th>Risk</th><th>Categories</th><th>Redacted evidence</th></tr>${rows || "<tr><td colspan=\"6\">No memory events yet.</td></tr>"}</table><p class="note">Hashes, metadata, and redacted evidence only. This does not reveal what bypassing third-party extensions read internally.</p>`);
    });
    reg("soterai.exportAIMemoryReport", async () => {
        const data = await loadExport();
        const safe = redactForSharing(JSON.stringify(data, null, 2));
        const doc = await vscode.workspace.openTextDocument({ content: safe, language: "json" });
        await vscode.window.showTextDocument(doc);
    });
    reg("soterai.showWhatAISaw", () => vscode.commands.executeCommand("soterai.openAIMemoryInspector"));
    reg("soterai.showBlockedAIContext", async () => {
        const data = await loadExport();
        const blocked = data.events.filter((e) => e.decision === "block" || e.eventType.includes("blocked"));
        const doc = await vscode.workspace.openTextDocument({ content: redactForSharing(JSON.stringify(blocked, null, 2)), language: "json" });
        await vscode.window.showTextDocument(doc);
    });
    reg("soterai.compareAIResponseWithContext", () => vscode.commands.executeCommand("soterai.compareOutputAgainstContext"));

    const recentEvents = async () => (await manager.request<{ events: BrokerEvent[] }>("/v1/events/recent", { method: "GET" })).events;
    reg("soterai.reviewPendingAIApproval", async () => {
        const pending = (await recentEvents()).filter((e) => e.decision === "approval_required" && e.contentHash);
        if (!pending.length) return void vscode.window.showInformationMessage("No pending local AI approvals.");
        const chosen = await vscode.window.showQuickPick(pending.map((e) => ({ label: `${e.eventType} — ${e.contentHash!.slice(0, 12)}…`, detail: e.redactedEvidence, event: e })), { title: "Pending AI approvals" });
        if (chosen) await approve(chosen.event, "once", "approve");
    });
    const approve = async (event: BrokerEvent, scope: string, outcome: string) => manager.request("/v1/approvals", { method: "POST", body: JSON.stringify({ sessionId: event.sessionId, contentHash: event.contentHash, scope, outcome }) });
    reg("soterai.approveAIContextOnce", async () => {
        const event = (await recentEvents()).slice().reverse().find((e) => e.decision === "approval_required" && e.contentHash && e.sessionId);
        if (!event) return void vscode.window.showInformationMessage("No pending approval to approve.");
        await approve(event, "once", "approve");
        vscode.window.showInformationMessage("AI context approved once for this exact session and content hash.");
    });
    reg("soterai.denyAIContext", async () => {
        const event = (await recentEvents()).slice().reverse().find((e) => e.decision === "approval_required" && e.contentHash && e.sessionId);
        if (!event) return void vscode.window.showInformationMessage("No pending approval to deny.");
        await approve(event, "once", "deny");
        vscode.window.showInformationMessage("AI context denied.");
    });
    reg("soterai.showActiveAIApprovals", async () => {
        const data = await manager.request<{ approvals: unknown[] }>("/v1/approvals", { method: "GET" });
        const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(data, null, 2), language: "json" });
        await vscode.window.showTextDocument(doc);
    });
    reg("soterai.clearAIApprovals", async () => { await manager.request("/v1/approvals/clear", { method: "POST" }); vscode.window.showInformationMessage("Local AI approvals cleared."); });
}
