import { db } from "@/lib/db";
import { listAIDestinations } from "@/lib/ai-destinations";
import { AIDestinationsClient } from "@/components/admin/ai-destinations/AIDestinationsClient";

export const dynamic = "force-dynamic";

export default async function AdminAIDestinationsPage() {
  const organizations = await db.organization.findMany({ orderBy: { createdAt: "asc" }, take: 100, select: { id: true, name: true } });
  const organizationId = organizations[0]?.id ?? "";
  if (!organizationId) return <div className="rounded-xl border border-slate-800 p-6"><h1 className="text-2xl font-bold">AI destinations</h1><p className="mt-2 text-sm text-slate-400">Create an organization before configuring destination controls.</p></div>;
  let destinations = [] as Awaited<ReturnType<typeof listAIDestinations>>;
  try { destinations = await listAIDestinations(organizationId); } catch (error) { console.error("[Soter] AI destinations unavailable", error); }
  return <AIDestinationsClient organizationId={organizationId} organizations={organizations} initialDestinations={destinations} />;
}
