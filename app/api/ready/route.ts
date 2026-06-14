import { db } from "@/lib/db";
import { jsonResponse } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return jsonResponse({ ok: true, checks: { database: "ready" } });
  } catch {
    return jsonResponse({ ok: false, checks: { database: "unavailable" } }, { status: 503 });
  }
}
