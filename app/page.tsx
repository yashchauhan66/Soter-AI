import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Zap } from "lucide-react";
import { FAQ } from "@/components/marketing/FAQ";
import { Features } from "@/components/marketing/Features";
import { DemoVideo } from "@/components/marketing/DemoVideo";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TwoProducts } from "@/components/marketing/TwoProducts";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { safeJsonLd } from "@/lib/seo/jsonLd";

const siteUrl = "https://soterai.in";

export const metadata: Metadata = {
  title: "AI Agent Security & LLM Firewall for Prompts, Data and Tools",
  description:
    "Stop prompt injection, sensitive-data leaks, unsafe outputs, and risky agent tool calls across LLM apps, RAG pipelines, browsers, IDEs, and workflows. Test SoterAI free—no signup required.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Stop AI Data Leaks and Risky Agent Actions | SoterAI",
    description:
      "Inspect prompts and outputs, redact secrets and Indian PII, and stop risky agent tool calls before execution. Try the public AI security playground without signup.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "SoterAI AI security control layer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stop AI Data Leaks and Risky Agent Actions | SoterAI",
    description:
      "Inspect prompts and outputs, redact secrets and Indian PII, and stop risky agent tool calls before execution. Test it free without signup.",
    images: ["/opengraph-image.png"],
  },
};

const owaspCoverage = [
  ["LLM01", "Prompt injection", "Detect instruction overrides, jailbreak combinations, and prompt extraction attempts."],
  ["LLM02", "Sensitive information disclosure", "Redact PII, Indian identifiers, credentials, tokens, and database URLs."],
  ["LLM05", "Improper output handling", "Inspect model output for leaked instructions, unsafe claims, and suspicious links."],
  ["LLM10", "Unbounded consumption", "Apply text-size, per-minute, and monthly usage controls."],
];

const aiSecurityTopics = [
  {
    title: "Prompt injection protection",
    copy: "Block direct and indirect prompt injection, jailbreak prompts, hidden instruction overrides, prompt extraction attempts, and multilingual attack patterns before they reach your LLM.",
    href: "/prompt-injection-protection",
  },
  {
    title: "AI data leakage prevention",
    copy: "Detect and redact secrets, credentials, database URLs, Aadhaar-like numbers, PAN, GSTIN, UPI IDs, IFSC codes, Indian phone numbers, and other sensitive context.",
    href: "/ai-data-leakage-prevention",
  },
  {
    title: "RAG security",
    copy: "Inspect retrieved documents and model outputs for poisoned context, untrusted sources, sensitive snippets, unsafe citations, and disclosure risks in retrieval-augmented generation.",
    href: "/docs/rag",
  },
  {
    title: "AI agent firewall",
    copy: "Review agent actions, MCP tools, browser automation, workflow steps, and high-risk operations before an AI agent can execute sensitive work.",
    href: "/mcp-security",
  },
];

const seoInternalLinks = [
  ["AI user security", "/ai-user-security"],
  ["AI agent security", "/ai-agent-security"],
  ["LLM security docs", "/docs"],
  ["OWASP LLM Top 10 alignment", "/compliance/owasp-llm-top-10"],
  ["Public benchmark", "/benchmark"],
  ["VS Code AI security", "/vscode-ai-security"],
  ["Trust center", "/trust"],
];

/**
 * Benchmark figures. Extracted from JSX because four near-identical cards are
 * data, not markup — and because the metric, its colour, and the sample it was
 * measured on now live together, which makes an inconsistent update obvious.
 */
const benchmarkMetrics = [
  { value: "100%", label: "Recall", basis: "2,200 synthetic attacks", Icon: ShieldCheck, tone: "text-cyan" },
  { value: "0.00%", label: "False-positive rate", basis: "1,000 benign controls", Icon: Zap, tone: "text-lime" },
  { value: "17.83ms", label: "Analyzer p95", basis: "Local benchmark run", Icon: Gauge, tone: "text-cyan" },
  { value: "10", label: "Attack categories", basis: "Synthetic public corpus", Icon: BarChart3, tone: "text-cyan" },
];

/**
 * Attack families covered by the corpus. The previous list ended with both
 * "Secrets / Credentials" and "Secret / PII" — a near-duplicate that made the
 * ten-category claim above look like nine categories padded to ten.
 */
const attackCategories = [
  "Prompt injection",
  "Jailbreak / DAN",
  "Encoding / obfuscation",
  "Multilingual (Hindi)",
  "RAG poisoning",
  "Tool abuse",
  "MCP risk",
  "PII detection",
  "Secrets / credentials",
  "Unsafe output",
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
        { "@type": "PropertyValue", "name": "Phase 9 Public Benchmark F1", "value": "1.0000 on synthetic public dataset" },
      ],
    },
    {
      "@type": "Dataset",
      "name": "SoterAI Phase 9 Public Benchmark",
      "description": "Self-maintained synthetic public benchmark with published dataset, methodology, limitations, and downloadable results. Latest generated run: 100% recall, 0% false-positive rate, 0% false-negative rate, and 17.83 ms p95 analyzer latency on 3,200 synthetic cases. Not an independent third-party benchmark.",
      "url": `${siteUrl}/benchmark`,
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${siteUrl}/benchmark` },
      "creator": { "@id": `${siteUrl}#organization` },
      "datePublished": "2026-07-15",
      "dateModified": "2026-07-15",
      "measurementTechnique": "Synthetic JSONL public dataset evaluated with the production SoterAI guard detector",
      "keywords": "prompt injection, jailbreak, PII detection, security benchmark, AI guardrails",
      "variableMeasured": [
        { "name": "F1 Score", "value": "1.0000" },
        { "name": "Precision", "value": "1.0000" },
        { "name": "Recall", "value": "1.0000" },
        { "name": "False Positive Rate", "value": "0.00%" },
        { "name": "False Negative Rate", "value": "0.00%" },
        { "name": "Dataset Rows", "value": "3200" },
        { "name": "Attack Categories", "value": "10" },
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(homepageJsonLd) }}
      />
      <Hero />

      {/* Extension entry points. These were `rounded-2xl` one-off gradient cards
          with a bespoke focus ring; they now use the shared card + interactive
          lift so hover, focus, and elevation match every other card on the site.
          The headings are h2 because they are siblings of the section headings
          below, not children of them. */}
      <section className="container-page mt-10 mb-16 grid gap-6 md:grid-cols-2">
        {[
          {
            href: "/extensions/browser",
            title: "SoterAI Browser Guard",
            copy: "Scan prompts, redact sensitive data, and apply safer AI usage controls in Chrome and Microsoft Edge.",
            cta: "Choose your browser",
          },
          {
            href: "/extensions/ide",
            title: "SoterAI IDE Guard",
            copy: "Secure AI pair-programming across VS Code, Cursor, Windsurf, and Kiro under one policy.",
            cta: "Choose your IDE",
          },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="card card-interactive group p-6">
            <h2 className="text-lg font-semibold text-white">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.copy}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              {card.cta}
              <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </section>

      <section className="section border-b border-slate-800 bg-slate-950/45">
        <div className="container-page">
          <SectionHeading
            eyebrow="AI security platform"
            title="Security controls for LLM apps, RAG pipelines, copilots, and AI agents"
            copy="SoterAI helps product, engineering, and security teams protect production AI systems from prompt injection, jailbreaks, data leakage, unsafe model outputs, and risky agent tool calls — in real time, between users, models, retrieval, and tools."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {aiSecurityTopics.map((topic) => (
              <article className="card p-6" key={topic.title}>
                <h3 className="text-lg font-semibold">{topic.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{topic.copy}</p>

                <Link href={topic.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan">
                  Learn more <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>

          <nav aria-label="Related AI security topics" className="mt-8 flex flex-wrap gap-2">
            {seoInternalLinks.map(([label, href]) => (
              <Link
                href={href}
                key={href}
                className="badge-neutral transition-colors hover:border-cyan/50 hover:text-cyan"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <section className="section">
        <div className="container-page grid gap-5 md:grid-cols-3">
          <div className="card p-7 md:col-span-2">
            <p className="eyebrow">The problem</p>
            <h2 className="heading-3 mt-3">Your AI workflow can become a path to data exposure.</h2>
            <p className="body-copy mt-4">
              Untrusted prompts, copied secrets, personal data, and unsafe model responses need controls outside the
              model itself. SoterAI adds an observable security gateway to the flow.
            </p>
          </div>
          <div className="card p-7">
            <p data-numeric className="text-5xl font-black text-cyan">2-way</p>
            <p className="mt-4 font-semibold">Input, output, and agent coverage</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Risk reduction around users, models, retrieval, and tools.
            </p>
          </div>
        </div>
      </section>

      <HowItWorks />
      <TwoProducts />
      <Features />

      {/* ── Demo Video Section ── */}
      <section className="section border-y border-slate-800 bg-slate-950/40">
        <div className="container-page">
          <SectionHeading
            center
            eyebrow="See it in action"
            title="Watch SoterAI block attacks in real time"
            copy="An interactive walkthrough of prompt-injection blocking, India PII redaction, secret detection, jailbreak prevention, and the public benchmark."
          />
          <div className="mx-auto mt-10 max-w-5xl">
            <DemoVideo />
          </div>
          <div className="mt-10 text-center">
            <Link href="/demo" className="button-secondary">
              View all demos <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>


      <section className="section border-y border-slate-800 bg-slate-950/40">
        <div className="container-page text-center">
          <SectionHeading
            center
            eyebrow="Adversarial benchmark"
            title="Published benchmark, published limitations"
            copy="Latest generated run: 2,200 synthetic attack cases and 1,000 benign controls evaluated with the production detector. This is self-maintained regression evidence — not an independent audit, and not a production guarantee."
          />

          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benchmarkMetrics.map((metric) => (
              <div className="card p-6" key={metric.label}>
                <metric.Icon className={`mx-auto ${metric.tone}`} size={28} aria-hidden="true" />
                <dd data-numeric className={`mt-3 text-3xl font-black ${metric.tone}`}>
                  {metric.value}
                </dd>
                <dt className="mt-1 text-sm font-medium text-slate-200">{metric.label}</dt>
                <p className="mt-0.5 text-xs text-slate-400">{metric.basis}</p>
              </div>
            ))}
          </dl>

          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {attackCategories.map((category) => (
              <li className="badge-neutral" key={category}>
                {category}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link href="/benchmark" className="button-secondary">
              View full benchmark details <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section border-y border-slate-800 bg-slate-950/40">
        <div className="container-page">
          <SectionHeading
            eyebrow="OWASP alignment"
            title="Focused coverage for production AI workflows"
            copy="Controls map to relevant OWASP LLM Top 10 risk areas. Alignment supports risk reduction and is not a certification or a claim of complete coverage."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {owaspCoverage.map(([id, title, copy]) => (
              <article className="card p-6" key={id}>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-cyan/10 px-2.5 py-1 text-xs font-bold text-cyan">{id}</span>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
              </article>
            ))}
          </div>
          <Link
            href="/compliance"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline"
          >
            See the full compliance mapping <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="card overflow-hidden p-8 sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Built for India</p>
                <h2 className="heading-3 mt-3">Recognize local personal-data patterns.</h2>
                <p className="body-copy mt-4">
                  Detect and redact Aadhaar-like patterns, PAN, GSTIN, UPI, IFSC, Indian mobile numbers, and contextual
                  student, patient, and bank identifiers.
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-3 text-sm">
                {["Aadhaar-like", "PAN", "GSTIN", "UPI ID", "IFSC", "Indian mobile"].map((label) => (
                  <li className="surface flex items-center gap-2 p-4 text-slate-300" key={label}>
                    <CheckCircle2 className="shrink-0 text-lime" size={16} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-page">
          <div className="card grid items-center gap-6 border-cyan/30 p-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow">Interactive playground</p>
              <h2 className="heading-3 mt-2">Test AI security decisions before integration.</h2>
              <p className="mt-2 text-slate-300">
                Use safe defensive examples to inspect findings, redaction, action, and risk score.
              </p>
            </div>
            <Link href="/playground" className="button-primary">
              Try the guard <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <FAQ />

      {/* Closing CTA. The old version used a one-off emerald button that appeared
          nowhere else on the site and a hand-rolled bordered link, so the most
          important conversion point on the page was the least consistent element
          on it. Brand primary + secondary now carry it. */}
      <section className="section-tight">
        <div className="container-page">
          <div className="gradient-border overflow-hidden p-10 text-center sm:p-14">
            <p className="eyebrow">Get started</p>
            <h2 className="heading-2 mt-3">Add observable controls to every AI turn.</h2>
            <p className="mx-auto mt-4 max-w-prose leading-7 text-slate-300">
              Free tier available. Create a project, get an API key, and protect your first AI workflow in under ten
              minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="button-primary button-lg">
                Create free account <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/docs" className="button-secondary button-lg">
                Read integration docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}



