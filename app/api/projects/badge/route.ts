import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
  badgeEnabled: z.boolean().optional(),
  publicName: z.string().trim().max(80).optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.id, "badge:manage");
    const updated = await db.project.update({
      where: { id: body.id },
      data: {
        badgeEnabled: typeof body.badgeEnabled === "boolean" ? body.badgeEnabled : undefined,
        publicName: body.publicName ?? undefined,
      },
    });
    if (typeof body.badgeEnabled === "boolean" && body.badgeEnabled) {
      await db.onboardingProgress.upsert({
        where: { userId: access.user.id },
        create: { userId: access.user.id, badgeEnabled: true },
        update: { badgeEnabled: true },
      });
    }
    return jsonResponse(updated);
  } catch (error) { return apiError(error, "Project badge could not be updated."); }
}
