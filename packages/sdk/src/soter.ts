import { GuardClient } from "./client";
import type {
  ClientOptions,
  GuardFinding,
  MetadataValue,
  SoterConfig,
  SoterProtectRequest,
  SoterProtectResult,
  SoterRiskLevel,
} from "./types";

type Environment = Record<string, string | undefined>;

function environment(): Environment {
  return (globalThis as { process?: { env?: Environment } }).process?.env ?? {};
}

function firstValue(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()));
}

/** Resolve Soter variables first while preserving the existing environment contract. */
export function resolveSoterConfig(config: SoterConfig = {}): ClientOptions {
  const env = environment();
  return {
    ...config,
    apiKey: firstValue(
      config.apiKey,
      env.SOTER_API_KEY,
      env.SOTERAI_API_KEY,
      env.CYBERGUARD_API_KEY,
      env.CYBERRAKSHAK_API_KEY,
      env.CYBERSECURITYGUARD_API_KEY,
    ) ?? "",
    projectId: firstValue(
      config.projectId,
      env.SOTER_PROJECT_ID,
      env.SOTERAI_PROJECT_ID,
      env.CYBERGUARD_PROJECT_ID,
      env.CYBERRAKSHAK_PROJECT_ID,
      env.CYBERSECURITYGUARD_PROJECT_ID,
    ),
    baseUrl: firstValue(
      config.baseUrl,
      env.SOTER_BASE_URL,
      env.SOTERAI_BASE_URL,
      env.CYBERGUARD_BASE_URL,
      env.CYBERRAKSHAK_BASE_URL,
      env.CYBERSECURITYGUARD_BASE_URL,
    ),
  };
}

function riskLevel(findings: GuardFinding[], score: number): SoterRiskLevel {
  const levels: SoterRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const findingLevel = findings.reduce<SoterRiskLevel | undefined>((highest, finding) => {
    if (!highest || levels.indexOf(finding.severity) > levels.indexOf(highest)) return finding.severity;
    return highest;
  }, undefined);
  if (findingLevel) return findingLevel;
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

/**
 * Primary Soter client. Existing GuardClient methods remain available for
 * integrations that need lower-level input, output, RAG, or agent controls.
 */
export class Soter extends GuardClient {
  constructor(config: SoterConfig = {}) {
    super(resolveSoterConfig(config));
  }

  async protect(request: SoterProtectRequest): Promise<SoterProtectResult> {
    const policyMetadata: Record<string, MetadataValue> = {};
    if (request.policy?.id) policyMetadata.soterPolicyId = request.policy.id;
    if (request.policy?.mode) policyMetadata.soterPolicyMode = request.policy.mode;

    const result = await this.guardInput({
      message: request.input,
      userId: request.context?.userId,
      sessionId: request.context?.sessionId,
      metadata: { ...request.context?.metadata, ...policyMetadata },
    });
    const safeText = result.safeText ?? result.redactedText;

    return {
      ...result,
      riskLevel: riskLevel(result.findings, result.riskScore),
      detections: result.findings.map((finding) => ({
        type: finding.type,
        label: finding.label,
        riskLevel: finding.severity,
        score: finding.score,
        message: finding.message,
      })),
      ...(safeText
        ? {
            redaction: {
              redacted: safeText !== request.input,
              text: safeText,
              categories: result.riskTypes,
            },
          }
        : {}),
    };
  }
}
