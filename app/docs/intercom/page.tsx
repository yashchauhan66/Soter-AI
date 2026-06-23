import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Intercom Integration Guide - AI Security for Customer Support",
  description:
    "Complete Intercom integration guide for SoterAI. Protect AI-powered customer support chats from prompt injection, PII leaks, and unsafe responses. Includes REST API examples and best practices.",
  alternates: { canonical: "/docs/intercom" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Intercom", item: "https://soterai.publicvm.com/docs/intercom" },
  ],
};

const apiCode = `// Guard incoming customer message (server-side)
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: customerMessage }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  // 🛑 Block unsafe messages before AI sees them
  return { reply: "I couldn't process that request.", blocked: true };
}

// Guard AI-generated reply before sending to customer
const outputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/output\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());`;

export default function IntercomDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Intercom Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use SoterAI to protect AI support-chat conversations in your Intercom workflows from prompt injection, PII leakage, and unsafe responses.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Integration pattern</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> Guard user messages before they reach the AI assistant
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> Guard AI-generated replies before they reach customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> Redact PII/secrets before saving examples for review
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> Use monthly reports for security evidence and compliance
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">API usage (server-side)</h2>
          <CodeBlock language="typescript" title="rest api" showLineNumbers>{apiCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Best practices</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Use separate projects per client", "Isolate data with distinct SoterAI projects per brand or client."],
              ["Always guard output too", "Run the output guard on AI drafts before they reach customers."],
              ["Redact audit logs", "Store only redacted/guarded text in audit logs, never raw text."],
              ["Use webhooks", "Configure webhooks for real-time blocking alerts."],
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
            <h2 className="text-xl font-bold">What's next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/whatsapp" className="button-primary gap-2">
                WhatsApp Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/botpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Botpress</Link>
          <Link href="/docs/whatsapp" className="text-sm text-cyan hover:text-cyan/80 transition-colors">WhatsApp →</Link>
        </div>
      </div>
    </main>
  );
}
