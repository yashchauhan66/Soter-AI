import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createModelVersion, listModelVersions, setRollout } from "@/lib/ml";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(80),
  backend: z.enum(["heuristic", "external-api"]).default("heuristic"),
  thresholds: z.record(z.string(), z.number().min(0).max(1)).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await readJson(request));
    const model = await createModelVersion(body);
    return jsonResponse({ id: model.id, name: model.name, version: model.version, backend: model.backend }, { status: 201 });
  } catch (error) {
    return apiError(error, "Could not register model version.");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    const models = await listModelVersions(organizationId);
    return jsonResponse({ models });
  } catch (error) {
    return apiError(error, "Could not list models.");
  }
}

const rolloutSchema = z.object({
  organizationId: z.string().min(1),
  modelVersionId: z.string().min(1),
  mode: z.enum(["OFF", "SHADOW", "PARTIAL", "FULL"]),
  percent: z.number().min(0).max(100).optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    const body = rolloutSchema.parse(await readJson(request));
    const deployment = await setRollout(body);
    await db.adminAuditLog.create({
      data: {
        organizationId: body.organizationId,
        adminUserId: user.id,
        action: "ml_rollout_update",
        targetType: "ml_deployment",
        targetId: deployment.id,
        reason: `mode=${body.mode} percent=${deployment.rolloutPercent}`,
        metadata: { mode: body.mode, percent: deployment.rolloutPercent, projectId: body.projectId ?? null },
      },
    });
    return jsonResponse({ id: deployment.id, mode: deployment.rolloutMode, percent: deployment.rolloutPercent });
  } catch (error) {
    return apiError(error, "Rollout update failed.");
  }
}
