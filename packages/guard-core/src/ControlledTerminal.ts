import { detectTerminalCommandRisk } from "./detectors";
import { RuntimePolicyEngine, type EnforcementAction, type ProtectionMode, type ReasonCode } from "./RuntimePolicyEngine";

export interface ControlledTerminalAnalysis {
    action: EnforcementAction;
    executable?: string;
    args: string[];
    riskScore: number;
    categories: string[];
    reasonCodes: Array<ReasonCode | "COMMAND_NOT_ALLOWLISTED" | "SHELL_SYNTAX_UNSUPPORTED" | "COMMAND_PARSE_ERROR">;
    explanation: string;
    coverageLevel: "STRONG_ENFORCEMENT";
    deterministic: true;
}

export interface ControlledTerminalOptions {
    protectionMode?: ProtectionMode;
    productionContext?: boolean;
}

const READ_ONLY_COMMANDS: Record<string, (args: string[]) => boolean> = {
    git: (args) => {
        const sub = args[0];
        if (sub === "status") return args.every((arg) => isSafeArg(arg));
        if (sub === "diff") return args.every((arg) => isSafeArg(arg) && !["--output", "--ext-diff"].includes(arg));
        if (sub === "log" || sub === "show") return args.every((arg) => isSafeArg(arg) && !arg.startsWith("--exec"));
        if (sub === "branch") return args.length === 2 && args[1] === "--show-current";
        return false;
    },
    npm: (args) => args.length === 1 && (args[0] === "--version" || args[0] === "-v"),
    node: (args) => args.length === 1 && (args[0] === "--version" || args[0] === "-v"),
    python: (args) => args.length === 1 && (args[0] === "--version" || args[0] === "-V"),
    python3: (args) => args.length === 1 && (args[0] === "--version" || args[0] === "-V"),
    pwd: (args) => args.length === 0,
    ls: (args) => args.every((arg) => /^-[A-Za-z]+$/.test(arg) || /^[A-Za-z0-9._/-]+$/.test(arg)),
};

export function analyzeControlledTerminalCommand(
    command: string,
    options: ControlledTerminalOptions = {},
): ControlledTerminalAnalysis {
    const parsed = parseCommandLine(command);
    const detector = detectTerminalCommandRisk(command);
    const categories = [...new Set(detector.matches.map((match) => match.type))].sort();
    let riskScore = Math.min(100, detector.matches.reduce((sum, match) => sum + match.score, 0));
    const localReasons: ControlledTerminalAnalysis["reasonCodes"] = [];

    if (!parsed.ok) {
        riskScore = Math.max(riskScore, parsed.reason === "SHELL_SYNTAX_UNSUPPORTED" ? 75 : 50);
        localReasons.push(parsed.reason);
    }

    const executable = parsed.ok ? normalizeExecutable(parsed.argv[0] ?? "") : undefined;
    const args = parsed.ok ? parsed.argv.slice(1) : [];
    if (parsed.ok && !isAllowlisted(executable, args)) {
        riskScore = Math.max(riskScore, 70);
        localReasons.push("COMMAND_NOT_ALLOWLISTED");
    }

    const policy = new RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode: options.protectionMode ?? "standard",
        coverageLevel: "STRONG_ENFORCEMENT",
        riskScore,
        categories,
        parserStatus: parsed.ok ? "parsed" : "failed_suspicious",
        reversible: false,
        productionContext: options.productionContext ?? terminalMentionsProduction(command),
    });

    const action = localReasons.length > 0 && policy.action !== "DENY" ? "DENY" : policy.action;
    const reasonCodes = [...localReasons, ...policy.reasonCodes];
    return {
        action,
        executable,
        args,
        riskScore,
        categories,
        reasonCodes,
        explanation: [
            localReasons.includes("COMMAND_NOT_ALLOWLISTED") ? "Command is outside the controlled read-only allowlist." : "",
            localReasons.includes("SHELL_SYNTAX_UNSUPPORTED") ? "Shell syntax is not supported in the controlled executor." : "",
            localReasons.includes("COMMAND_PARSE_ERROR") ? "Command could not be parsed into fixed argv." : "",
            policy.explanation,
        ].filter(Boolean).join(" "),
        coverageLevel: "STRONG_ENFORCEMENT",
        deterministic: true,
    };
}

function parseCommandLine(input: string): { ok: true; argv: string[] } | { ok: false; reason: "SHELL_SYNTAX_UNSUPPORTED" | "COMMAND_PARSE_ERROR" } {
    if (!input.trim() || input.length > 4096) return { ok: false, reason: "COMMAND_PARSE_ERROR" };
    const argv: string[] = [];
    let current = "";
    let quote: "'" | "\"" | undefined;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (!quote && /[\r\n|&;<>`$()]/.test(ch)) return { ok: false, reason: "SHELL_SYNTAX_UNSUPPORTED" };
        if (ch === "\\" && quote !== "'") {
            const next = input[i + 1];
            if (next === "\\" || next === quote || (!quote && next !== undefined && /\s/.test(next))) {
                i++;
                current += input[i];
            } else {
                current += ch;
            }
            continue;
        }
        if (ch === "'" || ch === "\"") {
            if (!quote) { quote = ch; continue; }
            if (quote === ch) { quote = undefined; continue; }
        }
        if (!quote && /\s/.test(ch)) {
            if (current) { argv.push(current); current = ""; }
            continue;
        }
        current += ch;
    }
    if (quote) return { ok: false, reason: "COMMAND_PARSE_ERROR" };
    if (current) argv.push(current);
    return argv.length ? { ok: true, argv } : { ok: false, reason: "COMMAND_PARSE_ERROR" };
}

function normalizeExecutable(value: string): string {
    const normalized = value.replace(/\\/g, "/").split("/").pop() ?? value;
    return normalized.toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");
}

function isAllowlisted(executable: string | undefined, args: string[]): boolean {
    if (!executable) return false;
    const rule = READ_ONLY_COMMANDS[executable];
    return Boolean(rule?.(args));
}

function isSafeArg(arg: string): boolean {
    return /^[A-Za-z0-9._/@:=,+-]+$/.test(arg) && !arg.startsWith("-c") && !arg.includes("..");
}

function terminalMentionsProduction(cmd: string): boolean {
    return /\b(?:prod|production|live|mainnet)\b|AWS_PROFILE\s*=\s*prod|kubectl\s+config\s+use-context\s+\S*prod/i.test(cmd);
}
