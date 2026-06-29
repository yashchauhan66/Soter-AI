import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { GuidedDemoFlow } from "@/components/marketing/GuidedDemoFlow";

export const metadata: Metadata = {
  title: "2-Minute Guided Demo | SoterAI",
  description:
    "Watch one attack walk through SoterAI's full control loop: prompt injection attempt → tool action blocked → human approval → evidence report → SIEM/audit trace.",
  alternates: { canonical: "/demo/guided" },
  openGraph: {
    title: "2-Minute Guided Demo | SoterAI",
    description:
      "Injection → blocked tool call → human approval → evidence report → SIEM trace. The full agent-security loop in two minutes.",
    url: "/demo/guided",
  },
};

export default function GuidedDemoPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Guided demo</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          One attack, the whole control loop
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300">
          <Clock size={15} className="text-cyan" /> ~2 minutes
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-slate-400">
        This walkthrough follows a single prompt-injection attempt through every stage SoterAI runs in production — from
        detection to a signed audit trace. It autoplays; pause or step through at your own pace. The scenario is
        illustrative and uses synthetic data.
      </p>

      <div className="mt-10 max-w-4xl">
        <GuidedDemoFlow />
      </div>

      {/* Next steps */}
      <section className="mt-14 max-w-4xl">
        <h2 className="text-2xl font-bold">Go deeper</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Live playground", "Fire your own non-sensitive test inputs and watch the verdict.", "/playground"],
            ["Adversarial benchmark", "97/97 attack variants detected, F1 = 1.0000.", "/benchmarks"],
            ["Agent firewall approvals", "See the real approvals queue in the dashboard.", "/dashboard/agent-firewall/approvals"],
          ].map(([title, copy, href]) => (
            <Link key={title} href={href} className="card p-5 transition hover:border-cyan/50">
              <h3 className="font-semibold text-slate-100">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{copy}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
                Open <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 max-w-4xl">
        <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
          <h2 className="text-3xl font-black">Protect your agents in production.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-ink/70">
            Drop in the SDK, set a policy mode, and get this exact loop — block, approve, evidence, SIEM — out of the box.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
              Get started free <ArrowRight size={18} />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink">
              Read the docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
