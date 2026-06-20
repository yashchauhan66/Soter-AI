import Link from "next/link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const apiCode = `// Guard incoming customer message
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: customerMessage }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  return { reply: "I couldn't process that request.", blocked: true };
}

// Guard AI-generated reply before sending
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
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Intercom Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use Soter to reduce AI support-chat risk in your Intercom workflows.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Integration Pattern</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> <strong>Guard user messages</strong> — Before they reach the AI assistant
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> <strong>Guard generated replies</strong> — Before they reach customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> <strong>Redact PII/secrets</strong> — Before saving examples for review
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> <strong>Monthly reports</strong> — Use for security evidence and compliance
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">API Usage (Server-side)</h2>
          <CodeBlock language="typescript">{apiCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Best Practices</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Use separate Soter projects per brand or client for isolation.</li>
            <li>Always run the output guard on AI drafts before they reach customers.</li>
            <li>Store only redacted/guarded text in audit logs.</li>
            <li>Use webhooks for real-time blocking alerts.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/botpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Botpress</Link>
          <Link href="/docs/whatsapp" className="text-sm text-cyan hover:text-cyan/80 transition-colors">WhatsApp →</Link>
        </div>
      </div>
    </main>
  );
}
