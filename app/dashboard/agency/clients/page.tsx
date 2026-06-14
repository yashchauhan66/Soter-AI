import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { listClients } from "@/lib/agency";

export const dynamic = "force-dynamic";

export default async function AgencyClientsPage() {
  const { clients } = await listClients();
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agency</p>
          <h1 className="mt-2 text-3xl font-bold">Clients</h1>
          <p className="mt-2 text-slate-400">Each client has their own projects, API keys, badge, and reports.</p>
        </div>
        <Link href="/dashboard/agency/clients/new" className="button-primary gap-2"><Plus size={18} /> Add client</Link>
      </div>
      {clients.length ? (
        <div className="mt-7 overflow-x-auto card">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Projects</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold">{client.name}</td>
                  <td className="px-4 py-3 text-slate-400">{client.contactEmail ?? "-"}</td>
                  <td className="px-4 py-3">{client._count.projects}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(client.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/dashboard/agency/clients/${client.id}`} className="text-cyan">Manage</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card mt-7 p-10 text-center">
          <Users className="mx-auto text-slate-700" size={42} />
          <p className="mt-4 font-semibold">No clients yet</p>
          <Link href="/dashboard/agency/clients/new" className="button-primary mt-5 inline-flex gap-2"><Plus size={16} /> Add first client</Link>
        </div>
      )}
    </div>
  );
}
