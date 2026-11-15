import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Zendesk Integration: Support Ticket Security",
  description:
    "Protect Zendesk AI ticket workflows from prompt injection, PII leaks and unsafe AI drafts. REST API examples and best practices for support teams.",
  alternates: { canonical: "/docs/zendesk" },
};

const apiCode = `// Node.js worker, after webhook authentication and deduplication.
async function guardedReply(message) {
  const hold = { reply: "This reply needs support review.", blocked: true };
  try {
    const baseUrl = process.env.SOTER_BASE_URL;
    const apiKey = process.env.SOTER_API_KEY;
    if (!baseUrl || !apiKey) return hold;

    async function checkedText(path, body, original) {
      const res = await fetch(baseUrl + path, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("Guard unavailable");
      const result = await res.json();
      if (result?.allowed !== true ||
          !["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"].includes(result.action)) {
        throw new Error("Hold for review"); // Includes BLOCK and HUMAN_REVIEW.
      }
      const text = result.safeText ?? result.redactedText ??
        (result.action === "ALLOW" ? original : null);
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Missing guarded text");
      }
      return text;
    }

    const input = await checkedText("/api/guard/input", { message }, message);
    const draft = await generateReply(input); // Your model adapter; no streaming.
    const reply = await checkedText("/api/guard/output", { aiResponse: draft }, draft);
    return { reply, blocked: false };
  } catch {
    return hold; // Never return the original message or the unchecked draft.
  }
}

// Your queue supplies ticketBody from an authenticated ticket event.
// Only publish result.reply when result.blocked === false; otherwise hand off.
return await guardedReply(ticketBody);`;

export default function ZendeskDocsPage() {
  return (
    <DocsPageShell path="/docs/zendesk">

        <section className="docs-section">
          <DocsHeading>Integration pattern</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This is a server-side integration pattern for a ticket workflow you control, not a native
            Zendesk app. You supply the authenticated event receiver, model adapter and final comment
            publication. A webhook after a ticket update does not retroactively protect stored content or
            intercept every Zendesk AI feature; verify a genuine pre-publish decision point in your workflow.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">1.</span> Guard inbound ticket messages before they reach the AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">2.</span> Guard AI draft replies before they are sent to customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">3.</span> Select distinct project API keys from authenticated brand or client mappings
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">4.</span> Use optional alerts and configured reports for review, not as the synchronous publication gate
            </div>
          </div>
        </section>

        <section className="docs-section">
          <DocsHeading>Verify ticket events</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Verify <InlineCode>X-Zendesk-Webhook-Signature</InlineCode> against a base64 HMAC-SHA256 digest
            of the exact timestamp string followed by the unchanged raw body, using that webhook&apos;s signing secret.
            Read the timestamp from <InlineCode>X-Zendesk-Webhook-Signature-Timestamp</InlineCode>.
            These are Zendesk credentials, separate from your SoterAI API key.
            <a href="https://developer.zendesk.com/documentation/webhooks/verifying/" className="text-cyan underline">[3]</a>
          </p>
          <p className="mt-3 leading-7 text-slate-200">
            Reject invalid signatures with a constant-time comparison before processing. Enforce an explicit
            timestamp freshness policy and deduplicate event deliveries; signature validity alone does not
            prevent replay. Validate the account, webhook and ticket mapping, ignore your own comment updates,
            and separate webhook acknowledgement from queued model work. Preserve these checks when configuring
            custom ticket payloads. The sample does not implement the receiver, retries or Zendesk API calls.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">Set both values in the server-side worker; raw fetch has no SDK default. Store Zendesk authentication and SoterAI keys server-side, never in a browser-side support app.</p>
          <CodeBlock language="bash" title="server environment">{`SOTER_BASE_URL=https://api.soterai.in
SOTER_API_KEY=replace_with_your_server_side_key
# Use an HTTPS origin without a trailing slash; do not commit credentials.`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>API example</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use this inside an async Node.js 18+ worker with your own <InlineCode>generateReply</InlineCode> adapter.
            Publish only the checked reply when <InlineCode>blocked</InlineCode> is false; route all other
            results to your support or retry queue. BLOCK, HUMAN_REVIEW, HTTP errors, network failures and
            missing replacement text never fall back to an unchecked draft.
          </p>
          <CodeBlock language="javascript" title="zendesk-worker.js" showLineNumbers>{apiCode}</CodeBlock>
          <p className="mt-3 leading-7 text-slate-200">Before enabling automatic comments, test allowed text, redaction, review, denial, timeout and duplicate events. Check the final comment body, including any added template text, before publication. Buffer drafts instead of streaming unchecked output.</p>
        </section>

        <section className="docs-section">
          <DocsHeading>Best practices</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Use separate projects per client", "Choose project keys from server-validated brand mappings. Separate labels alone do not enforce tenant authorization."],
              ["Always guard output too", "Run the output guard on AI drafts before they reach customers."],
              ["Minimize audit logs", "Keep allowlisted decision metadata, not whole guard responses, ticket bodies, draft text or potentially sensitive matched findings."],
              ["Use webhooks for alerts", "Optional SoterAI alerts are separate from Zendesk event authentication. Do not wait for an alert to decide whether to publish."],
              ["Coordinate with support owners", "Get buy-in from support teams before enabling blocking mode."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <DocsHeading>What&apos;s next?</DocsHeading>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/wordpress" className="button-primary gap-2">
                WordPress Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/whatsapp" className="button-secondary gap-2">
                WhatsApp Guide
              </Link>
            </div>
          </div>
        </section>

    </DocsPageShell>
  );
}
