import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI CLI Tool - npx soter init for Framework Detection & Scaffolding",
  description:
    "SoterAI CLI documentation for npx soter init. Framework detection, project scaffolding, and automated setup for Next.js, Express, Node.js, Python, and FastAPI projects.",
  alternates: { canonical: "/docs/cli" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "CLI", item: "https://soterai.publicvm.com/docs/cli" },
  ],
};

export default function CliDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Tool guide</p>
        <h1 className="mt-3 text-4xl font-bold">SoterAI CLI</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          <InlineCode>npx soter init</InlineCode> — a convenience tool for framework detection and project scaffolding.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Status: Planned</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The CLI init command is planned but not yet implemented. The SDK, examples, and documentation
            provide clear integration paths — manual setup takes less than 2 minutes for most developers.
          </p>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Planned behavior</h2>
          <p className="mt-3 leading-7 text-slate-400">When implemented, <InlineCode>npx soter init</InlineCode> would:</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">1. <strong>Detect framework</strong> — Next.js, Express, Node.js, Python/FastAPI, or unknown</div>
            <div className="rounded-lg border border-slate-800 p-4">2. <strong>Prompt for config</strong> — Base URL and API key stored in <InlineCode>.env</InlineCode></div>
            <div className="rounded-lg border border-slate-800 p-4">3. <strong>Generate files</strong> — <InlineCode>.env.example</InlineCode> plus sample integration file</div>
            <div className="rounded-lg border border-slate-800 p-4">4. <strong>Print next steps</strong> — Fill in API key, run the app</div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Alternative: Dashboard wizard</h2>
          <p className="mt-3 leading-7 text-slate-400">
            While the CLI is not yet available, the <Link href="/dashboard/integrations" className="text-cyan underline">integration wizard</Link> in the dashboard
            already provides copy-paste snippets for all supported languages and frameworks.
          </p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="button-primary gap-2">
                Quickstart Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/js" className="button-secondary gap-2">
                JavaScript SDK <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/generic-chatbot" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Generic Chatbot</Link>
          <Link href="/docs/best-practices" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Security Best Practices →</Link>
        </div>
      </div>
    </main>
  );
}
