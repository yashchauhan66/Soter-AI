"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanBrokerRequest = scanBrokerRequest;
exports.shouldForward = shouldForward;
exports.messagesToForward = messagesToForward;
exports.scanBrokerResponse = scanBrokerResponse;
const DecisionEngine_1 = require("./DecisionEngine");
const Redactor_1 = require("./Redactor");
const OutputLeakScanner_1 = require("./OutputLeakScanner");
const SafeMode_1 = require("./SafeMode");
const Canary_1 = require("./Canary");
const TerminalCommandRiskDetector_1 = require("./detectors/TerminalCommandRiskDetector");
const AIGeneratedCodeRiskDetector_1 = require("./detectors/AIGeneratedCodeRiskDetector");
const HashCache_1 = require("./HashCache");
function joinMessages(messages) {
    return messages.map((m) => `${m.role}: ${m.content ?? ""}`).join("\n");
}
/**
 * Pick a scan context by message role. The model's OWN instructions
 * (system/developer/assistant) are not "prompt injection", so they skip the
 * injection/jailbreak detectors — but they are still fully scanned for secrets,
 * PII, and env leakage. Untrusted user/tool content gets the full injection pass.
 */
function contextForRole(role) {
    const r = role.toLowerCase();
    if (r === "user" || r === "tool" || r === "function")
        return "prompt";
    return "file"; // system | developer | assistant | anything else
}
/**
 * Scan an OpenAI/Anthropic-compatible request. Runs guard-core detectors over the
 * concatenated messages, checks for planted canaries, then escalates via Safe
 * Mode. Produces a redacted copy suitable for forwarding.
 */
async function scanBrokerRequest(messages, options = {}) {
    const engine = options.engine ?? new DecisionEngine_1.DecisionEngine();
    const joined = joinMessages(messages);
    const contentHash = await (0, HashCache_1.hashExactContent)(JSON.stringify(messages));
    let scannerError = false;
    let decision = "allow";
    let riskScore = 0;
    let categories = [];
    const findings = [];
    let evidencePreview = "";
    try {
        // Scan each message with a role-appropriate context, then aggregate.
        const catSet = new Set();
        for (const m of messages) {
            const result = await engine.scan(m.content ?? "", {
                context: contextForRole(m.role),
                maxContentLength: options.maxContentLength,
            });
            riskScore = Math.max(riskScore, result.riskScore);
            for (const c of result.categories)
                catSet.add(c);
            findings.push(...result.findings);
            decision = (0, SafeMode_1.strictest)(decision, result.decision);
            if (result.evidencePreview && !evidencePreview)
                evidencePreview = result.evidencePreview;
        }
        categories = [...catSet];
    }
    catch {
        // Fail closed: never forward content we could not scan.
        scannerError = true;
        decision = "block";
    }
    const canaryHits = options.canaries?.length ? (0, Canary_1.matchCanaries)(joined, options.canaries) : [];
    const canaryInRequest = canaryHits.length > 0;
    if (canaryInRequest && !categories.includes("canary"))
        categories = [...categories, "canary"];
    // Safe Mode escalation (never loosens).
    if (options.safeMode?.enabled) {
        decision = (0, SafeMode_1.applySafeMode)(options.safeMode.level, {
            baseAction: decision,
            categories,
            riskScore,
            canaryPresent: canaryInRequest,
            scannerError,
        });
    }
    else if (canaryInRequest) {
        decision = "block";
    }
    // Always compute a redacted copy so a redact/allow decision forwards safely.
    const redactedMessages = messages.map((m) => ({
        ...m,
        content: (0, Redactor_1.redactForSharing)(m.content ?? ""),
    }));
    const redacted = redactedMessages.some((m, i) => m.content !== (messages[i].content ?? ""));
    const survivors = (0, Redactor_1.findSurvivingSecrets)(joinMessages(redactedMessages));
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
function shouldForward(decision, approved) {
    if (decision === "block")
        return false;
    if (decision === "approval_required")
        return approved;
    return true; // allow | warn | redact
}
/** For redact/approval decisions the provider must receive the redacted copy. */
function messagesToForward(decision, original, redacted) {
    return decision === "redact" ? redacted : original;
}
/**
 * Scan a provider response for secrets, canary leaks, dangerous terminal
 * commands, unsafe generated code, and exfiltration instructions.
 */
async function scanBrokerResponse(text, options = {}) {
    const base = (0, OutputLeakScanner_1.scanAIOutput)(text, {
        canaries: options.canaries,
        placeholders: options.placeholders,
    });
    const contentHash = await (0, HashCache_1.hashExactContent)(text);
    const terminal = (0, TerminalCommandRiskDetector_1.detectTerminalCommandRisk)(text);
    const code = (0, AIGeneratedCodeRiskDetector_1.detectAIGeneratedCodeRisk)(text);
    const dangerousCommands = terminal.matches.length > 0;
    const unsafeCode = code.matches.length > 0;
    const exfiltration = base.categories.some((c) => c.startsWith("exfil") || c === "output_exfiltration");
    let decision = base.decision;
    if (base.canaryLeaked)
        decision = "block";
    else if (dangerousCommands)
        decision = decision === "allow" ? "warn" : decision;
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
//# sourceMappingURL=BrokerScanner.js.map