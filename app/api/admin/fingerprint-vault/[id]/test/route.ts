import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { testFingerprintMatch } from "@/lib/ai-data-security/server";

export const dynamic = "force-dynamic";

const schema = z.object({ organizationId: z.string().min(1), text: z.string().min(1).max(20000) });

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await readJson(request));
    return jsonResponse({ matches: await testFingerprintMatch(body.organizationId, body.text) });
  } catch (error) {
    return apiError(error, "Fingerprint test could not be run.");
  }
}
