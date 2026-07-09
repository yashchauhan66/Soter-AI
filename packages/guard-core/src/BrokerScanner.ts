import type { Finding, GuardAction, ScanOptions } from "./types";
import { DecisionEngine } from "./DecisionEngine";
import { redactForSharing, findSurvivingSecrets } from "./Redactor";
import { scanAIOutput, type OutputScanResult } from "./OutputLeakScanner";
import { applySafeMode, strictest, type SafeModeLevel } from "./SafeMode";
import { matchCanaries, type Canary } from "./Canary";
import { detectTerminalCommandRisk } from "./detectors/TerminalCommandRiskDetector";
import { detectAIGeneratedCodeRisk } from "./detectors/AIGeneratedCodeRiskDetector";
import { hashContent } from "./HashCache";

/**
 * BrokerScanner — the guard-core brain the Local AI Broker uses to inspect
 * OpenAI/Anthropic-compatible requests and responses. Pure and local: it never
 * calls a provider, never logs raw content, and returns redacted evidence only.
 */

export interface BrokerMessage {
    role: string;
    content: string;
    name?: string;
}

export interface BrokerSafeModeInput {
    enabled: boolean;
    level: SafeModeLevel;
}

export interface BrokerRequestScanOptions {
    engine?: DecisionEngine;
    safeMode?: BrokerSafeModeInput;
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    maxContentLength?: number;
}

export interface BrokerRequestScanResult {
    decision: GuardAction;
    riskScore: number;
    categories: string[];
    findings: Finding[];
    evidencePreview: string;
    /** Redacted copy of the messages — safe to forward for redact/warn/allow. */
    redactedMessages: BrokerMessage[];
    redacted: boolean;
    canaryInRequest: boolean;
    /** SHA-256 of the joined message content (never the content itself). */
    contentHash: string;
    /** True when no raw high-risk secret survives redaction (invariant). */
    safe: boolean;
}

function joinMessages(messages: BrokerMessage[]): string {
    return messages.map((m) => `${m.role}: ${m.content ?? ""}`).join("\n");
}

/**
 * Pick a scan context by message role. The model's OWN instructions
 * (system/developer/assistant) are not "prompt injection", so they skip the
 * injection/jailbreak detectors — but they are still fully scanned for secrets,
 * PII, and env leakage. Untrusted user/tool content gets the full injection pass.
 */
function contextForRole(role: string): ScanOptions["context"] {
    const r = role.toLowerCase();
    if (r === "user" || r === "tool" || r === "function") return "prompt";
    return "file"; // system | developer | assistant | anything else
}

/**
 * Scan an OpenAI/Anthropic-compatible request. Runs guard-core detectors over the
 * concatenated messages, checks for planted canaries, then escalates via Safe
 * Mode. Produces a redacted copy suitable for forwarding.
 */
export async function scanBrokerRequest(
    messages: BrokerMessage[],
    options: BrokerRequestScanOptions = {},
): Promise<BrokerRequestScanResult> {
    const engine = options.engine ?? new DecisionEngine();
    const joined = joinMessages(messages);
    const contentHash = await hashContent(joined);

    let scannerError = false;
    let decision: GuardAction = "allow";
    let riskScore = 0;
    let categories: string[] = [];
    const findings: Finding[] = [];
    let evidencePreview = "";

    try {
        // Scan each message with a role-appropriate context, then aggregate.
        const catSet = new Set<string>();
        for (const m of messages) {
            const result = await engine.scan(m.content ?? "", {
                context: contextForRole(m.role),
                maxContentLength: options.maxContentLength,
            });
            riskScore = Math.max(riskScore, result.riskScore);
            for (const c of result.categories) catSet.add(c);
            findings.push(...result.findings);
            decision = strictest(decision, result.decision);
            if (result.evidencePreview && !evidencePreview) evidencePreview = result.evidencePreview;
        }
        categories = [...catSet];
    } catch {
        // Fail closed: never forward content we could not scan.
        scannerError = true;
        decision = "block";
    }

    const canaryHits = options.canaries?.length ? matchCanaries(joined, options.canaries) : [];
    const canaryInRequest = canaryHits.length > 0;
    if (canaryInRequest && !categories.includes("canary")) categories = [...categories, "canary"];

    // Safe Mode escalation (never loosens).
    if (options.safeMode?.enabled) {
        decision = applySafeMode(options.safeMode.level, {
            baseAction: decision,
            categories,
            riskScore,
            canaryPresent: canaryInRequest,
            scannerError,
        });
    } else if (canaryInRequest) {
        decision = "block";
    }

    // Always compute a redacted copy so a redact/allow decision forwards safely.
    const redactedMessages = messages.map((m) => ({
        ...m,
        content: redactForSharing(m.content ?? ""),
    }));
    const redacted = redactedMessages.some((m, i) => m.content !== (messages[i].content ?? ""));

    const survivors = findSurvivingSecrets(joinMessages(redactedMessages));
    const safe = survivors.length === 0;

    return {
        decision,
        riskScore: canaryInRequest ? 100 : riskScore,
        categories: [...new Set(categories)].sort(),
        findings,
        evidencePreview,
        redactedMessages,
        redacted,
        canaryInRequest,
        contentHash,
        safe,
    };
}

/** True when the broker should forward to the provider for a given decision. */
export function shouldForward(decision: GuardAction, approved: boolean): boolean {
    if (decision === "block") return false;
    if (decision === "approval_required") return approved;
    return true; // allow | warn | redact
}

/** For redact/approval decisions the provider must receive the redacted copy. */
export function messagesToForward(
    decision: GuardAction,
    original: BrokerMessage[],
    redacted: BrokerMessage[],
): BrokerMessage[] {
    return decision === "redact" ? redacted : original;
}

// ─── Response scanning ───────────────────────────────────────────────────────

export interface BrokerResponseScanOptions {
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    placeholders?: string[];
}

export interface BrokerResponseScanResult extends OutputScanResult {
    contentHash: string;
    dangerousCommands: boolean;
    unsafeCode: boolean;
    exfiltration: boolean;
}

/**
 * Scan a provider response for secrets, canary leaks, dangerous terminal
 * commands, unsafe generated code, and exfiltration instructions.
 */
export async function scanBrokerResponse(
    text: string,
    options: BrokerResponseScanOptions = {},
): Promise<BrokerResponseScanResult> {
    const base = scanAIOutput(text, {
        canaries: options.canaries,
        placeholders: options.placeholders,
    });
    const contentHash = await hashContent(text);

    const terminal = detectTerminalCommandRisk(text);
    const code = detectAIGeneratedCodeRisk(text);
    const dangerousCommands = terminal.matches.length > 0;
    const unsafeCode = code.matches.length > 0;
    const exfiltration = base.categories.some((c) => c.startsWith("exfil") || c === "output_exfiltration");

    let decision = base.decision;
    if (base.canaryLeaked) decision = "block";
    else if (dangerousCommands) decision = decision === "allow" ? "warn" : decision;

    const categories = [
        ...new Set([
            ...base.categories,
            ...(dangerousCommands ? ["dangerous_command"] : []),
            ...(unsafeCode ? ["unsafe_code"] : []),
        ]),
    ].sort();

    return {
        ...base,
        decision,
        categories,
        contentHash,
        dangerousCommands,
        unsafeCode,
        exfiltration,
    };
}
