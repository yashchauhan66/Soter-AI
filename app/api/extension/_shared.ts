import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ExtensionOrgPolicy, PolicyAction, PolicySeverity } from "@/packages/policy-engine/src/types";
import { BUILT_IN_AI_DESTINATIONS } from "@/packages/shared/src/ai-destinations";
import { hashSecret } from "@/lib/extension/enrollment";
import { sanitizeExtensionMetadata } from "@/lib/extension/privacyGuard";

export const extensionActionSchema = z.enum(["allow", "log_only", "warn", "redact", "rewrite", "block", "require_justification", "require_approval"]);
export const extensionSeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store, max-age=0", ...(init.headers ?? {}) },
  });
}

export async function authenticateExtensionRequest(request: Request, organizationId: string) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const { authenticateApiKeyRequest } = await import("@/lib/apiKeyMiddleware");
    const authenticated = await authenticateApiKeyRequest(request);
    if (!authenticated.ok) return authenticated;
    if (authenticated.auth.project.organizationId !== organizationId) {
      return {
        ok: false as const,
        response: jsonResponse({ error: true, message: "API key is not scoped to this organization." }, { status: 403 }),
      };
    }
    return { ok: true as const, projectId: authenticated.auth.project.id, source: "api_key" as const };
  }

  const expected = process.env.SOTER_EXTENSION_DEVICE_TOKEN ?? process.env.SOTER_EXTENSION_TOKEN;
  const supplied = request.headers.get("x-soter-extension-token");
  if (expected && supplied === expected) return { ok: true as const, source: "extension_token" as const };
  if (supplied) {
    const device = await db.deviceAgent.findUnique({
      where: { deviceTokenHash: hashSecret(supplied) },
      select: { id: true, organizationId: true, status: true },
    });
    if (device?.organizationId === organizationId && device.status === "active") {
      return { ok: true as const, source: "device_token" as const, deviceId: device.id };
    }
  }
  if (!expected && process.env.NODE_ENV !== "production") return { ok: true as const, source: "dev_unconfigured" as const };
  return {
    ok: false as const,
    response: jsonResponse({ error: true, message: "Missing or invalid extension token." }, { status: 401 }),
  };
}

export function defaultExtensionPolicy(organizationId: string): ExtensionOrgPolicy {
  return {
    organizationId,
    version: `org-${organizationId}-default-1`,
    enabled: true,
    allowedDomains: [],
    monitoredDomains: ["chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "perplexity.ai", "poe.com"],
    defaultAction: "allow",
    maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      {
        id: "extension-secret-block",
        name: "Block secrets in public AI tools",
        action: "block",
        severity: "critical",
        destinationTypes: ["public_ai"],
        detectedDataTypes: ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"],
      },
      {
        id: "extension-india-pii-approval",
        name: "Require approval for regulated India identifiers",
        action: "require_approval",
        severity: "high",
        destinationTypes: ["public_ai"],
        detectedDataTypes: ["aadhaar", "pan", "gstin", "upi_id", "ifsc", "credit_card"],
      },
      {
        id: "extension-business-redact",
        name: "Redact business-sensitive content",
        action: "redact",
        severity: "medium",
        destinationTypes: ["public_ai"],
        detectedDataTypes: ["customer_data", "legal_contract", "hr_salary", "financial_text", "source_code", "production_logs"],
      },
      {
        id: "extension-company-fingerprint-block",
        name: "Enforce Company Data Fingerprint Vault matches",
        action: "block",
        severity: "critical",
        destinationTypes: ["public_ai", "browser_coding"],
        detectedDataTypes: ["company_fingerprint_match"],
        minFingerprintSimilarity: 0.24,
      },
      {
        id: "extension-prompt-injection-warn",
        name: "Warn on prompt injection",
        action: "warn",
        severity: "medium",
        destinationTypes: ["public_ai"],
        detectedDataTypes: ["prompt_injection"],
      },
    ],
    destinations: BUILT_IN_AI_DESTINATIONS.filter((destination) => ["public_ai", "browser_coding", "local_ai", "custom"].includes(destination.category)).map((destination) => ({ ...destination, organizationId })),
    updatedAt: new Date().toISOString(),
    signature: `unsigned-dev-${organizationId}`,
  };
}

export async function authenticateAgentRequest(request: Request, organizationId: string) {
  const supplied = request.headers.get("x-soter-device-token");
  const expected = process.env.SOTER_AGENT_DEVICE_TOKEN;
  if (expected && supplied === expected) return { ok: true as const, source: "device_token" as const };
  if (!expected && process.env.NODE_ENV !== "production") return { ok: true as const, source: "dev_unconfigured" as const };
  return {
    ok: false as const,
    response: jsonResponse({ error: true, message: "Missing or invalid device token." }, { status: 401 }),
  };
}

export async function recordExtensionSecurityEvent(input: {
  organizationId: string;
  projectId?: string;
  eventType: string;
  severity: PolicySeverity;
  action: PolicyAction;
  source: string;
  riskTypes: string[];
  metadata: Record<string, unknown>;
}) {
  try {
    const organization = await db.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
    if (!organization) return null;
    return await db.securityEvent.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        eventType: input.eventType,
        severity: input.severity.toUpperCase(),
        riskTypes: input.riskTypes,
        action: input.action.toUpperCase(),
        source: input.source,
        metadata: sanitizeExtensionMetadata(input.metadata) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[Soter extension] Failed to persist event", error);
    return null;
  }
}
