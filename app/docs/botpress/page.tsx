import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

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
  return { reply: inputResult.safeText ?? "This message was blocked.", blocked: true };
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
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Botpress Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Add Soter as a pre-processing and post-processing HTTP step in your Botpress workflows.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">How It Works</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> <strong>Input step</strong> — Call <InlineCode>POST /api/guard/input</InlineCode> before the user message reaches your AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> <strong>Output step</strong> — Call <InlineCode>POST /api/guard/output</InlineCode> before the AI response is sent to the user
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> <strong>Handle decisions</strong> — Block or redirect when the guard returns BLOCK or HUMAN_REVIEW
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> <strong>Audit logs</strong> — Store only the public guard result (not raw text) in Botpress logs
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Botpress Workflow Example</h2>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <code className="text-xs text-slate-500">
              User Message → Soter Input Guard (/api/guard/input) → AI Agent → Soter Output Guard (/api/guard/output) → User
            </code>
          </div>
          <CodeBlock language="typescript">{workflowCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Security Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Keep the API key server-side in your Botpress environment variables.</li>
            <li>Always guard both input and output.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/rag" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← RAG Guide</Link>
          <Link href="/docs/intercom" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Intercom →</Link>
        </div>
      </div>
    </main>
  );
}
