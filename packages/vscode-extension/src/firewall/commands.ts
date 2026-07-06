import * as vscode from "vscode";
import {
    buildSafeContext,
    buildDebugPrompt,
    buildCodeReviewPrompt,
    buildDeploymentPrompt,
    buildErrorFixPrompt,
    buildArchitecturePrompt,
    scanAIOutput,
    redactForSharing,
    hashContent,
    type ContextItem,
    type SafeContext,
    type ProjectPolicy,
} from "@soterai/guard-core";
import { PolicyStore } from "./PolicyStore";
import { VaultManager } from "./VaultManager";
import { LedgerStore } from "./LedgerStore";
import { CanaryManager } from "./CanaryManager";
import { gatherContext } from "./ContextGatherer";
import { escapeHtml, showInfoWebview, workspacePseudoId, firstWorkspaceFolder } from "./util";
import { getBrokerManager } from "../broker/BrokerManager";

const APPROVAL_STATE_ID = "soterai.contextApproval";

interface ApprovalSession {
    id: string;
    expiresAt: number;
}

/** Active editor file uri, or a friendly error. */
function activeFileUri(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
}

/** Read the active context-approval session, expiring it if past its window. */
export async function readContextApproval(
    context: vscode.ExtensionContext,
): Promise<ApprovalSession | undefined> {
    const s = context.globalState.get<ApprovalSession>(APPROVAL_STATE_ID);
    if (!s) return undefined;
    if (Date.now() > s.expiresAt) {
        await context.globalState.update(APPROVAL_STATE_ID, undefined);
        return undefined;
    }
    return s;
}

/** Register every AI Context Firewall command. */
export function registerFirewallCommands(context: vscode.ExtensionContext, refreshViews: () => void): void {
    const vault = new VaultManager(context);
    const canary = new CanaryManager(context);

    const requireTrust = (feature: string): boolean => {
        if (!vscode.workspace.isTrusted) {
            vscode.window.showWarningMessage(
                `${feature} is disabled in restricted (untrusted) workspaces. Trust this workspace to use it.`,
            );
            return false;
        }
        return true;
    };

    // ── Phase 1: Project policy ───────────────────────────────────────────────
    const createProjectPolicy = async () => {
        if (!firstWorkspaceFolder()) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        if (await PolicyStore.exists()) {
            const pick = await vscode.window.showWarningMessage(
                ".soterai/policy.json already exists. Overwrite with defaults?",
                "Overwrite",
                "Cancel",
            );
            if (pick !== "Overwrite") return;
        }
        const uri = await PolicyStore.createDefault();
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
        vscode.window.showInformationMessage("Created .soterai/policy.json (AI Context Firewall policy).");
        refreshViews();
    };

    const editProjectPolicy = async () => {
        const uri = PolicyStore.policyUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        if (!(await PolicyStore.exists())) await PolicyStore.createDefault();
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    };

    const showProtectedFiles = async () => {
        const policy = await PolicyStore.load();
        const matches = await PolicyStore.listClassified(policy);
        const rows = matches
            .map(
                (m) =>
                    `<tr><td><code>${escapeHtml(m.relPath)}</code></td><td><span class="badge ${escapeHtml(
                        m.level,
                    )}">${escapeHtml(m.level)}</span></td><td><code>${escapeHtml(m.matchedPattern ?? "")}</code></td></tr>`,
            )
            .join("");
        const body = `<h1>🛡️ Protected & Sensitive Files</h1>
      <p>Files in this workspace matched by the AI Context Firewall policy.</p>
      <table><tr><th>File</th><th>Level</th><th>Matched pattern</th></tr>${
          rows || `<tr><td colspan="3">No protected/sensitive files matched.</td></tr>`
      }</table>
      <p class="note">Protected files are excluded from SoterAI-built AI context; sensitive files require approval. This does not stop other extensions from reading files SoterAI has not migrated — see the limitations doc.</p>`;
        showInfoWebview("soteraiProtectedFiles", "SoterAI: Protected Files", body);
    };

    const addToProtectedFiles = async () => {
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a file to protect.");
        const rel = vscode.workspace.asRelativePath(uri);
        await PolicyStore.addProtected(rel);
        vscode.window.showInformationMessage(`Added ${rel} to protected files.`);
        refreshViews();
    };

    const removeFromProtectedFiles = async () => {
        const policy = await PolicyStore.load();
        const pick = await vscode.window.showQuickPick(policy.protectedFiles, {
            title: "Remove a protected file pattern",
            placeHolder: "Select a pattern to remove",
        });
        if (!pick) return;
        await PolicyStore.removeProtected(pick);
        vscode.window.showInformationMessage(`Removed ${pick} from protected files.`);
        refreshViews();
    };

    // ── Phase 2: Vault ────────────────────────────────────────────────────────
    const migrateSecretsToVault = async () => {
        if (!requireTrust("Secret vault migration")) return;
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a .env-style file to migrate.");

        const preview = await vault.preview(uri);
        if (preview.candidates.length === 0) {
            return void vscode.window.showInformationMessage("No migratable secrets found in this file.");
        }
        const rows = preview.candidates
            .map((c) => `<tr><td><code>${escapeHtml(c.key)}</code></td><td>${escapeHtml(c.type)}</td><td><code>${escapeHtml(
                c.placeholder,
            )}</code></td><td>${escapeHtml(c.redactedPreview)}</td></tr>`)
            .join("");
        showInfoWebview(
            "soteraiVaultPreview",
            "SoterAI: Vault Migration Preview",
            `<h1>🔐 Migration preview — ${escapeHtml(preview.file)}</h1>
         <p>These secrets will be moved into the encrypted vault and replaced with placeholders. A <code>.bak</code> backup is written first.</p>
         <table><tr><th>Key</th><th>Type</th><th>Placeholder</th><th>Value (masked)</th></tr>${rows}</table>
         <p class="note">Raw values are shown masked only. They are stored encrypted outside the workspace; never in logs or reports.</p>`,
        );

        const confirm = await vscode.window.showWarningMessage(
            `Migrate ${preview.candidates.length} secret(s) from ${preview.file} into the protected vault? A .bak backup will be created.`,
            { modal: true },
            "Migrate & Backup",
        );
        if (confirm !== "Migrate & Backup") return;

        const count = await vault.migrate(uri);
        await LedgerStore.append({
            eventId: `mig_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType: "vault_migrated",
            action: "redact",
            severity: "high",
            riskScore: 50,
            categories: ["secret"],
            filePaths: [preview.file],
            policyVersion: String((await PolicyStore.load()).version),
            redactedEvidencePreview: `${count} secret(s) vaulted`,
        });
        vscode.window.showInformationMessage(`Migrated ${count} secret(s) to the vault. Backup: ${preview.file}.bak`);
        refreshViews();
    };

    const restoreSecretPlaceholders = async () => {
        if (!requireTrust("Vault restore")) return;
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open the file whose placeholders to restore.");
        const confirm = await vscode.window.showWarningMessage(
            "Restore raw secrets from the vault back into this file? A .bak backup will be created.",
            { modal: true },
            "Restore & Backup",
        );
        if (confirm !== "Restore & Backup") return;
        const count = await vault.restore(uri);
        vscode.window.showInformationMessage(
            count > 0 ? `Restored ${count} secret(s) from the vault.` : "No matching placeholders found for this file.",
        );
    };

    const openVaultStatus = async () => {
        const status = await vault.status();
        const rows = status.entries
            .map((e) => `<tr><td><code>${escapeHtml(e.key)}</code></td><td>${escapeHtml(e.type)}</td><td><code>${escapeHtml(
                e.placeholder,
            )}</code></td><td><code>${escapeHtml(e.hash.slice(0, 12))}…</code></td><td>${escapeHtml(e.originalFile)}</td></tr>`)
            .join("");
        showInfoWebview(
            "soteraiVaultStatus",
            "SoterAI: Protected Vault Status",
            `<h1>🔐 Protected Vault</h1>
         <p>Encrypted store: <code>${escapeHtml(status.location)}</code> (outside the workspace). ${
             status.exists ? `${status.entryCount} entr${status.entryCount === 1 ? "y" : "ies"}.` : "Not yet created."
         }</p>
         <table><tr><th>Key</th><th>Type</th><th>Placeholder</th><th>Hash</th><th>Original file</th></tr>${
             rows || `<tr><td colspan="5">Vault is empty.</td></tr>`
         }</table>
         <p class="note">Only hashes and metadata are shown — raw secret values are AES-256-GCM encrypted and never displayed.</p>`,
        );
    };

    const generateEnvExampleSafely = async () => {
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a .env-style file first.");
        const exampleUri = await vault.writeEnvExample(uri);
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(exampleUri));
        vscode.window.showInformationMessage("Generated .env.example (no secret values).");
    };

    // ── Phase 3/4: Context gate + safe builders ───────────────────────────────
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

    // ── Phase 5: Ledger ───────────────────────────────────────────────────────
    const openAILedger = async () => {
        const entries = await LedgerStore.readAll();
        const rows = entries
            .slice()
            .reverse()
            .slice(0, 200)
            .map(
                (e) =>
                    `<tr><td>${escapeHtml(e.timestamp)}</td><td>${escapeHtml(e.eventType)}</td>` +
                    `<td><span class="badge ${escapeHtml(e.decision)}">${escapeHtml(e.decision)}</span></td>` +
                    `<td>${escapeHtml(String(e.riskScore))}</td><td>${escapeHtml((e.categories ?? []).join(", "))}</td>` +
                    `<td>${escapeHtml((e.filePaths ?? []).join(", "))}</td><td>${escapeHtml(e.redactedEvidencePreview ?? "")}</td></tr>`,
            )
            .join("");
        showInfoWebview(
            "soteraiLedger",
            "SoterAI: What AI Saw — Ledger",
            `<h1>📒 What AI Saw</h1>
         <p>${entries.length} recorded event(s). Newest first (max 200 shown). Hashes and redacted previews only — no raw secrets.</p>
         <table><tr><th>Time</th><th>Event</th><th>Decision</th><th>Risk</th><th>Categories</th><th>Files</th><th>Evidence</th></tr>${
             rows || `<tr><td colspan="7">Ledger is empty.</td></tr>`
         }</table>`,
        );
    };

    const exportAILedger = async () => {
        const jsonl = await LedgerStore.exportSafe();
        const doc = await vscode.workspace.openTextDocument({ content: jsonl || "", language: "json" });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage("Exported sanitized AI access ledger (no raw secrets).");
    };

    const clearAILedger = async () => {
        const confirm = await vscode.window.showWarningMessage(
            "Delete the local AI access ledger? This history cannot be recovered.",
            { modal: true },
            "Delete Ledger",
        );
        if (confirm !== "Delete Ledger") return;
        await LedgerStore.clear();
        vscode.window.showInformationMessage("Local AI ledger cleared.");
        refreshViews();
    };

    const showWhatAISawLastSession = async () => {
        const entries = await LedgerStore.readAll();
        const last = entries.filter((e) => e.eventType === "context_built" || e.eventType === "context_approved").pop();
        if (!last) return void vscode.window.showInformationMessage("No AI context has been built yet this workspace.");
        vscode.window.showInformationMessage(
            `Last AI context: ${last.decision.toUpperCase()} — ${last.redactedEvidencePreview ?? ""} (${last.timestamp}).`,
        );
    };

    // ── Phase 6: Output leak monitor ──────────────────────────────────────────
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

    // ── Phase 7: Canary ───────────────────────────────────────────────────────
    const generateLocalCanary = async () => {
        const c = await canary.create();
        await vscode.env.clipboard.writeText(c.token);
        vscode.window.showWarningMessage(
            `Canary generated and copied to clipboard (${c.redactedPreview}). Paste it into a decoy file/secret. The raw token is stored in SecretStorage only.`,
        );
        refreshViews();
    };

    const insertCanaryIntoTestFile = async () => {
        if (!firstWorkspaceFolder()) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        const confirm = await vscode.window.showWarningMessage(
            "Create .soterai/canary.env containing a decoy canary secret? (Local only — never commit it.)",
            { modal: true },
            "Create Canary File",
        );
        if (confirm !== "Create Canary File") return;
        const c = await canary.create();
        const dir = vscode.Uri.joinPath(firstWorkspaceFolder()!.uri, ".soterai");
        await vscode.workspace.fs.createDirectory(dir);
        const fileUri = vscode.Uri.joinPath(dir, "canary.env");
        const body = `# SoterAI decoy canary — DO NOT COMMIT. If this value appears in AI output, protected context leaked.\nCANARY_API_KEY=${c.token}\n`;
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body));
        vscode.window.showInformationMessage(`Inserted canary into ${vscode.workspace.asRelativePath(fileUri)} (${c.redactedPreview}).`);
        refreshViews();
    };

    const scanWorkspaceForCanary = async () => {
        const active = await canary.loadForScan();
        if (active.length === 0) return void vscode.window.showInformationMessage("No canaries generated yet.");
        const config = vscode.workspace.getConfiguration("soterai");
        const excludeGlobs = config.get<string[]>("scan.excludeGlobs", ["**/node_modules/**", "**/.git/**"]);
        const files = await vscode.workspace.findFiles("**/*", `{${excludeGlobs.join(",")}}`, 2000);
        const hitFiles: string[] = [];
        for (const f of files) {
            try {
                const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(f));
                if ((await canary.scan(text)).length > 0) hitFiles.push(vscode.workspace.asRelativePath(f));
            } catch {
                /* skip */
            }
        }
        vscode.window.showInformationMessage(
            hitFiles.length
                ? `Canary present in ${hitFiles.length} file(s): ${hitFiles.slice(0, 10).join(", ")}. Ensure these are gitignored.`
                : "No canary exposure found in workspace files.",
        );
    };

    const verifyNoCanaryInLogs = async () => {
        // Prove the ledger/export never contain a raw canary token.
        const jsonl = await LedgerStore.exportSafe();
        const active = await canary.loadForScan();
        const leaked = active.filter((c) => jsonl.includes(c.token));
        if (leaked.length) {
            vscode.window.showErrorMessage(`[SoterAI] Canary token found in ledger export — investigate immediately.`);
        } else {
            vscode.window.showInformationMessage("Verified: no raw canary token appears in the AI ledger/export.");
        }
    };

    const rotateCanary = async () => {
        const c = await canary.rotate();
        await vscode.env.clipboard.writeText(c.token);
        vscode.window.showInformationMessage(`Canary rotated. New canary copied (${c.redactedPreview}). Old canaries invalidated.`);
        refreshViews();
    };

    // ── Registration (must match package.json contributes.commands) ───────────
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.createProjectPolicy", createProjectPolicy);
    reg("soterai.editProjectPolicy", editProjectPolicy);
    reg("soterai.showProtectedFiles", showProtectedFiles);
    reg("soterai.addToProtectedFiles", addToProtectedFiles);
    reg("soterai.removeFromProtectedFiles", removeFromProtectedFiles);

    reg("soterai.migrateSecretsToVault", migrateSecretsToVault);
    reg("soterai.restoreSecretPlaceholders", restoreSecretPlaceholders);
    reg("soterai.openVaultStatus", openVaultStatus);
    reg("soterai.generateEnvExample", generateEnvExampleSafely);

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

    reg("soterai.openAILedger", openAILedger);
    reg("soterai.exportAILedger", exportAILedger);
    reg("soterai.clearAILedger", clearAILedger);
    reg("soterai.showWhatAISawLastSession", showWhatAISawLastSession);

    reg("soterai.scanAIOutput", () => scanOutput("input"));
    reg("soterai.compareOutputAgainstContext", () => scanOutput("clipboard"));
    reg("soterai.checkOutputForLeakage", () => scanOutput("selection"));

    reg("soterai.generateCanary", generateLocalCanary);
    reg("soterai.insertCanaryIntoTestFile", insertCanaryIntoTestFile);
    reg("soterai.scanWorkspaceForCanary", scanWorkspaceForCanary);
    reg("soterai.verifyNoCanaryInLogs", verifyNoCanaryInLogs);
    reg("soterai.rotateCanary", rotateCanary);
}
