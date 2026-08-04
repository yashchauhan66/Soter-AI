/**
 * Gap A + Gap B — Outbound AI-call Egress Firewall with obfuscation-resistant scoring.
 *
 * Gap A: any text a user or tool is about to send to an AI endpoint passes through
 * evaluateEgress(), which returns ALLOW / REDACT / ASK / BLOCK. This is the single
 * choke point every SoterAI-mediated send routes through, and the hook that future
 * wrappers around Copilot/Cursor/Continue (Gap E) will call.
 *
 * Gap B: the text is folded through the deterministic normalizers in
 * ./unicodeFolding (zero-width strip, homoglyph fold, leetspeak, letter-spacing,
 * reversal, base64) and the guard-core detectors are re-run on every variant, so
 * smuggled injection that evades a single-pass regex still scores. No model
 * download, no cloud call.
 *
 * HONESTY: this is a choke point for content SoterAI is asked to send or approve.
 * VS Code exposes no network-interception API, so traffic another extension sends
 * directly to a provider is NOT intercepted here. See EGRESS_COVERAGE.
 */
import {
    detectSecrets,
    detectPromptInjection,
    detectJailbreak,
    detectOutputExfiltration,
    redactText,
    minimizeEvidence,
    type DetectorMatch,
    type Finding,
} from "@soterai/guard-core";
import { detectObfuscation, obfuscationVariants } from "./unicodeFolding";

export type EgressDecision = "ALLOW" | "REDACT" | "ASK" | "BLOCK";

/** What this module can and cannot honestly claim (mirrors the capability registry). */
export const EGRESS_COVERAGE = {
    level: "PARTIAL_ENFORCEMENT",
    enforcedFor: "Text routed through a SoterAI send/approve/paste command or the local broker",
    notEnforcedFor: "Direct HTTP from other extensions, terminals, or processes — VS Code exposes no network hook",
} as const;

export interface EgressResult {
    decision: EgressDecision;
    riskScore: number;
    /** Minimized findings — redacted evidence only, safe to log or ledger. */
    findings: Finding[];
    obfuscationScore: number;
    /** Which de-obfuscation variants surfaced a detection the raw text hid. */
    obfuscationVariants: string[];
    redactedText?: string;
    reason: string;
}

/** Known AI endpoints whose outbound payloads should be evaluated (Gap A/E). */
export const AI_EGRESS_HOSTS = [
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.copilot.github.com",
    "api.githubcopilot.com",
    "cursor.sh",
    "api.continue.dev",
    "openrouter.ai",
    "api.mistral.ai",
    "api.cohere.ai",
    "api.groq.com",
    "api.deepseek.com",
    "api.x.ai",
];

export function isAiEgressHost(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return AI_EGRESS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
        return false;
    }
}

/** Run every guard-core detector over one text variant. */
function scanVariant(text: string): { secrets: DetectorMatch[]; attack: DetectorMatch[] } {
    return {
        secrets: detectSecrets(text).matches,
        attack: [
            ...detectPromptInjection(text).matches,
            ...detectJailbreak(text).matches,
            ...detectOutputExfiltration(text).matches,
        ],
    };
}

/** Merge matches found across variants, keeping the highest score per finding. */
function mergeMatches(all: DetectorMatch[]): DetectorMatch[] {
    const seen = new Map<string, DetectorMatch>();
    for (const m of all) {
        const key = `${m.type}:${m.label}:${m.match}`;
        const prev = seen.get(key);
        if (!prev || m.score > prev.score) seen.set(key, m);
    }
    return [...seen.values()];
}

/**
 * Central pre-send decision. Call before any outbound AI request body is built.
 * - BLOCK: secrets combined with an active injection or clear obfuscation.
 * - REDACT: secrets present, no injection — a safe copy is provided.
 * - ASK: injection/jailbreak or heavy obfuscation without secrets; user decides.
 * - ALLOW: clean.
 */
export function evaluateEgress(text: string): EgressResult {
    const input = typeof text === "string" ? text : "";
    if (!input.trim()) {
        return { decision: "ALLOW", riskScore: 0, findings: [], obfuscationScore: 0, obfuscationVariants: [], reason: "Nothing to send." };
    }

    const secretMatches: DetectorMatch[] = [];
    const attackMatches: DetectorMatch[] = [];
    const hitVariants: string[] = [];

    for (const variant of obfuscationVariants(input)) {
        const { secrets, attack } = scanVariant(variant.text);
        if ((secrets.length || attack.length) && variant.name !== "raw" && !hitVariants.includes(variant.name)) {
            hitVariants.push(variant.name);
        }
        secretMatches.push(...secrets);
        attackMatches.push(...attack);
    }

    const secrets = mergeMatches(secretMatches);
    const attacks = mergeMatches(attackMatches);
    const obfusc = detectObfuscation(input);

    const findings: Finding[] = [
        ...minimizeEvidence(secrets, "SecretDetector"),
        ...minimizeEvidence(attacks, "EgressAttackDetectors"),
    ];

    const secretScore = secrets.reduce((a, s) => a + s.score, 0);
    const attackScore = attacks.reduce((a, s) => a + s.score, 0);
    const riskScore = Math.min(100, secretScore + attackScore + Math.round(obfusc / 2));

    const base = { riskScore, findings, obfuscationScore: obfusc, obfuscationVariants: hitVariants };

    // Redaction only ever uses matches found in the RAW text: offsets from a
    // folded variant do not map back onto the original string.
    const rawSecrets = detectSecrets(input).matches;
    const safeCopy = rawSecrets.length ? redactText(input, rawSecrets) : undefined;

    if (secrets.length && (attacks.length || obfusc >= 30)) {
        return { ...base, decision: "BLOCK", redactedText: safeCopy, reason: "Secrets combined with injection/obfuscation — too risky to send." };
    }
    if (secrets.length) {
        return { ...base, decision: "REDACT", redactedText: safeCopy, reason: "Secrets detected — send the redacted copy instead." };
    }
    if (attacks.length || obfusc >= 40) {
        return {
            ...base,
            decision: "ASK",
            reason: hitVariants.length
                ? `Possible prompt-injection hidden via ${hitVariants.join(", ")} — confirm intent before sending.`
                : "Possible prompt-injection/obfuscation — confirm intent before sending.",
        };
    }
    return { ...base, decision: "ALLOW", reason: "No risky content detected." };
}

/**
 * Combine the content decision with the destination. A clean payload heading to
 * a non-allowlisted host still warrants an ASK; one carrying secrets escalates
 * to BLOCK.
 */
export function evaluateEgressToHost(text: string, url: string, allowedHosts: string[] = AI_EGRESS_HOSTS): EgressResult {
    const result = evaluateEgress(text);
    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return { ...result, decision: result.decision === "ALLOW" ? "ASK" : result.decision, reason: `${result.reason} Destination URL could not be parsed.` };
    }
    const approved = allowedHosts.some((h) => host === h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`));
    if (approved) return result;

    if (result.decision === "REDACT" || result.decision === "BLOCK") {
        return { ...result, decision: "BLOCK", reason: `${result.reason} Destination ${host} is not on the approved AI host list.` };
    }
    return {
        ...result,
        decision: "ASK",
        riskScore: Math.max(result.riskScore, 40),
        reason: `${result.reason} Destination ${host} is not on the approved AI host list.`,
    };
}
