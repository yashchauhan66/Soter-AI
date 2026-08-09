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

// ── #4: RAG / embedding egress detection ───────────────────────────────────
// Implemented in ../advanced/egressFirewall (RAG_EGRESS_HOSTS / isRagEgress),
// where it is reached by the live evaluateEgressToHost() decision path. The
// copy that used to live here had no caller, so the detection it advertised
// never ran. Re-exported for callers that already import from this module.
export { RAG_EGRESS_HOSTS, isRagEgress } from "../advanced/egressFirewall";

// ── #5: Git pre-commit hook generator ──────────────────────────────────────

/**
 * Parse `hooksPath` out of a git config file.
 *
 * When a repo sets `core.hooksPath` (husky, lefthook, and most monorepo
 * setups do), git stops reading `.git/hooks` altogether. Writing a hook there
 * then succeeds at the filesystem level and never runs — the worst kind of
 * security failure, because the UI reports success.
 */
export function parseGitHooksPath(configText: string): string | null {
    let inCore = false;
    for (const rawLine of configText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.startsWith("[")) { inCore = /^\[core\]/i.test(line); continue; }
        if (!inCore) continue;
        const m = line.match(/^hooksPath\s*=\s*(.+)$/i);
        if (m) {
            const value = m[1].trim().replace(/^["']|["']$/g, "");
            return value.length > 0 ? value : null;
        }
    }
    return null;
}

/** Read core.hooksPath from .git/config; null when unset or unreadable. */
async function readGitHooksPath(
    root: string,
    fsp: { readFile(p: string, enc: string): Promise<string> },
    pathM: { join(...parts: string[]): string },
): Promise<string | null> {
    try {
        return parseGitHooksPath(await fsp.readFile(pathM.join(root, ".git", "config"), "utf8"));
    } catch {
        return null;
    }
}

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
/**
 * Flag visible editors holding secret-bearing files.
 *
 * Matched on the BASENAME, not the whole string. The incoming value is
 * `asRelativePath()`, which returns a nested path for anything below the root
 * ("backend/.env.production") and an ABSOLUTE path for files outside the
 * workspace. Comparing the full string to ".env" therefore caught only a
 * root-level .env and silently missed every other case — and a security
 * warning that stays quiet is worse than no warning at all.
 */
export function buildScreenShareWarnings(visibleRelativePaths: string[]): string[] {
    const out: string[] = [];
    for (const rel of visibleRelativePaths) {
        const lower = rel.toLowerCase();
        const base = lower.split(/[\\/]/).pop() ?? lower;
        const isEnv = base === ".env" || base.startsWith(".env.") || base.endsWith(".env");
        const isKeyMaterial = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".ppk"].some((x) => base.endsWith(x)) ||
            /^id_(rsa|dsa|ecdsa|ed25519)$/.test(base);
        const isNamedSecret = /secret|credential|password|passwd|token|apikey|api[._-]key/.test(base);
        // Whole-path checks: files under an SSH/AWS/GPG dir are sensitive
        // regardless of basename (e.g. ~/.aws/config, ~/.ssh/known_hosts).
        const inSecretDir = /(^|[\\/])\.(ssh|aws|gnupg|kube|docker)([\\/])/.test(lower);
        if (isEnv || isKeyMaterial || isNamedSecret || inSecretDir) out.push(rel);
    }
    return out;
}

// ── #7: DependencyGuard OSV nudge logic ────────────────────────────────────
export interface DepGuardNudge { shouldNudge: boolean; message?: string }

/**
 * Evidence a caller has about the workspace's dependencies.
 * `scanned: false` means no scan ran — the nudge must then NOT claim findings.
 */
export interface DepRiskEvidence { scanned: boolean; riskyCount: number }

/**
 * Decide whether to nudge the user toward `osvMode: "always"`.
 *
 * The message is derived from evidence, never asserted. The previous version
 * took a bare boolean that the only caller hardcoded to `true`, so the UI
 * always said "found risky packages" without any scan having run.
 */
export function evaluateOsvNudge(osvMode: string, evidence: DepRiskEvidence): DepGuardNudge {
    if (osvMode !== "ask" && osvMode !== "never") return { shouldNudge: false };
    const setting = "soterai.dependencyGuard.osvMode = \"always\"";
    if (evidence.scanned && evidence.riskyCount > 0) {
        return {
            shouldNudge: true,
            message: `SoterAI Dependency Guard flagged ${evidence.riskyCount} risky package(s) locally. ` +
                `Enable OSV online queries (${setting}) for live CVE advisories?`,
        };
    }
    if (evidence.scanned) return { shouldNudge: false };
    // No scan ran: still worth offering the setting, but say so plainly.
    return {
        shouldNudge: true,
        message: `OSV online queries are currently "${osvMode}", so Dependency Guard checks offline data only ` +
            `(no CVE advisories are fetched). No dependency scan has run in this session. ` +
            `Enable OSV online queries (${setting})?`,
    };
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

/** Minimal fs surface needed to expand log candidates (injectable for tests). */
export interface LogFsIO {
    stat(p: string): Promise<{ isDirectory(): boolean }>;
    readdir(p: string): Promise<string[]>;
}

/**
 * Resolve candidates to concrete FILE paths.
 *
 * LM Studio's `.cache/lm-studio/server-logs` is a DIRECTORY, so `readFile()` on
 * it throws EISDIR. The old scanner swallowed that error and then reported "no
 * secrets persisted" without having read a single line — a clean bill of health
 * from a scan that never ran. One level of listing covers both known layouts
 * and keeps the walk bounded.
 */
export async function resolveLocalModelLogFiles(
    homeDir: string,
    io: LogFsIO,
    maxFilesPerDir = 40,
): Promise<string[]> {
    const files: string[] = [];
    for (const candidate of localModelLogPaths(homeDir)) {
        let isDir = false;
        try {
            isDir = (await io.stat(candidate)).isDirectory();
        } catch {
            continue; // missing path is expected — that tool just isn't installed
        }
        if (!isDir) { files.push(candidate); continue; }
        try {
            const entries = await io.readdir(candidate);
            const sep = candidate.includes("\\") && !candidate.includes("/") ? "\\" : "/";
            for (const name of entries.slice(0, maxFilesPerDir)) {
                const child = `${candidate}${sep}${name}`;
                try {
                    if (!(await io.stat(child)).isDirectory()) files.push(child);
                } catch { /* unreadable entry */ }
            }
        } catch { /* unreadable directory */ }
    }
    return files;
}

// ── Command handlers registered from extension.ts ───────────────────────────
export function registerContinuousGuardCommands(
    context: vscode.ExtensionContext,
    helpers: {
        scanText: (text: string, context: string) => Promise<{ findings: unknown[] }>;
    },
): void {
    const reg = (id: string, fn: (...args: unknown[]) => unknown) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    // #3 command: scan clipboard as "AI-generated code"
    reg("soterai.scanClipboardAICode", async () => {
        const clip = await vscode.env.clipboard.readText();
        if (!clip.trim()) { vscode.window.showInformationMessage("Clipboard is empty."); return; }
        const hits = scanAICodeForVulns(clip);
        if (hits.length === 0) vscode.window.showInformationMessage("No AI-code vulnerability patterns found in clipboard.");
        else vscode.window.showWarningMessage(`AI-code check: ${hits.length} pattern(s) matched: ${hits.join(", ")}`);
    });

    // #5 command: offer to install a pre-commit hook in the workspace
    reg("soterai.installGitSecretHook", async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { vscode.window.showErrorMessage("Open a workspace first."); return; }

        const fsp = require("fs/promises");
        const pathM = require("path");
        const root = folder.uri.fsPath;
        const hookPath = pathM.join(root, ".git", "hooks", "pre-commit");

        // A repo using husky/lefthook sets core.hooksPath, and git then ignores
        // .git/hooks entirely — installing there would look successful and do
        // nothing. Detect it and say so instead of writing a dead file.
        const custom = await readGitHooksPath(root, fsp, pathM);
        if (custom) {
            vscode.window.showWarningMessage(
                `This repo sets core.hooksPath = "${custom}" (husky/lefthook or similar), so git ignores .git/hooks. ` +
                `SoterAI did not install anything. Add the scan to your "${custom}/pre-commit" manually — ` +
                `use "SoterAI: Copy Pre-Commit Hook Script" to get the script.`,
            );
            return;
        }

        let existing: string | null = null;
        try { existing = await fsp.readFile(hookPath, "utf8"); } catch { existing = null; }
        const alreadyOurs = existing !== null && existing.includes("SoterAI pre-commit guard");

        const prompt = existing === null || alreadyOurs
            ? "Install SoterAI git pre-commit hook? Future commits will be scanned for secrets (bypass always possible with --no-verify)."
            : "A pre-commit hook already exists in this repo. SoterAI will back it up to " +
              "'pre-commit.soterai-backup' and replace it. Your original is restorable from that file.";
        const confirmLabel = existing !== null && !alreadyOurs ? "Back up & replace" : "Install";
        const pick = await vscode.window.showWarningMessage(prompt, { modal: true }, confirmLabel);
        if (pick !== confirmLabel) return;

        try {
            await fsp.mkdir(pathM.dirname(hookPath), { recursive: true });
            if (existing !== null && !alreadyOurs) {
                await fsp.writeFile(`${hookPath}.soterai-backup`, existing, "utf8");
            }
            await fsp.writeFile(hookPath, buildPreCommitHook(), "utf8");
            // Without the exec bit git silently skips the hook on macOS/Linux —
            // the UI would claim protection that never runs. Windows ignores mode.
            let execBitSet = true;
            try { await fsp.chmod(hookPath, 0o755); } catch { execBitSet = false; }
            const tail = existing !== null && !alreadyOurs ? " Previous hook saved as pre-commit.soterai-backup." : "";
            if (execBitSet || process.platform === "win32") {
                vscode.window.showInformationMessage(`SoterAI pre-commit secret hook installed (.git/hooks/pre-commit).${tail}`);
            } else {
                vscode.window.showWarningMessage(
                    `Hook written to .git/hooks/pre-commit but the executable bit could not be set, ` +
                    `so git will skip it. Run: chmod +x .git/hooks/pre-commit${tail}`,
                );
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Hook install failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    // Escape hatch for husky/lefthook repos, referenced by the warning above.
    reg("soterai.copyPreCommitHookScript", async () => {
        await vscode.env.clipboard.writeText(buildPreCommitHook());
        vscode.window.showInformationMessage(
            "Pre-commit scan script copied to clipboard. Paste it into your managed hook (e.g. .husky/pre-commit) and make it executable.",
        );
    });

    // #6 command: warn on screen-share risk (visible sensitive files)
    reg("soterai.checkScreenShareRisk", async () => {
        const vis = vscode.window.visibleTextEditors.map((e) => vscode.workspace.asRelativePath(e.document.uri));
        const risky = buildScreenShareWarnings(vis);
        if (risky.length === 0) vscode.window.showInformationMessage("No sensitive files currently visible — screen-share looks safe.");
        else vscode.window.showWarningMessage(`Screen-share warning: close these before sharing → ${risky.join(", ")}`);
    });

    // #8 command: scan local-model logs for persisted secrets
    reg("soterai.scanLocalModelLogs", async () => {
        const osM = require("os");
        const fsM = require("fs/promises");
        const { detectSecrets } = require("@soterai/detectors");
        const findings: Array<{ path: string; count: number }> = [];
        const unreadable: string[] = [];
        // Candidates include a DIRECTORY (LM Studio server-logs); resolve to
        // real files first so a scan that reads nothing can't report "clean".
        const paths = await resolveLocalModelLogFiles(osM.homedir(), fsM);
        let scanned = 0;
        for (const p of paths) {
            try {
                const text = await fsM.readFile(p, "utf8");
                scanned++;
                const hits = detectSecrets(text).length;
                if (hits > 0) findings.push({ path: p, count: hits });
            } catch {
                unreadable.push(p);
            }
        }
        if (paths.length === 0) {
            vscode.window.showInformationMessage("No Ollama / LM Studio log files found on this machine — nothing to scan.");
            return;
        }
        if (findings.length === 0) {
            const tail = unreadable.length ? ` ${unreadable.length} file(s) could not be read.` : "";
            vscode.window.showInformationMessage(`Scanned ${scanned} local-model log file(s) — no secrets persisted.${tail}`);
        } else {
            vscode.window.showWarningMessage(
                `Secrets found persisted in local-model logs: ${findings.map((f) => `${f.path} (${f.count})`).join("; ")}. Rotate them and clear the logs.`,
            );
        }
    });

    // #7 command: OSV mode nudge
    reg("soterai.reviewDependencyGuardMode", async () => {
        const cfg = vscode.workspace.getConfiguration("soterai");
        const mode = cfg.get<string>("dependencyGuard.osvMode", "ask");
        // No scan has run here, so say that rather than claiming findings.
        const nudge = evaluateOsvNudge(mode, { scanned: false, riskyCount: 0 });
        if (!nudge.shouldNudge) {
            vscode.window.showInformationMessage(`Dependency Guard OSV mode is "${mode}" — live CVE advisories are already enabled.`);
            return;
        }
        const pick = await vscode.window.showInformationMessage(nudge.message!, "Enable OSV always", "Keep as-is");
        if (pick === "Enable OSV always") await cfg.update("dependencyGuard.osvMode", "always", vscode.ConfigurationTarget.Global);
    });
}
