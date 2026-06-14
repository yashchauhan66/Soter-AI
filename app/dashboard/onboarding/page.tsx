import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { loadOnboarding } from "@/lib/onboarding";
import { SdkInstalledButton } from "@/components/dashboard/SdkInstalledButton";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { items, done, total, percent } = await loadOnboarding();
  return (
    <div>
      <p className="eyebrow">Beta onboarding</p>
      <h1 className="mt-2 text-3xl font-bold">Get to a protected chatbot</h1>
      <p className="mt-3 text-slate-400">Each step unlocks a capability. Skip any step you do not need today.</p>

      <div className="card mt-7 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Progress</p>
            <p className="text-3xl font-bold">{done} / {total}</p>
          </div>
          <p className="text-3xl font-black text-cyan">{percent}%</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {items.map((item, index) => (
          <li key={item.key} className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${item.done ? "border-emerald-500/20" : ""}`}>
            <div className="flex items-start gap-4">
              {item.done ? <CheckCircle2 className="mt-1 text-emerald-300" /> : <Circle className="mt-1 text-slate-600" />}
              <div>
                <p className="font-semibold">{index + 1}. {item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </div>
            </div>
            {item.key === "sdk" ? (
              <SdkInstalledButton done={item.done} />
            ) : (
              <Link href={item.href} className="button-secondary !px-4 !py-2 text-sm gap-2">
                {item.done ? "Open" : "Start"} <ArrowRight size={14} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
