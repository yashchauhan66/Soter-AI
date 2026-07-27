import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, LifeBuoy, PlayCircle, Sparkles } from "lucide-react";
import { ACTIVATION_PATHS } from "@/lib/ux/activationPaths";

export function UserSuccessCommandCenter({
  completed,
  total,
  nextAction,
}: {
  completed: number;
  total: number;
  nextAction: { title: string; href: string } | null;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section aria-labelledby="success-center-heading" className="rounded-2xl border border-cyan/25 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">Start here</p>
          <h2 id="success-center-heading" className="mt-2 text-2xl font-bold text-white">
            Choose your path. Reach first value without guessing.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            SoterAI has many security tools, so this panel keeps the first session focused on one clear outcome.
          </p>
        </div>
        <div className="min-w-[180px] rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Setup progress</span>
            <span className="text-lg font-bold text-cyan">{percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Workspace setup progress" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}>
            <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 md:grid-cols-2">
          {ACTIVATION_PATHS.map((path) => {
            const Icon = path.icon;
            return (
              <Link key={path.key} href={path.href} className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-cyan/40 hover:bg-slate-900">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{path.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{path.who}</p>
                    <p className="mt-2 text-xs font-medium text-emerald-300">{path.outcome}</p>
                  </div>
                  <ArrowRight size={16} className="ml-auto shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>

        <aside className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" aria-label="Recommended next action">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={16} className="text-cyan" aria-hidden="true" />
            Recommended next step
          </div>
          {nextAction ? (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-400">{nextAction.title}</p>
              <Link href={nextAction.href} className="button-primary mt-4 w-full justify-center !py-2 text-sm">
                Continue <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">Your setup checklist is complete. Review logs or run a red-team test next.</p>
          )}
          <div className="mt-4 grid gap-2 border-t border-slate-800 pt-4 text-sm">
            <Link href="/dashboard/onboarding" className="flex items-center gap-2 text-slate-300 hover:text-cyan">
              <PlayCircle size={15} aria-hidden="true" /> Guided checklist
            </Link>
            <Link href="/dashboard/support" className="flex items-center gap-2 text-slate-300 hover:text-cyan">
              <LifeBuoy size={15} aria-hidden="true" /> Get help
            </Link>
          </div>
        </aside>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-300" aria-hidden="true" /> Clear outcome</span>
        <span className="inline-flex items-center gap-1"><Circle size={14} className="text-slate-500" aria-hidden="true" /> No setup dead ends</span>
      </div>
    </section>
  );
}
