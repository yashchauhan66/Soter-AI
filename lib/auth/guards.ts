// SECURITY: Tenant boundary enforcement.
// Every private route MUST go through one of these helpers.
// They throw on permission failure so routes can `try/catch` via apiError.

import { cache } from "react";
import type { OrgRole, Organization, OrganizationMember } from "@prisma/client";
import { auth } from "../../auth";
import { db } from "../db";
import {
  assertOrganizationAvailable,
  assertProjectAvailable,
  buildActiveMembershipWhere,
} from "./availability";
import { AuthError, ForbiddenError, NotFoundError } from "./errors";
import { hasPermission, type Permission } from "./permissions";
import { listGuardEventsByProject } from "../events/store";

// The error hierarchy lives in ./errors so that every module which throws an
// authorization failure produces an instance of the SAME class.
// lib/apiResponse.ts maps `instanceof AuthError` onto the HTTP status, and
// `instanceof` is identity-based: a second, structurally identical copy of these
// classes declared here (which is what used to live in this file) meant a
// ForbiddenError raised by ./availability was NOT an instance of the AuthError
// apiError checks, so a deliberate 403 was reported to the caller as a generic
// 500. Re-export the single definition instead of redeclaring it.
export { AuthError, ForbiddenError, NotFoundError } from "./errors";

/**
 * `cache` de-duplicates a call for the lifetime of one server request.
 *
 * It is a React *canary* API: `@types/react` only declares it in canary.d.ts,
 * and the `react` package this repo installs (18.2.0) does not export it at all
 * — Next.js substitutes its own bundled React during `next build` / `next dev`,
 * which is the only reason the app works. Calling the import directly therefore
 * crashes every consumer that runs outside the Next bundler (plain `tsx` tests,
 * standalone workers, one-off scripts) with
 * "(0 , import_react.cache) is not a function".
 *
 * Falling back to the identity wrapper keeps this module importable there. The
 * only thing lost outside a request scope is memoisation, which is a
 * performance property and not a security one: every call still re-runs the
 * full session lookup and membership check.
 */
const requestCache: typeof cache = typeof cache === "function" ? cache : (fn) => fn;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export const requireUser = requestCache(async (): Promise<SessionUser> => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Sign in required.", 401);
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  if (!user) throw new AuthError("Session user no longer exists.", 401);
  return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
});

export const getActiveOrganization = requestCache(async (input?: { organizationId?: string | null }): Promise<{ org: Organization; membership: OrganizationMember & { role: OrgRole } } | null> => {
  const user = await requireUser();

  // buildActiveMembershipWhere hides organizations an administrator has
  // suspended from ordinary members while keeping them visible to platform
  // admins for recovery. Inlining a plain `{ userId }` filter here (which is
  // what this used to do) meant a suspended tenant was silently picked as
  // somebody's active organization again on the very next request.
  const membership = await db.organizationMember.findFirst({
    where: buildActiveMembershipWhere(user, input?.organizationId ?? null),
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
  // A tenant an administrator suspended has to stop serving its own members, not
  // just its API keys. lib/apiKey.ts already rejects on organization.disabled,
  // so before this check the same suspension blocked SDK traffic while leaving
  // every session-authenticated dashboard route and server action fully usable.
  // Platform admins stay exempt so the suspension can be lifted.
  assertOrganizationAvailable(membership.organization, user);
  return { user, org: membership.organization, role: membership.role };
}

export async function requireProjectAccess(projectId: string): Promise<{ user: SessionUser; org: Organization; role: OrgRole; project: NonNullable<Awaited<ReturnType<typeof db.project.findUnique>>> }> {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found.");
  // Same asymmetry as the organization check above: lib/apiKey.ts rejects on
  // project.disabledAt, the session path did not.
  assertProjectAvailable(project, user);
  if (!project.organizationId) {
    if (project.userId !== user.id && !user.isAdmin) throw new ForbiddenError("You do not have access to this project.");
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
  return (await listGuardEventsByProject(access.project.id, { limit: take })).items;
}
