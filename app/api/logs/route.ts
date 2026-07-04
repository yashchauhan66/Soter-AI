import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getActiveOrganization, requireUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { parseLogFilters } from "@/lib/guard/logFilters";
import { listGuardEventsByOrg, listGuardEventsByProject } from "@/lib/events/store";

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
    if (projectId) {
      const ownedProject = await db.project.findFirst({
        where: { id: projectId, organizationId: active.org.id },
        select: { id: true },
      });
      if (!ownedProject) {
        return jsonResponse({ error: true, message: "Project not found." }, { status: 404 });
      }
    }
    const filters = parseLogFilters({
      action: params.get("action"),
      direction: params.get("direction"),
      riskType: params.get("riskType"),
      from: params.get("from"),
      to: params.get("to"),
      cursor: params.get("cursor"),
      limit: params.get("limit"),
    });

    const page = projectId
      ? await listGuardEventsByProject(projectId, {
          limit: filters.limit,
          cursor: params.get("cursor"),
          from: filters.from,
          to: filters.to,
          decision: filters.action,
          direction: filters.direction,
          category: filters.riskType,
        })
      : await listGuardEventsByOrg(active.org.id, {
          limit: filters.limit,
          cursor: params.get("cursor"),
          from: filters.from,
          to: filters.to,
          decision: filters.action,
          direction: filters.direction,
          category: filters.riskType,
        });

    const projectIds = [...new Set(page.items.map((row) => row.projectId))];
    const projects = projectIds.length ? await db.project.findMany({
      where: { id: { in: projectIds }, organizationId: active.org.id },
      select: { id: true, name: true },
    }) : [];
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const logs = page.items.map((row) => ({
      ...row,
      project: row.project ?? { name: projectNames.get(row.projectId) ?? "Project" },
    }));

    return jsonResponse({ logs, nextCursor: page.nextCursor });
  } catch (error) { return apiError(error, "Guard logs could not be loaded."); }
}
