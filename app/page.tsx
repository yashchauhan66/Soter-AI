import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Zap } from "lucide-react";
import { FAQ } from "@/components/marketing/FAQ";
import { Features } from "@/components/marketing/Features";
import { DemoVideo } from "@/components/marketing/DemoVideo";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { TwoProducts } from "@/components/marketing/TwoProducts";
import { SectionHeading } from "@/components/ui/SectionHeading";

const siteUrl = "https://soterai.publicvm.com";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const owaspCoverage = [
  ["LLM01", "Prompt injection", "Detect instruction overrides, jailbreak combinations, and prompt extraction attempts."],
  ["LLM02", "Sensitive information disclosure", "Redact PII, Indian identifiers, credentials, tokens, and database URLs."],
  ["LLM05", "Improper output handling", "Inspect model output for leaked instructions, unsafe claims, and suspicious links."],
  ["LLM10", "Unbounded consumption", "Apply text-size, per-minute, and monthly usage controls."],
];

const homepageJsonLd = {
  "@context": "https://schema.org",
  // Organization + WebSite entity nodes are injected site-wide from the root
  // layout (lib/seo/schema.ts); the nodes below reference them via @id.
  "@graph": [
    {
      "@type": "WebPage",
      "@id": siteUrl,
      "url": siteUrl,
      "name": "SoterAI | AI Security Command Layer",
      "description": "Protect your AI chatbots, RAG apps, and agents from prompt injection, data leakage, unsafe outputs, and agent abuse with SoterAI\u2019s observable security gateway.",
      "inLanguage": "en",
      "isPartOf": { "@id": `${siteUrl}#website` },
      "about": { "@id": `${siteUrl}#organization` },
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": `${siteUrl}/opengraph-image.png`,
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
        ],
      },
      "mainEntity": [
        { "@type": "SoftwareApplication", "@id": `${siteUrl}#softwareapplication` },
        { "@type": "FAQPage", "@id": `${siteUrl}#faq` },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}#softwareapplication`,
      "name": "SoterAI",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Linux, macOS, Windows",
      "description": "AI security command layer for chatbots, RAG apps, and autonomous agents. Protects against prompt injection, jailbreaks, PII leakage, unsafe outputs, and agent abuse.",
      "url": siteUrl,
      "author": { "@id": `${siteUrl}#organization` },
      "offers": [
        {
          "@type": "Offer",
          "name": "Free",
          "price": "0",
          "priceCurrency": "INR",
          "priceValidUntil": "2026-12-31",
          "availability": "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          "name": "Starter",
          "price": "999",
          "priceCurrency": "INR",
          "priceValidUntil": "2026-12-31",
          "availability": "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          "name": "Pro",
          "price": "2999",
          "priceCurrency": "INR",
          "priceValidUntil": "2026-12-31",
          "availability": "https://schema.org/InStock",
        },
      ],
      "featureList": "Input Guard, Output Guard, RAG Security, Agent Firewall, Policy Engine, India PII Detection, Self-Hosted, Enterprise SSO",
      "screenshot": `${siteUrl}/opengraph-image.png`,
      "softwareVersion": "2.0",
      "releaseNotes": `${siteUrl}/docs`,
      "applicationSubCategory": "AI Security",
      "requirements": "Node.js 18+ or Python 3.9+",
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
      "name": "SoterAI Adversarial Benchmark",
      "description": "97/97 adversarial attack variants detected across 8 categories with zero false positives (F1=1.0000). Internal Garak-style red-team evaluation covering prompt injection, jailbreaks, encoding, multilingual, PII, secrets, indirect injection, and unsafe output.",
      "url": `${siteUrl}/benchmarks`,
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${siteUrl}/benchmarks` },
      "creator": { "@id": `${siteUrl}#organization` },
      "datePublished": "2026-06-21",
      "dateModified": "2026-06-27",
      "measurementTechnique": "Garak-style adversarial probing",
      "keywords": "prompt injection, jailbreak, PII detection, security benchmark, AI guardrails",
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
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}#faq`,
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is SoterAI?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SoterAI is an AI security command layer that protects chatbots, RAG apps, and autonomous agents from prompt injection, jailbreaks, data leakage, unsafe outputs, and agent abuse. It sits between users, models, and tools to inspect every AI interaction in real time.",
          },
        },
        {
          "@type": "Question",
          "name": "Does SoterAI guarantee complete security?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. SoterAI is a defense-in-depth risk reduction layer. It should be combined with secure application design, identity controls, monitoring, and human review.",
          },
        },
        {
          "@type": "Question",
          "name": "What does SoterAI protect?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SoterAI inspects AI inputs and outputs for prompt injection, jailbreaks, sensitive data, unsafe responses, and risky agent behavior across chatbots, RAG pipelines, and autonomous agents.",
          },
        },
        {
          "@type": "Question",
          "name": "How does SoterAI detect prompt injection and jailbreak attacks?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SoterAI uses a multi-layer detection engine that analyzes user inputs for instruction overrides, jailbreak personas (like DAN), prompt extraction attempts, encoding obfuscation, multilingual attacks, and indirect injection through retrieved documents.",
          },
        },
        {
          "@type": "Question",
          "name": "Is SoterAI free to use?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. SoterAI offers a Free plan at INR 0 per month to validate a small AI workflow. Paid plans start at INR 999 per month for production chatbot traffic with team controls and deeper reporting.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I self-host SoterAI?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The production stack runs with Docker, Postgres, Redis, and optional vector storage, so teams can keep full control of deployment and data boundaries on their own infrastructure.",
          },
        },
        {
          "@type": "Question",
          "name": "Are raw secrets stored in SoterAI?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. Secret-bearing and sensitive payloads are persisted only in redacted or hashed form where practical. SoterAI is designed to minimize data retention of sensitive content.",
          },
        },
        {
          "@type": "Question",
          "name": "Can SoterAI detect Indian PII like Aadhaar and PAN?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. SoterAI is built with India-specific PII detection including Aadhaar-like patterns, PAN, GSTIN, UPI ID, IFSC codes, Indian mobile numbers, and contextual student, patient, and bank identifiers.",
          },
        },
        {
          "@type": "Question",
          "name": "How fast is SoterAI's security check?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SoterAI performs input and output guard checks in under 50 milliseconds, making it suitable for real-time chatbot and agent interactions without noticeable latency.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I integrate SoterAI with my chatbot?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Create a project, keep your API key on the server, call the input guard before your LLM, and call the output guard before returning the response to the user. SDKs are available for JavaScript, Python, Next.js, Express, and more.",
          },
        },
        {
          "@type": "Question",
          "name": "What programming languages does SoterAI support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SoterAI provides native SDKs for JavaScript/TypeScript and Python, plus a REST API that works with any language including Java, Go, PHP, C#, Ruby, Rust, and more.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I use SoterAI with LangChain or RAG pipelines?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. SoterAI integrates with LangChain chains, LlamaIndex query engines, and custom RAG pipelines. It inspects retrieved context, applies document trust scoring, and prevents sensitive data from leaking into model responses.",
          },
        },
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
            <h2 className="mt-3 text-3xl font-bold">Your AI workflow can become a path to data exposure.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Untrusted prompts, copied secrets, personal data, and unsafe model responses need controls outside the model itself.
              SoterAI adds an observable security gateway to the flow.
            </p>
          </div>
          <div className="card p-7">
            <p className="text-5xl font-black text-cyan">2-way</p>
            <p className="mt-4 font-semibold">Input, output, and agent coverage</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Risk reduction around users, models, retrieval, and tools.</p>
          </div>
        </div>
      </section>

      <HowItWorks />
      <TwoProducts />
      <Features />

      {/* ── Demo Video Section ── */}
      <section className="border-y border-slate-800 bg-slate-950/40 py-20">
        <div className="container-page">
          <p className="eyebrow text-center">See it in action</p>
          <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">
            Watch SoterAI <span className="text-cyan">block attacks</span> in real time
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            An interactive walkthrough showing prompt injection blocking, India PII redaction,
            secret detection, jailbreak prevention, and our F1=1.0000 benchmark in action.
          </p>
          <div className="mx-auto mt-10 max-w-5xl">
            <DemoVideo />
          </div>
          <div className="mt-10 text-center">
            <Link href="/demo" className="button-secondary inline-flex items-center gap-2">
              View all demos <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>


      <section className="border-y border-slate-800 bg-slate-950/40 py-20">
        <div className="container-page text-center">
          <p className="eyebrow">Adversarial Benchmark</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Internal benchmark: <span className="text-cyan">F1 = 1.0000</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            97/97 adversarial cases detected with 0/25 false positives in a small, self-authored dataset.
            This Garak-style evaluation is useful regression evidence, not an independent audit or production guarantee.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6">
              <ShieldCheck className="mx-auto text-cyan" size={28} aria-hidden="true" />
              <p className="mt-3 text-3xl font-black text-cyan">100%</p>
              <p className="mt-1 text-sm text-slate-400">Detection Rate</p>
              <p className="text-xs text-slate-500">97/97 adversarial prompts</p>
            </div>
            <div className="card p-6">
              <Zap className="mx-auto text-lime" size={28} aria-hidden="true" />
              <p className="mt-3 text-3xl font-black text-lime">0%</p>
              <p className="mt-1 text-sm text-slate-400">False Positives</p>
              <p className="text-xs text-slate-500">25/25 safe inputs allowed</p>
            </div>
            <div className="card p-6">
              <Gauge className="mx-auto text-cyan" size={28} aria-hidden="true" />
              <p className="mt-3 text-3xl font-black text-cyan">891ms</p>
              <p className="mt-1 text-sm text-slate-400">Recorded HTTP p50</p>
              <p className="text-xs text-slate-500">Internal benchmark run</p>
            </div>
            <div className="card p-6">
              <BarChart3 className="mx-auto text-cyan" size={28} aria-hidden="true" />
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
            View full benchmark details <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/40 py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="OWASP alignment"
            title="Focused coverage for production AI workflows"
            copy="Controls map to relevant OWASP LLM Top 10 risk areas. Alignment supports risk reduction and is not a certification or claim of complete coverage."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {owaspCoverage.map(([id, title, copy]) => (
              <article className="card p-6" key={id}>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-cyan/10 px-2.5 py-1 text-xs font-bold text-cyan">{id}</span>
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
                  Detect and redact Aadhaar-like patterns, PAN, GSTIN, UPI, IFSC, Indian mobile numbers,
                  and contextual student, patient, and bank identifiers.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {["Aadhaar-like", "PAN", "GSTIN", "UPI ID", "IFSC", "Indian mobile"].map((label) => (
                  <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 p-4 text-slate-300" key={label}>
                    <CheckCircle2 className="text-lime" size={16} aria-hidden="true" />{label}
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
              <h2 className="mt-2 text-2xl font-bold">Test AI security decisions before integration.</h2>
              <p className="mt-2 text-slate-400">Use safe defensive examples to inspect findings, redaction, action, and risk score.</p>
            </div>
            <Link href="/playground" className="button-primary gap-2">Try the guard <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
      <Pricing />
      <FAQ />
      <section className="pb-24">
        <div className="container-page">
          <div className="rounded-lg bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Add observable controls to every AI turn.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Start with the playground, then protect users, models, retrieval, and tools with project-scoped API keys.
            </p>
            <Link href="/docs" className="mt-7 inline-flex items-center gap-2 rounded-md bg-ink px-6 py-3 font-semibold text-white">
              Read integration docs <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
  
}

