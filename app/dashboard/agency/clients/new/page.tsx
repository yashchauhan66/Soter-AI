import { NewClientForm } from "@/components/dashboard/NewClientForm";

export default function NewClientPage() {
  return (
    <div>
      <p className="eyebrow">Agency</p>
      <h1 className="mt-2 text-3xl font-bold">Add client</h1>
      <p className="mt-3 text-slate-400">Clients group projects under your agency for client-wise stats, white-label reports, and badges.</p>
      <NewClientForm />
    </div>
  );
}
