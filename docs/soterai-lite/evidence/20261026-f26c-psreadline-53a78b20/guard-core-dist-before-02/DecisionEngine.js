"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionEngine = exports.DETECTOR_VERSIONS = exports.SCAN_PIPELINE_VERSION = void 0;
exports.resolveScanPipeline = resolveScanPipeline;
const detectors_1 = require("./detectors");
const EvidenceMinimizer_1 = require("./EvidenceMinimizer");
const Redactor_1 = require("./Redactor");
const PolicyEvaluator_1 = require("./PolicyEvaluator");
const HashCache_1 = require("./HashCache");
/** Bump when detector selection / pipeline semantics change (invalidates cache). */
exports.SCAN_PIPELINE_VERSION = "1.3.0";
exports.DETECTOR_VERSIONS = {
    SecretDetector: detectors_1.SECRET_DETECTOR_VERSION,
    EncodedSecretDetector: detectors_1.ENCODED_SECRET_DETECTOR_VERSION,
    EnvFileDetector: detectors_1.ENV_FILE_DETECTOR_VERSION,
    PIIDetector: detectors_1.PII_DETECTOR_VERSION,
    IndiaPIIDetector: detectors_1.INDIA_PII_DETECTOR_VERSION,
    PromptInjectionLiteDetector: detectors_1.PROMPT_INJECTION_DETECTOR_VERSION,
    JailbreakLiteDetector: detectors_1.JAILBREAK_DETECTOR_VERSION,
    FileContextRiskDetector: detectors_1.FILE_CONTEXT_RISK_DETECTOR_VERSION,
    TerminalCommandRiskDetector: detectors_1.TERMINAL_COMMAND_RISK_DETECTOR_VERSION,
    RepoInstructionPoisoningDetector: detectors_1.REPO_INSTRUCTION_POISONING_DETECTOR_VERSION,
    MCPConfigRiskDetector: detectors_1.MCP_CONFIG_RISK_DETECTOR_VERSION,
    AIGeneratedCodeRiskDetector: detectors_1.AI_CODE_RISK_DETECTOR_VERSION,
    ScanPipeline: exports.SCAN_PIPELINE_VERSION,
};
/**
 * Shared scan-policy for every entry path (live scan, manual scan, clipboard,
 * broker preflight, etc.). Callers must not invent private detector lists.
 */
function resolveScanPipeline(context = "file") {
    const ctx = context ?? "file";
    return {
        secretDetection: true,
        piiDetection: true,
        // Live file/workspace paths must run the same injection detectors as
        // prompt/selection — otherwise marketplace "prompt-injection" claims
        // for live scan are false (verified gap, fixed in pipeline 1.1.0).
        promptInjectionDetection: ctx === "prompt" || ctx === "selection" || ctx === "file" || ctx === "workspace" || ctx === "git",
        jailbreakDetection: ctx === "prompt" || ctx === "selection" || ctx === "file" || ctx === "workspace" || ctx === "git",
        unsafeCodeDetection: ctx === "file" || ctx === "workspace" || ctx === "selection" || ctx === "git",
        dependencyDetection: false, // separate DepGuard path; not content-regex
        provenanceAnalysis: ctx === "file" || ctx === "workspace" || ctx === "selection",
    };
}
class DecisionEngine {
    policyEvaluator;
    hashCache;
    maxContentLength;
    constructor(opts) {
        this.policyEvaluator = opts?.policyEvaluator ?? new PolicyEvaluator_1.PolicyEvaluator();
        this.hashCache = opts?.hashCache ?? new HashCache_1.HashCache({ detectorVersions: exports.DETECTOR_VERSIONS });
        this.maxContentLength = opts?.maxContentLength ?? 500_000;
    }
    async scan(text, options) {
        const started = Date.now();
        const limit = options?.maxContentLength ?? this.maxContentLength;
        if (!Number.isSafeInteger(limit) || limit <= 0 || text.length > limit) {
            return {
                decision: "block", riskScore: 100, severity: "high", categories: ["scan_incomplete"],
                findings: [], redactedText: "[Content withheld: scan size limit exceeded or invalid]",
                evidencePreview: "Content was not fully scanned; sharing is blocked.", inputHash: "",
                detectorVersions: exports.DETECTOR_VERSIONS, localOnly: true, createdAt: new Date().toISOString(),
            };
        }
        const content = text;
        let cacheKey = "";
        let inputHash;
        if (!options?.skipCache) {
            inputHash = await (0, HashCache_1.hashExactContent)(content);
            cacheKey = await (0, HashCache_1.hashExactContent)(JSON.stringify([
                inputHash, options?.context ?? "file", this.policyEvaluator.getPolicy(), exports.DETECTOR_VERSIONS,
            ]));
            const cached = this.hashCache.get(cacheKey);
            if (cached)
                return cached;
        }
        else {
            inputHash = "";
        }
        // Run detectors via the shared pipeline (single source of truth).
        const { results, pipelineReport } = this.runDetectors(content, options);
        const allMatches = (0, detectors_1.deduplicateMatches)(results.flatMap((r) => r.matches));
        // Build findings
        const findings = [];
        for (const r of results) {
            findings.push(...(0, EvidenceMinimizer_1.minimizeEvidence)(r.matches, r.detectorName));
        }
        // Calculate risk score on overlap-collapsed matches so a single secret
        // matched by multiple patterns is not counted twice.
        const scoringMatches = (0, detectors_1.collapseOverlappingMatches)(allMatches);
        const riskScore = Math.min(100, scoringMatches.reduce((sum, m) => sum + m.score, 0));
        const categories = [...new Set(scoringMatches.map((m) => m.type))].sort();
        // Evaluate policy
        const { action, severity } = this.policyEvaluator.evaluate(riskScore, categories);
        // Always compute a safety-net redaction. Even if no detector fired, the
        // pattern pass can catch secrets the detectors missed. Only expose a
        // redactedText when redaction actually changed the content so callers
        // never receive (and cache) raw input verbatim.
        const redacted = (0, Redactor_1.redactForSharing)(content, allMatches);
        const redactedText = redacted !== content ? redacted : undefined;
        // Hard invariant: redactedText must never contain a raw high-risk secret.
        if (redactedText) {
            const survivors = (0, Redactor_1.findSurvivingSecrets)(redactedText);
            if (survivors.length > 0) {
                throw new Error(`Redaction invariant violated — secrets survived: ${survivors.join(", ")}`);
            }
        }
        pipelineReport.durationMs = Date.now() - started;
        const decision = {
            decision: action,
            riskScore,
            severity,
            categories,
            findings,
            redactedText,
            evidencePreview: (0, EvidenceMinimizer_1.createEvidencePreview)(findings),
            inputHash,
            detectorVersions: exports.DETECTOR_VERSIONS,
            localOnly: true,
            createdAt: new Date().toISOString(),
            pipeline: pipelineReport,
        };
        // Cache result
        if (cacheKey) {
            this.hashCache.set(cacheKey, decision);
        }
        return decision;
    }
    /**
     * Shared detector selection. Every scan path (live, manual, clipboard,
     * broker) must go through this so detector lists cannot drift.
     */
    runDetectors(text, options) {
        const ctx = options?.context ?? "file";
        const pipeline = resolveScanPipeline(ctx);
        const results = [];
        const executed = [];
        const skipped = [];
        const run = (name, enabled, fn, skipReason) => {
            if (!enabled) {
                skipped.push({ detector: name, reason: skipReason ?? `disabled for context=${ctx}` });
                return;
            }
            results.push(fn());
            executed.push(name);
        };
        // Always-on content detectors
        run("SecretDetector", pipeline.secretDetection, () => (0, detectors_1.detectSecrets)(text));
        // Same gate as SecretDetector: catches a credential that was ENCODED
        // (base64/hex) to slip past the plaintext rules, by decoding and
        // re-scanning. Closes the T4 gap the Leak Range harness measured.
        run("EncodedSecretDetector", pipeline.secretDetection, () => (0, detectors_1.detectEncodedSecrets)(text));
        run("EnvFileDetector", pipeline.secretDetection, () => (0, detectors_1.detectEnvFile)(text));
        run("PIIDetector", pipeline.piiDetection, () => (0, detectors_1.detectPII)(text));
        run("IndiaPIIDetector", pipeline.piiDetection, () => (0, detectors_1.detectIndiaPII)(text));
        // Injection / jailbreak — required for live file scan parity (pipeline 1.1.0)
        run("PromptInjectionLiteDetector", pipeline.promptInjectionDetection, () => (0, detectors_1.detectPromptInjection)(text), "promptInjectionDetection=false for this context");
        run("JailbreakLiteDetector", pipeline.jailbreakDetection, () => (0, detectors_1.detectJailbreak)(text), "jailbreakDetection=false for this context");
        // File / workspace / selection structural detectors
        const fileish = ctx === "file" || ctx === "workspace" || ctx === "selection";
        run("FileContextRiskDetector", pipeline.unsafeCodeDetection && (fileish || ctx === "git"), () => (0, detectors_1.detectFileContextRisk)(text));
        run("AIGeneratedCodeRiskDetector", pipeline.unsafeCodeDetection && (fileish || ctx === "git"), () => (0, detectors_1.detectAIGeneratedCodeRisk)(text));
        run("RepoInstructionPoisoningDetector", pipeline.provenanceAnalysis && fileish, () => (0, detectors_1.detectRepoInstructionPoisoning)(text));
        run("MCPConfigRiskDetector", pipeline.provenanceAnalysis && fileish, () => (0, detectors_1.detectMCPConfigRisk)(text));
        // Terminal-only
        run("TerminalCommandRiskDetector", ctx === "terminal", () => (0, detectors_1.detectTerminalCommandRisk)(text), "only runs for context=terminal");
        if (!pipeline.dependencyDetection) {
            skipped.push({
                detector: "DependencyGuard",
                reason: "dependency intelligence is a separate path (DepGuard), not content-regex",
            });
        }
        const pipelineReport = {
            version: exports.SCAN_PIPELINE_VERSION,
            context: ctx,
            pipeline,
            detectorsExecuted: executed,
            detectorsSkipped: skipped,
            // Live scan is visibility/detection — not pre-execution enforcement.
            protectionLevel: ctx === "terminal"
                ? "DETECTION_ONLY"
                : ctx === "prompt" || ctx === "selection"
                    ? "DETECTION_ONLY"
                    : "VISIBILITY_ONLY",
            durationMs: 0,
        };
        return { results, pipelineReport };
    }
    getCache() { return this.hashCache; }
    getPolicyEvaluator() { return this.policyEvaluator; }
}
exports.DecisionEngine = DecisionEngine;
//# sourceMappingURL=DecisionEngine.js.map