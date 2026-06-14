// SECURITY: Worker endpoint that drains the durable webhook queue.
// Auth: requires the WEBHOOK_WORKER_TOKEN env var to match the
// `Authorization: Bearer <token>` header. Cron drivers (Vercel Cron,
// GitHub Actions, Render Cron, etc.) supply this token.

import { jsonResponse, apiError } from "@/lib/apiResponse";
import { processDuePending } from "@/lib/webhooks/delivery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const expected = process.env.WEBHOOK_WORKER_TOKEN;
    if (!expected) {
      return jsonResponse({ error: true, message: "Worker is not configured." }, { status: 503 });
    }
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (provided.length !== expected.length || provided !== expected) {
      return jsonResponse({ error: true, message: "Forbidden." }, { status: 403 });
    }
    const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 25);
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 100 ? limitParam : 25;
    const results = await processDuePending(limit);
    return jsonResponse({ processed: results.length, results });
  } catch (error) {
    return apiError(error, "Worker run failed.");
  }
}
