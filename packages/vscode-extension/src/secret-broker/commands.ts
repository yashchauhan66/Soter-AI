import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { hashContent } from "@soterai/guard-core";
import { EnforcedApiCapabilityBroker } from "./EnforcedApiCapability";
import { buildSafeLLMContext } from "./LLMContext";
import { secretBrokerRuntime, setSecretValueStore } from "./runtime";
import { SecretStorageValueStore } from "./SecretStorageValueStore";
import { SensitiveContextPolicyEngine, type SensitiveContextPolicy } from "./SensitiveContextPolicy";
import { SensitiveContextRedactor } from "./SensitiveContextRedactor";
import { CapabilityBroker } from "./CapabilityBroker";
import { type BrokerOperation } from "./types";
import { LedgerStore } from "../firewall/LedgerStore";
import { escapeHtml, showInfoWebview, workspacePseudoId } from "../firewall/util";
import { getBrokerManager } from "../broker/BrokerManager";

let lastPreview:
    | {
          model: string;
          provider: string;
          redactedText: string;
          maskedOriginal: string;
          refs: string[];
          allowedOperations: string[];
          blocked: string[];
          policyReason: string;
      }
    | undefined;

export function registerSecretBrokerCommands(context: vscode.ExtensionContext, refreshViews: () => void): void {
    // Back raw secret values with VS Code SecretStorage (OS keychain) instead
    // of the extension-host heap for their TTL window.
    setSecretValueStore(new SecretStorageValueStore(context.secrets));

    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const currentWorkspace = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "no-workspace";

    /**
     * Real approval gate. When policy requires approval for brokered use, the
     * user must confirm the exact operation in a modal before the broker acts.
     * Returns false (and audits a denial) if the user declines.
     */
    async function approveBrokerUse(operation: BrokerOperation | string, purpose: string): Promise<boolean> {
        if (!policyForCurrentWorkspace().requiresApproval()) return true;
        const choice = await vscode.window.showWarningMessage(
            `Allow SoterAI to run the brokered operation "${operation}"? Purpose: ${purpose}. ` +
                "The operation uses the secret locally and returns sanitized results only — the raw value is never shown or sent to AI.",
            { modal: true },
            "Allow Once",
        );
        if (choice === "Allow Once") return true;
        await audit("approval_denied", "block", "", `user declined broker operation ${operation}`);
        return false;
    }

    async function readSelectedText(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor.");
            return undefined;
        }
        const text = editor.document.getText(editor.selection);
        if (!text.trim()) vscode.window.showErrorMessage("Selection is empty.");
        return text.trim() ? text : undefined;
    }

    async function useSensitiveContextSafely(): Promise<void> {
        const text = await readSelectedText();
        if (!text) return;
        const workspace = currentWorkspace();
        const result = await redactorForCurrentPolicy().redact(text, workspace, "selection");
        if (!result.secrets.length) {
            vscode.window.showInformationMessage("No sensitive context detected in the selection.");
            return;
        }

        const detected = [...new Set(result.secrets.map((secret) => secret.finding.label || secret.finding.type))].join(", ");
        const choice = await vscode.window.showWarningMessage(
            `Sensitive information detected: ${detected}. Choose how SoterAI should handle this context.`,
            { modal: true },
            "Use safely without revealing",
            "Send redacted version",
            "Block",
            "Explain risk",
            "Reveal once, dangerous",
        );

        if (!choice || choice === "Block") {
            await audit("context_blocked", "block", result.text, "user blocked sensitive context");
            return;
        }
        if (choice === "Explain risk") {
            showRisk(result.text, result.secrets.map((secret) => secret.finding.type));
            return;
        }
        if (choice === "Reveal once, dangerous") {
            const policy = policyForCurrentWorkspace();
            if (!policy.canReveal()) {
                await audit("context_blocked", "block", result.text, "raw reveal disabled by policy");
                vscode.window.showErrorMessage("Raw reveal is disabled by SoterAI policy or enterprise lock.");
                return;
            }
            const confirm = await vscode.window.showInputBox({
                title: "SoterAI: Reveal Once",
                prompt:
                    "Raw sensitive information may be sent to the selected AI model. This can leak credentials or private data. Type REVEAL to continue.",
                ignoreFocusOut: true,
                password: true,
            });
            if (confirm !== "REVEAL") {
                await audit("approval_denied", "block", result.text, "typed confirmation missing");
                return;
            }
            await audit("approval_granted", "approval_required", result.text, "time-limited raw reveal approved");
            // Real behavior, not a simulation: the raw selection goes to the
            // clipboard for ONE deliberate paste. SoterAI does not send it
            // anywhere itself, and the clipboard is the only copy made.
            await vscode.env.clipboard.writeText(text);
            vscode.window.showWarningMessage(
                "Raw selection copied to clipboard for one paste. Anything you paste it into may retain it — rotate the credential afterwards if it reaches an AI tool. A sanitized audit event was recorded.",
            );
            return;
        }

        const safeContext = buildSafeLLMContext("User-selected VS Code context", result, result.allowedOperations);
        lastPreview = {
            model: "user-selected",
            provider: "local-or-user-selected",
            redactedText: safeContext.redactedText,
            maskedOriginal: maskOriginalText(text, result.text),
            refs: result.secrets.map((secret) => secret.ref).filter((ref): ref is string => Boolean(ref)),
            allowedOperations: safeContext.allowedOperations,
            blocked: result.blocked.map((secret) => secret.finding.type),
            policyReason: choice === "Send redacted version" ? "redacted version selected" : "brokered safe context selected",
        };
        await audit("context_built", "redact", result.text, lastPreview.policyReason);
        showPreview();
        refreshViews();
    }

    async function previewWhatAIWillSee(): Promise<void> {
        if (!lastPreview) {
            const text = await readSelectedText();
            if (!text) return;
            const result = await redactorForCurrentPolicy().redact(text, currentWorkspace(), "preview");
            lastPreview = {
                model: "user-selected",
                provider: "local-or-user-selected",
                redactedText: result.text,
                maskedOriginal: maskOriginalText(text, result.text),
                refs: result.secrets.map((secret) => secret.ref).filter((ref): ref is string => Boolean(ref)),
                allowedOperations: result.allowedOperations,
                blocked: result.blocked.map((secret) => secret.finding.type),
                policyReason: "preview generated before AI send",
            };
        }
        showPreview();
    }

    async function manageSecretReferences(): Promise<void> {
        const refs = secretBrokerRuntime.refs.list(currentWorkspace());
        const rows = refs
            .map(
                (ref) =>
                    `<tr><td><code>${escapeHtml(ref.ref)}</code></td><td>${escapeHtml(ref.type)}</td><td>${escapeHtml(ref.sensitivity)}</td><td>${escapeHtml(
                        ref.expiresAt,
                    )}</td><td>${escapeHtml(ref.revoked ? "revoked" : "active")}</td><td>${escapeHtml(ref.allowedOperations.join(", "))}</td></tr>`,
            )
            .join("");
        showInfoWebview(
            "soteraiSecretRefs",
            "SoterAI: Secret References",
            `<h1>Secret References</h1><table><tr><th>Reference</th><th>Type</th><th>Sensitivity</th><th>Expires</th><th>Status</th><th>Operations</th></tr>${
                rows || `<tr><td colspan="6">No active references.</td></tr>`
            }</table><p class="note">Raw values are not displayed. References are scoped to this workspace and expire automatically.</p>`,
        );
    }

    async function clearBrokerSession(): Promise<void> {
        await secretBrokerRuntime.refs.clear(currentWorkspace());
        lastPreview = undefined;
        await audit("broker_request_redacted", "redact", "", "references revoked");
        vscode.window.showInformationMessage("SoterAI secret broker session cleared. Active references were revoked.");
        refreshViews();
    }

    async function chooseSecretHandlingPolicy(): Promise<void> {
        const pick = await vscode.window.showQuickPick(["broker", "redact", "block"], {
            title: "SoterAI: Choose Secret Handling Policy",
            placeHolder: "Default policy for sensitive AI context",
        });
        if (!pick) return;
        // Global, not Workspace: `sensitiveContext.defaultAction` is machine-scoped
        // so a repo cannot weaken it, and VS Code throws on a Workspace write to a
        // machine-scoped key. The sibling privacy-mode command already writes Global.
        await vscode.workspace
            .getConfiguration("soterai")
            .update("sensitiveContext.defaultAction", pick, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`SoterAI sensitive context default set to ${pick}.`);
    }

    async function configurePrivacyMode(): Promise<void> {
        const pick = await vscode.window.showQuickPick(["local", "hybrid", "cloud"], {
            title: "SoterAI: Configure Privacy Mode",
            placeHolder: "Local mode prevents broker network actions by default",
        });
        if (!pick) return;
        await vscode.workspace.getConfiguration("soterai").update("privacyMode", pick, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`SoterAI privacy mode set to ${pick}.`);
    }

    async function buildSafePromptForAI(): Promise<void> {
        const text = await readSelectedText();
        if (!text) return;
        const result = await redactorForCurrentPolicy().redact(text, currentWorkspace(), "safe-prompt");
        const safeContext = buildSafeLLMContext("Use this VS Code context safely", result, result.allowedOperations);
        const prompt = [
            safeContext.systemContract,
            "",
            "Task:",
            safeContext.task,
            "",
            "Safe context:",
            safeContext.redactedText,
            "",
            "Allowed broker operations:",
            safeContext.allowedOperations.length ? safeContext.allowedOperations.map((op) => `- ${op}`).join("\n") : "- none",
            "",
            "Forbidden operations:",
            safeContext.forbiddenOperations.map((op) => `- ${op}`).join("\n"),
            "",
            "Privacy proof:",
            "- Raw secrets sent to AI: no",
            "- Raw secrets sent to SoterAI: no by default",
            "- Ledger stores raw prompt: no by default",
        ].join("\n");
        await vscode.env.clipboard.writeText(prompt);
        lastPreview = {
            model: "user-selected",
            provider: "local-or-user-selected",
            redactedText: safeContext.redactedText,
            maskedOriginal: maskOriginalText(text, result.text),
            refs: result.secrets.map((secret) => secret.ref).filter((ref): ref is string => Boolean(ref)),
            allowedOperations: safeContext.allowedOperations,
            blocked: result.blocked.map((secret) => secret.finding.type),
            policyReason: "safe prompt copied to clipboard",
        };
        await audit("context_built", "redact", result.text, "safe AI prompt built without raw sensitive values");
        showPreview("Safe prompt copied. AI gets the context, not the secret.");
        refreshViews();
    }

    async function runSecretBrokerDemo(): Promise<void> {
        const fakeEnv = [
            "DATABASE_URL=postgres://admin:fakepass@localhost:5432/app",
            "OPENAI_API_KEY=sk-test-1234567890abcdef",
            "GITHUB_TOKEN=ghp_fake1234567890abcdef",
            "AADHAAR=1234 5678 9012",
            "PAN=ABCDE1234F",
        ].join("\n");
        const result = await redactorForCurrentPolicy().redact(fakeEnv, currentWorkspace(), "secret-broker-demo");
        const firstRef = result.secrets.find((secret) => secret.ref && secret.metadata?.allowedOperations.length)?.ref;
        const brokerResult = firstRef
            ? await brokerForCurrentPolicy().handle({
                  operation: "inspect_secret_metadata",
                  secretRef: firstRef,
                  purpose: "demonstrate safe broker metadata inspection",
                  workspace: currentWorkspace(),
                  // Demo runs on hard-coded FAKE secrets only — no user data is
                  // involved, so the approval modal is skipped by design.
                  approved: true,
              })
            : undefined;
        lastPreview = {
            model: "demo",
            provider: "local",
            redactedText: result.text,
            maskedOriginal: maskOriginalText(fakeEnv, result.text),
            refs: result.secrets.map((secret) => secret.ref).filter((ref): ref is string => Boolean(ref)),
            allowedOperations: result.allowedOperations,
            blocked: result.blocked.map((secret) => secret.finding.type),
            policyReason: "demo uses fake secrets and shows local-only handling",
        };
        await audit("broker_request_scanned", "redact", result.text, "secret broker demo completed with fake secrets");
        showInfoWebview(
            "soteraiSecretBrokerDemo",
            "SoterAI: Secret Broker Demo",
            `<h1>Secret Broker Demo</h1>
<p><span class="badge allow">Raw secrets sent to AI: no</span> <span class="badge allow">Raw secrets sent to SoterAI: no by default</span></p>
<table>
<tr><th>Detected</th><td>${escapeHtml(result.secrets.map((secret) => secret.finding.type).join(", "))}</td></tr>
<tr><th>Secret refs created</th><td>${escapeHtml(String(lastPreview.refs.length))}</td></tr>
<tr><th>Broker result</th><td><code>${escapeHtml(JSON.stringify(brokerResult?.result ?? { valueReturned: false }))}</code></td></tr>
</table>
<h2>Before, masked</h2><pre>${escapeHtml(lastPreview.maskedOriginal)}</pre>
<h2>AI-safe context</h2><pre>${escapeHtml(lastPreview.redactedText)}</pre>
<p class="note">The demo input uses fake secrets. Raw fake values are intentionally not displayed in this webview.</p>`,
        );
        refreshViews();
    }

    async function openLocalPrivacyStatus(): Promise<void> {
        const config = vscode.workspace.getConfiguration("soterai");
        const refs = secretBrokerRuntime.refs.list(currentWorkspace());
        const ledgerEntries = await LedgerStore.readAll();
        const privacyMode = config.get("privacyMode", "local");
        const telemetry = config.get("telemetry.redactedEvents", "off");
        const rawReveal = config.get("sensitiveContext.allowRawReveal", false);
        const rawPromptAudit = config.get("audit.storeRawPrompts", false);
        showInfoWebview(
            "soteraiLocalPrivacyStatus",
            "SoterAI: Local Privacy Status",
            `<h1>Local Privacy Status</h1>
<table>
<tr><th>Privacy mode</th><td>${escapeHtml(privacyMode)}</td></tr>
<tr><th>Raw secrets sent to SoterAI by default</th><td><span class="badge allow">no</span></td></tr>
<tr><th>Raw secrets sent to AI by default</th><td><span class="badge allow">no</span></td></tr>
<tr><th>Telemetry</th><td>${escapeHtml(telemetry)}</td></tr>
<tr><th>Raw reveal enabled</th><td><span class="badge ${rawReveal ? "warn" : "allow"}">${rawReveal ? "yes" : "no"}</span></td></tr>
<tr><th>Raw prompt audit enabled</th><td><span class="badge ${rawPromptAudit ? "warn" : "allow"}">${rawPromptAudit ? "yes" : "no"}</span></td></tr>
<tr><th>Active secret refs</th><td>${escapeHtml(String(refs.length))}</td></tr>
<tr><th>Local ledger events</th><td>${escapeHtml(String(ledgerEntries.length))}</td></tr>
<tr><th>SecretStorage</th><td>used for credentials/tokens when storage is required</td></tr>
</table>
<p class="note">This status page does not include API keys, prompts, secrets, raw files, private keys, database URLs, or PII.</p>`,
        );
    }

    async function brokerDemoOperation(): Promise<void> {
        const ref = secretBrokerRuntime.refs.list(currentWorkspace())[0];
        if (!ref) {
            vscode.window.showWarningMessage("No secret reference is available. Run 'Use Sensitive Context Safely' first.");
            return;
        }
        const operation = ref.allowedOperations[0] ?? "inspect_secret_metadata";
        const purpose = "debug sensitive context safely";
        // Real approval gate: this operation uses a reference to the user's own
        // secret, so policy-required approval is enforced here, not assumed.
        if (!(await approveBrokerUse(operation, purpose))) {
            vscode.window.showInformationMessage("Broker operation cancelled — approval was not granted.");
            return;
        }
        const response = await brokerForCurrentPolicy().handle({
            operation,
            secretRef: ref.ref,
            purpose,
            workspace: currentWorkspace(),
            approved: true,
        });
        await audit(response.allowed ? "broker_request_scanned" : "broker_request_blocked", response.allowed ? "redact" : "block", JSON.stringify(response.result ?? {}), response.reason ?? operation);
        vscode.window.showInformationMessage(response.allowed ? `Broker operation completed: ${operation}` : `Broker operation blocked: ${response.reason}`);
    }

    /**
     * "Test Protection" — reproducible Scenario A proof, run entirely locally on
     * a SYNTHETIC canary secret and a mock transport. Demonstrates that the
     * enforced capability sends the credential only for the approved
     * host/method/path and fails closed on wrong host, replay, and revocation —
     * without any live network call or user secret.
     */
    async function testProtection(): Promise<void> {
        const canary = `sk-live-soter-canary-${randomBytes(12).toString("hex")}`;
        const workspace = currentWorkspace();
        const { refs, enforcedApi } = secretBrokerRuntime;
        const meta = await refs.create({
            finding: {
                type: "api_key",
                value: canary,
                start: 0,
                end: canary.length,
                label: "DEMO_API_KEY",
                source: "test-protection",
                sensitivity: "critical",
                allowedOperations: ["call_api_with_secret"],
            },
            workspace,
            ttlMs: 60_000,
        });
        const grant = enforcedApi.grant({
            secretRef: meta.ref,
            workspace,
            scope: { host: "api.example.com", method: "POST", pathPrefix: "/v1/charges" },
            ttlMs: 60_000,
            maxUses: 1,
            operation: "call_api_with_secret",
        });

        let sentAuthHeader = "";
        const transport = async (req: { headers: Record<string, string> }) => {
            sentAuthHeader = req.headers["authorization"] ?? "";
            return { status: 200, body: '{"ok":true}' };
        };

        const ok = await enforcedApi.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges", body: "{}" }, transport);
        const wrongHost = await enforcedApi.call({ handle: grant.handle, workspace, method: "POST", url: "https://evil.example.net/v1/charges" }, transport);
        const replay = await enforcedApi.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        enforcedApi.revoke(grant.handle);
        const afterRevoke = await enforcedApi.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        await refs.revoke(meta.ref);

        // Prove: the canary reached only the auth header of the approved call,
        // and never appears in the handle or any result surfaced to the caller.
        const results = JSON.stringify({ ok: { ...ok, response: undefined }, wrongHost, replay, afterRevoke });
        const canaryOnlyInHeader = sentAuthHeader.includes(canary) && !results.includes(canary) && !grant.handle.includes(canary);

        const pass =
            ok.allowed &&
            !wrongHost.allowed &&
            !replay.allowed &&
            !afterRevoke.allowed &&
            canaryOnlyInHeader;

        await audit(pass ? "broker_request_scanned" : "broker_request_blocked", pass ? "redact" : "block", "", `test protection ${pass ? "passed" : "failed"}`);

        const row = (label: string, allowed: boolean, expectAllow: boolean) => {
            const good = allowed === expectAllow;
            return `<tr><td>${escapeHtml(label)}</td><td><span class="badge ${allowed ? "allow" : "block"}">${allowed ? "sent" : "blocked"}</span></td><td>${good ? "✓ expected" : "✗ UNEXPECTED"}</td></tr>`;
        };
        showInfoWebview(
            "soteraiTestProtection",
            "SoterAI: Test Protection (Scenario A)",
            `<h1>${pass ? "✅ Verified protected" : "❌ Protection check FAILED"}</h1>
<p>Reproducible local proof on a synthetic canary secret — no network, no user data. The AI/agent would receive only the opaque handle <code>${escapeHtml(EnforcedApiCapabilityBroker.fingerprint(grant.handle))}…</code>, never the credential.</p>
<table><tr><th>Attempt</th><th>Result</th><th>Check</th></tr>
${row("Approved host + method + path", ok.allowed, true)}
${row("Wrong host (evil.example.net)", wrongHost.allowed, false)}
${row("Replay past use limit", replay.allowed, false)}
${row("After revocation", afterRevoke.allowed, false)}
</table>
<p class="stat-row">Canary appeared only in the outbound Authorization header, never in the handle, results, or this view: <strong>${canaryOnlyInHeader ? "confirmed" : "NOT confirmed"}</strong>.</p>
<p class="note">Enforcement scope: SoterAI controls this brokered request. It does not control other extensions/processes reading the underlying secret from disk — that remains monitored/unknown.</p>`,
        );
        refreshViews();
    }

    /**
     * Emergency Lockdown (Scenario E). One action that contains a suspected
     * leak: revoke every active enforced capability, revoke all secret
     * references (drops raw values from the keychain-backed store), and emit a
     * sanitized incident record. No raw secret/canary is ever surfaced.
     */
    async function emergencyLockdown(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            "Emergency Lockdown: revoke ALL active capabilities and secret references now? " +
                "Enforced broker calls will fail closed until you re-grant. This cannot be undone.",
            { modal: true },
            "Lock Down Now",
        );
        if (confirm !== "Lock Down Now") return;

        await context.globalState.update("soterai.lockdown", { active: true, activatedAt: new Date().toISOString(), reason: "emergency lockdown command" });
        // Stop the authenticated broker after the persistent lock is written.
        // This keeps a running broker from becoming a stale enforcement path;
        // BrokerManager also refuses restart/request while the lock is active.
        await getBrokerManager()?.stop();

        const workspace = currentWorkspace();
        const capsRevoked = secretBrokerRuntime.enforcedApi.revokeAll();
        const refsRevoked = secretBrokerRuntime.refs.list(workspace).length;
        await secretBrokerRuntime.refs.clear(workspace);
        lastPreview = undefined;

        const stamp = new Date().toISOString();
        await audit("broker_request_blocked", "block", "", `emergency lockdown — ${capsRevoked} capability(ies), ${refsRevoked} reference(s) revoked`);

        showInfoWebview(
            "soteraiLockdown",
            "SoterAI: Emergency Lockdown",
            `<h1>🚨 Emergency Lockdown complete</h1>
<table>
<tr><th>When</th><td>${escapeHtml(stamp)}</td></tr>
<tr><th>Capabilities revoked</th><td>${capsRevoked}</td></tr>
<tr><th>Secret references revoked</th><td>${refsRevoked}</td></tr>
<tr><th>Enforced broker calls</th><td><span class="badge block">fail closed until re-granted</span></td></tr>
</table>
<h2>Next steps</h2>
<ol>
<li>Rotate the affected credential at its provider.</li>
<li>Re-run <code>Test Protection</code> after re-granting to confirm enforcement.</li>
<li>Export the AI ledger for a sanitized incident record — it contains hashes and decisions only, never raw secrets.</li>
</ol>
<p class="note">This bundle contains no raw secret or canary values. Containment scope: SoterAI-brokered paths only; rotate at the provider to cover paths SoterAI cannot observe.</p>`,
        );
        refreshViews();
    }

    function showPreview(message = "What AI will see before sending."): void {
        if (!lastPreview) return;
        showInfoWebview(
            "soteraiWhatAISawPreview",
            "SoterAI: What AI Will See",
            `<h1>What AI Will See</h1>
<p>${escapeHtml(message)}</p>
<table>
<tr><th>Raw secret</th><td><span class="badge block">no</span></td></tr>
<tr><th>Raw secret sent to SoterAI</th><td><span class="badge allow">no by default</span></td></tr>
<tr><th>Secret refs</th><td>${escapeHtml(lastPreview.refs.length ? lastPreview.refs.join(", ") : "none")}</td></tr>
<tr><th>Allowed operations</th><td>${escapeHtml(lastPreview.allowedOperations.join(", ") || "none")}</td></tr>
<tr><th>Blocked content</th><td>${escapeHtml(lastPreview.blocked.join(", ") || "none")}</td></tr>
<tr><th>Policy reason</th><td>${escapeHtml(lastPreview.policyReason)}</td></tr>
</table>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
<section><h2>Original, masked</h2><pre>${escapeHtml(lastPreview.maskedOriginal)}</pre></section>
<section><h2>AI-safe context</h2><pre>${escapeHtml(lastPreview.redactedText)}</pre></section>
</div>
<p class="note">This preview intentionally does not display raw sensitive values.</p>`,
        );
    }

    function policyForCurrentWorkspace(): SensitiveContextPolicyEngine {
        const workspace = currentWorkspace();
        const policy = SensitiveContextPolicyEngine.loadFromWorkspace(workspace);
        const config = vscode.workspace.getConfiguration("soterai");
        const merged: SensitiveContextPolicy = {
            ...policy,
            sensitiveContext: {
                ...policy.sensitiveContext,
                defaultAction: config.get("sensitiveContext.defaultAction", policy.sensitiveContext.defaultAction),
                allowRawReveal: config.get("sensitiveContext.allowRawReveal", policy.sensitiveContext.allowRawReveal),
                requireApprovalForBroker: config.get("sensitiveContext.requireApproval", policy.sensitiveContext.requireApprovalForBroker),
                maxSecretRefTtlMinutes: config.get("sensitiveContext.ttlMinutes", policy.sensitiveContext.maxSecretRefTtlMinutes),
                auditRawPrompt: config.get("audit.storeRawPrompts", policy.sensitiveContext.auditRawPrompt),
            },
        };
        return new SensitiveContextPolicyEngine(SensitiveContextPolicyEngine.parse(merged));
    }

    function redactorForCurrentPolicy(): SensitiveContextRedactor {
        return new SensitiveContextRedactor(secretBrokerRuntime.refs, policyForCurrentWorkspace());
    }

    function brokerForCurrentPolicy(): CapabilityBroker {
        return new CapabilityBroker(secretBrokerRuntime.refs, policyForCurrentWorkspace());
    }

    function maskOriginalText(original: string, redacted: string): string {
        if (!original.trim()) return "";
        const originalLines = original.split(/\r?\n/);
        const redactedLines = redacted.split(/\r?\n/);
        return originalLines
            .map((line, index) => {
                const safeLine = redactedLines[index] ?? "";
                if (safeLine.includes("[SECRET_REF:") || safeLine.includes("[REDACTED_") || safeLine.includes("[BLOCKED_")) {
                    const key = /^(\s*[A-Za-z0-9_.-]+\s*[=:])/.exec(line)?.[1];
                    return key ? `${key}[SENSITIVE_VALUE_LOCAL_ONLY]` : "[SENSITIVE_VALUE_LOCAL_ONLY]";
                }
                return line;
            })
            .join("\n");
    }

    function showRisk(redactedText: string, types: string[]): void {
        showInfoWebview(
            "soteraiSecretRisk",
            "SoterAI: Sensitive Context Risk",
            `<h1>Sensitive Context Risk</h1><p>Detected: ${escapeHtml(types.join(", "))}</p><p>SoterAI can replace values with scoped references and run approved local broker actions so the model sees structure, not raw secrets.</p><h2>Safe preview</h2><pre>${escapeHtml(
                redactedText,
            )}</pre>`,
        );
    }

    async function audit(
        eventType:
            | "context_blocked"
            | "context_built"
            | "approval_denied"
            | "approval_granted"
            | "broker_request_scanned"
            | "broker_request_blocked"
            | "broker_request_redacted",
        verdict: "block" | "redact" | "approval_required",
        safeText: string,
        reason: string,
    ): Promise<void> {
        await LedgerStore.append({
            eventId: `secret_broker_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType,
            action: verdict,
            severity: verdict === "block" ? "high" : "low",
            riskScore: verdict === "block" ? 80 : 10,
            categories: ["secret_broker"],
            contentHashes: safeText ? [await hashContent(safeText)] : [],
            policyVersion: String(SensitiveContextPolicyEngine.parse({}).sensitiveContext.maxSecretRefTtlMinutes),
            redactedEvidencePreview: reason,
        });
    }

    reg("soterai.useSensitiveContextSafely", useSensitiveContextSafely);
    reg("soterai.buildSafePromptForAI", buildSafePromptForAI);
    reg("soterai.runSecretBrokerDemo", runSecretBrokerDemo);
    reg("soterai.openLocalPrivacyStatus", openLocalPrivacyStatus);
    reg("soterai.previewWhatAIWillSee", previewWhatAIWillSee);
    reg("soterai.manageSecretReferences", manageSecretReferences);
    reg("soterai.clearSecretBrokerSession", clearBrokerSession);
    reg("soterai.configurePrivacyMode", configurePrivacyMode);
    reg("soterai.chooseSecretHandlingPolicy", chooseSecretHandlingPolicy);
    reg("soterai.runSecretBrokerDemoOperation", brokerDemoOperation);
    reg("soterai.emergencyLockdown", emergencyLockdown);
    reg("soterai.testProtection", testProtection);
}
