import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export const authorizationFixtures = {
  viewerEmail: "e2e.viewer@cyberrakshak.dev",
  viewerPassword: "e2e-viewer-cyberrakshak-2026",
  viewerProjectId: "e2e-viewer-project",
  foreignProjectId: "e2e-foreign-project",
} as const;

export async function seedAuthorizationFixtures(databaseUrl: string) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const viewerPasswordHash = await bcrypt.hash(authorizationFixtures.viewerPassword, 12);
    const viewer = await prisma.user.upsert({
      where: { email: authorizationFixtures.viewerEmail },
      update: {
        name: "E2E Viewer",
        passwordHash: viewerPasswordHash,
        isAdmin: false,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: authorizationFixtures.viewerEmail,
        name: "E2E Viewer",
        passwordHash: viewerPasswordHash,
        isAdmin: false,
        emailVerifiedAt: new Date(),
      },
    });
    const viewerOrganization = await prisma.organization.upsert({
      where: { slug: "e2e-viewer-workspace" },
      update: { name: "E2E Viewer workspace", contactEmail: viewer.email },
      create: {
        slug: "e2e-viewer-workspace",
        name: "E2E Viewer workspace",
        contactEmail: viewer.email,
      },
    });
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: viewerOrganization.id,
          userId: viewer.id,
        },
      },
      update: { role: "VIEWER" },
      create: {
        organizationId: viewerOrganization.id,
        userId: viewer.id,
        role: "VIEWER",
      },
    });
    await prisma.project.upsert({
      where: { id: authorizationFixtures.viewerProjectId },
      update: {
        name: "E2E Viewer Project",
        userId: viewer.id,
        organizationId: viewerOrganization.id,
      },
      create: {
        id: authorizationFixtures.viewerProjectId,
        name: "E2E Viewer Project",
        userId: viewer.id,
        organizationId: viewerOrganization.id,
      },
    });

    const foreignOwner = await prisma.user.upsert({
      where: { email: "e2e.foreign-owner@cyberrakshak.dev" },
      update: { name: "E2E Foreign Owner", isAdmin: false },
      create: {
        email: "e2e.foreign-owner@cyberrakshak.dev",
        name: "E2E Foreign Owner",
        isAdmin: false,
      },
    });
    const foreignOrganization = await prisma.organization.upsert({
      where: { slug: "e2e-foreign-workspace" },
      update: { name: "E2E Foreign workspace", contactEmail: foreignOwner.email },
      create: {
        slug: "e2e-foreign-workspace",
        name: "E2E Foreign workspace",
        contactEmail: foreignOwner.email,
      },
    });
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: foreignOrganization.id,
          userId: foreignOwner.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        organizationId: foreignOrganization.id,
        userId: foreignOwner.id,
        role: "OWNER",
      },
    });
    await prisma.project.upsert({
      where: { id: authorizationFixtures.foreignProjectId },
      update: {
        name: "E2E Foreign Project",
        userId: foreignOwner.id,
        organizationId: foreignOrganization.id,
      },
      create: {
        id: authorizationFixtures.foreignProjectId,
        name: "E2E Foreign Project",
        userId: foreignOwner.id,
        organizationId: foreignOrganization.id,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
