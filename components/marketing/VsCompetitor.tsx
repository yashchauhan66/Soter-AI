import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ExternalLink,
  Award,
  AlertTriangle,
} from "lucide-react";

export interface VsRow {
  feature: string;
  desc?: string;
  soter: string;
  them: string;
}

export interface VsContent {
  slug: string;
  competitor: string;
  competitorNote?: string;
  tagline: string;
  intro: string;
  /** Honest summary of what the competitor is genuinely strong at. */
  theirStrength: string;
  /** Where Soter has the edge. */
  soterEdge: string[];
  /** Where the competitor stays ahead — keep this honest. */
  theirEdge: string[];
  rows: VsRow[];
  bestFor: { soter: string; them: string };
  sourceUrl: string;
  sourceLabel: string;
}

function cell(val: string) {
  if (val === "yes") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lime/10 text-lime">
        <CheckCircle2 size={16} aria-hidden="true" />
      </span>
    );
  }
  if (val === "no") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <XCircle size={16} aria-hidden="true" />
      </span>
    );
  }
  return <span className="text-sm text-slate-300">{val}</span>;
}

export function VsCompetitor({ data }: { data: VsContent }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `SoterAI vs ${data.competitor}`,
    description: data.intro,
    mainEntity: {
      "@type": "ItemList",
      name: `SoterAI vs ${data.competitor} feature comparison`,
      numberOfItems: data.rows.length,
      itemListElement: data.rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: r.feature,
      })),
    },
  };

  return (
    <main className="py-16 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-page">
        {/* Hero */}
        <div className="text-center">
          <p className="eyebrow">Comparison</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            SoterAI <span className="text-slate-500">vs</span>{" "}
            <span className="text-cyan">{data.competitor}</span>
          </h1>
          {data.competitorNote && <p className="mt-2 text-sm text-slate-500">{data.competitorNote}</p>}
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-7 text-slate-400">{data.tagline}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="button-primary gap-2">
              Get started free <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/comparison" className="button-secondary gap-2">
              Full comparison
            </Link>
            <Link href="/playground" className="text-sm text-slate-400 hover:text-white">
              Try the playground
            </Link>
          </div>
        </div>

        {/* Intro */}
        <div className="mx-auto mt-12 max-w-3xl space-y-4 leading-7 text-slate-400">
          <p>{data.intro}</p>
        </div>

        {/* Honest framing */}
        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="card border-cyan/20 p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-cyan" size={20} aria-hidden="true" />
              <h2 className="text-lg font-bold">Where SoterAI wins</h2>
            </div>
            <ul className="mt-4 space-y-2">
              {data.soterEdge.map((e) => (
                <li key={e} className="flex gap-2 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card border-amber-400/20 p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-300" size={20} aria-hidden="true" />
              <h2 className="text-lg font-bold">Where {data.competitor} stays ahead</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{data.theirStrength}</p>
            <ul className="mt-3 space-y-2">
              {data.theirEdge.map((e) => (
                <li key={e} className="flex gap-2 text-sm leading-6 text-slate-400">
                  <span className="mt-0.5 shrink-0 text-amber-300">→</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Feature table */}
        <section className="mt-14">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Award className="text-cyan" size={24} aria-hidden="true" /> Feature comparison
          </h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-300">Capability</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-cyan">SoterAI</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-slate-300">{data.competitor}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.feature} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-950/30" : ""}`}>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-200">{r.feature}</span>
                      {r.desc && <p className="text-xs text-slate-500">{r.desc}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-center font-bold">{cell(r.soter)}</td>
                    <td className="px-3 py-3.5 text-center">{cell(r.them)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            ✅ = Supported · ❌ = Not supported. Competitor capabilities are summarized from public documentation and may
            change.
          </p>
        </section>

        {/* Best for */}
        <section className="mt-14 grid gap-4 md:grid-cols-2">
          <div className="card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan">Choose SoterAI when</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{data.bestFor.soter}</p>
          </div>
          <div className="card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Choose {data.competitor} when</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{data.bestFor.them}</p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16">
          <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">See the difference yourself.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Fire a prompt-injection or PII attack in the live playground and watch SoterAI block it in under 50ms.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/playground" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
                Try the playground <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/benchmarks" className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink">
                View benchmarks
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-slate-600">
          Source:{" "}
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan underline underline-offset-2">
            {data.sourceLabel} <ExternalLink size={11} aria-hidden="true" />
          </a>{" "}
          · See the full{" "}
          <Link href="/comparison" className="text-cyan underline underline-offset-2">competitor landscape</Link>.
        </p>
      </div>
    </main>
  );
}
