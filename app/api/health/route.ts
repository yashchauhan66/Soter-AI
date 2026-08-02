import { db } from "@/lib/db";
import { jsonResponse } from "@/lib/apiResponse";
import { getGuardHealth, toPublicGuardHealth } from "@/lib/guard/guardHealth";

/**
 * Liveness + honest guard-tier status.
 *
 * The guard block exists so a degraded ML tier cannot hide. A guard configured as
 * shadow/enforce whose model never loaded serves rules-only traffic while looking
 * identical to a healthy one; publishing the coarse status makes that visible, and
 * SOTERAI_ML_REQUIRE_HEALTHY turns it into a 503 so an orchestrator pulls the
 * instance instead of serving a downgraded security control.
 *
 * Only the coarse status is public. Failure reasons, model paths and counters can
 * name filesystem paths and internal errors, so they stay in `npm run ml:health`.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  let database: "reachable" | "unreachable" = "reachable";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }

  // Never let a health probe fail because the health probe failed.
  let guard: ReturnType<typeof toPublicGuardHealth> | undefined;
  let guardBlocks = false;
  try {
    const health = await getGuardHealth();
    guard = toPublicGuardHealth(health);
    guardBlocks = health.requireHealthyMl && health.ml.status === "degraded";
  } catch {
    guard = undefined;
  }

  const degraded = database === "unreachable" || guardBlocks;

  return jsonResponse(
    {
      status: degraded ? "degraded" : "ok",
      database,
      guard,
      timestamp,
    },
    degraded ? { status: 503 } : {},
  );
}
