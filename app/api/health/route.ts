import { db } from "@/lib/db";
import { jsonResponse } from "@/lib/apiResponse";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return jsonResponse({ status: "ok", database: "reachable", timestamp: new Date().toISOString() });
  } catch {
    return jsonResponse({ status: "degraded", database: "unreachable", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
