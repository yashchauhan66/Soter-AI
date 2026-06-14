import { z } from "zod";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";

export async function POST(request: Request) {
  try {
    const { token } = z.object({ token: z.string().min(20).max(500) }).parse(await readJson(request));
    const userId = await consumeEmailVerificationToken(token);
    if (!userId) return jsonResponse({ error: true, message: "Verification link is invalid, expired, or already used." }, { status: 400 });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Email verification failed."); }
}
