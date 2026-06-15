import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    return (
      <main className="container-page py-20">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><ShieldAlert /></span>
          <h1 className="mt-4 text-xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-slate-400">Your account does not have administrator access. If you need it, contact the workspace owner.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="container-page py-10">
      <div className="mb-7 flex items-center gap-3">
        <span className="rounded-xl bg-amber-500/15 p-2 text-amber-300"><ShieldAlert size={18} /></span>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Internal admin · use carefully</p>
      </div>
      <nav className="mb-7 flex flex-wrap gap-2 text-sm">{[["Overview", "/admin"], ["Growth", "/admin/growth/metrics"], ["Organizations", "/admin/organizations"], ["Projects", "/admin/projects"], ["Support", "/admin/support"], ["Production", "/admin/production"], ["Detection quality", "/admin/detection-quality"], ["KMS", "/admin/kms"], ["Classifiers", "/admin/classifier-evals"], ["ML registry", "/admin/ml"], ["ML datasets", "/admin/ml/datasets"], ["ML evaluations", "/admin/ml/evaluations"], ["ML review", "/admin/ml/review"], ["ML deployments", "/admin/ml/deployments"], ["Red team", "/admin/redteam"], ["SIEM", "/admin/siem"], ["System health", "/admin/system-health"]].map(([label, href]) => <Link className="rounded-lg border border-slate-800 px-3 py-2 text-slate-300 hover:border-cyan-500/50" href={href} key={href}>{label}</Link>)}</nav>
      {children}
    </main>
  );
}
