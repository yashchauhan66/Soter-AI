import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { generateApiKey } from "@/lib/apiKey";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rotateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  environment: z.enum(["test", "live"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = rotateSchema.parse(await readJson(request));
    const target = await db.apiKey.findUnique({ where: { id: body.id } });
    if (!target) return jsonResponse({ error: true, message: "API key not found." }, { status: 404 });
    await requireProjectPermission(target.projectId, "api_key:create");
    await requireProjectPermission(target.projectId, "api_key:revoke");

    const environment: "test" | "live" = body.environment ?? (target.prefix.startsWith("ck_live_") ? "live" : "test");
    const generated = generateApiKey(environment);
    const replacementName = body.name ?? `${target.name} (rotated)`;

    const result = await db.$transaction(async (tx) => {
      const replacement = await tx.apiKey.create({
        data: {
          name: replacementName,
          projectId: target.projectId,
          prefix: generated.prefix,
          keyHash: generated.keyHash,
        },
        select: { id: true, name: true, prefix: true, projectId: true, isActive: true, createdAt: true },
      });
      const revoked = await tx.apiKey.update({
        where: { id: target.id },
        data: { isActive: false },
        select: { id: true, name: true, prefix: true, isActive: true },
      });
      return { replacement, revoked };
    });

    return jsonResponse(
      {
        replacement: { ...result.replacement, apiKey: generated.rawKey },
        revoked: result.revoked,
        notice: "Old key revoked atomically. The raw replacement key is shown once and is not retrievable later.",
      },
      { status: 201 },
    );
  } catch (error) { return apiError(error, "API key rotation failed."); }
}
