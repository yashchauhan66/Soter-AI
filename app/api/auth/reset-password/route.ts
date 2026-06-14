import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { consumePasswordResetToken } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string().min(20).max(500), password: z.string().min(8).max(200) }).parse(await readJson(request));
    const userId = await consumePasswordResetToken(body.token, await bcrypt.hash(body.password, 12));
    if (!userId) return jsonResponse({ error: true, message: "Reset link is invalid, expired, or already used." }, { status: 400 });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Password reset failed."); }
}
