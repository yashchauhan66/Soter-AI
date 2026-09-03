import type { Metadata } from "next";
import { CodeBlock, InlineCode, WarnBox } from "@/components/ui/CodeBlock";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

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
    <DocsPageShell path="/docs/botpress">

        <section className="docs-section">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">1. Input step</span> — Call <InlineCode>POST /api/guard/input</InlineCode> before the user message reaches your AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">2. Output step</span> — Call <InlineCode>POST /api/guard/output</InlineCode> before the AI response goes to the user
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">3. Handle decisions</span> — Block or redirect when the guard returns BLOCK or HUMAN_REVIEW
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">4. Audit logs</span> — Store only the public guard result (not raw text) in Botpress logs
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_live_your_key_here
# SOTER_BASE_URL is optional if using the SDK — a default is included`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Botpress workflow example</h2>
          <CodeBlock language="typescript" title="botpress action" showLineNumbers>{workflowCode}</CodeBlock>
        </section>

        <WarnBox>
          Keep the API key server-side in your Botpress environment variables. Never expose it to the browser.
        </WarnBox>
    </DocsPageShell>
  );
}
