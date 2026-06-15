"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, SkipForward } from "lucide-react";
import { ONBOARDING_STEPS, ONBOARDING_STEP_CONTENT, type OnboardingStepKey } from "@/lib/phase8/onboarding";

export function OnboardingWizard({ onboardingId: _onboardingId, type, projectId, initialSteps }: { onboardingId: string; type: "BETA" | "AGENCY" | "ENTERPRISE"; projectId: string; initialSteps: Array<{ stepKey: string; state: "COMPLETED" | "SKIPPED" }> }) {
  const [states, setStates] = useState(() => new Map(initialSteps.map((step) => [step.stepKey, step.state])));
  const [saving, setSaving] = useState<string | null>(null);
  const completed = [...states.values()].length;

  async function update(stepKey: OnboardingStepKey, state: "COMPLETED" | "SKIPPED") {
    setSaving(stepKey);
    const metadata: Record<string, string> = {};
    if (stepKey === "chatbot_type_selected") metadata.chatbotType = "customer-support";
    if (stepKey === "integration_selected") metadata.integrationMethod = "REST";
    const response = await fetch("/api/phase8/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, projectId, stepKey, state, metadata }) });
    if (response.ok) setStates((current) => new Map(current).set(stepKey, state));
    setSaving(null);
  }

  return <div>
    <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-sm text-slate-400">{completed} of {ONBOARDING_STEPS.length} steps recorded</p><div className="mt-2 h-2 w-64 max-w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan" style={{ width: `${Math.round(completed / ONBOARDING_STEPS.length * 100)}%` }} /></div></div><span className="text-2xl font-bold text-cyan">{Math.round(completed / ONBOARDING_STEPS.length * 100)}%</span></div>
    <div className="divide-y divide-slate-800 border-y border-slate-800">
      {ONBOARDING_STEPS.map((stepKey, index) => { const content = ONBOARDING_STEP_CONTENT[stepKey]; const state = states.get(stepKey); return <div className="grid gap-3 py-4 sm:grid-cols-[32px_1fr_auto] sm:items-center" key={stepKey}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${state ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-slate-700 text-slate-500"}`}>{state === "COMPLETED" ? <Check size={16} /> : state === "SKIPPED" ? <SkipForward size={15} /> : <Circle size={12} />}</span>
        <div><p className="font-medium">{index + 1}. {content.title}</p><Link href={content.href} className="mt-1 inline-block text-sm text-cyan hover:underline">Open setup</Link></div>
        <div className="flex gap-2"><button type="button" disabled={saving === stepKey} onClick={() => update(stepKey, "COMPLETED")} className="button-primary !px-3 !py-2 text-sm">Complete</button><button type="button" disabled={saving === stepKey} onClick={() => update(stepKey, "SKIPPED")} className="button-secondary !px-3 !py-2 text-sm">Skip</button></div>
      </div>; })}
    </div>
  </div>;
}
