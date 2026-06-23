import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { loadBadgeStatus } from "@/lib/badge";

export const dynamic = "force-dynamic";

export default async function PublicSecurityStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = await loadBadgeStatus(slug);
  if (!status) notFound();
  const accent = status.brandColor ?? "#31d7c8";

  const styles: Record<string, { bg: string; label: string; Icon: typeof ShieldCheck }> = {
    PROTECTED: { bg: "bg-emerald-500/15 text-emerald-300", label: "Protected", Icon: ShieldCheck },
    MONITORING_ACTIVE: { bg: "bg-cyan/15 text-cyan", label: "Monitoring active", Icon: ShieldCheck },
    ISSUES_FOUND: { bg: "bg-amber-500/15 text-amber-300", label: "Risks blocked", Icon: ShieldAlert },
    INACTIVE: { bg: "bg-slate-800 text-slate-400", label: "Inactive", Icon: ShieldOff },
  };
  const visual = styles[status.status];
  const Icon = visual.Icon;

  return (
    <main className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Public security status</p>
        <h1 className="mt-3 text-4xl font-bold">Protected AI application</h1>

        <div className="card mt-7 p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${visual.bg}`} style={{ borderColor: accent }}>
                <Icon size={24} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</p>
                <p className="text-2xl font-bold">{visual.label}</p>
              </div>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${accent}1A`, color: accent }}>
              {status.alignment}
            </span>
          </div>
          <p className="mt-5 leading-7 text-slate-300">{status.message}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Stat label="Requests scanned this month" value={status.monthRequestsScanned} />
            <Stat label="Risks blocked this month" value={status.monthRisksBlocked} />
            <Stat label="Last activity" value={status.lastActivity ? new Date(status.lastActivity).toLocaleDateString() : "No activity yet"} />
          </div>
        </div>

        <p className="mt-7 text-xs leading-6 text-slate-500">
          This page does not display the contents of any chatbot conversation, prompt, response, or detected secret.
          Numbers are aggregate counts over the calendar month. Pattern detection can produce false positives or false
          negatives; the badge represents defensive activity, not a promise of complete protection.
        </p>

        <Link href="/" className="mt-7 inline-block text-sm text-slate-400 hover:text-white">Powered by SoterAI →</Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
