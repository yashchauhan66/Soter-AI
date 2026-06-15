import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ORGANIZATION_PAGE_SIZE = 50;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const cursor = parseCursorDate(params.cursor);
  const rows = await db.organization.findMany({
    where: cursor ? { createdAt: { lt: cursor } } : undefined,
    orderBy: { createdAt: "desc" },
    take: ORGANIZATION_PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      disabled: true,
      createdAt: true,
      _count: { select: { members: true, projects: true, securityEvents: true } },
    },
  });
  const hasMore = rows.length > ORGANIZATION_PAGE_SIZE;
  const organizations = rows.slice(0, ORGANIZATION_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Platform admin</p>
          <h1 className="mt-2 text-3xl font-bold">Organizations</h1>
        </div>
        {hasMore && (
          <Link className="text-sm font-semibold text-cyan" href={`/admin/organizations?cursor=${organizations.at(-1)?.createdAt.toISOString()}`}>
            Next organizations
          </Link>
        )}
      </div>
      <section className="mt-6 card p-5">
        <div className="space-y-3 text-sm">
          {organizations.map((org) => (
            <div className="rounded-lg border border-slate-800 p-3" key={org.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{org.name}</p>
                <p className="text-slate-500">
                  {org.plan} - {org.disabled ? "disabled" : "active"}
                </p>
              </div>
              <p className="mt-2 text-slate-400">
                {org.slug} - {org._count.members} members - {org._count.projects} projects - {org._count.securityEvents} security events
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
