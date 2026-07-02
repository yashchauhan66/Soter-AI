import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { LiveThreatConsole } from "@/components/marketing/LiveThreatConsole";

const trustStats = [
  ["97/97", "Adversarial cases detected"],
  ["0", "False positives (25/25 safe)"],
  ["<50ms", "Guard decision latency"],
  ["4", "Languages incl. Hinglish"],
];

const assurances = [
  "Input & output guard",
  "Agent firewall controls",
  "No raw secret storage",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(49,215,200,0.12),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0))] py-20 sm:py-24">
      {/* Animated grid + radar glow backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 grid-fade-anim opacity-60" />
      <div className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[480px] w-[480px] rounded-full bg-cyan/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 -z-10 h-[420px] w-[420px] rounded-full bg-lime/5 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 hidden h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 lg:block">
        <div className="animate-radar h-full w-full rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(49,215,200,0.07)_40deg,transparent_80deg)]" />
      </div>

      <div className="container-page grid items-center gap-12 lg:grid-cols-[1.02fr_.98fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
            <Sparkles size={14} aria-hidden="true" />
            Adversarial benchmark · F1 = 1.0000
          </span>

          <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.4rem]">
            The security command layer for{" "}
            <span className="bg-gradient-to-r from-cyan to-lime bg-clip-text text-transparent">
              production AI.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            SoterAI inspects every prompt, response, retrieval, and agent tool-call in
            real time — blocking prompt injection, redacting sensitive data, and turning
            every risky interaction into evidence your team can trust.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/playground" className="button-primary gap-2">
              See it block an attack <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/docs" className="button-secondary">
              Read integration docs
            </Link>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
            {assurances.map((item) => (
              <span className="flex items-center gap-2" key={item}>
                <CheckCircle2 className="text-lime" size={16} aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>

          {/* Trust stat strip */}
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-800 pt-7 sm:grid-cols-4">
            {trustStats.map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-black text-cyan sm:text-3xl">{value}</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <LiveThreatConsole />
      </div>
    </section>
  );
}
