import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { getOrCreateAgency } from "@/lib/agency";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/PageHeader";

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
      <PageHeader
        eyebrow="New project"
        title="Protect another chatbot"
        description="Create the project first, then issue a scoped API key."
      />
      <NewProjectForm clients={clients} />
    </div>
  );
}
