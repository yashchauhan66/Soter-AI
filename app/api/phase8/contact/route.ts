import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";
import { checkMemoryRateLimit } from "@/lib/rateLimit";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), company: z.string().trim().min(2).max(160), role: z.string().trim().max(100).optional(), monthlyMessages: z.number().int().positive().max(1_000_000_000).optional(), interest: z.enum(["agency", "enterprise", "security-review", "self-hosted", "other"]), message: z.string().trim().min(10).max(3000), deploymentPreference: z.string().max(100).optional() });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkMemoryRateLimit(`contact:${ip}`, 5, 60 * 60_000).allowed) return jsonResponse({ error: true, message: "Too many requests." }, { status: 429 });
    const body = schema.parse(await readJson(request));
    const lead = await db.contactLead.create({ data: { ...body, email: body.email.toLowerCase(), message: sanitizeLogText(body.message) } });
    return jsonResponse({ id: lead.id, received: true }, { status: 201 });
  } catch (error) { return apiError(error, "Sales request could not be submitted."); }
}
