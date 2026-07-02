import { db } from "@/lib/db";
import { ApprovalQueueClient } from "@/components/admin/ai-policies/ApprovalQueueClient";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  // Get approval requests from security events with EXTENSION_APPROVAL_REQUEST type
  const approvalRequests = await db.securityEvent.findMany({
    where: {
      eventType: { in: ["EXTENSION_APPROVAL_REQUEST", "EXTENSION_APPROVAL_REQUESTED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Also get the audit log entries for completed approvals
  const approvalActions = await db.adminAuditLog.findMany({
    where: {
      action: { in: ["extension_approval_granted", "extension_approval_rejected", "extension_approval_redacted"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      adminUser: { select: { email: true, name: true } },
    },
  });

  const parsedApprovals = approvalRequests.map((event) => {
    const meta = (event.metadata as Record<string, unknown>) ?? {};
    return {
      id: event.id,
      organizationId: event.organizationId,
      employeeId: (meta.employeeId as string) ?? "unknown",
      domain: (meta.domain as string) ?? "unknown",
      destination: (meta.destination as string) ?? "Unknown",
      detectedDataTypes: (meta.detectedDataTypes as string[]) ?? [],
      severity: event.severity,
      riskScore: (meta.riskScore as number) ?? 0,
      redactedPreview: (meta.redactedPreview as string) ?? "",
      justification: (meta.justification as string) ?? "",
      status: "pending" as const,
      createdAt: event.createdAt.toISOString(),
    };
  });

  return (
    <ApprovalQueueClient
      organizations={organizations}
      initialApprovals={parsedApprovals}
      initialActions={approvalActions.map((a) => ({
        id: a.id,
        action: a.action,
        adminEmail: a.adminUser?.email ?? "system",
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
        targetId: a.targetId,
      }))}
    />
  );
}
