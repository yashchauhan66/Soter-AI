import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { DemoVideo } from "@/components/marketing/DemoVideo";
import { Evidence } from "@/components/marketing/Evidence";
import { FAQ } from "@/components/marketing/FAQ";
import { Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Surfaces } from "@/components/marketing/Surfaces";
import { TwoProducts } from "@/components/marketing/TwoProducts";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { safeJsonLd } from "@/lib/seo/jsonLd";

const siteUrl = "https://soterai.in";

export const metadata: Metadata = {
  title: "AI Agent Security & LLM Firewall for Prompts, Data and Tools",
  description:
    "Stop prompt injection, data leaks, unsafe outputs, and risky tool calls across LLM apps, RAG, browsers, IDEs, and workflows. Test SoterAI free.",
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

/**
 * Homepage structured data. The visible sections that used to live in this file
 * — deployment surfaces, the benchmark/OWASP/India evidence block — moved into
 * `components/marketing/Surfaces.tsx` and `Evidence.tsx`, so this file is now
 * metadata, JSON-LD, and section order.
 */

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

      {/* Section order is deliberate, and it is the redesign: identity (Hero) →
          where it installs (Surfaces) → who it is for (TwoProducts) → how it
          runs (HowItWorks) → what it detects (Features) → proof (Evidence) →
          see it (DemoVideo) → objections (FAQ) → act (CTA).

          Nine stops, down from fifteen. Four of the removed sections were
          duplicates of ones that remain: a loose pair of Browser/IDE Guard cards
          that the Surfaces grid already lists, an "AI security platform" grid
          whose four topics restate the four capability cards in Features, a
          seven-link SEO badge row that only repeats the header navigation, and a
          playground CTA one screen above the closing CTA. */}
      <Surfaces />

      <TwoProducts />
      <HowItWorks />
      <Features />
      <Evidence />

      {/* Tinted. Section backgrounds alternate strictly from here to the footer —
          Surfaces white, TwoProducts tinted, HowItWorks white, Features tinted,
          Evidence white, this one tinted, FAQ white. The old page had five
          consecutive `bg-slate-950/40` sections, which is why a long scroll read
          as one undifferentiated column: when almost everything is the alternate
          shade, the shade stops marking anything. */}
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
            {/* Direct links to the two pillar pages. The homepage previously
                reached them only through <TwoProducts />, so the pages that are
                meant to rank for the head terms had no link from the body of the
                highest-authority page on the site. */}
            <p className="mt-6 text-sm text-slate-400">
              Not sure where to start? Compare{" "}
              <Link href="/ai-agent-security" className="font-medium text-cyan hover:underline">
                AI agent security
              </Link>{" "}
              for the systems you build, and{" "}
              <Link href="/ai-user-security" className="font-medium text-cyan hover:underline">
                AI user security
              </Link>{" "}
              for the tools your employees already use.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}



