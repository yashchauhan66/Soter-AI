import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support | SoterAI",
  description:
    "Get help with SoterAI — API issues, integration support, billing questions, and security vulnerability reporting.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support | SoterAI",
    description:
      "Get help with SoterAI — API issues, integration support, billing, and security.",
  },
};

const integrations = [
  { name: "n8n", note: "Community node: n8n-nodes-soterai", href: "/docs" },
  { name: "Dify", note: "Marketplace plugin", href: "/docs" },
  { name: "Zapier", note: "Public app (review pending)", href: "/docs" },
  { name: "Make.com", note: "Custom app (review pending)", href: "/docs" },
  { name: "Botpress", note: "Hub integration", href: "/docs/botpress" },
  { name: "Flowise", note: "Custom nodes", href: "/docs" },
  { name: "Langflow", note: "Custom components", href: "/docs" },
  { name: "Voiceflow", note: "API/Function templates", href: "/docs" },
];

const faqs = [
  {
    q: "Invalid API key",
    a: "Check that the key starts with sk_, and verify it has not been revoked in the dashboard.",
  },
  {
    q: "Request timeout",
    a: "The default timeout is 8 seconds. Check your network connectivity and retry.",
  },
  {
    q: "Rate limit exceeded",
    a: "Check your plan limits on the dashboard and upgrade if needed.",
  },
  {
    q: "Integration node not appearing",
    a: "Restart the platform after installing the SoterAI node or plugin.",
  },
];

export default function SupportPage() {
  return (
    <main className="container-page py-16">
      {/* Header */}
      <p className="eyebrow">Support</p>
      <h1 className="mt-2 text-4xl font-bold">How can we help?</h1>
      <p className="mt-4 max-w-3xl text-slate-400">
        Contact us for API issues, integration support, billing questions, or
        security concerns.
      </p>

      {/* Contact cards */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="card p-6">
          <h2 className="text-xl font-semibold">General Support</h2>
          <p className="mt-2 text-sm text-slate-400">
            API issues, account questions, integration help
          </p>
          <a
            href="mailto:support@soterai.dev"
            className="mt-4 inline-block text-cyan hover:underline"
          >
            support@soterai.dev
          </a>
        </article>
        <article className="card p-6">
          <h2 className="text-xl font-semibold">Security</h2>
          <p className="mt-2 text-sm text-slate-400">
            Vulnerability reports, security concerns, responsible disclosure
          </p>
          <a
            href="mailto:security@soterai.dev"
            className="mt-4 inline-block text-cyan hover:underline"
          >
            security@soterai.dev
          </a>
        </article>
      </div>

      {/* Integration Support */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Integration Support</h2>
        <p className="mt-2 text-slate-400">
          Need help with a specific platform? Find your integration below.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {integrations.map((i) => (
            <Link key={i.name} href={i.href} className="card block p-5 hover:border-slate-600">
              <h3 className="font-semibold">{i.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{i.note}</p>
              <span className="mt-3 inline-block text-sm text-cyan">
                View docs &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Common Issues */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Common Issues</h2>
        <div className="mt-6 space-y-4">
          {faqs.map((faq) => (
            <article key={faq.q} className="card p-5">
              <h3 className="font-semibold">{faq.q}</h3>
              <p className="mt-2 text-sm text-slate-400">{faq.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Security Vulnerability Reporting */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Security Vulnerability Reporting</h2>
        <div className="card mt-6 p-6">
          <p className="text-slate-400">
            To report a security vulnerability, email{" "}
            <a
              href="mailto:security@soterai.dev"
              className="text-cyan hover:underline"
            >
              security@soterai.dev
            </a>{" "}
            with the following details:
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-400">
            <li>Description of the vulnerability</li>
            <li>Steps to reproduce</li>
            <li>Impact assessment</li>
          </ul>
          <p className="mt-4 text-sm text-slate-400">
            We follow coordinated disclosure practices.
          </p>
        </div>
      </section>

      {/* Footer note */}
      <section className="mt-16 border-t border-slate-800 pt-8">
        <p className="text-sm text-slate-400">
          Response times: General support 24-48h, Security issues 24h.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          For urgent production issues, include &ldquo;URGENT&rdquo; in the
          subject line.
        </p>
      </section>
    </main>
  );
}
