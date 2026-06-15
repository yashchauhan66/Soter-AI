import { db } from "@/lib/db";

export interface TenantProjectScope {
  organizationId: string;
  projectId?: string | null;
}

export interface ProjectOwnershipRecord {
  id: string;
  organizationId: string | null;
}

export function assertTenantProjectOwnership(scope: TenantProjectScope, project: ProjectOwnershipRecord | null) {
  if (!scope.projectId) return;
  if (!project || project.id !== scope.projectId || project.organizationId !== scope.organizationId) {
    throw new Error("Project does not belong to the requested organization.");
  }
}

export async function requireTenantProjectOwnership(scope: TenantProjectScope) {
  if (!scope.projectId) return null;
  const project = await db.project.findUnique({
    where: { id: scope.projectId },
    select: { id: true, organizationId: true },
  });
  assertTenantProjectOwnership(scope, project);
  return project;
}
