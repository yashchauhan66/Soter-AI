import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { getOrCreateAgency } from "@/lib/agency";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const agency = await getOrCreateAgency();
  const clients = await db.client.findMany({
    where: { agencyId: agency.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <p className="eyebrow">New project</p>
      <h1 className="mt-2 text-3xl font-bold">Protect another chatbot</h1>
      <p className="mb-7 mt-3 text-slate-400">Create the project first, then issue a scoped API key.</p>
      <NewProjectForm clients={clients} />
    </div>
  );
}
