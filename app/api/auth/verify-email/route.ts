import { z } from "zod";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export async function POST(request: Request) {
  try {
    const { token } = z.object({ token: z.string().min(20).max(500) }).parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:verify-email",
      limit: 10,
      windowMs: 60 * 60_000,
      subject: token,
      message: "Too many verification attempts. Please try again later.",
    });
    if (limited) return limited;
    const userId = await consumeEmailVerificationToken(token);
    if (!userId) return jsonResponse({ error: true, message: "Verification link is invalid, expired, or already used." }, { status: 400 });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Email verification failed."); }
}
