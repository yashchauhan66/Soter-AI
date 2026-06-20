import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const apiCode = `// Guard incoming WhatsApp message
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

// Guard the AI response
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
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">WhatsApp Chatbot Security</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your WhatsApp chatbot deployments with input/output guarding and India-specific PII redaction.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Integration Flow</h2>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <code className="text-xs text-slate-500">
              WhatsApp Message → Soter Input Guard → LLM/RAG → Soter Output Guard → WhatsApp Reply
            </code>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> Route inbound WhatsApp messages through <InlineCode>/api/guard/input</InlineCode> before the LLM
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> Route model responses through <InlineCode>/api/guard/output</InlineCode> before replying to users
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> Enable India PII redaction for phone numbers, Aadhaar, PAN, UPI IDs
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> Configure webhooks for blocked prompts, secrets, PII redactions, and usage alerts
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">API Example</h2>
          <CodeBlock language="typescript">{apiCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">India-Specific PII</h2>
          <p className="mt-3 text-slate-400">
            Soter automatically detects and redacts India-specific personally identifiable information when enabled:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li><strong>Aadhaar numbers</strong> (12-digit with optional spaces)</li>
            <li><strong>PAN numbers</strong> (10-character alphanumeric)</li>
            <li><strong>UPI IDs</strong> (format: username@bank)</li>
            <li><strong>Indian phone numbers</strong> (10-digit with +91 prefix)</li>
            <li><strong>Bank account numbers</strong> and IFSC codes</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Security Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Do not test against customer systems without written authorization.</li>
            <li>API key stays server-side only.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/intercom" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Intercom</Link>
          <Link href="/docs/zendesk" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Zendesk →</Link>
        </div>
      </div>
    </main>
  );
}
