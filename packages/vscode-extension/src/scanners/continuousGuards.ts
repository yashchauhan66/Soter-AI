/**
 * Continuous Guards — consolidated module for remaining IDE security issues.
 * Extends LiveScanner's zero-config philosophy to the gaps found in review:
 *
 *  #3 AI-generated code vulnerability auto-scan  (scanner runs on accepted suggestions)
 *  #4 RAG / embedding egress leak detection      (vector-DB hosts in outgoing payloads)
 *  #5 Git pre-commit secret scan hook            (install hook, scan staged diff)
 *  #6 Screen-share / screenshot secret warning    (warn when protected files are visible)
 *  #7 DependencyGuard OSV hardening               (prompt to switch osvMode ask→always)
 *  #8 Local-model log scanning                    (Ollama / LM Studio log dirs)
 */
import * as vscode from "vscode";
declare const URL: any; // VS Code host provides it
declare const TextEncoder: any; // VS Code host provides it
declare const require: any; // Node require available in extension host

// ── #3: AI-code vulnerability detector ─────────────────────────────────────
export const AI_CODE_VULN_PATTERNS = [
    { type: "sql_injection_risk", re: /(?:query|execute|raw)\s*\(\s*[`"'][^`"']*\$\{/gi },
    { type: "innerHTML_xss",      re: /\.innerHTML\s*=\s*[^'"0]/gi },
    { type: "eval_execution",     re: /\beval\s*\(/g },
    { type: "shell_exec_inject",  re: /exec(?:Sync)?\s*\([^)]*\$\{|exec(?:Sync)?\s*\(\s*`/g },
    { type: "path_traversal",     re: /readFile(?:Sync)?\s*\([^)]*req\.|\.params\./gi },
    { type: "hardcoded_fallback_secret", re: /(?:password|secret|token)\s*\|\|\s*["'][^"']{6,}["']/gi },
    { type: "cors_wildcard_credentials", re: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/gi },
];

/** Run AI-code vuln patterns; returns matching type names. 100% local regex. */
export function scanAICodeForVulns(code: string): string[] {
    return AI_CODE_VULN_PATTERNS.filter((p) => { p.re.lastIndex = 0; return p.re.test(code); }).map((p) => p.type);
}

// ── #4: RAG / embedding egress detector ────────────────────────────────────
export const RAG_EGRESS_HOSTS = [
    "api.pinecone.io", "weaviate.io", "qdrant.io", "api.zilliz.com",
    "chroma.streamlit.app", "vectorize.workers.dev", "lancedb.com",
];
/** True if outbound payload targets a vector/RAG DB (potential embedding leak). */
export function isRagEgress(url: string): boolean {
    try {
        const h = new URL(url).hostname.toLowerCase();
        return RAG_EGRESS_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
    } catch { return false; }
}

// ── #5: Git pre-commit hook generator ──────────────────────────────────────
export function buildPreCommitHook(): string {
    return [
        "#!/bin/sh",
        "# SoterAI pre-commit guard — scans staged diff for secrets before commit.",
        "DIFF=$(git diff --cached --unified=0 2>/dev/null || true)",
        "PATTERNS='AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{30,}|sk-(proj-|svc-)?[A-Za-z0-9_\\-]{20,}|sk-ant-[A-Za-z0-9_\\-]{20,}|xox[bpoars]-|-----BEGIN (RSA|EC|OPENSSH|DSA)? ?PRIVATE KEY|AIza[0-9A-Za-z_\\-]{20,40}|npm_[A-Za-z0-9]{36}|(postgres|mysql|mongodb(\\+srv)?|redis)://|eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}'",
        "if echo \"$DIFF\" | grep -Eiq \"$PATTERNS\"; then",
        "  echo 'SoterAI: Possible secret in staged changes. Commit blocked.'",
        "  echo 'Run \"SoterAI: Scan Git Diff\" in VS Code for details, or commit with --no-verify to bypass.'",
        "  exit 1",
        "fi",
        "exit 0",
        "",
    ].join("\n");
}

// ── #6: Screen-share / screenshot warning ──────────────────────────────────
export function buildScreenShareWarnings(visibleRelativePaths: string[]): string[] {
    const out: string[] = [];
    for (const rel of visibleRelativePaths) {
        const lower = rel.toLowerCase();
        if (lower === ".env" || lower.startsWith(".env.") || lower.includes("credential") || lower.includes("secret") || lower.endsWith(".pem") || lower.endsWith(".key")) {
            out.push(rel);
        }
    }
    return out;
}

// ── #7: DependencyGuard OSV nudge logic ────────────────────────────────────
export interface DepGuardNudge { shouldNudge: boolean; message?: string }
export function evaluateOsvNudge(osvMode: string, foundRiskyDeps: boolean): DepGuardNudge {
    if ((osvMode === "ask" || osvMode === "never") && foundRiskyDeps) {
        return {
            shouldNudge: true,
            message: "SoterAI Dependency Guard found risky packages. Enable OSV online queries (soterai.dependencyGuard.osvMode = \"always\") for live CVE advisories?",
        };
    }
    return { shouldNudge: false };
}

// ── #8: Local-model log secret scanner ─────────────────────────────────────
export const LOCAL_MODEL_LOG_CANDIDATES = [
    "${HOME}/.ollama/logs/server.log",
    "${HOME}/.cache/lm-studio/server-logs",
    "${HOME}/AppData/Roaming/ollama/logs/server.log",
    "${HOME}/Library/Logs/ollama/server.log",
];
/** Expand ${HOME} and return absolute paths to inspect for persisted prompts/secrets. */
export function localModelLogPaths(homeDir: string): string[] {
    return LOCAL_MODEL_LOG_CANDIDATES.map((p) => p.replace("${HOME}", homeDir));
}

// ── Command handlers registered from extension.ts ───────────────────────────
export function registerContinuousGuardCommands(
    context: vscode.ExtensionContext,
    helpers: {
        scanText: (text: string, context: string) => Promise<{ findings: unknown[] }>;
    },
): void {
    const push = (id: string, fn: (...args: unknown[]) => unknown) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    // #3 command: scan clipboard as "AI-generated code"
    push("soterai.scanClipboardAICode", async () => {
        const clip = await vscode.env.clipboard.readText();
        if (!clip.trim()) { vscode.window.showInformationMessage("Clipboard is empty."); return; }
        const hits = scanAICodeForVulns(clip);
        if (hits.length === 0) vscode.window.showInformationMessage("No AI-code vulnerability patterns found in clipboard.");
        else vscode.window.showWarningMessage(`AI-code check: ${hits.length} pattern(s) matched: ${hits.join(", ")}`);
    });

    // #5 command: offer to install a pre-commit hook in the workspace
    push("soterai.installGitSecretHook", async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { vscode.window.showErrorMessage("Open a workspace first."); return; }
        const pick = await vscode.window.showWarningMessage(
            "Install SoterAI git pre-commit hook? Future commits will be scanned for secrets (bypass always possible with --no-verify).",
            { modal: true }, "Install",
        );
        if (pick !== "Install") return;
        const hookUri = vscode.Uri.joinPath(folder.uri, ".git", "hooks", "pre-commit");
        try {
            await vscode.workspace.fs.writeFile(hookUri, new TextEncoder().encode(buildPreCommitHook()));
            vscode.window.showInformationMessage("SoterAI pre-commit secret hook installed (.git/hooks/pre-commit).");
        } catch (e) {
            vscode.window.showErrorMessage(`Hook install failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    // #6 command: warn on screen-share risk (visible sensitive files)
    push("soterai.checkScreenShareRisk", async () => {
        const vis = vscode.window.visibleTextEditors.map((e) => vscode.workspace.asRelativePath(e.document.uri));
        const risky = buildScreenShareWarnings(vis);
        if (risky.length === 0) vscode.window.showInformationMessage("No sensitive files currently visible — screen-share looks safe.");
        else vscode.window.showWarningMessage(`Screen-share warning: close these before sharing → ${risky.join(", ")}`);
    });

    // #8 command: scan local-model logs for persisted secrets
    push("soterai.scanLocalModelLogs", async () => {
        const osM = require("os");
        const fsM = require("fs/promises");
        const { detectSecrets } = require("@soterai/detectors");
        const findings: Array<{ path: string; count: number }> = [];
        const paths = localModelLogPaths(osM.homedir());
        for (const p of paths) {
            try {
                const text = await fsM.readFile(p, "utf8");
                const hits = detectSecrets(text).length;
                if (hits > 0) findings.push({ path: p, count: hits });
            } catch { /* path missing is fine */ }
        }
        if (findings.length === 0) vscode.window.showInformationMessage("Local model logs scanned — no secrets persisted.");
        else vscode.window.showWarningMessage(
            `Secrets found persisted in local-model logs: ${findings.map((f) => `${f.path} (${f.count})`).join("; ")}. Rotate them and clear the logs.`,
        );
    });

    // #7 command: OSV mode nudge
    push("soterai.reviewDependencyGuardMode", async () => {
        const cfg = vscode.workspace.getConfiguration("soterai");
        const mode = cfg.get<string>("dependencyGuard.osvMode", "ask");
        const nudge = evaluateOsvNudge(mode, true); // command implies user thinks there's risk
        if (!nudge.shouldNudge) { vscode.window.showInformationMessage("Dependency Guard OSV mode is already optimal."); return; }
        const pick = await vscode.window.showInformationMessage(nudge.message!, "Enable OSV always", "Keep as-is");
        if (pick === "Enable OSV always") await cfg.update("dependencyGuard.osvMode", "always", vscode.ConfigurationTarget.Global);
    });
}
