import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Zap } from "lucide-react";
import { FAQ } from "@/components/marketing/FAQ";
import { Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { SectionHeading } from "@/components/ui/SectionHeading";

const owaspCoverage = [
  ["LLM01", "Prompt injection", "Detect instruction overrides, jailbreak combinations, and prompt extraction attempts."],
  ["LLM02", "Sensitive information disclosure", "Redact PII, Indian identifiers, credentials, tokens, and database URLs."],
  ["LLM05", "Improper output handling", "Inspect model output for leaked instructions, unsafe claims, and suspicious links."],
  ["LLM10", "Unbounded consumption", "Apply text-size, per-minute, and monthly usage controls."],
];

const homepageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Soter Guard",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Linux, macOS, Windows",
      "description": "AI security guardrail platform. Protects chatbots, RAG apps, and AI agents from prompt injection, jailbreaks, PII leakage, and unsafe outputs with 2-way input+output coverage.",
      "url": "https://soter.dev",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://soter.dev" },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "additionalProperty": [
        { "@type": "PropertyValue", "name": "Input Guard", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Output Guard", "value": "Yes" },
        { "@type": "PropertyValue", "name": "RAG Security", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Agent Firewall", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Policy Engine", "value": "Yes" },
        { "@type": "PropertyValue", "name": "India PII Detection", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Self-Hosted", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Enterprise SSO", "value": "Yes" },
        { "@type": "PropertyValue", "name": "Adversarial Benchmark F1", "value": "1.0000" },
      ],
    },
    {
      "@type": "Dataset",
      "name": "Soter Guard Adversarial Benchmark",
      "description": "97/97 adversarial attack variants detected across 8 categories with zero false positives (F1=1.0000). Internal Garak-style red-team evaluation.",
      "url": "https://soter.dev/benchmarks",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://soter.dev/benchmarks" },
      "creator": { "@type": "Organization", "name": "Soter" },
      "measurementTechnique": "Garak-style adversarial probing",
      "variableMeasured": [
        { "name": "F1 Score", "value": "1.0000" },
        { "name": "Precision", "value": "1.0000" },
        { "name": "Recall", "value": "1.0000" },
        { "name": "Specificity", "value": "100.0%" },
        { "name": "False Positive Rate", "value": "0.0%" },
        { "name": "Attacks Detected", "value": "97/97" },
        { "name": "Safe Inputs Allowed", "value": "25/25" },
        { "name": "Attack Categories", "value": "8" },
      ],
    },
  ],
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
      />
      <Hero />
      <section className="py-20">
        <div className="container-page grid gap-5 md:grid-cols-3">
          <div className="card p-7 md:col-span-2">
            <p className="eyebrow">The problem</p>
            <h2 className="mt-3 text-3xl font-bold">Your chatbot can become a path to data exposure.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Untrusted prompts, copied secrets, personal data, and unsafe model responses need controls outside the model itself.
              CyberRakshak adds an observable policy gateway to the flow.
            </p>
          </div>
          <div className="card p-7">
            <p className="text-5xl font-black text-cyan">2-way</p>
            <p className="mt-4 font-semibold">Input plus output coverage</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Risk reduction before and after every model call.</p>
          </div>
        </div>
      </section>

      <HowItWorks />
      <Features />

      {/* ── Benchmark section ── */}
      <section className="border-y border-slate-800 bg-slate-950/40 py-20">
        <div className="container-page text-center">
          <p className="eyebrow">Adversarial Benchmark</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Proven detection: <span className="text-cyan">F1 = 1.0000</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            97/97 adversarial attack variants detected across 8 categories with zero false positives.
            Garak-style red-team evaluation against prompt injection, jailbreaks, PII leaks, and more.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6">
              <ShieldCheck className="mx-auto text-cyan" size={28} />
              <p className="mt-3 text-3xl font-black text-cyan">100%</p>
              <p className="mt-1 text-sm text-slate-400">Detection Rate</p>
              <p className="text-xs text-slate-500">97/97 adversarial prompts</p>
            </div>
            <div className="card p-6">
              <Zap className="mx-auto text-lime" size={28} />
              <p className="mt-3 text-3xl font-black text-lime">0%</p>
              <p className="mt-1 text-sm text-slate-400">False Positives</p>
              <p className="text-xs text-slate-500">25/25 safe inputs allowed</p>
            </div>
            <div className="card p-6">
              <Gauge className="mx-auto text-cyan" size={28} />
              <p className="mt-3 text-3xl font-black text-cyan">&lt;50ms</p>
              <p className="mt-1 text-sm text-slate-400">Inline Latency</p>
              <p className="text-xs text-slate-500">SDK-level detection</p>
            </div>
            <div className="card p-6">
              <BarChart3 className="mx-auto text-cyan" size={28} />
              <p className="mt-3 text-3xl font-black text-cyan">8</p>
              <p className="mt-1 text-sm text-slate-400">Attack Categories</p>
              <p className="text-xs text-slate-500">All detected at 100%</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {[
              "Prompt Injection",
              "Jailbreak / DAN",
              "Encoding / Obfuscation",
              "Multilingual (Hindi)",
              "Indirect Injection",
              "PII Detection",
              "Secrets / Credentials",
              "Unsafe Output",
            ].map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300"
              >
                {cat}
              </span>
            ))}
          </div>

          <Link
            href="/benchmarks"
            className="button-secondary mt-8 inline-flex items-center gap-2"
          >
            View full benchmark details <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/40 py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="OWASP alignment"
            title="Focused coverage for Phase 1 chatbot flows"
            copy="The controls map to relevant OWASP LLM Top 10 risk areas. Alignment supports risk reduction and is not a certification or claim of complete coverage."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {owaspCoverage.map(([id, title, copy]) => (
              <article className="card p-6" key={id}>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-cyan/10 px-2.5 py-1 text-xs font-bold text-cyan">{id}</span>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="container-page">
          <div className="card overflow-hidden p-8 sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Built for India</p>
                <h2 className="mt-3 text-3xl font-bold">Recognize local personal-data patterns.</h2>
                <p className="mt-4 leading-7 text-slate-400">
                  Add detection and redaction for Aadhaar-like patterns, PAN, GSTIN, UPI, IFSC, Indian mobile numbers,
                  and contextual student, patient, and bank identifiers.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {["Aadhaar-like", "PAN", "GSTIN", "UPI ID", "IFSC", "Indian mobile"].map((label) => (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300" key={label}>
                    <CheckCircle2 className="text-lime" size={16} />{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="pb-24">
        <div className="container-page">
          <div className="card grid items-center gap-6 border-cyan/30 p-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow">Interactive playground</p>
              <h2 className="mt-2 text-2xl font-bold">Test input and output decisions before integration.</h2>
              <p className="mt-2 text-slate-400">Use safe defensive examples to inspect findings, redaction, action, and risk score.</p>
            </div>
            <Link href="/playground" className="button-primary gap-2">Try the guard <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
      <Pricing />
      <FAQ />
      <section className="pb-24">
        <div className="container-page">
          <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Add observable controls to every chatbot turn.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Start with the playground, then protect both sides of your model call with project-scoped API keys.
            </p>
            <Link href="/docs" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
              Read integration docs <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
  
}

