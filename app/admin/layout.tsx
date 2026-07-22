import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AdminSidebar, type AdminBadgeCounts } from "@/components/admin/AdminSidebar";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, email: true },
  });
  if (!user?.isAdmin) {
    return (
      <main className="container-page py-20">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <ShieldAlert />
          </span>
          <h1 className="mt-4 text-xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your account does not have administrator access. If you need it, contact the workspace owner.
          </p>
        </div>
      </main>
    );
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    pendingApprovals,
    openTickets,
    unresolvedFeedback,
    failedDeliveries24h,
    failedJobs24h,
    shadowFindings24h,
    mlReviewQueue,
    lockedOrgs,
  ] = await Promise.all([
    db.aiUsageApprovalRequest.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
    db.detectionFeedback.count({ where: { review: null } }),
    db.webhookDelivery.count({ where: { status: { in: ["FAILED", "DEAD_LETTER"] }, createdAt: { gte: since24h } } }),
    db.backgroundJob.count({ where: { status: "FAILED", createdAt: { gte: since24h } } }),
    db.shadowAiFinding.count({ where: { createdAt: { gte: since24h } } }),
    db.mLReviewQueue.count({ where: { status: "PENDING" } }),
    db.emergencyLockdownState.count({ where: { enabled: true } }),
  ]);

  const counts: AdminBadgeCounts = {
    pendingApprovals,
    openTickets,
    unresolvedFeedback,
    failedDeliveries24h,
    failedJobs24h,
    shadowFindings24h,
    mlReviewQueue,
    lockedOrgs,
  };

  return (
    <div className="flex min-h-screen w-full bg-ink">
      <AdminSidebar counts={counts} adminEmail={user.email ?? "admin"} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </div>
      <AdminCommandPalette counts={counts} />
    </div>
  );
}
