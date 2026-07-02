import { db } from "@/lib/db";
import { EmergencyLockdownClient } from "@/components/admin/ai-policies/EmergencyLockdownClient";

export const dynamic = "force-dynamic";

export default async function EmergencyLockdownPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  const firstOrganizationId = organizations[0]?.id ?? null;
  const lockdown = firstOrganizationId ? await db.emergencyLockdownState.findUnique({
    where: { organizationId: firstOrganizationId },
    include: { enabledByAdmin: { select: { email: true } }, disabledByAdmin: { select: { email: true } } },
  }) : null;

  return (
    <EmergencyLockdownClient
      organizations={organizations}
      initialState={{
        organizationId: firstOrganizationId,
        isLockedDown: lockdown?.enabled ?? false,
        lastEnabledAt: (lockdown?.updatedAt ?? null)?.toISOString() ?? null,
        lastAdminEmail: lockdown?.enabled ? lockdown.enabledByAdmin?.email ?? null : lockdown?.disabledByAdmin?.email ?? null,
      }}
    />
  );
}
