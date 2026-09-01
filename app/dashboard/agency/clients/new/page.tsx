import { NewClientForm } from "@/components/dashboard/NewClientForm";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Agency"
        title="Add client"
        description="Clients group projects under your agency for client-wise stats, white-label reports, and badges."
      />
      <NewClientForm />
    </div>
  );
}
