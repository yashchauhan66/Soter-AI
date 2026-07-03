import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { createPolicy, listPolicies, updatePolicy } from "@/lib/admin-ai-policies/store";

export const dynamic = "force-dynamic";

// The dashboard exposes a single, high-level "managed" extension policy per org.
// It is stored as a normal AiAdminPolicy so the existing /api/extension/policy
// compiler picks it up unchanged. Granular rules still live in Usage Governance.
const MANAGED_POLICY_NAME = "Browser Extension (managed)";

const DEFAULT_DETECTORS = [
  "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key",
  "database_url", "password", "aadhaar", "pan", "credit_card", "source_code",
];

const bodySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
  action: z.enum(["block", "redact", "warn", "log_only", "require_approval"]),
  monitoredDomains: z.array(z.string().trim().min(1).max(200)).max(100),
  scanResponses: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { user } = await requirePermission(body.organizationId, "policy:manage");

    const existing = (await listPolicies(body.organizationId)).find((p) => p.name === MANAGED_POLICY_NAME);

    const destinations = { preset: "custom", domains: body.monitoredDomains, riskLevel: "all" as const };
    const detectionConfig = {
      detectorKeys: DEFAULT_DETECTORS,
      keywords: [],
      regex: [],
      domains: [],
      fileNames: [],
      documentFingerprints: [],
      semanticCategories: [],
      scanResponses: body.scanResponses,
    };

    if (existing) {
      const updated = await updatePolicy(body.organizationId, existing.id, user.id, {
        enabled: body.enabled,
        action: body.action,
        destinations,
        detectionConfig,
      });
      return jsonResponse({ ok: true, policyId: updated?.id ?? existing.id });
    }

    const created = await createPolicy({
      organizationId: body.organizationId,
      actorId: user.id,
      policy: {
        name: MANAGED_POLICY_NAME,
        description: "High-level browser extension policy managed from the dashboard.",
        enabled: body.enabled,
        mode: "custom",
        severity: "high",
        action: body.action,
        scope: { type: "all", departments: ["all"], roles: ["all"], users: ["all"] },
        destinations,
        detectionConfig,
        logMode: "redacted_prompt",
      },
    });
    return jsonResponse({ ok: true, policyId: created.id }, { status: 201 });
  } catch (error) {
    return apiError(error, "Extension policy could not be saved.");
  }
}
