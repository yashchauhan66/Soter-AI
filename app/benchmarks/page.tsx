import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, BarChart3, Gauge, Zap, Layers } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  title: "Adversarial Benchmark | SoterAI",
  description:
    "Honest, reproducible benchmark of the SoterAI guard: Recall@1%FPR, ROC-AUC, multi-turn detection and latency, run with the exact production classifier. Full methodology, corpus provenance and limitations included.",
  alternates: { canonical: "/benchmarks" },
  openGraph: {
    title: "SoterAI Adversarial Benchmark",
    description:
      "Recall at a 1% false-positive budget, ROC-AUC, multi-turn (Crescendo) detection and latency — measured with the exact production classifier on a disclosed corpus.",
  },
};

// Shape of scripts/guard-benchmark/honest-results.json (written by
// `npm run benchmark:honest`). Kept in sync with lib/benchmarks/honestBenchmark.ts.
interface HonestResults {
  singleTurn: {
    generatedAtIso: string;
    corpus: {
      total: number;
      attacks: number;
      benign: number;
      sources: Record<string, { total: number; attacks: number; benign: number }>;
    };
    production: {
      precision: number;
      recall: number;
      f1: number;
      falsePositiveRate: number;
      falseNegativeRate: number;
      blockOrReviewRate: number;
    };
    recallAtFpr: Array<{
      targetFpr: number;
      threshold: number;
      recall: number;
      fprAchieved: number;
      allowedFalsePositives: number;
    }>;
    rocAuc: number;
    perCategory: Array<{ category: string; total: number; detected: number; recall: number }>;
    latencyMs: { p50: number; p95: number; p99: number; max: number };
    limitations: string[];
  };
  multiTurn: {
    total: number;
    attacks: number;
    benign: number;
    recall: number;
    falsePositiveRate: number;
    meanTurnsToDetect: number;
  };
}

function loadData(): HonestResults | null {
  try {
    const filePath = join(process.cwd(), "scripts/guard-benchmark/honest-results.json");
    return JSON.parse(readFileSync(filePath, "utf-8")) as HonestResults;
  } catch {
    return null;
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function recallBarColor(recall: number): string {
  if (recall >= 0.85) return "from-cyan to-lime";
  if (recall >= 0.6) return "from-amber-400 to-cyan";
  return "from-rose-500 to-amber-400";
}

// Comprehensive adversarial battery — service-by-service hardening scenarios.
// This is a service-hardening regression suite (does each service reject its
// abuse cases), distinct from the detection-accuracy numbers above.
const BATTERY = {
  date: "2026-06-29",
  total: 101,
  passed: 101,
  serviceCount: 21,
} as const;

function jsonLd(data: HonestResults) {
  const st = data.singleTurn;
  const at1 = st.recallAtFpr.find((r) => r.targetFpr === 0.01);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "SoterAI",
        applicationCategory: "SecurityApplication",
        operatingSystem: "Linux, macOS, Windows",
        mainEntityOfPage: { "@type": "WebPage", "@id": "https://soterai.in/benchmarks" },
        description:
          "AI security guardrail platform protecting against prompt injection, jailbreaks, PII leakage, and unsafe outputs.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        url: "https://soterai.in/benchmarks",
      },
      {
        "@type": "Dataset",
        name: "SoterAI Guard Benchmark",
        description: `Honest guard benchmark on a disclosed ${st.corpus.total}-case corpus (${st.corpus.attacks} attacks / ${st.corpus.benign} benign): ROC-AUC ${st.rocAuc.toFixed(3)}, Recall@1%FPR ${at1 ? pct(at1.recall) : "n/a"}. Measured with the exact production classifier.`,
        url: "https://soterai.in/benchmarks",
        datePublished: st.generatedAtIso,
        mainEntityOfPage: { "@type": "WebPage", "@id": "https://soterai.in/benchmarks" },
        creator: { "@type": "Organization", name: "Soter" },
        variableMeasured: [
          { name: "ROC-AUC", value: st.rocAuc.toFixed(4) },
          { name: "Recall@1%FPR", value: at1 ? at1.recall.toFixed(4) : "n/a" },
          { name: "Production Precision", value: st.production.precision.toFixed(4) },
          { name: "Production F1", value: st.production.f1.toFixed(4) },
          { name: "False Positive Rate", value: pct(st.production.falsePositiveRate) },
          { name: "p50 Latency", value: `${st.latencyMs.p50.toFixed(1)}ms` },
          { name: "Multi-turn Recall", value: data.multiTurn.recall.toFixed(4) },
        ],
        measurementTechnique: "Recall at fixed false-positive budget (Recall@1%FPR) + ROC-AUC over a disclosed corpus, run with the production analyzeText classifier",
      },
    ],
  };
}

export default function BenchmarksPage() {
  const data = loadData();

  if (!data) {
    return (
      <main className="container-page py-24 text-center">
        <p className="eyebrow">Benchmark</p>
        <h1 className="mt-4 text-4xl font-bold">Results not available</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">Generate the honest benchmark artifact first:</p>
        <pre className="mx-auto mt-6 max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-4 text-left text-sm text-slate-300">
          npm run benchmark:honest
        </pre>
      </main>
    );
  }

  const { singleTurn: st, multiTurn: mt } = data;
  const at1 = st.recallAtFpr.find((r) => r.targetFpr === 0.01);
  const at01 = st.recallAtFpr.find((r) => r.targetFpr === 0.001);

  return (
    <main className="py-16 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd(data)) }} />
      <div className="container-page">
        {/* Header */}
        <div className="text-center">
          <p className="eyebrow">Adversarial Benchmark</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Recall <span className="text-cyan">{at1 ? pct(at1.recall) : "—"}</span> at a 1% false-positive budget
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-400">
            Measured with the <em>exact</em> production classifier over a disclosed corpus of {st.corpus.total.toLocaleString()} cases
            ({st.corpus.attacks} attacks, {st.corpus.benign.toLocaleString()} benign). We publish the metric that actually matters —
            recall at a fixed false-positive rate — not a &ldquo;100%&rdquo; score. Reproduce it with{" "}
            <code className="text-cyan">npm run benchmark:honest</code>.
          </p>
          <div className="mt-4 text-sm text-slate-500">Run date: {formatDate(st.generatedAtIso)}</div>
        </div>

        {/* "How to read this" */}
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-cyan/20 bg-cyan/5 p-5 text-sm leading-6 text-slate-300">
          <p className="flex items-center gap-2 font-semibold text-cyan">
            <AlertTriangle size={16} aria-hidden="true" /> How to read this
          </p>
          <p className="mt-2">
            A guard is only useful if it catches attacks <strong>without</strong> flooding real users with false blocks.
            <strong> Recall@1%FPR</strong> answers exactly that: &ldquo;if we tune the guard so at most 1 in 100 benign
            messages is flagged, what fraction of real attacks do we still catch?&rdquo; It is the metric industry
            benchmarks (Lakera PINT, Meta PromptGuard-2) report — and it is far more honest than a headline accuracy number.
          </p>
        </div>

        {/* Hero Score Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-6 text-center">
            <div className="text-4xl font-black text-cyan">{at1 ? pct(at1.recall) : "—"}</div>
            <p className="mt-2 text-sm text-slate-400">Recall @ 1% FPR</p>
            <p className="text-xs text-slate-500">Attacks caught within a 1% false-positive budget</p>
          </div>
          <div className="card p-6 text-center">
            <div className="text-4xl font-black text-lime">{st.rocAuc.toFixed(3)}</div>
            <p className="mt-2 text-sm text-slate-400">ROC-AUC</p>
            <p className="text-xs text-slate-500">Threshold-independent separability</p>
          </div>
          <div className="card p-6 text-center">
            <div className="text-4xl font-black text-emerald">{pct(st.production.precision)}</div>
            <p className="mt-2 text-sm text-slate-400">Precision</p>
            <p className="text-xs text-slate-500">FPR {pct(st.production.falsePositiveRate)} on {st.corpus.benign.toLocaleString()} benign</p>
          </div>
          <div className="card p-6 text-center">
            <div className="text-4xl font-black text-cyan">{st.latencyMs.p50.toFixed(1)}ms</div>
            <p className="mt-2 text-sm text-slate-400">p50 Latency</p>
            <p className="text-xs text-slate-500">Analyzer CPU time, no network</p>
          </div>
        </div>

        {/* Production-threshold detail */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Zap size={16} aria-hidden="true" /> Mitigation recall
            </div>
            <p className="mt-2 text-2xl font-bold">{pct(st.production.recall)}</p>
            <p className="text-xs text-slate-500">Attacks blocked, reviewed, rewritten or redacted</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck size={16} aria-hidden="true" /> Hard block / review
            </div>
            <p className="mt-2 text-2xl font-bold">{pct(st.production.blockOrReviewRate)}</p>
            <p className="text-xs text-slate-500">Strictest — fully stopped or escalated</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <BarChart3 size={16} aria-hidden="true" /> Production F1
            </div>
            <p className="mt-2 text-2xl font-bold">{st.production.f1.toFixed(3)}</p>
            <p className="text-xs text-slate-500">
              Recall@0.1%FPR drops to {at01 ? pct(at01.recall) : "—"} — the deterministic-engine ceiling
            </p>
          </div>
        </div>

        {/* Multi-turn / adaptive */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Layers className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Multi-turn / adaptive (Crescendo)</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Static single-turn benchmarks miss the most realistic attack shape: the slow escalation where each message is
            individually mild but the session as a whole builds toward a bypass. We evaluate the session-level defense
            separately across {mt.total} conversations (including benign sessions that reuse &ldquo;as we discussed / go
            deeper&rdquo; phrasing, to measure false escalation honestly).
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-cyan">{pct(mt.recall)}</div>
              <p className="mt-2 text-sm text-slate-400">Multi-turn recall</p>
              <p className="text-xs text-slate-500">Escalating attack sessions caught</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-lime">{pct(mt.falsePositiveRate)}</div>
              <p className="mt-2 text-sm text-slate-400">Benign escalation rate</p>
              <p className="text-xs text-slate-500">Benign sessions wrongly escalated</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-emerald">{mt.meanTurnsToDetect.toFixed(1)}</div>
              <p className="mt-2 text-sm text-slate-400">Mean turns to catch</p>
              <p className="text-xs text-slate-500">How fast the session defense fires</p>
            </div>
          </div>
        </section>

        {/* Per-category recall (weakest first) */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Detection by attack category</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Weakest categories first — we show where the guard is strong <em>and</em> where it has room to improve, because
            an honest benchmark is how detection actually gets better.
          </p>
          <div className="mt-6 grid gap-4">
            {st.perCategory.map((cat) => {
              const p = cat.recall * 100;
              return (
                <div key={cat.category} className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{cat.category}</h3>
                      <p className="text-sm text-slate-500">{cat.total} attack prompt{cat.total === 1 ? "" : "s"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${cat.recall >= 0.85 ? "text-lime" : cat.recall >= 0.6 ? "text-amber-300" : "text-rose-400"}`}>
                        {cat.detected}/{cat.total}
                      </span>
                      <span className="ml-2 text-sm text-slate-400">({p.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full bg-gradient-to-r ${recallBarColor(cat.recall)} transition-all`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Corpus provenance */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Corpus &amp; provenance</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Every case is labeled with its source so you can audit exactly what these numbers were measured against.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Object.entries(st.corpus.sources).map(([source, s]) => (
              <div key={source} className="card p-5">
                <p className="font-mono text-sm text-cyan">{source}</p>
                <p className="mt-2 text-2xl font-bold">{s.total.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{s.attacks} attack · {s.benign.toLocaleString()} benign</p>
              </div>
            ))}
          </div>
        </section>

        {/* Latency */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Gauge className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Latency</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Per-input analyzer CPU time (deterministic engine, no model, no network). The one-off cold-start outlier
            (~{st.latencyMs.max.toFixed(0)}ms max) is JIT/module warm-up, not steady-state.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-slate-400">p50 (Median)</p>
              <p className="mt-1 text-3xl font-bold text-cyan">{st.latencyMs.p50.toFixed(1)}ms</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-400">p95</p>
              <p className="mt-1 text-3xl font-bold text-cyan">{st.latencyMs.p95.toFixed(1)}ms</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-400">p99</p>
              <p className="mt-1 text-3xl font-bold text-cyan">{st.latencyMs.p99.toFixed(1)}ms</p>
            </div>
          </div>
        </section>

        {/* Comprehensive Adversarial Battery (service hardening) */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Service-hardening battery</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Separate from detection accuracy: an end-to-end regression suite asserting each security service rejects its
            abuse cases — agent firewall bypass, passport forgery, delegation abuse, egress exfiltration, evidence
            tampering. It exits non-zero if any scenario regresses.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-lime">{BATTERY.passed}/{BATTERY.total}</div>
              <p className="mt-2 text-sm text-slate-400">Scenarios passing</p>
              <p className="text-xs text-slate-500">Across {BATTERY.serviceCount} services</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-cyan">{BATTERY.serviceCount}</div>
              <p className="mt-2 text-sm text-slate-400">Services covered</p>
              <p className="text-xs text-slate-500">Guard, agents, identity, evidence, SIEM</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-4xl font-black text-emerald">0</div>
              <p className="mt-2 text-sm text-slate-400">Failing scenarios</p>
              <p className="text-xs text-slate-500">Run {formatDate(BATTERY.date)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Command: <code className="text-cyan">npx tsx tests/comprehensive-adversarial-test-battery.ts</code>. This is a
            service-hardening suite, <strong>not</strong> a detection-accuracy score — those are the honest metrics above.
          </p>
        </section>

        {/* Methodology & Limitations */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-cyan" size={24} aria-hidden="true" />
            <h2 className="text-2xl font-bold">Methodology &amp; limitations</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-semibold">Method</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The exact production classifier (<code className="text-cyan">analyzeText</code>) scores every case. We sweep
                its risk score to find the threshold that keeps benign false positives at or below 1%, then report attack
                recall there (Recall@1%FPR), plus ROC-AUC, per-category recall, a multi-turn Crescendo evaluation, and
                latency. Reproduce with <code className="text-cyan">npm run benchmark:honest</code>.
              </p>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold">Limitations we disclose</h3>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-400">
                {st.limitations.map((lim, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-cyan">{i + 1}.</span>
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16">
          <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Test your own chatbot flow.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Try the interactive playground, then protect both sides of your model call.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/playground" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
                Try the playground <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink">
                Read docs
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-slate-600">
          Full raw results available at{" "}
          <a href="/api/benchmarks" className="text-cyan underline underline-offset-2 hover:text-cyan/80">
            /api/benchmarks
          </a>{" "}
          (JSON).
        </p>
      </div>
    </main>
  );
}
