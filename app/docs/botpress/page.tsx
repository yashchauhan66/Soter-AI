import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Botpress Integration Guide - AI Security for Chatbots",
  description:
    "Complete Botpress integration guide for SoterAI. Learn to add input and output guarding as pre/post processing HTTP steps in Botpress workflows to protect against prompt injection and PII leaks.",
  alternates: { canonical: "/docs/botpress" },
};

const workflowCode = `// In your Botpress action or hook
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: userMessage }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK" || inputResult.action === "HUMAN_REVIEW") {
  return { reply: "This message was blocked.", blocked: true };
}

// Pass safeText to your AI agent
const aiReply = await callBotpressAgent(inputResult.safeText ?? userMessage);

const outputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/output\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());

return {
  reply: outputResult.safeText ?? outputResult.redactedText ?? aiReply,
  blocked: outputResult.action === "BLOCK",
};`;

export default function BotpressDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Botpress Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Add SoterAI as a pre-processing and post-processing HTTP step in your Botpress workflows.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1. Input step</span> — Call <InlineCode>POST /api/guard/input</InlineCode> before the user message reaches your AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2. Output step</span> — Call <InlineCode>POST /api/guard/output</InlineCode> before the AI response goes to the user
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3. Handle decisions</span> — Block or redirect when the guard returns BLOCK or HUMAN_REVIEW
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4. Audit logs</span> — Store only the public guard result (not raw text) in Botpress logs
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Botpress workflow example</h2>
          <CodeBlock language="typescript" title="botpress action" showLineNumbers>{workflowCode}</CodeBlock>
        </section>

        <WarnBox>
          Keep the API key server-side in your Botpress environment variables. Never expose it to the browser.
        </WarnBox>
      </div>
    </main>
  );
}
