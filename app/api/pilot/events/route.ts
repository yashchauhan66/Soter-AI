import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { buildPilotEvent, pilotEventSchema } from "@/lib/pilot/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = pilotEventSchema.parse(await readJson(request));
    const event = buildPilotEvent({ ...body, userId: user.id });
    const created = await db.productEvent.create({
      data: {
        organizationId: event.organizationId,
        projectId: event.projectId,
        userId: event.userId,
        eventType: event.eventType,
        properties: event.properties,
      },
      select: { id: true, eventType: true, occurredAt: true },
    });

    return jsonResponse({ ok: true, event: created }, { status: 201 });
  } catch (error) {
    return apiError(error, "Pilot event could not be recorded.");
  }
}
