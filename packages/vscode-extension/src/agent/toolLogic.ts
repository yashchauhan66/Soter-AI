/**
 * GAP 2 — the decision logic behind SoterAI's agent-facing tools.
 *
 * Copilot agent mode and every MCP client work by calling tools. Until now
 * SoterAI could only shout from the sidebar: it had 162 commands and no way for
 * the agent itself to ask "is this safe?" before acting. This module is the
 * answer to that question, and it is deliberately the *only* copy of it.
 *
 * Two surfaces consume it — `vscode.lm.registerTool` (Copilot/VS Code chat) and
 * the standalone MCP server (every other agent). Both call the same three
 * functions here, so a verdict cannot differ depending on which door the agent
 * came through. That mattered enough to justify a separate module: two
 * implementations of "is this command dangerous" is two answers.
 *
 * PURE BY CONTRACT. No `vscode` import, ever. The MCP server runs as a plain
 * Node child process with no extension host, so anything that touches `vscode`
 * here would work in chat and crash for every MCP agent — a failure that only
 * shows up in the surface nobody tests. It also means every assertion below can
 * run under `tsx --test`.
 *
 * HONESTY. These tools are ADVISORY. They return a verdict on text the agent
 * chooses to submit. They do not intercept anything: an agent that never calls
 * them is unaffected, and VS Code exposes no API to force the call. Every result
 * says so in `coverage`, because an agent-readable result that overstates its
 * own authority is worse than no result.
 */
import {
    detectTerminalCommandRisk,
    minimizeEvidence,
    type Finding,
} from "@soterai/guard-core";
import { evaluateEgress } from "../advanced/egressFirewall";
import { analyzeInstallCommand, analyzePackage, type DependencyRisk } from "../dep-guard/DepGuardCore";

/**
 * What every tool answers. Deliberately small and identical across tools: an
 * agent should not need per-tool parsing to learn whether it may proceed.
 */
export type AgentVerdict = "allow" | "warn" | "block";

/** The single honest statement of what these tools do and do not enforce. */
export const AGENT_TOOL_COVERAGE =
    "ADVISORY. SoterAI evaluated the text you submitted and returned a verdict. " +
    "It did not and cannot block the action: nothing forces an agent to call this tool, " +
    "and VS Code exposes no API to intercept an agent's own file, network or terminal access.";

export interface AgentToolResult {
    verdict: AgentVerdict;
    /** 0–100. Comparable across tools; not a probability. */
    riskScore: number;
    /** One sentence an agent can relay to the user verbatim. */
    summary: string;
    /**
     * Redacted findings only. `redactedEvidence` never carries a raw secret,
     * which is the whole reason findings are minimized before they leave here:
     * a tool result is handed to a language model and usually leaves the machine.
     */
    findings: Array<{ title: string; severity: string; evidence: string }>;
    /** Present only when a safe rewrite exists and the input held a secret. */
    redactedText?: string;
    /** Always populated. See AGENT_TOOL_COVERAGE. */
    coverage: string;
}

/** Findings → the trimmed, agent-facing shape. Raw match text never survives. */
function present(findings: readonly Finding[]): AgentToolResult["findings"] {
    return findings.slice(0, 10).map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        evidence: finding.redactedEvidence,
    }));
}

/** The empty-input answer, shared so all three tools agree on it. */
function nothingToCheck(what: string): AgentToolResult {
    return {
        verdict: "allow",
        riskScore: 0,
        summary: `No ${what} was supplied, so there is nothing to check.`,
        findings: [],
        coverage: AGENT_TOOL_COVERAGE,
    };
}

/**
 * `soterai_scan_text` — is this text safe to send to a model or write to a file?
 *
 * Delegates to the existing egress firewall rather than re-deriving a verdict,
 * so the agent path and the human path (Scan Before Sending to AI) cannot
 * disagree about the same string. The mapping to three verdicts is the only new
 * logic: BLOCK stays block, REDACT and ASK both become warn, because a redacted
 * copy is a way forward rather than a refusal, and an agent that treats "I have
 * a safe version for you" as a hard stop is less useful and no safer.
 */
export function scanText(text: unknown): AgentToolResult {
    const input = typeof text === "string" ? text : "";
    if (!input.trim()) return nothingToCheck("text");

    const egress = evaluateEgress(input);
    const verdict: AgentVerdict = egress.decision === "BLOCK" ? "block" : egress.decision === "ALLOW" ? "allow" : "warn";
    const hidden = egress.obfuscationVariants.length
        ? ` Detected only after de-obfuscation (${egress.obfuscationVariants.join(", ")}), so the raw text looked clean.`
        : "";

    return {
        verdict,
        riskScore: egress.riskScore,
        summary: `${egress.reason}${hidden}`,
        findings: present(egress.findings),
        // Only offered when the input actually held a secret. Returning the
        // original text under a "redacted" label would be worse than omitting it.
        ...(egress.redactedText ? { redactedText: egress.redactedText } : {}),
        coverage: AGENT_TOOL_COVERAGE,
    };
}

/**
 * `soterai_check_command` — is this shell command safe to run?
 *
 * Runs the 22-pattern terminal detector the product already ships. The severity
 * mapping is intentionally stricter than `scanText`: a critical match here means
 * fork bomb, `curl | bash`, reverse shell, or a read of `.aws/credentials`, and
 * none of those have a "proceed with care" reading.
 *
 * Note this is the command *as text*. A command assembled at runtime, or one
 * whose danger lives in a script it invokes, is outside what any regex can see.
 */
export function checkCommand(command: unknown): AgentToolResult {
    const input = typeof command === "string" ? command : "";
    if (!input.trim()) return nothingToCheck("command");

    const detected = detectTerminalCommandRisk(input);
    const findings = minimizeEvidence(detected.matches, "TerminalCommandRiskDetector");
    if (findings.length === 0) {
        return {
            verdict: "allow",
            riskScore: 0,
            summary:
                "No known dangerous pattern matched this command. " +
                "This is a pattern check, not proof the command is safe — it cannot see what a script it calls will do.",
            findings: [],
            coverage: AGENT_TOOL_COVERAGE,
        };
    }

    const riskScore = Math.min(100, detected.matches.reduce((total, match) => total + match.score, 0));
    const critical = findings.filter((finding) => finding.severity === "critical");
    const verdict: AgentVerdict = critical.length > 0 ? "block" : "warn";
    const named = (critical.length > 0 ? critical : findings).map((finding) => finding.title).join("; ");

    return {
        verdict,
        riskScore,
        summary:
            verdict === "block"
                ? `Do not run this command. It matches: ${named}. Tell the user what it would do and ask before proceeding.`
                : `This command matches a risky pattern: ${named}. Confirm with the user before running it.`,
        findings: present(findings),
        coverage: AGENT_TOOL_COVERAGE,
    };
}

/** Highest risk wins, so one critical package cannot be averaged away. */
function worst(risks: readonly DependencyRisk[]): DependencyRisk["risk"] {
    const order = ["low", "medium", "high", "critical"] as const;
    let index = 0;
    for (const risk of risks) index = Math.max(index, order.indexOf(risk.risk));
    return order[index];
}

/**
 * `soterai_check_dependency` — is this package safe to install?
 *
 * Accepts either a whole install command (`npm i expres`, `pip install …`) or a
 * bare name + version, because an agent has both shapes to hand and forcing it
 * to parse the command first would just move the parsing bug into the agent.
 *
 * Heuristics only. `analyzeInstallCommand` is deliberately offline here: the OSV
 * lookup in `DepGuardCore` is a network call, and a tool an agent invokes on
 * every install must not silently reach the internet — that is a privacy
 * decision the user makes through `soterai.dependencyGuard.osvMode`, not one an
 * agent makes on their behalf. The summary says so rather than implying CVE
 * coverage it does not have.
 */
export function checkDependency(input: unknown): AgentToolResult {
    const raw = input as { command?: unknown; name?: unknown; version?: unknown } | string | undefined;
    const command = typeof raw === "string" ? raw : typeof raw?.command === "string" ? raw.command : "";
    const name = typeof raw === "object" && typeof raw?.name === "string" ? raw.name : "";
    const version = typeof raw === "object" && typeof raw?.version === "string" ? raw.version : "";

    const risks = command.trim()
        ? analyzeInstallCommand(command)
        : name.trim()
            ? [analyzePackage(name.trim(), version.trim() || "latest")]
            : [];

    if (risks.length === 0) {
        return nothingToCheck("package or install command");
    }

    const level = worst(risks);
    const verdict: AgentVerdict = level === "critical" ? "block" : level === "low" ? "allow" : "warn";
    // Score, not a probability: aligned with the other two tools so an agent can
    // compare across them, derived from the worst level rather than a sum.
    const riskScore = level === "critical" ? 90 : level === "high" ? 70 : level === "medium" ? 40 : 5;

    const flagged = risks.filter((risk) => risk.reasons.length > 0);
    const detail = flagged
        .map((risk) => `${risk.name}@${risk.version}: ${risk.reasons.join("; ")}`)
        .join(" | ");
    const offline = " Local heuristics only — no CVE database was queried, so a known-vulnerable but well-named package can still pass.";

    return {
        verdict,
        riskScore,
        summary: flagged.length
            ? `${flagged.length} of ${risks.length} package(s) flagged. ${detail}.${offline}`
            : `${risks.length} package(s) checked, none matched a risk heuristic.${offline}`,
        findings: flagged.map((risk) => ({
            title: `${risk.name}@${risk.version}`,
            severity: risk.risk,
            // Package names and versions are not secrets, so this is the real
            // value rather than redacted evidence.
            evidence: risk.reasons.join("; "),
        })),
        coverage: AGENT_TOOL_COVERAGE,
    };
}

/**
 * The three tools, declared once.
 *
 * `package.json` must list the same names under `contributes.languageModelTools`
 * (VS Code refuses to register a tool that is not contributed), and the MCP
 * server must expose the same three. A test asserts all three lists agree,
 * because the failure mode otherwise is a tool that exists in the manifest,
 * never registers, and is silently absent from the agent's tool list.
 *
 * Names are `{verb}_{noun}` with the `soterai_` prefix, per VS Code's guidance.
 */
export const AGENT_TOOLS = [
    {
        name: "soterai_scan_text",
        run: (input: unknown) => scanText((input as { text?: unknown } | undefined)?.text),
    },
    {
        name: "soterai_check_command",
        run: (input: unknown) => checkCommand((input as { command?: unknown } | undefined)?.command),
    },
    {
        name: "soterai_check_dependency",
        run: (input: unknown) => checkDependency(input),
    },
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number]["name"];
