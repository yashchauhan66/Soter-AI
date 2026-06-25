import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { generateApiKey } from "@/lib/apiKey";
import { requireProjectPermission, getActiveOrganization, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { apiKeySchema } from "@/lib/validations";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // requireUser() provides defense-in-depth — the session check also happens
    // in middleware, but an explicit guard here ensures this can never be exposed
    // accidentally if the route is ever moved or the middleware config changes.
    await requireUser();
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
    const body = z.object({ id: z.string().min(1), isActive: z.boolean() }).parse(await readJson(request));
    const permission = body.isActive ? "api_key:create" : "api_key:revoke";

    // SECURITY (H-2 IDOR fix): do a single permission-scoped lookup.
    // A universal findUnique before auth leaks whether a UUID is valid (404 vs 403).
    // Here we resolve the session user's organizations first, then query only
    // within those orgs — non-existent and unauthorized IDs both yield 404.
    const user = await requireUser();
    const target = await db.apiKey.findFirst({
      where: {
        id: body.id,
        project: {
          organization: {
            members: { some: { userId: user.id } },
          },
        },
      },
      select: { id: true, projectId: true },
    });
    // Also allow platform admins to act on any key.
    if (!target) {
      if (user.isAdmin) {
        // Admin path: check the key exists at all.
        const adminTarget = await db.apiKey.findUnique({ where: { id: body.id }, select: { id: true, projectId: true } });
        if (!adminTarget) return jsonResponse({ error: true, message: "API key not found." }, { status: 404 });
        await requireProjectPermission(adminTarget.projectId, permission);
        const key = await db.apiKey.update({
          where: { id: body.id },
          data: { isActive: body.isActive },
          select: { id: true, name: true, prefix: true, projectId: true, isActive: true, lastUsedAt: true, createdAt: true },
        });
        return jsonResponse(key);
      }
      return jsonResponse({ error: true, message: "API key not found." }, { status: 404 });
    }
    await requireProjectPermission(target.projectId, permission);
    const key = await db.apiKey.update({
      where: { id: body.id },
      data: { isActive: body.isActive },
      select: { id: true, name: true, prefix: true, projectId: true, isActive: true, lastUsedAt: true, createdAt: true },
    });
    return jsonResponse(key);
  } catch (error) { return apiError(error, "API key could not be updated."); }
}

