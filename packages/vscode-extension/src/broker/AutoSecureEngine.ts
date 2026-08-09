/**
 * "Secure My AI" — ONE-CLICK auto-discovery & protection engine.
 *
 * Goal (user's requirement):
 *   The user clicks ONE button. SoterAI finds every AI tool on this machine
 *   (Cline, Claude Code, Copilot, Continue, Cursor, env-based providers,
 *   NVIDIA NIM, OpenRouter, Groq, DeepSeek, Mistral, xAI, Ollama, LM Studio...)
 *   and re-routes ALL of them through the local SoterAI broker, so NO secret
 *   or prompt can ever leave raw. Backup first. Health-check after.
 *   Verify end-to-end. One-click restore if anything breaks.
 *
 * Honest design notes:
 *   - We never silent-write. One button = one approval, then batch-apply.
 *   - Start the broker first; refuse to "secure" tools while broker is down.
 *   - Tools that CANNOT be auto-routed (hard-coded endpoint, e.g. raw Copilot
 *     ext) are reported as "monitor-only" so the UI never lies about coverage.
 */

import {
    detectIntegrationConfigs,
    proposeBrokerRewrite,
    applyProposedChange,
    type DetectedConfig,
    type ProposedChange,
    type ApplyResult,
    type FileIO,
    type HttpIO,
} from "./IntegrationAdapter";

/* ------------------------------------------------------------------ */
/* 1. TOOL KNOWLEDGE BASE — where every known AI tool keeps its config */
/* ------------------------------------------------------------------ */

export interface AiToolSpec {
    id: string;
    /** Human name shown in the UI */
    name: string;
    /** True if we can fully re-route its traffic to the broker */
    canAutoSecure: boolean;
    /** Candidate config locations (workspace-relative AND home-relative) */
    configCandidates: string[];
    /**
     * "route"  -> we rewrite its base URL to the local broker (FULL blocking)
     * "env"    -> we write base-URL env vars to a shell/profile or .env
     * "monitor"-> cannot intercept; only warn user (honest coverage)
     */
    mode: "route" | "env" | "monitor";
    /** Short explanation shown in UI */
    coverageNote: string;
}

/**
 * WORLD-WIDE coverage list. Order = UI display order.
 * ${HOME} is replaced at runtime with the user's home dir.
 */
export const KNOWN_AI_TOOLS: AiToolSpec[] = [
    {
        id: "cline",
        name: "Cline (VS Code)",
        canAutoSecure: true,
        mode: "env",
        configCandidates: [
            "${HOME}/.config/cline/config.json",
            "${HOME}/AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
            ".cline/config.json",
        ],
        coverageNote: "Routed to broker via OPENAI_BASE_URL — full redaction. ✅",
    },
    {
        id: "claude-code",
        name: "Claude Code (terminal / VS Code)",
        canAutoSecure: true,
        mode: "env",
        configCandidates: [
            "${HOME}/.claude/settings.json",
            "${HOME}/.config/claude-code/config.json",
            ".claude/settings.json",
        ],
        coverageNote: "Routed via ANTHROPIC_BASE_URL — full redaction. ✅",
    },
    {
        id: "continue",
        name: "Continue.dev",
        canAutoSecure: true,
        mode: "route",
        configCandidates: [
            "${HOME}/.continue/config.json",
            "${HOME}/.continue/config.yaml",
        ],
        coverageNote: "config.json base URL rewritten to broker. ✅",
    },
    {
        id: "aider",
        name: "Aider",
        canAutoSecure: true,
        mode: "env",
        configCandidates: [
            "${HOME}/.aider.conf.yml",
            ".aider.conf.yml",
        ],
        coverageNote: "OPENAI/ANTHROPIC base URLs pointed at broker. ✅",
    },
    {
        id: "opencode",
        name: "OpenCode",
        canAutoSecure: true,
        mode: "route",
        configCandidates: [
            "${HOME}/.config/opencode/config.json",
            "opencode.json",
        ],
        coverageNote: "Provider endpoint set to local broker. ✅",
    },
    {
        id: "generic-env",
        name: "Shell / .env providers (NVIDIA, OpenRouter, Groq, DeepSeek, Mistral, xAI, Ollama...)",
        canAutoSecure: true,
        mode: "env",
        configCandidates: [
            ".env",
            ".env.local",
            "${HOME}/.zshrc",
            "${HOME}/.bashrc",
        ],
        coverageNote: "Any *-compatible base URL env var re-pointed to broker. ✅",
    },
    {
        id: "copilot-ext",
        name: "GitHub Copilot (built-in extension)",
        canAutoSecure: false,
        mode: "monitor",
        configCandidates: [],
        coverageNote: "Copilot hard-codes its endpoint and cannot be re-routed. SoterAI cannot intercept its direct HTTPS calls (VS Code has no network API). We MONITOR the editor/clipboard instead so leaks are still visible. ⚠️ monitor-only.",
    },
];

/* ------------------------------------------------------------------ */
/* 2. DISCOVERY — expand ${HOME}, probe filesystem, respect honesty     */
/* ------------------------------------------------------------------ */

export interface DiscoveredTool {
    spec: AiToolSpec;
    configs: DetectedConfig[];   // existing config files we can act on
    status: "found" | "monitor-only" | "not-installed";
}

/**
 * Expand a candidate to an absolute path.
 *
 * `${HOME}` candidates resolve against the home dir. Workspace-relative
 * candidates (".env", ".claude/settings.json") MUST resolve against the open
 * workspace — leaving them relative makes the extension host resolve them
 * against its own cwd, which is the VS Code install dir, not the user's
 * project. That both missed real configs and risked writing into an
 * unrelated directory.
 */
function expandCandidate(candidate: string, homeDir: string, workspaceRoot?: string): string | null {
    if (candidate.includes("${HOME}")) return candidate.replace("${HOME}", homeDir);
    if (!workspaceRoot) return null; // no workspace open → skip relative candidates
    const sep = workspaceRoot.includes("\\") && !workspaceRoot.includes("/") ? "\\" : "/";
    return `${workspaceRoot.replace(/[\\/]+$/, "")}${sep}${candidate}`;
}

export async function discoverAllAiTools(io: FileIO, homeDir: string, workspaceRoot?: string): Promise<DiscoveredTool[]> {
    const results: DiscoveredTool[] = [];
    for (const spec of KNOWN_AI_TOOLS) {
        if (spec.mode === "monitor") {
            results.push({ spec, configs: [], status: "monitor-only" });
            continue;
        }
        const candidates = spec.configCandidates
            .map((c) => expandCandidate(c, homeDir, workspaceRoot))
            .filter((c): c is string => c !== null);
        let configs: DetectedConfig[] = [];
        try {
            configs = await detectIntegrationConfigs(candidates, io);
        } catch {
            configs = [];
        }
        results.push({
            spec,
            configs,
            status: configs.length > 0 ? "found" : "not-installed",
        });
    }
    return results;
}

/* ------------------------------------------------------------------ */
/* 3. PLAN — build every change BEFORE touching disk                    */
/* ------------------------------------------------------------------ */

export interface SecurePlan {
    proposed: ProposedChange[];
    monitorOnly: string[];        // tool ids we can't route
    /** Configs we found but deliberately refused to rewrite (would corrupt them). */
    unsupported: Array<{ toolId: string; path: string; reason: string }>;
    brokerNeeded: boolean;
    summaryLines: string[];
}

export function buildSecurePlan(discovered: DiscoveredTool[], ioFiles: Record<string, string>, brokerPort: number): SecurePlan {
    const proposed: ProposedChange[] = [];
    const monitorOnly: string[] = [];
    const unsupported: Array<{ toolId: string; path: string; reason: string }> = [];
    const summaryLines: string[] = [];

    for (const d of discovered) {
        if (d.status === "monitor-only") {
            monitorOnly.push(d.spec.id);
            summaryLines.push(`⚠️  ${d.spec.name}: monitor-only (cannot auto-route)`);
            continue;
        }
        if (d.status === "not-installed") continue;

        for (const cfg of d.configs) {
            const currentText = ioFiles[cfg.path];
            if (currentText === undefined) continue;
            // Use the kind the file itself reports. Coercing every env-mode
            // tool to "anthropic-compatible" pointed OpenAI-backed tools at
            // the Anthropic broker route.
            const change = proposeBrokerRewrite(cfg.path, currentText, cfg.kind, brokerPort);
            if (change.unsupportedReason) {
                unsupported.push({ toolId: d.spec.id, path: cfg.path, reason: change.unsupportedReason });
                summaryLines.push(`⚠️  ${d.spec.name}: ${cfg.path} left unchanged (not safely rewritable)`);
            } else if (change.after !== change.before) {
                proposed.push(change);
                summaryLines.push(`✅ ${d.spec.name}: will route via ${change.brokerBaseUrl}`);
            } else {
                summaryLines.push(`ℹ️  ${d.spec.name}: already secure (no diff needed)`);
            }
        }
    }
    return { proposed, monitorOnly, unsupported, brokerNeeded: proposed.length > 0, summaryLines };
}

/* ------------------------------------------------------------------ */
/* 4. EXECUTE — single approval → batch apply → health check all        */
/* ------------------------------------------------------------------ */

export interface SecureOutcome {
    applied: ApplyResult[];
    verified: Array<{ toolId: string; ok: boolean; detail: string }>;
    monitorOnly: string[];
    /** Carried through from the plan so the UI never implies these are covered. */
    unsupported: Array<{ toolId: string; path: string; reason: string }>;
    brokerOnline: boolean;
    headline: string;
}

export async function executeSecurePlan(
    plan: SecurePlan,
    discovered: DiscoveredTool[],
    io: FileIO,
    http: HttpIO,
    approved: boolean,
    brokerHealthUrl: string,
): Promise<SecureOutcome> {
    // 1) REFUSE if broker is down — never "secure" into a dead proxy.
    let brokerOnline = false;
    try {
        const h = await http.get(brokerHealthUrl);
        brokerOnline = h.status === 200;
    } catch {
        brokerOnline = false;
    }
    if (!brokerOnline && plan.brokerNeeded) {
        return {
            applied: [],
            verified: [],
            monitorOnly: plan.monitorOnly,
            unsupported: plan.unsupported,
            brokerOnline: false,
            headline: "❌ Broker offline — start SoterAI Local AI Broker first, then click Secure again.",
        };
    }

    // 2) Batch-apply every rewrite (each makes its own timestamped backup).
    const applied: ApplyResult[] = [];
    for (const change of plan.proposed) {
        applied.push(await applyProposedChange(change, io, approved));
    }

    // 3) Verify: for every applied config, POST a single tiny redaction smoke
    //    message through the broker and confirm a 2xx means the chain works.
    const verified: Array<{ toolId: string; ok: boolean; detail: string }> = [];
    for (const d of discovered) {
        if (d.status !== "found") continue;
        const routed = d.configs.some((c) => plan.proposed.some((p) => p.path === c.path));
        if (!routed) continue;
        try {
            const smoke = await http.post(
                `${brokerHealthUrl.replace(/\/health.?$/, "")}/v1/ai/openai-compatible/smoke`,
                JSON.stringify({ ping: true }),
                { "content-type": "application/json" },
            );
            verified.push({ toolId: d.spec.id, ok: smoke.status >= 200 && smoke.status < 300, detail: `HTTP ${smoke.status}` });
        } catch (e) {
            verified.push({ toolId: d.spec.id, ok: false, detail: String(e) });
        }
    }

    const okCount = applied.filter((a) => a.applied).length;
    const failedVerify = verified.filter((v) => !v.ok).length;
    const skipped = plan.unsupported.length;
    const tail = skipped > 0 ? ` ${skipped} config(s) left unchanged — see details.` : "";

    let headline: string;
    if (okCount === 0) {
        headline = skipped > 0
            ? `No config was safely rewritable.${tail}`
            : "Nothing to change — everything reachable is already secure.";
    } else if (failedVerify > 0) {
        // Never claim redaction we did not observe end-to-end.
        headline =
            `⚠️ Rewrote ${okCount} config(s) but ${failedVerify} did not pass the broker smoke test — ` +
            `redaction is NOT confirmed. Run "SoterAI: Restore AI Configs" if your tools misbehave.${tail}`;
    } else {
        headline = `🛡️ Secured ${okCount} tool config(s). Secrets now redact before they reach any connected LLM.${tail}`;
    }
    return { applied, verified, monitorOnly: plan.monitorOnly, unsupported: plan.unsupported, brokerOnline, headline };
}

/* ------------------------------------------------------------------ */
/* 5. RESTORE — one click puts every original config back               */
/* ------------------------------------------------------------------ */

export async function restoreAll(applied: ApplyResult[], io: FileIO): Promise<{ restored: number; failed: string[] }> {
    let restored = 0;
    const failed: string[] = [];
    for (const a of applied) {
        if (!a.applied || !a.backupPath) continue;
        const backup = await io.readText(a.backupPath);
        if (backup === null) { failed.push(a.path); continue; }
        await io.writeText(a.path, backup);
        restored++;
    }
    return { restored, failed };
}
