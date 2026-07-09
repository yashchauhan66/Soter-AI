import type { DetectorResult, Finding, GuardDecision, ScanOptions } from "./types";
import { detectSecrets, SECRET_DETECTOR_VERSION, detectEnvFile, ENV_FILE_DETECTOR_VERSION, detectPII, PII_DETECTOR_VERSION, detectIndiaPII, INDIA_PII_DETECTOR_VERSION, detectPromptInjection, PROMPT_INJECTION_DETECTOR_VERSION, detectJailbreak, JAILBREAK_DETECTOR_VERSION, detectFileContextRisk, FILE_CONTEXT_RISK_DETECTOR_VERSION, detectTerminalCommandRisk, TERMINAL_COMMAND_RISK_DETECTOR_VERSION, detectRepoInstructionPoisoning, REPO_INSTRUCTION_POISONING_DETECTOR_VERSION, detectMCPConfigRisk, MCP_CONFIG_RISK_DETECTOR_VERSION, detectAIGeneratedCodeRisk, AI_CODE_RISK_DETECTOR_VERSION, deduplicateMatches, collapseOverlappingMatches } from "./detectors";
import { minimizeEvidence, createEvidencePreview } from "./EvidenceMinimizer";
import { findSurvivingSecrets, redactForSharing } from "./Redactor";
import { PolicyEvaluator } from "./PolicyEvaluator";
import { HashCache, hashContent } from "./HashCache";

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
};

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
        const content = text.slice(0, options?.maxContentLength ?? this.maxContentLength);
        let inputHash: string;
        if (!options?.skipCache) {
            inputHash = await hashContent(content);
            const cached = this.hashCache.get(inputHash);
            if (cached) return cached;
        } else {
            inputHash = "";
        }
        // Run detectors
        const results = this.runDetectors(content, options);
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
        };
        // Cache result
        if (inputHash) {
            this.hashCache.set(inputHash, decision);
        }
        return decision;
    }

    private runDetectors(text: string, options?: ScanOptions): DetectorResult[] {
        const ctx = options?.context ?? "file";
        const results: DetectorResult[] = [];
        // Always run these
        results.push(detectSecrets(text));
        results.push(detectEnvFile(text));
        results.push(detectPII(text));
        results.push(detectIndiaPII(text));
        // Context-specific detectors
        if (ctx === "prompt" || ctx === "selection") {
            results.push(detectPromptInjection(text));
            results.push(detectJailbreak(text));
        }
        if (ctx === "file" || ctx === "workspace" || ctx === "selection") {
            results.push(detectFileContextRisk(text));
            results.push(detectAIGeneratedCodeRisk(text));
            results.push(detectRepoInstructionPoisoning(text));
            results.push(detectMCPConfigRisk(text));
        }
        if (ctx === "terminal") {
            results.push(detectTerminalCommandRisk(text));
        }
        if (ctx === "git") {
            results.push(detectFileContextRisk(text));
            results.push(detectAIGeneratedCodeRisk(text));
        }
        return results;
    }

    getCache(): HashCache { return this.hashCache; }
    getPolicyEvaluator(): PolicyEvaluator { return this.policyEvaluator; }
}
