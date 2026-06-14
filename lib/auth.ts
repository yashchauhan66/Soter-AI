// Backwards-compatible helpers used by Phase 1/2 routes.
// SECURITY: These now delegate to the real session via lib/auth/guards.ts.
// Routes that already migrated should call requireUser/requireProjectAccess
// directly. New code should NOT depend on these helpers.

import { db } from "./db";
import { requireUser, getActiveOrganization, requireProjectAccess } from "./auth/guards";

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev";

/**
 * Returns the signed-in user. Auto-provisions a default Organization
 * (DIRECT_BUSINESS, OWNER membership) on first call if the user has none.
 */
export async function getCurrentUser() {
  const user = await requireUser();
  const existing = await db.organizationMember.findFirst({ where: { userId: user.id } });
  if (!existing) {
    const slug = `org-${user.id.slice(-12).toLowerCase()}`;
    const name = user.name ? `${user.name} workspace` : `${user.email.split("@")[0]} workspace`;
    const org = await db.organization.create({
      data: { name, slug, type: "DIRECT_BUSINESS", plan: "FREE", contactEmail: user.email },
    });
    await db.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });
  }
  return db.user.findUniqueOrThrow({ where: { id: user.id } });
}

export async function getCurrentProject() {
  const user = await getCurrentUser();
  const active = await getActiveOrganization();
  if (active) {
    const existing = await db.project.findFirst({
      where: { organizationId: active.org.id },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return db.project.create({
      data: {
        name: "Demo Chatbot",
        description: "Phase 1 protected chatbot project",
        plan: "DEMO",
        userId: user.id,
        organizationId: active.org.id,
      },
    });
  }
  // Should not happen because getCurrentUser provisioned an org, but stay safe.
  const fallback = await db.project.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (fallback) return fallback;
  return db.project.create({
    data: { name: "Demo Chatbot", description: "Phase 1 protected chatbot project", plan: "DEMO", userId: user.id },
  });
}

export async function getCurrentProjectById(projectId?: string) {
  if (projectId) {
    try {
      const access = await requireProjectAccess(projectId);
      return access.project;
    } catch {
      // fall through to default
    }
  }
  return getCurrentProject();
}

export async function getCurrentUserProjects() {
  const user = await requireUser();
  const active = await getActiveOrganization();
  if (active) {
    return db.project.findMany({
      where: { organizationId: active.org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  }
  return db.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

export { DEMO_EMAIL };
