// SECURITY: Tenant boundary enforcement.
// Every private route MUST go through one of these helpers.
// They throw on permission failure so routes can `try/catch` via apiError.

import { auth } from "../../auth";
import { db } from "../db";
import type { OrgRole, Organization, OrganizationMember } from "@prisma/client";
import { cache } from "react";
import { hasPermission, type Permission } from "./permissions";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AuthError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export const requireUser = cache(async (): Promise<SessionUser> => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Sign in required.", 401);
  }
  // Hydrate from DB so isAdmin is always fresh.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  if (!user) throw new AuthError("Session user no longer exists.", 401);
  return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
});

/**
 * Resolve the user's "active" organization. The session does not encode
 * the active org because users may belong to many; clients pass it in via
 * cookie or query param. This helper falls back to the user's first
 * membership.
 */
export const getActiveOrganization = cache(async (input?: { organizationId?: string | null }): Promise<{ org: Organization; membership: OrganizationMember & { role: OrgRole } } | null> => {
  const user = await requireUser();
  const targetId = input?.organizationId ?? null;

  const where = targetId
    ? { userId: user.id, organizationId: targetId }
    : { userId: user.id };

  const membership = await db.organizationMember.findFirst({
    where,
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  return { org: membership.organization, membership };
});

export async function requireOrganizationAccess(organizationId: string): Promise<{ user: SessionUser; org: Organization; role: OrgRole }> {
  const user = await requireUser();
  const membership = await db.organizationMember.findFirst({
    where: { organizationId, userId: user.id },
    include: { organization: true },
  });
  if (!membership) {
    if (user.isAdmin) {
      const org = await db.organization.findUnique({ where: { id: organizationId } });
      if (!org) throw new NotFoundError("Organization not found.");
      return { user, org, role: "OWNER" };
    }
    throw new ForbiddenError("You do not have access to this organization.");
  }
  return { user, org: membership.organization, role: membership.role };
}

export async function requireProjectAccess(projectId: string): Promise<{ user: SessionUser; org: Organization; role: OrgRole; project: NonNullable<Awaited<ReturnType<typeof db.project.findUnique>>> }> {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found.");
  if (!project.organizationId) {
    if (project.userId !== user.id && !user.isAdmin) throw new ForbiddenError("You do not have access to this project.");
    // Legacy project: synthesise org info via the user's default org.
    const fallback = await getActiveOrganization();
    if (!fallback) throw new ForbiddenError("No organization available.");
    return { user, org: fallback.org, role: fallback.membership.role, project };
  }
  const access = await requireOrganizationAccess(project.organizationId);
  return { ...access, project };
}

export async function requirePermission(organizationId: string, permission: Permission) {
  const access = await requireOrganizationAccess(organizationId);
  if (!hasPermission(access.role, permission) && !access.user.isAdmin) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return access;
}

export async function requireProjectPermission(projectId: string, permission: Permission) {
  const access = await requireProjectAccess(projectId);
  if (!access.org.id) {
    return access;
  }
  if (!hasPermission(access.role, permission) && !access.user.isAdmin) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return access;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError("Admin only.");
  return user;
}

export async function getScopedProject(projectId: string) {
  return requireProjectAccess(projectId);
}

export async function getScopedLogs(projectId: string, take = 100) {
  const access = await requireProjectPermission(projectId, "logs:read");
  return db.guardLog.findMany({
    where: { projectId: access.project.id },
    orderBy: { createdAt: "desc" },
    take,
  });
}
