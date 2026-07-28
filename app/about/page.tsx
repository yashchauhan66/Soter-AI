import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList, SITE_URL } from "@/lib/seo/schema";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = buildMetadata({
  title: "About SoterAI — AI Security Platform Built for Developers and Enterprises",
  description:
    "SoterAI is an AI security platform protecting LLM applications, AI agents, and developer workflows from prompt injection, data leakage, and unsafe AI outputs. Built in India for a global AI-first world.",
  path: "/about",
  keywords: [
    "about soterai",
    "soterai company",
    "soterai mission",
    "ai security company india",
    "soterai guard platform",
  ],
});

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "url": `${SITE_URL}/about`,
  "name": "About SoterAI",
  "description": "SoterAI builds AI security infrastructure for LLM applications, AI agents, and developer workflows.",
  "mainEntity": {
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    "name": "SoterAI",
    "url": SITE_URL,
    "foundingDate": "2024",
    "description": "AI security platform protecting LLM applications, AI agents, and developer workflows from prompt injection, data leakage, jailbreaks, and unsafe AI outputs.",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN",
    },
    "sameAs": [
      "https://github.com/yashchauhan66/Ai-Security-Guard",
      "https://twitter.com/soterai",
      "https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard",
      "https://www.npmjs.com/package/@soterai/sdk",
    ],
  },
};

const principles = [
  {
    title: "Honest about limitations",
    body: "We publish what our detection cannot catch. Every product page includes an honest limitations section because trust starts with transparency, not marketing claims.",
  },
  {
    title: "Local-first by default",
    body: "Sensitive data should not have to leave your machine to be protected. Our IDE Guard extension runs all scanning locally. Cloud features are always opt-in.",
  },
  {
    title: "Built for the Indian developer ecosystem",
    body: "India has unique data formats — Aadhaar, PAN, GSTIN, UPI, IFSC. We built native detection for these from day one because Indian developers and enterprises deserve security tooling that understands their regulatory context.",
  },
  {
    title: "Defense in depth, not snake oil",
    body: "No single tool eliminates AI security risk. We build layered controls — input guard, output guard, RAG security, agent firewall — and tell users clearly where each layer ends.",
  },
];

export default function Page() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(aboutJsonLd) }} />

      {/* Hero */}
      <section className="max-w-3xl">
        <p className="eyebrow">About SoterAI</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          AI security built by developers, for developers
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          SoterAI builds AI security infrastructure for teams deploying LLM applications,
          AI agents, and agentic developer tools. Our platform — SoterAI Guard — protects
          against prompt injection, data leakage, jailbreaks, unsafe AI outputs, and
          agent tool abuse across chatbots, RAG pipelines, IDE workflows, and automated processes.
        </p>
      </section>

      {/* Mission */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Our mission</h2>
        <p className="mt-4 leading-7 text-slate-400">
          AI adoption is outpacing security. Every week, teams ship chatbots, RAG systems,
          and autonomous agents without the controls that production software demands:
          observable security decisions, enforceable policies, honest audit trails.
        </p>
        <p className="mt-4 leading-7 text-slate-400">
          SoterAI&apos;s mission is to make runtime AI security practical and accessible —
          starting with a free tier for individual developers, scaling to enterprise
          deployments with SSO, RBAC, and full data sovereignty.
        </p>
        <p className="mt-4 leading-7 text-slate-400">
          We are especially focused on the Indian market because India has unique AI security
          challenges: Aadhaar, PAN, GSTIN detection requirements; DPDP Act compliance;
          a fast-growing developer community building AI products at scale; and limited
          tooling designed for this regulatory context. We built SoterAI to fix that.
        </p>
      </section>

      {/* Principles */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">How we build</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {principles.map((p) => (
            <div key={p.title} className="rounded-xl border border-slate-800 bg-panel/40 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan" aria-hidden="true" />
                <h3 className="font-semibold text-slate-100">{p.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">The product</h2>
        <p className="mt-4 leading-7 text-slate-400">
          SoterAI Guard is a runtime AI security platform with two deployment surfaces:
        </p>
        <ul className="mt-4 space-y-3 text-slate-400">
          <li className="flex gap-3 text-sm leading-6">
            <span className="mt-1 text-cyan font-semibold">API / SDK</span>
            <span>
              A cloud or self-hosted API that intercepts every LLM input and output,
              enforces configurable security policies, and produces signed audit logs.
              Integrates with JavaScript, Python, LangChain, Vercel AI SDK, Express,
              FastAPI, n8n, Zapier, and Make.
            </span>
          </li>
          <li className="flex gap-3 text-sm leading-6">
            <span className="mt-1 text-cyan font-semibold">IDE Guard</span>
            <span>
              A VS Code extension (also compatible with Cursor and Windsurf) that
              scans workspace context locally before it reaches any AI coding assistant.
              Secret detection, PII scanning, prompt injection detection, MCP config
              review, and a local AI memory inspector — no cloud connection required
              for core features.
            </span>
          </li>
        </ul>
      </section>

      {/* Transparency */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Transparency and trust</h2>
        <p className="mt-4 leading-7 text-slate-400">
          Security vendors have an obligation to be honest about what their products do and
          do not do. We publish our{" "}
          <Link href="/benchmark" className="text-cyan underline underline-offset-2">public benchmark</Link>{" "}
          with its methodology, dataset, and explicit disclaimer that it is self-maintained
          and not an independent audit. We maintain a{" "}
          <Link href="/limitations" className="text-cyan underline underline-offset-2">limitations page</Link>{" "}
          that describes exactly what SoterAI cannot catch. We have a{" "}
          <Link href="/responsible-disclosure" className="text-cyan underline underline-offset-2">responsible disclosure policy</Link>{" "}
          for security researchers.
        </p>
        <p className="mt-4 leading-7 text-slate-400">
          We do not claim certifications we do not hold, benchmarks we did not run, or
          customers we do not have. Our{" "}
          <Link href="/security" className="text-cyan underline underline-offset-2">security page</Link>{" "}
          documents our own security posture honestly.
        </p>
      </section>

      {/* Contact / Links */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Contact and community</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "General enquiries", value: "support@soterai.in", href: "mailto:support@soterai.in" },
            { label: "Enterprise sales", value: "Contact Sales", href: "/contact-sales" },
            { label: "Security disclosures", value: "Responsible Disclosure", href: "/responsible-disclosure" },
            { label: "GitHub", value: "Ai-Security-Guard", href: "https://github.com/yashchauhan66/Ai-Security-Guard" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-800 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
              <a
                href={c.href}
                className="mt-1 text-sm font-medium text-cyan hover:opacity-80"
                {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {c.value}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Start protecting your AI applications</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Free tier available. No credit card required to get started.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90">
            Create free account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/docs/quickstart" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500">
            Read the docs
          </Link>
        </div>
      </section>
    </main>
  );
}
