import { SupportTicketForm } from "@/components/phase8/SupportTicketForm";
import { getCurrentUserProjects } from "@/lib/auth";
export default async function NewSupportTicketPage() { const projects = await getCurrentUserProjects(); return <div className="max-w-2xl"><p className="eyebrow">Support</p><h1 className="mt-2 text-3xl font-bold">Create a support ticket</h1><p className="mb-7 mt-3 text-slate-400">Submit redacted context only. Never include API keys, passwords, raw secrets, or unredacted customer conversations.</p><SupportTicketForm projects={projects} /></div>; }
