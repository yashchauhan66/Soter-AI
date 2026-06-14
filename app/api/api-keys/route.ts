import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { generateApiKey } from "@/lib/apiKey";
import { requireProjectPermission, getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { apiKeySchema } from "@/lib/validations";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const keys = await db.apiKey.findMany({
      where: { project: { organizationId: active.org.id } },
      select: {
        id: true, name: true, prefix: true, projectId: true, isActive: true, lastUsedAt: true, createdAt: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(keys);
  } catch (error) { return apiError(error, "API keys could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const body = apiKeySchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "api_key:create");
    const generated = generateApiKey(body.environment);
    const key = await db.apiKey.create({
      data: { name: body.name, projectId: access.project.id, prefix: generated.prefix, keyHash: generated.keyHash },
    });
    await db.onboardingProgress.upsert({
      where: { userId: access.user.id },
      create: { userId: access.user.id, apiKeyGenerated: true },
      update: { apiKeyGenerated: true },
    });
    return jsonResponse(
      { id: key.id, name: key.name, prefix: key.prefix, apiKey: generated.rawKey },
      { status: 201 },
    );
  } catch (error) { return apiError(error, "API key could not be generated."); }
}

export async function PATCH(request: Request) {
  try {
    const body = z.object({ id: z.string(), isActive: z.boolean() }).parse(await readJson(request));
    const target = await db.apiKey.findUnique({ where: { id: body.id } });
    if (!target) return jsonResponse({ error: true, message: "API key not found." }, { status: 404 });
    const permission = body.isActive ? "api_key:create" : "api_key:revoke";
    await requireProjectPermission(target.projectId, permission);
    const key = await db.apiKey.update({
      where: { id: body.id },
      data: { isActive: body.isActive },
      select: { id: true, name: true, prefix: true, projectId: true, isActive: true, lastUsedAt: true, createdAt: true },
    });
    return jsonResponse(key);
  } catch (error) { return apiError(error, "API key could not be updated."); }
}
