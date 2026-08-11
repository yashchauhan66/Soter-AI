import * as vscode from "vscode";
import * as path from "path";
import { generateSafeModePolicy, redactForSharing } from "@soterai/guard-core";
import { BrokerManager } from "./BrokerManager";
import { escapeHtml, showInfoWebview } from "../firewall/util";
import {
    DEFAULT_INTEGRATION_CANDIDATES,
    applyProposedChange,
    detectIntegrationConfigs,
    healthCheckBroker,
    proposeBrokerRewrite,
    restoreFromBackup,
    streamSmokeTest,
    type FileIO,
    type HttpIO,
    type ProposedChange,
} from "./IntegrationAdapter";
import { EncryptedBackupSink } from "./EncryptedBackupSink";

/** globalState key holding {path, backupPath} pairs written by secureAllAI. */
const SECURE_BACKUPS_KEY = "soterai.secureAllAI.backups";

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

interface TerminalPreview {
    action: string;
    executable?: string;
    args?: string[];
    riskScore: number;
    categories: string[];
    reasonCodes: string[];
    explanation: string;
    coverageLevel: string;
    deterministic: boolean;
}

interface TerminalExecuteResponse {
    analysis: TerminalPreview;
    result: {
        exitCode: number;
        stdout: string;
        stderr: string;
    };
}

interface RuntimeCapabilitySummary {
    agent: string;
    effectiveRiskScore: number;
    effectiveRisk: string;
    unsupportedWarnings: string[];
    summaryLines: string[];
}

interface ExtensionIsolationSummary {
    action: string;
    riskScore: number;
    findings: Array<{
        id: string;
        action: string;
        riskScore: number;
        categories: string[];
        recommendation: string;
    }>;
    workspaceRecommendations: string[];
    explanation: string;
}

export function registerBrokerCommands(context: vscode.ExtensionContext, manager: BrokerManager, refresh: () => void): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    const started = async () => { const status = await manager.start(); refresh(); return status; };

    reg("soterai.secureAllAI", async () => {
        try {
            const s = await started(); // start broker first (health gate)
            const home = require("os").homedir();
            const nodeFs: FileIO = {
                readText: async (p: string) => { try { return await require("fs/promises").readFile(p, "utf8"); } catch { return null; } },
                writeText: async (p: string, c: string) => require("fs/promises").writeFile(p, c, "utf8"),
                exists: async (p: string) => { try { await require("fs/promises").access(p); return true; } catch { return false; } },
            };
            const nodeHttp: HttpIO = {
                get: async (url: string, _h?: Record<string, string>) => { const r = await fetch(url); return { status: r.status, body: await r.text() }; },
                post: async (url: string, body: string, _h?: Record<string, string>) => { const r = await fetch(url, { method: "POST", body, headers: { "content-type": "application/json" } }); return { status: r.status, body: await r.text() }; },
            };
            const { discoverAllAiTools, buildSecurePlan, executeSecurePlan } = await import("./AutoSecureEngine");
            // Relative candidates (".env", ".claude/settings.json") must be
            // anchored to the open workspace, never the extension host's cwd.
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const discovered = await discoverAllAiTools(nodeFs, home, workspaceRoot);

            // Read every existing config's text into memory for planning (no writes yet).
            const ioFiles: Record<string, string> = {};
            for (const d of discovered) for (const c of d.configs) { const t = await nodeFs.readText(c.path); if (t !== null) ioFiles[c.path] = t; }
            const brokerPort = Number(vscode.workspace.getConfiguration("soterai").get("broker.port", 47321));
            const plan = buildSecurePlan(discovered, ioFiles, brokerPort);

            if (plan.proposed.length === 0 && plan.monitorOnly.length === 0 && plan.unsupported.length === 0) {
                vscode.window.showInformationMessage("SoterAI: no AI tool configs found to secure on this machine.");
                return;
            }
            if (plan.proposed.length === 0) {
                // Nothing writable: say so plainly instead of opening a
                // "Secure Everything" prompt that would do nothing.
                const detail = plan.unsupported.map((u) => `• ${u.reason}`).join("\n");
                vscode.window.showWarningMessage(
                    `SoterAI found AI tooling but nothing it can safely re-route automatically.` +
                    (detail ? `\n${detail}` : "") +
                    (plan.monitorOnly.length ? `\nMonitor-only: ${plan.monitorOnly.join(", ")}` : ""),
                );
                return;
            }
            const pick = await vscode.window.showInformationMessage(
                `🛡️ SoterAI found ${plan.proposed.length} tool config(s) to secure` +
                `${plan.monitorOnly.length ? ` + ${plan.monitorOnly.length} monitor-only` : ""}` +
                `${plan.unsupported.length ? ` + ${plan.unsupported.length} left unchanged` : ""}.\n` +
                plan.summaryLines.slice(0, 6).join("\n") + (plan.summaryLines.length > 6 ? `\n…and ${plan.summaryLines.length - 6} more` : "") +
                `\n\nEach file is backed up first; use "SoterAI: Restore AI Configs" to undo.`,
                { modal: true }, "Secure Everything Now", "Cancel",
            );
            if (pick !== "Secure Everything Now") return;

            const brokerToken = await context.secrets.get("soterai.localBrokerToken") ?? "";
            const outcome = await executeSecurePlan(
                plan, discovered, nodeFs, nodeHttp, true, `${s.url}/health`,
                new EncryptedBackupSink(context), brokerToken,
            );
            // Persist backup pointers so restore works in a later session.
            const restorable = outcome.applied.filter((a) => a.applied && a.backupPath);
            if (restorable.length > 0) {
                await context.globalState.update(SECURE_BACKUPS_KEY, restorable.map((a) => ({ path: a.path, backupPath: a.backupPath })));
            }
            refresh();
            const verif = outcome.verified.map((v) => `${v.ok ? "✅" : "⚠️"} ${v.toolId}: ${v.detail}`).join("\n");
            const unsup = outcome.unsupported.map((u) => `⚠️ ${u.reason}`).join("\n");
            const message = [outcome.headline, verif, unsup].filter(Boolean).join("\n");
            const anyFailed = outcome.verified.some((v) => !v.ok);
            if (anyFailed) vscode.window.showWarningMessage(message);
            else vscode.window.showInformationMessage(message);
        } catch (e) {
            vscode.window.showErrorMessage(`Secure My AI failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    reg("soterai.restoreAIConfigs", async () => {
        const saved = context.globalState.get<Array<{ path: string; backupPath: string }>>(SECURE_BACKUPS_KEY, []);
        if (saved.length === 0) {
            vscode.window.showInformationMessage("SoterAI: no AI config backups recorded — nothing to restore.");
            return;
        }
        const pick = await vscode.window.showWarningMessage(
            `Restore ${saved.length} AI config file(s) from SoterAI backups? Current contents will be overwritten:\n` +
            saved.map((s) => `• ${s.path}`).join("\n"),
            { modal: true }, "Restore",
        );
        if (pick !== "Restore") return;
        const fsp = require("fs/promises");
        const nodeFs: FileIO = {
            readText: async (p: string) => { try { return await fsp.readFile(p, "utf8"); } catch { return null; } },
            writeText: async (p: string, c: string) => fsp.writeFile(p, c, "utf8"),
            exists: async (p: string) => { try { await fsp.access(p); return true; } catch { return false; } },
        };
        const { restoreAll } = await import("./AutoSecureEngine");
        const result = await restoreAll(
            saved.map((s) => ({ path: s.path, backupPath: s.backupPath, applied: true })),
            nodeFs,
            new EncryptedBackupSink(context),
        );
        if (result.failed.length === 0) await context.globalState.update(SECURE_BACKUPS_KEY, []);
        vscode.window.showInformationMessage(
            `SoterAI restored ${result.restored} config(s).` +
            (result.failed.length ? ` Failed (backup missing): ${result.failed.join(", ")}` : ""),
        );
    });
    reg("soterai.startLocalAIBroker", async () => { const s = await started(); vscode.window.showInformationMessage(`SoterAI Local AI Broker running at ${s.url} (authenticated, local-only).`); });
    reg("soterai.stopLocalAIBroker", async () => { await manager.stop(); refresh(); vscode.window.showInformationMessage("SoterAI Local AI Broker stopped."); });
    reg("soterai.restartLocalAIBroker", async () => { const s = await manager.restart(); refresh(); vscode.window.showInformationMessage(`SoterAI Local AI Broker restarted at ${s.url}.`); });
    reg("soterai.showBrokerStatus", async () => {
        const s = await manager.status();
        vscode.window.showInformationMessage(s.running ? `Broker running at ${s.url}; Safe Mode ${s.safeMode?.enabled ? s.safeMode.level : "off"}; Memory ${s.memorySessionId ? "active" : "idle"}.` : `Broker stopped (configured URL ${s.url}).`);
    });
    reg("soterai.showRuntimeCapabilitySummary", async () => {
        await started();
        const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
        const installedAIExtensions = vscode.extensions.all
            .filter((extension) => /ai|copilot|claude|cursor|codeium|continue|tabnine/i.test(`${extension.id} ${extension.packageJSON?.displayName ?? ""} ${extension.packageJSON?.description ?? ""}`))
            .map((extension) => extension.id);
        const summary = await manager.request<RuntimeCapabilitySummary>("/v1/preflight/runtime-capabilities", {
            method: "POST",
            body: JSON.stringify({
                agentName: "VS Code",
                integrationType: "vscode-extension",
                workspaceTrusted: vscode.workspace.isTrusted,
                workspaceRoots,
                terminalEnabled: true,
                networkReach: "unknown",
                installedAIExtensions,
                sandbox: "disabled",
            }),
        });
        const rows = summary.summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
        const warnings = summary.unsupportedWarnings.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
        showInfoWebview(
            "soteraiRuntimeCapabilities",
            "SoterAI: Runtime Capability Summary",
            `<h1>Runtime Capability Summary</h1><p>Effective risk: <strong>${escapeHtml(summary.effectiveRisk.toUpperCase())}</strong> (${escapeHtml(String(summary.effectiveRiskScore))}).</p><ul>${rows}</ul><h2>Unsupported or detection-only routes</h2><ul>${warnings || "<li>No unsupported warnings reported by this preflight.</li>"}</ul><p class="note">This is a broker-authenticated preflight summary. It does not claim OS-wide interception.</p>`,
        );
    });
    reg("soterai.showExtensionIsolationSummary", async () => {
        await started();
        const extensions = vscode.extensions.all.map((extension) => ({
            id: extension.id,
            publisher: typeof extension.packageJSON?.publisher === "string" ? extension.packageJSON.publisher : undefined,
            displayName: typeof extension.packageJSON?.displayName === "string" ? extension.packageJSON.displayName : undefined,
            verifiedPublisher: Boolean(extension.packageJSON?.publisher),
            activationEvents: Array.isArray(extension.packageJSON?.activationEvents) ? extension.packageJSON.activationEvents : [],
            capabilities: [
                JSON.stringify(extension.packageJSON?.capabilities ?? {}),
                JSON.stringify(extension.packageJSON?.contributes ?? {}),
            ],
            aiLike: /ai|copilot|claude|cursor|codeium|continue|tabnine|agent/i.test(`${extension.id} ${extension.packageJSON?.displayName ?? ""} ${extension.packageJSON?.description ?? ""}`),
        }));
        const summary = await manager.request<ExtensionIsolationSummary>("/v1/preflight/extension-isolation", {
            method: "POST",
            body: JSON.stringify({
                extensions,
                workspaceTrusted: vscode.workspace.isTrusted,
                trustedPublishers: ["microsoft", "ms-vscode", "github"],
            }),
        });
        const findings = summary.findings
            .filter((finding) => finding.action !== "ALLOW")
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 25)
            .map((finding) => `<tr><td>${escapeHtml(finding.id)}</td><td>${escapeHtml(finding.action)}</td><td>${escapeHtml(String(finding.riskScore))}</td><td>${escapeHtml(finding.categories.join(", "))}</td><td>${escapeHtml(finding.recommendation)}</td></tr>`)
            .join("");
        const recommendations = summary.workspaceRecommendations.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
        showInfoWebview(
            "soteraiExtensionIsolation",
            "SoterAI: Extension Isolation Summary",
            `<h1>Extension Isolation Summary</h1><p>Decision: <strong>${escapeHtml(summary.action)}</strong> (${escapeHtml(String(summary.riskScore))}).</p><table><tr><th>Extension</th><th>Action</th><th>Risk</th><th>Categories</th><th>Recommendation</th></tr>${findings || "<tr><td colspan=\"5\">No risky extension isolation findings.</td></tr>"}</table><h2>Recommendations</h2><ul>${recommendations}</ul><p class="note">${escapeHtml(summary.explanation)}</p>`,
        );
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
    reg("soterai.runControlledTerminalCommand", async () => {
        await started();
        const command = await vscode.window.showInputBox({
            title: "SoterAI Controlled Terminal",
            prompt: "Runs only broker-approved read-only commands through fixed argv execution.",
            placeHolder: "git status --short",
            ignoreFocusOut: true,
        });
        if (!command) return;
        const preview = await manager.request<TerminalPreview>("/v1/terminal/preview", { method: "POST", body: JSON.stringify({ command }) });
        if (preview.action !== "ALLOW") {
            vscode.window.showWarningMessage(`Controlled terminal blocked this command (${preview.reasonCodes.join(", ") || "policy"}).`);
            return;
        }
        const operation = [preview.executable ?? "command", `${preview.args?.length ?? 0} arg(s)`].join(" ");
        const proceed = await vscode.window.showWarningMessage(
            `Run broker-approved controlled terminal operation: ${operation}? Coverage ${preview.coverageLevel}.`,
            { modal: true },
            "Run",
        );
        if (proceed !== "Run") return;
        const executed = await manager.request<TerminalExecuteResponse>(
            "/v1/terminal/execute",
            { method: "POST", body: JSON.stringify({ command }) },
            35_000,
        );
        const output = [
            `SoterAI Controlled Terminal`,
            `decision=${executed.analysis.action}`,
            `coverage=${executed.analysis.coverageLevel}`,
            `riskScore=${executed.analysis.riskScore}`,
            `exitCode=${executed.result.exitCode}`,
            "",
            "stdout:",
            executed.result.stdout || "(empty)",
            "",
            "stderr:",
            executed.result.stderr || "(empty)",
        ].join("\n");
        const doc = await vscode.workspace.openTextDocument({ content: redactForSharing(output), language: "text" });
        await vscode.window.showTextDocument(doc);
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

    // ── Phase 7: Integration usability (never silent write) ──────────────────
    const lastBackupKey = "soterai.integration.lastBackup";
    const workspaceFileIO = (): FileIO => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        return {
            async readText(rel: string) {
                if (!folder) return null;
                try {
                    const uri = vscode.Uri.file(path.isAbsolute(rel) ? rel : path.join(folder.uri.fsPath, rel));
                    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
                } catch {
                    return null;
                }
            },
            async writeText(rel: string, content: string) {
                if (!folder) throw new Error("No workspace open");
                const uri = vscode.Uri.file(path.isAbsolute(rel) ? rel : path.join(folder.uri.fsPath, rel));
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
            },
            async exists(rel: string) {
                if (!folder) return false;
                try {
                    const uri = vscode.Uri.file(path.isAbsolute(rel) ? rel : path.join(folder.uri.fsPath, rel));
                    await vscode.workspace.fs.stat(uri);
                    return true;
                } catch {
                    return false;
                }
            },
        };
    };
    const fetchHttpIO = (): HttpIO => ({
        async get(url, headers) {
            const res = await fetch(url, { headers });
            return { status: res.status, body: await res.text() };
        },
        async post(url, body, headers) {
            const res = await fetch(url, { method: "POST", headers, body });
            return { status: res.status, body: await res.text() };
        },
    });

    reg("soterai.setupBrokerIntegration", async () => {
        if (!vscode.workspace.isTrusted) {
            return void vscode.window.showWarningMessage("Broker integration setup requires a trusted workspace.");
        }
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return void vscode.window.showErrorMessage("Open a workspace first.");

        const io = workspaceFileIO();
        const candidates = DEFAULT_INTEGRATION_CANDIDATES.map((rel) => path.join(folder.uri.fsPath, rel));
        const detected = await detectIntegrationConfigs(candidates, io);
        if (detected.length === 0) {
            vscode.window.showInformationMessage(
                "No AI client config found among known paths (.continue/config.json, .env, config/openai.json). " +
                "Use Configure AI Broker + copy URL manually. Setup is usability — only brokered traffic is STRONG.",
            );
            return;
        }

        const pick = await vscode.window.showQuickPick(
            detected.map((d) => ({
                label: path.basename(d.path),
                description: d.kind,
                detail: `${d.path}${d.currentBaseUrl ? ` · ${d.currentBaseUrl}` : ""}`,
                config: d,
            })),
            { title: "SoterAI: Setup Broker Integration (review before write)", ignoreFocusOut: true },
        );
        if (!pick) return;

        const current = await io.readText(pick.config.path);
        if (current === null) return void vscode.window.showErrorMessage("Could not read config file.");
        const change = proposeBrokerRewrite(pick.config.path, current, pick.config.kind, manager.port);

        const doc = await vscode.workspace.openTextDocument({
            content: [
                "SoterAI proposed broker integration diff (NOT YET APPLIED)",
                `Path: ${change.path}`,
                `Summary: ${change.summary}`,
                `Broker URL: ${change.brokerBaseUrl}`,
                "",
                "--- BEFORE ---",
                change.before,
                "",
                "--- AFTER ---",
                change.after,
                "",
                "Honesty: STRONG enforcement applies only to traffic that uses the broker after this config.",
                "Setup itself is usability, not universal protection. Never silent write.",
            ].join("\n"),
            language: "diff",
        });
        await vscode.window.showTextDocument(doc, { preview: true });

        const approve = await vscode.window.showWarningMessage(
            `Apply broker URL to ${path.basename(change.path)}? A backup will be written first.`,
            { modal: true },
            "Apply with backup",
        );
        if (approve !== "Apply with backup") {
            vscode.window.showInformationMessage("No changes written (approval required).");
            return;
        }

        const result = await applyProposedChange(change, io, true, new EncryptedBackupSink(context));
        if (!result.applied) {
            vscode.window.showErrorMessage(`Apply failed: ${result.reason ?? "unknown"}`);
            return;
        }
        await context.globalState.update(lastBackupKey, { path: result.path, backupPath: result.backupPath, at: Date.now() });
        vscode.window.showInformationMessage("Broker URL applied. An encrypted backup is stored outside your workspace.");

        await started();
        const health = await healthCheckBroker(manager.port, fetchHttpIO());
        const token = await context.secrets.get("soterai.localBrokerToken") ?? "";
        const smoke = await streamSmokeTest(manager.port, token, fetchHttpIO());
        showInfoWebview(
            "soteraiIntegrationSetup",
            "SoterAI: Integration Setup Result",
            `<h1>Broker Integration Setup</h1>
            <p><strong>Applied:</strong> ${escapeHtml(result.path)}</p>
            <p><strong>Backup:</strong> encrypted, in extension global storage (not in your workspace)</p>
            <p><strong>Health:</strong> ${escapeHtml(health.detail)}</p>
            <p><strong>Stream smoke:</strong> ${escapeHtml(smoke.detail)}</p>
            <p class="note">STRONG only for traffic that uses the broker after this config. Use <code>SoterAI: Restore Broker Integration</code> for one-click restore.</p>`,
        );
    });

    reg("soterai.restoreBrokerIntegration", async () => {
        const last = context.globalState.get<{ path: string; backupPath: string }>(lastBackupKey);
        if (!last?.path || !last?.backupPath) {
            return void vscode.window.showInformationMessage("No integration backup recorded in this session.");
        }
        const approve = await vscode.window.showWarningMessage(
            `Restore ${path.basename(last.path)} from backup?`,
            { modal: true },
            "Restore",
        );
        if (approve !== "Restore") {
            vscode.window.showInformationMessage("Restore cancelled — no write.");
            return;
        }
        const result = await restoreFromBackup(last.path, last.backupPath, workspaceFileIO(), true, new EncryptedBackupSink(context));
        if (!result.restored) {
            vscode.window.showErrorMessage(`Restore failed: ${result.reason ?? "unknown"}`);
            return;
        }
        vscode.window.showInformationMessage(`Restored ${path.basename(last.path)} from backup.`);
    });
}
