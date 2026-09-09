import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Download, Mail, Newspaper } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList, ORGANIZATION_ID, SITE_URL } from "@/lib/seo/schema";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Press & Media Kit",
  description:
    "SoterAI press and media kit: company boilerplate, brand assets, verified product facts, and a media contact for the AI security platform built in India.",
  path: "/press",
  keywords: [
    "soterai press",
    "soterai media kit",
    "soterai brand assets",
    "soterai logo",
    "soterai press kit",
    "ai security company press",
  ],
});

// Reference the canonical Organization node by @id rather than restating it, so
// the entity stays consolidated to a single definition (see lib/seo/schema.ts).
const pressJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${SITE_URL}/press`,
  name: "SoterAI Press & Media Kit",
  description:
    "Press resources for SoterAI: boilerplate, brand assets, product facts, and media contact.",
  mainEntity: { "@id": ORGANIZATION_ID },
};

/** Quick-reference facts. Every value here is verifiable elsewhere on the site. */
const fastFacts: Array<{ label: string; value: React.ReactNode }> = [
  { label: "Company", value: "SoterAI" },
  { label: "Category", value: "Runtime AI security / LLM guardrails" },
  { label: "Founded", value: "2024" },
  { label: "Headquarters", value: "India" },
  {
    label: "Website",
    value: (
      <a href={SITE_URL} className="text-cyan hover:opacity-80">
        soterai.in
      </a>
    ),
  },
  {
    label: "Media contact",
    value: (
      <a href="mailto:support@soterai.in" className="text-cyan hover:opacity-80">
        support@soterai.in
      </a>
    ),
  },
  { label: "Pricing", value: "Free tier available; paid plans for teams and enterprise" },
  {
    label: "Availability",
    value: "VS Code Marketplace, Open VSX, npm, PyPI, n8n community nodes",
  },
];

/** Copy-ready description blocks for journalists and partners. */
const boilerplates: Array<{ label: string; text: string }> = [
  {
    label: "One-liner",
    text: "SoterAI is a runtime AI security platform that protects chatbots, RAG apps, and AI agents from prompt injection, data leakage, and unsafe actions.",
  },
  {
    label: "Short (≈50 words)",
    text: "SoterAI is an AI security command layer for teams shipping LLM applications, RAG pipelines, and autonomous agents. It inspects every AI input and output at runtime — blocking prompt injection, redacting secrets and Indian PII such as Aadhaar, PAN, and GSTIN, and gating risky agent tool calls — across IDEs, browsers, APIs, and automation platforms. Built in India.",
  },
  {
    label: "Long (≈100 words)",
    text: "SoterAI builds runtime security infrastructure for AI applications. As teams ship chatbots, RAG systems, and autonomous agents, SoterAI Guard sits between the application and the model to enforce security policies on every interaction: detecting prompt injection and jailbreaks, redacting secrets and Indian PII (Aadhaar, PAN, GSTIN, UPI, IFSC), inspecting retrieved context, and gating the tool calls an agent is allowed to make. It deploys as a cloud or self-hosted API, language SDKs, an IDE extension, and a browser extension. SoterAI is built in India with native support for the DPDP Act, and publishes an open benchmark and an explicit limitations page rather than marketing claims.",
  },
];

/** Product surfaces, each independently verifiable on its own page. */
const products: Array<{ name: string; body: string; href: string }> = [
  {
    name: "SoterAI Guard API & SDKs",
    body: "A cloud or self-hosted API that inspects every LLM input and output, enforces configurable policies, and produces signed audit logs. JavaScript and Python SDKs, plus LangChain, Express, FastAPI, n8n, Zapier, and Make integrations.",
    href: "/integrations",
  },
  {
    name: "IDE Guard",
    body: "A VS Code extension (also compatible with Cursor, Windsurf, and Kiro) that scans workspace context locally before it reaches an AI coding assistant — secrets, PII, prompt injection, and MCP config review, with no cloud connection required for core features. Currently in beta.",
    href: "/extensions/ide",
  },
  {
    name: "Browser Guard",
    body: "A Chrome and Microsoft Edge extension that protects what employees paste into web-based AI tools, catching sensitive data before it leaves the browser. Currently in beta.",
    href: "/extensions/browser",
  },
];

/** Real brand files in /public. Named, honest, and downloadable. */
const brandAssets: Array<{ label: string; file: string }> = [
  { label: "Primary logo (PNG)", file: "/logo.png" },
  { label: "Logo mark (PNG)", file: "/logo-mark.png" },
  { label: "Logo mark @2x (PNG)", file: "/logo-mark@2x.png" },
  { label: "App icon 512px (PNG)", file: "/icon-512.png" },
  { label: "Social card (PNG)", file: "/opengraph-image.png" },
];

export default function Page() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Press", path: "/press" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(pressJsonLd) }} />

      {/* Hero */}
      <section className="max-w-3xl">
        <p className="eyebrow">Press &amp; media</p>
        <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
          <Newspaper className="h-9 w-9 text-cyan" aria-hidden="true" />
          Press &amp; media kit
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          Everything you need to write about SoterAI accurately: boilerplate you can paste,
          brand assets you can download, and product facts you can verify. For anything not
          covered here, email{" "}
          <a href="mailto:support@soterai.in" className="text-cyan underline underline-offset-2">
            support@soterai.in
          </a>
          .
        </p>
      </section>

      {/* Fast facts */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">Fast facts</h2>
        <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 sm:grid-cols-2">
          {fastFacts.map((f) => (
            <div key={f.label} className="bg-slate-950/60 p-5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{f.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-slate-100">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Boilerplate */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Company boilerplate</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Copy any of these verbatim. They are written to be accurate on their own.
        </p>
        <div className="mt-6 space-y-5">
          {boilerplates.map((b) => (
            <div key={b.label} className="rounded-xl border border-slate-800 bg-panel/40 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan">{b.label}</p>
              <p className="mt-2 leading-7 text-slate-200">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Products at a glance</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {products.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              className="group rounded-xl border border-slate-800 bg-panel/40 p-5 transition hover:border-cyan/40"
            >
              <h3 className="font-semibold text-slate-100 group-hover:text-cyan">{p.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-200">{p.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
                Learn more <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand assets */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Brand assets</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Please use the SoterAI name and logo as provided, without altering the mark or its
          proportions. Do not imply a partnership, endorsement, or certification that does not exist.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brandAssets.map((a) => (
            <a
              key={a.file}
              href={a.file}
              download
              className="flex items-center justify-between rounded-xl border border-slate-800 p-4 transition hover:border-cyan/40"
            >
              <span className="text-sm font-medium text-slate-100">{a.label}</span>
              <Download className="h-4 w-4 text-cyan" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      {/* Facts, figures, and what we do not claim */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Facts, figures, and honest limits</h2>
        <p className="mt-4 leading-7 text-slate-200">
          For detection numbers, cite the{" "}
          <Link href="/benchmark" className="text-cyan underline underline-offset-2">public benchmark</Link>{" "}
          and its{" "}
          <Link href="/benchmark/methodology" className="text-cyan underline underline-offset-2">methodology</Link>.
          The benchmark is <strong>self-maintained on an in-repo corpus, not an independent third-party audit</strong>,
          and we ask that it be described that way. What the detection cannot catch is documented on the{" "}
          <Link href="/limitations" className="text-cyan underline underline-offset-2">limitations page</Link>.
        </p>
        <p className="mt-4 leading-7 text-slate-200">
          To keep coverage accurate, please do not attribute to SoterAI any claim of{" "}
          <em>complete</em> or <em>100% security</em>, formal certifications it does not hold
          (SOC 2 and ISO 27001 pages describe <em>readiness</em>, not certification), or specific
          customers, funding, or user counts — we do not publish figures we cannot stand behind.
          SoterAI&apos;s own security posture is documented on the{" "}
          <Link href="/security" className="text-cyan underline underline-offset-2">security page</Link>{" "}
          and{" "}
          <Link href="/trust" className="text-cyan underline underline-offset-2">trust center</Link>.
        </p>
      </section>

      {/* Media contact CTA */}
      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Media &amp; analyst enquiries</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-200">
          Interviews, product briefings, expert commentary on AI security, or anything you need
          for a story — we respond to press quickly.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="mailto:support@soterai.in?subject=Press%20enquiry"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" aria-hidden="true" /> Email the team
          </a>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            About SoterAI
          </Link>
        </div>
      </section>
    </main>
  );
}
