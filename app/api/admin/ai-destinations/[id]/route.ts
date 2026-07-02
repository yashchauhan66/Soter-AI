import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { deleteAIDestination, updateAIDestination, updateAIDestinationSchema } from "@/lib/ai-destinations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = updateAIDestinationSchema.parse(await readJson(request));
    const { organizationId, ...patch } = body;
    const destination = await updateAIDestination(organizationId, id, patch);
    return destination ? jsonResponse({ destination }) : jsonResponse({ error: true, message: "Destination not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "AI destination could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    return await deleteAIDestination(organizationId, id)
      ? jsonResponse({ ok: true })
      : jsonResponse({ error: true, message: "Destination not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "AI destination could not be deleted.");
  }
}
