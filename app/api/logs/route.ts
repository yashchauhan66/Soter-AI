import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getActiveOrganization, requireUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";
import { buildLogWhere, encodeCursor, LOG_ORDER_BY, parseLogFilters } from "@/lib/guard/logFilters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ logs: [], nextCursor: null });

    // SECURITY (CRG-RT-011): enforce the logs:read permission. Membership alone
    // is not sufficient — roles such as BILLING are not granted logs:read in the
    // permission matrix. Platform admins are always allowed. (requireUser is
    // React-cached, so this does not add a second DB round-trip per request.)
    const user = await requireUser();
    if (!user.isAdmin && !hasPermission(active.membership.role, "logs:read")) {
      return jsonResponse({ error: true, message: "Missing permission: logs:read" }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    const filters = parseLogFilters({
      action: params.get("action"),
      direction: params.get("direction"),
      riskType: params.get("riskType"),
      from: params.get("from"),
      to: params.get("to"),
      cursor: params.get("cursor"),
      limit: params.get("limit"),
    });

    // Tenant boundary is enforced here and never derived from user input.
    const projectScope: Record<string, unknown> = {
      project: { organizationId: active.org.id },
      ...(projectId ? { projectId } : {}),
    };
    const where = buildLogWhere(projectScope, filters);

    // Fetch one extra row to detect whether a next page exists.
    const rows = await db.guardLog.findMany({
      where,
      orderBy: LOG_ORDER_BY,
      take: filters.limit + 1,
      select: { ...guardLogListSelect, id: true, project: { select: { name: true } } },
    });

    const hasMore = rows.length > filters.limit;
    const logs = hasMore ? rows.slice(0, filters.limit) : rows;
    const nextCursor = hasMore ? encodeCursor(logs[logs.length - 1]) : null;

    return jsonResponse({ logs, nextCursor });
  } catch (error) { return apiError(error, "Guard logs could not be loaded."); }
}
