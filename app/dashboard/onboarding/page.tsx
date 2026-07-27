import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock3, LifeBuoy, Route } from "lucide-react";
import { loadOnboarding } from "@/lib/onboarding";
import { ACTIVATION_PATHS, nextOnboardingAction } from "@/lib/ux/activationPaths";
import { SdkInstalledButton } from "@/components/dashboard/SdkInstalledButton";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { items, done, total, percent } = await loadOnboarding();
  const nextAction = nextOnboardingAction(items);

  return (
    <div className="space-y-7">
      <p className="eyebrow">Beta onboarding</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-bold">Get to first protected value</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Pick the path closest to your job, then follow the checklist. Every step has a clear outcome and a place to continue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/support" className="button-secondary !px-4 !py-2 text-sm gap-2">
            <LifeBuoy size={15} aria-hidden="true" /> Get help
          </Link>
          <Link href="/dashboard" className="button-secondary !px-4 !py-2 text-sm gap-2">
            Skip for now <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Role-based setup paths">
        {ACTIVATION_PATHS.map((path) => {
          const Icon = path.icon;
          return (
            <Link key={path.key} href={path.href} className="group rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan/40 hover:bg-slate-900">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-white">{path.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{path.who}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-emerald-300">{path.outcome}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Progress</p>
              <p className="text-3xl font-bold">{done} / {total}</p>
            </div>
            <p className="text-3xl font-black text-cyan">{percent}%</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Onboarding completion" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
            <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <aside className="rounded-xl border border-cyan/25 bg-cyan/5 p-5" aria-label="Next best action">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Route size={16} className="text-cyan" aria-hidden="true" />
            Next best action
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{nextAction?.title ?? "Review your guarded activity"}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Clock3 size={14} aria-hidden="true" /> Usually 2-5 minutes
          </p>
          {nextAction && (
            <Link href={nextAction.href} className="button-primary mt-4 w-full justify-center !py-2 text-sm gap-2">
              Continue <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </aside>
      </section>

      <ol className="space-y-3">
        {items.map((item, index) => (
          <li key={item.key} className={`rounded-xl border bg-slate-950/50 p-5 ${item.done ? "border-emerald-500/25" : "border-slate-800"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                {item.done ? <CheckCircle2 className="mt-1 shrink-0 text-emerald-300" aria-hidden="true" /> : <Circle className="mt-1 shrink-0 text-slate-600" aria-hidden="true" />}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{index + 1}. {item.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.done ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                      {item.done ? "Done" : "Open"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                </div>
              </div>
              {item.key === "sdk" ? (
                <SdkInstalledButton done={item.done} />
              ) : (
                <Link href={item.href} className="button-secondary !px-4 !py-2 text-sm gap-2">
                  {item.done ? "Open" : "Start"} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
