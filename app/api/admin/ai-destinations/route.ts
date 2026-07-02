import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { createAIDestination, createAIDestinationSchema, listAIDestinations } from "@/lib/ai-destinations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    return jsonResponse({ destinations: await listAIDestinations(organizationId) });
  } catch (error) {
    return apiError(error, "AI destinations could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = createAIDestinationSchema.parse(await readJson(request));
    return jsonResponse({ destination: await createAIDestination(input) }, { status: 201 });
  } catch (error) {
    return apiError(error, "AI destination could not be created.");
  }
}
