import { SupportTicketForm } from "@/components/ops/SupportTicketForm";
import { getCurrentUserProjects } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/PageHeader";
export default async function NewSupportTicketPage() { const projects = await getCurrentUserProjects(); return <div className="max-w-2xl"><PageHeader
        eyebrow="Support"
        title="Create a support ticket"
        description="Submit redacted context only. Never include API keys, passwords, raw secrets, or unredacted customer conversations."
      /><SupportTicketForm projects={projects} /></div>; }
