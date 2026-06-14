import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  key: z.enum(["projectCreated", "apiKeyGenerated", "firstGuardRequest", "webhookConfigured", "badgeEnabled", "reportGenerated", "sdkInstalled"]),
  value: z.boolean(),
});

export async function PATCH(request: Request) {
  
  try {
    
    const user = await getCurrentUser();
    const body = schema.parse(await readJson(request));
    const updated = await db.onboardingProgress.upsert({
      where: { userId: user.id },
      create: { userId: user.id, [body.key]: body.value },
      update: { [body.key]: body.value },
    });

    return jsonResponse(updated);
  } catch (error) { return apiError(error, "Onboarding could not be updated."); }
}
