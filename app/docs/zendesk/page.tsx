import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Zendesk Integration Guide - AI Security for Support Tickets",
  description:
    "Complete Zendesk integration guide for SoterAI. Protect AI-powered ticket workflows from prompt injection, PII leaks, and unsafe AI drafts. Includes REST API examples and best practices for support teams.",
  alternates: { canonical: "/docs/zendesk" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Zendesk", item: "https://soterai.publicvm.com/docs/zendesk" },
  ],
};

const apiCode = `// Guard incoming ticket message (server-side)
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: ticketBody }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  // 🛑 Block unsafe ticket content before AI processes it
  return { reply: "This message could not be processed.", blocked: true };
}

// Guard AI draft before sending to customer
const outputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/output\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiDraft }),
}).then((r) => r.json());`;

export default function ZendeskDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Zendesk Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use SoterAI to protect AI ticket workflows in your Zendesk environment from prompt injection, PII leakage, and unsafe AI drafts.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Integration pattern</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> Guard inbound ticket messages before they reach the AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> Guard AI draft replies before they are sent to customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> Use distinct SoterAI projects per brand or client for isolation
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> Use webhooks and scheduled reports for security review
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_live_your_key_here
# SOTER_BASE_URL is optional if using the SDK — a default is included`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">API example</h2>
          <CodeBlock language="typescript" title="rest api" showLineNumbers>{apiCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Best practices</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Use separate projects per client", "Isolate data with distinct SoterAI projects per brand or client."],
              ["Always guard output too", "Run the output guard on AI drafts before they reach customers."],
              ["Redact audit logs", "Store only redacted/guarded text in audit logs, never raw text."],
              ["Use webhooks for alerts", "Configure webhooks for real-time blocking alerts."],
              ["Coordinate with support owners", "Get buy-in from support teams before enabling blocking mode."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/wordpress" className="button-primary gap-2">
                WordPress Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/whatsapp" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← WhatsApp</Link>
          <Link href="/docs/wordpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">WordPress →</Link>
        </div>
      </div>
    </main>
  );
}
