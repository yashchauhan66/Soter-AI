import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { members: true, projects: true, securityEvents: true } } },
  });
  return (
    <div>
      <p className="eyebrow">Platform admin</p>
      <h1 className="mt-2 text-3xl font-bold">Organizations</h1>
      <section className="mt-6 card p-5">
        <div className="space-y-3 text-sm">
          {organizations.map((org) => (
            <div className="rounded-lg border border-slate-800 p-3" key={org.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{org.name}</p>
                <p className="text-slate-500">{org.plan} - {org.disabled ? "disabled" : "active"}</p>
              </div>
              <p className="mt-2 text-slate-400">{org.slug} - {org._count.members} members - {org._count.projects} projects - {org._count.securityEvents} security events</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
