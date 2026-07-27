import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { LiveThreatConsole } from "@/components/marketing/LiveThreatConsole";
import { heroCopy, productStatus } from "@/lib/marketing/launchStatus";

const trustStats = [
  ["100%", "Recall on Phase 9 synthetic dataset"],
  ["0.00%", "FPR on 1,000 benchmark controls"],
  ["10.92ms", "Benchmark p95 analyzer latency"],
  ["4", "Languages incl. Hinglish"],
];

const assurances = [
  "Local-first AI usage controls",
  "Agent action review",
  "No raw secret storage on redaction paths",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(49,215,200,0.12),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0))] py-20 sm:py-24">
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
            AI usage and agent control security
          </span>

          <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.4rem]">
            {heroCopy.headline}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            {heroCopy.subheading}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="button-primary gap-2">
              Start Free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/contact-sales" className="button-secondary">
              {heroCopy.secondaryCta}
            </Link>
            <Link href="/playground" className="button-secondary">
              Try API
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

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-800 pt-7 sm:grid-cols-4">
            {trustStats.map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-black text-cyan sm:text-3xl">{value}</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-2">
            {productStatus.map((product) => (
              <span key={product.name} className="rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300">
                {product.name}: <span className="text-cyan">{product.status}</span>
              </span>
            ))}
          </div>
        </div>

        <LiveThreatConsole />
      </div>
    </section>
  );
}
