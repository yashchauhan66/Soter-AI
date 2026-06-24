import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI WhatsApp Chatbot Security Guide - India PII Protection",
  description:
    "Complete WhatsApp chatbot security guide for SoterAI. Protect WhatsApp deployments with input/output guarding, India-specific PII redaction (Aadhaar, PAN, UPI), and prompt injection detection.",
  alternates: { canonical: "/docs/whatsapp" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "WhatsApp", item: "https://soterai.publicvm.com/docs/whatsapp" },
  ],
};

const apiCode = `// Guard incoming WhatsApp message (server-side)
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: userMessage,
    userId: senderPhoneNumber,  // traceable identifier
  }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  return sendWhatsAppReply(sender, "I couldn't process that message.");
}

// Guard the AI response before sending
const outputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/output\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());

const safeReply = outputResult.safeText ?? outputResult.redactedText ?? aiReply;
sendWhatsAppReply(sender, safeReply);`;

export default function WhatsappDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">WhatsApp Chatbot Security Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your WhatsApp chatbot deployments with input/output guarding and India-specific PII redaction.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Integration flow</h2>
          <CodeBlock language="text" title="message flow">{`WhatsApp Message → Soter Input Guard → LLM/RAG → Soter Output Guard → WhatsApp Reply`}</CodeBlock>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">1. Route inbound WhatsApp messages through input guard before the LLM</div>
            <div className="rounded-lg border border-slate-800 p-4">2. Route model responses through output guard before replying to users</div>
            <div className="rounded-lg border border-slate-800 p-4">3. Enable India PII redaction for Aadhaar, PAN, UPI IDs</div>
            <div className="rounded-lg border border-slate-800 p-4">4. Configure webhooks for blocked prompts and PII redactions</div>
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
          <h2 className="text-2xl font-bold">India-specific PII detection</h2>
          <p className="mt-3 leading-7 text-slate-400">
            SoterAI automatically detects and redacts India-specific personally identifiable information:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Aadhaar numbers", "12-digit with optional spaces"],
              ["PAN numbers", "10-character alphanumeric"],
              ["UPI IDs", "Format: username@bank"],
              ["Indian phone numbers", "10-digit with +91 prefix"],
              ["Bank account numbers", "Including IFSC codes"],
              ["GSTIN", "Goods and Services Tax ID"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
                <p className="font-semibold text-sm">{title}</p>
                <p className="mt-1 text-xs text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/zendesk" className="button-primary gap-2">
                Zendesk Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/intercom" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Intercom</Link>
          <Link href="/docs/zendesk" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Zendesk →</Link>
        </div>
      </div>
    </main>
  );
}
