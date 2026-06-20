import Link from "next/link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const apiCode = `// Guard incoming ticket message
const inputResult = await fetch(\`$\{process.env.SOTER_BASE_URL\}/api/guard/input\`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: ticketBody }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  // Return safe fallback or flag for human review
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
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">Zendesk Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use Soter to protect AI workflows in your Zendesk environment.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Integration Pattern</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> <strong>Guard inbound ticket messages</strong> — Before they reach the AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> <strong>Guard AI draft replies</strong> — Before they are sent to customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> <strong>Separate projects</strong> — Use distinct Soter projects per brand or client
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> <strong>Audit and reports</strong> — Use webhooks and scheduled reports for security review
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
          <h2 className="text-2xl font-bold">Best Practices</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Use separate Soter projects per brand or client for isolation.</li>
            <li>Always run the output guard on AI drafts before they reach customers.</li>
            <li>Store only redacted/guarded text in audit logs.</li>
            <li>Use webhooks for real-time blocking alerts.</li>
            <li>Coordinate with support owners before enabling blocking mode.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/whatsapp" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← WhatsApp</Link>
          <Link href="/docs/wordpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">WordPress →</Link>
        </div>
      </div>
    </main>
  );
}
