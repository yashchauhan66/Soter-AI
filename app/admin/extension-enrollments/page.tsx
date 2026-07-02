import { db } from "@/lib/db";
import { EnrollmentTokensClient } from "@/components/admin/EnrollmentTokensClient";

export const dynamic = "force-dynamic";

export default async function ExtensionEnrollmentsPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  const firstOrgId = organizations[0]?.id ?? null;

  const tokens = firstOrgId
    ? await db.extensionEnrollmentToken.findMany({
        where: { organizationId: firstOrgId },
        include: { createdByAdmin: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Extension Enrollment Tokens</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create, manage, and revoke enrollment tokens for browser extension deployment. Tokens are only shown once at creation.
        </p>
      </div>

      <EnrollmentTokensClient
        organizations={organizations}
        initialTokens={tokens.map((t) => ({
          id: t.id,
          organizationId: t.organizationId,
          employeeEmail: t.employeeEmail,
          department: t.department,
          role: t.role,
          maxUses: t.maxUses,
          usedCount: t.usedCount,
          expiresAt: t.expiresAt.toISOString(),
          revokedAt: t.revokedAt?.toISOString() ?? null,
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
          createdByAdminId: t.createdByAdminId,
          createdBy: t.createdByAdmin?.email ?? t.createdByAdmin?.name ?? t.createdByAdmin?.id ?? "Unknown admin",
        }))}
      />
    </div>
  );
}
