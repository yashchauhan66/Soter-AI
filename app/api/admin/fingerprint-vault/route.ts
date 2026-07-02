import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { createFingerprintSet, listFingerprintSets } from "@/lib/ai-data-security/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["customer_list", "legal_contract", "investor_deck", "salary_sheet", "source_code", "product_roadmap", "internal_policy", "support_export", "financial_report", "database_export", "confidential_notes", "custom"]),
  sensitivity: z.enum(["low", "medium", "high", "critical"]),
  ownerDepartment: z.string().max(120).optional(),
  action: z.enum(["warn", "redact", "rewrite", "block", "require_justification", "require_approval"]),
  sourceType: z.enum(["manual_text", "uploaded_file", "api_import", "connector_import"]).default("manual_text"),
  text: z.string().min(1).max(20000),
  originalFileName: z.string().max(255).optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  retentionDays: z.number().int().positive().max(3650).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    return jsonResponse({ fingerprintSets: await listFingerprintSets(organizationId, url.searchParams) });
  } catch (error) {
    return apiError(error, "Fingerprint vault could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = createSchema.parse(await readJson(request));
    const fingerprintSet = await createFingerprintSet({ ...input, adminUserId: admin.id });
    return jsonResponse({ fingerprintSet }, { status: 201 });
  } catch (error) {
    return apiError(error, "Fingerprint set could not be created.");
  }
}
