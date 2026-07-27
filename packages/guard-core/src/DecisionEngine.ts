import type {
    DetectorResult,
    Finding,
    GuardDecision,
    ScanOptions,
    ScanPipeline,
    ScanPipelineReport,
} from "./types";
import { detectSecrets, SECRET_DETECTOR_VERSION, detectEnvFile, ENV_FILE_DETECTOR_VERSION, detectPII, PII_DETECTOR_VERSION, detectIndiaPII, INDIA_PII_DETECTOR_VERSION, detectPromptInjection, PROMPT_INJECTION_DETECTOR_VERSION, detectJailbreak, JAILBREAK_DETECTOR_VERSION, detectFileContextRisk, FILE_CONTEXT_RISK_DETECTOR_VERSION, detectTerminalCommandRisk, TERMINAL_COMMAND_RISK_DETECTOR_VERSION, detectRepoInstructionPoisoning, REPO_INSTRUCTION_POISONING_DETECTOR_VERSION, detectMCPConfigRisk, MCP_CONFIG_RISK_DETECTOR_VERSION, detectAIGeneratedCodeRisk, AI_CODE_RISK_DETECTOR_VERSION, deduplicateMatches, collapseOverlappingMatches } from "./detectors";
import { minimizeEvidence, createEvidencePreview } from "./EvidenceMinimizer";
import { findSurvivingSecrets, redactForSharing } from "./Redactor";
import { PolicyEvaluator } from "./PolicyEvaluator";
import { HashCache, hashContent } from "./HashCache";

/** Bump when detector selection / pipeline semantics change (invalidates cache). */
export const SCAN_PIPELINE_VERSION = "1.1.0";

export const DETECTOR_VERSIONS: Record<string, string> = {
    SecretDetector: SECRET_DETECTOR_VERSION,
    EnvFileDetector: ENV_FILE_DETECTOR_VERSION,
    PIIDetector: PII_DETECTOR_VERSION,
    IndiaPIIDetector: INDIA_PII_DETECTOR_VERSION,
    PromptInjectionLiteDetector: PROMPT_INJECTION_DETECTOR_VERSION,
    JailbreakLiteDetector: JAILBREAK_DETECTOR_VERSION,
    FileContextRiskDetector: FILE_CONTEXT_RISK_DETECTOR_VERSION,
    TerminalCommandRiskDetector: TERMINAL_COMMAND_RISK_DETECTOR_VERSION,
    RepoInstructionPoisoningDetector: REPO_INSTRUCTION_POISONING_DETECTOR_VERSION,
    MCPConfigRiskDetector: MCP_CONFIG_RISK_DETECTOR_VERSION,
    AIGeneratedCodeRiskDetector: AI_CODE_RISK_DETECTOR_VERSION,
    ScanPipeline: SCAN_PIPELINE_VERSION,
};

/**
 * Shared scan-policy for every entry path (live scan, manual scan, clipboard,
 * broker preflight, etc.). Callers must not invent private detector lists.
 */
export function resolveScanPipeline(context: ScanOptions["context"] = "file"): ScanPipeline {
    const ctx = context ?? "file";
    return {
        secretDetection: true,
        piiDetection: true,
        // Live file/workspace paths must run the same injection detectors as
        // prompt/selection — otherwise marketplace "prompt-injection" claims
        // for live scan are false (verified gap, fixed in pipeline 1.1.0).
        promptInjectionDetection:
            ctx === "prompt" || ctx === "selection" || ctx === "file" || ctx === "workspace" || ctx === "git",
        jailbreakDetection:
            ctx === "prompt" || ctx === "selection" || ctx === "file" || ctx === "workspace" || ctx === "git",
        unsafeCodeDetection:
            ctx === "file" || ctx === "workspace" || ctx === "selection" || ctx === "git",
        dependencyDetection: false, // separate DepGuard path; not content-regex
        provenanceAnalysis:
            ctx === "file" || ctx === "workspace" || ctx === "selection",
    };
}

export class DecisionEngine {
    private policyEvaluator: PolicyEvaluator;
    private hashCache: HashCache;
    private maxContentLength: number;

    constructor(opts?: { policyEvaluator?: PolicyEvaluator; hashCache?: HashCache; maxContentLength?: number }) {
        this.policyEvaluator = opts?.policyEvaluator ?? new PolicyEvaluator();
        this.hashCache = opts?.hashCache ?? new HashCache({ detectorVersions: DETECTOR_VERSIONS });
        this.maxContentLength = opts?.maxContentLength ?? 500_000;
    }

    async scan(text: string, options?: ScanOptions): Promise<GuardDecision> {
        const started = Date.now();
        const content = text.slice(0, options?.maxContentLength ?? this.maxContentLength);
        let inputHash: string;
        if (!options?.skipCache) {
            inputHash = await hashContent(content);
            const cached = this.hashCache.get(inputHash);
            if (cached) return cached;
        } else {
            inputHash = "";
        }
        // Run detectors via the shared pipeline (single source of truth).
        const { results, pipelineReport } = this.runDetectors(content, options);
        const allMatches = deduplicateMatches(results.flatMap((r) => r.matches));
        // Build findings
        const findings: Finding[] = [];
        for (const r of results) {
            findings.push(...minimizeEvidence(r.matches, r.detectorName));
        }
        // Calculate risk score on overlap-collapsed matches so a single secret
        // matched by multiple patterns is not counted twice.
        const scoringMatches = collapseOverlappingMatches(allMatches);
        const riskScore = Math.min(100, scoringMatches.reduce((sum, m) => sum + m.score, 0));
        const categories = [...new Set(scoringMatches.map((m) => m.type))].sort();
        // Evaluate policy
        const { action, severity } = this.policyEvaluator.evaluate(riskScore, categories);

        // Always compute a safety-net redaction. Even if no detector fired, the
        // pattern pass can catch secrets the detectors missed. Only expose a
        // redactedText when redaction actually changed the content so callers
        // never receive (and cache) raw input verbatim.
        const redacted = redactForSharing(content, allMatches);
        const redactedText = redacted !== content ? redacted : undefined;

        // Hard invariant: redactedText must never contain a raw high-risk secret.
        if (redactedText) {
            const survivors = findSurvivingSecrets(redactedText);
            if (survivors.length > 0) {
                throw new Error(`Redaction invariant violated — secrets survived: ${survivors.join(", ")}`);
            }
        }

        pipelineReport.durationMs = Date.now() - started;

        const decision: GuardDecision = {
            decision: action,
            riskScore,
            severity,
            categories,
            findings,
            redactedText,
            evidencePreview: createEvidencePreview(findings),
            inputHash,
            detectorVersions: DETECTOR_VERSIONS,
            localOnly: true,
            createdAt: new Date().toISOString(),
            pipeline: pipelineReport,
        };
        // Cache result
        if (inputHash) {
            this.hashCache.set(inputHash, decision);
        }
        return decision;
    }

    /**
     * Shared detector selection. Every scan path (live, manual, clipboard,
     * broker) must go through this so detector lists cannot drift.
     */
    private runDetectors(
        text: string,
        options?: ScanOptions,
    ): { results: DetectorResult[]; pipelineReport: ScanPipelineReport } {
        const ctx = options?.context ?? "file";
        const pipeline = resolveScanPipeline(ctx);
        const results: DetectorResult[] = [];
        const executed: string[] = [];
        const skipped: Array<{ detector: string; reason: string }> = [];

        const run = (name: string, enabled: boolean, fn: () => DetectorResult, skipReason?: string) => {
            if (!enabled) {
                skipped.push({ detector: name, reason: skipReason ?? `disabled for context=${ctx}` });
                return;
            }
            results.push(fn());
            executed.push(name);
        };

        // Always-on content detectors
        run("SecretDetector", pipeline.secretDetection, () => detectSecrets(text));
        run("EnvFileDetector", pipeline.secretDetection, () => detectEnvFile(text));
        run("PIIDetector", pipeline.piiDetection, () => detectPII(text));
        run("IndiaPIIDetector", pipeline.piiDetection, () => detectIndiaPII(text));

        // Injection / jailbreak — required for live file scan parity (pipeline 1.1.0)
        run(
            "PromptInjectionLiteDetector",
            pipeline.promptInjectionDetection,
            () => detectPromptInjection(text),
            "promptInjectionDetection=false for this context",
        );
        run(
            "JailbreakLiteDetector",
            pipeline.jailbreakDetection,
            () => detectJailbreak(text),
            "jailbreakDetection=false for this context",
        );

        // File / workspace / selection structural detectors
        const fileish = ctx === "file" || ctx === "workspace" || ctx === "selection";
        run(
            "FileContextRiskDetector",
            pipeline.unsafeCodeDetection && (fileish || ctx === "git"),
            () => detectFileContextRisk(text),
        );
        run(
            "AIGeneratedCodeRiskDetector",
            pipeline.unsafeCodeDetection && (fileish || ctx === "git"),
            () => detectAIGeneratedCodeRisk(text),
        );
        run(
            "RepoInstructionPoisoningDetector",
            pipeline.provenanceAnalysis && fileish,
            () => detectRepoInstructionPoisoning(text),
        );
        run(
            "MCPConfigRiskDetector",
            pipeline.provenanceAnalysis && fileish,
            () => detectMCPConfigRisk(text),
        );

        // Terminal-only
        run(
            "TerminalCommandRiskDetector",
            ctx === "terminal",
            () => detectTerminalCommandRisk(text),
            "only runs for context=terminal",
        );

        if (!pipeline.dependencyDetection) {
            skipped.push({
                detector: "DependencyGuard",
                reason: "dependency intelligence is a separate path (DepGuard), not content-regex",
            });
        }

        const pipelineReport: ScanPipelineReport = {
            version: SCAN_PIPELINE_VERSION,
            context: ctx,
            pipeline,
            detectorsExecuted: executed,
            detectorsSkipped: skipped,
            // Live scan is visibility/detection — not pre-execution enforcement.
            protectionLevel:
                ctx === "terminal"
                    ? "DETECTION_ONLY"
                    : ctx === "prompt" || ctx === "selection"
                      ? "DETECTION_ONLY"
                      : "VISIBILITY_ONLY",
            durationMs: 0,
        };

        return { results, pipelineReport };
    }

    getCache(): HashCache { return this.hashCache; }
    getPolicyEvaluator(): PolicyEvaluator { return this.policyEvaluator; }
}
