import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Intercom Integration: AI Support Security",
  description:
    "Protect Intercom AI customer-support chats from prompt injection, PII leaks and unsafe responses. REST API examples and best practices included.",
  alternates: { canonical: "/docs/intercom" },
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

// Your queue supplies customerMessage from an authenticated conversation.
// Only publish result.reply when result.blocked === false; otherwise hand off.
return await guardedReply(customerMessage);`;

export default function IntercomDocsPage() {
  return (
    <DocsPageShell path="/docs/intercom">

        <section className="docs-section">
          <DocsHeading>Integration pattern</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This is a server-side integration pattern for a custom support workflow, not a native
            Intercom app. You need a server that controls the model call and final reply publication.
            An event notification alone is not a pre-send interception point for Fin or other
            Intercom-managed automation; confirm that your chosen workflow can actually withhold a reply.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">1.</span> Guard user messages before they reach the AI assistant
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">2.</span> Guard AI-generated replies before they reach customers
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">3.</span> Minimize review data; omit message text and sensitive matched findings from ordinary logs
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">4.</span> Where configured, use reports as review evidence, not a compliance certificate
            </div>
          </div>
        </section>

        <section className="docs-section">
          <DocsHeading>Authenticate and normalize events</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Intercom signs notifications in <InlineCode>X-Hub-Signature</InlineCode> with a{" "}
            <InlineCode>sha1=</InlineCode> prefix: verify HMAC-SHA1 over the unchanged raw body using
            your Intercom app&apos;s client secret, not the SoterAI API key.
            <a href="https://developers.intercom.com/docs/references/webhooks/webhook-models" className="text-cyan underline">[2]</a>
          </p>
          <p className="mt-3 leading-7 text-slate-200">
            Reject missing or invalid signatures with a constant-time comparison before parsing or queueing.
            Validate the expected app, topic and conversation-to-project mapping; deduplicate notification IDs
            and ignore your own reply events to avoid loops. Queue accepted work and acknowledge delivery
            separately from AI processing. The sample below does not implement those provider-specific steps.
            Normalize only the intended customer text; attachments and tool actions need separate checks.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">Set both values in your server-side worker. These raw HTTP calls do not use an SDK default. Keep Intercom and SoterAI credentials in server secret storage, never in the Messenger browser bundle.</p>
          <CodeBlock language="bash" title="server environment">{`SOTER_BASE_URL=https://api.soterai.in
SOTER_API_KEY=replace_with_your_server_side_key
# Use an HTTPS origin without a trailing slash; do not commit credentials.`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>API usage (server-side)</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use this inside an async Node.js 18+ worker. You implement <InlineCode>generateReply</InlineCode>{" "}
            and the Intercom delivery adapter. BLOCK, HUMAN_REVIEW, unknown decisions, HTTP failures,
            timeouts and missing replacement text hold publication. A held result needs your support or retry
            queue, not an unchecked fallback draft.
          </p>
          <CodeBlock language="javascript" title="intercom-worker.js" showLineNumbers>{apiCode}</CodeBlock>
          <p className="mt-3 leading-7 text-slate-200">Test allowed text, redaction, review, denial, API failure and duplicate events before enabling automated replies. Buffer the complete draft; publishing tokens before the output decision bypasses this pattern.</p>
        </section>

        <section className="docs-section">
          <DocsHeading>Best practices</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Use separate projects per client", "Choose each brand's project API key on your server from authenticated account mappings. A project label alone is not tenant authorization."],
              ["Always guard output too", "Run the output guard on AI drafts before they reach customers."],
              ["Minimize audit logs", "Prefer allowlisted decision metadata such as action and risk types. Public guard responses can still contain text or matched findings; do not log the whole result."],
              ["Use webhooks", "Optional SoterAI alert delivery is separate from Intercom event authentication and must not be your synchronous blocking gate."],
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
              <Link href="/docs/whatsapp" className="button-primary gap-2">
                WhatsApp Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/botpress" className="button-secondary gap-2">
                Botpress Guide
              </Link>
            </div>
          </div>
        </section>

    </DocsPageShell>
  );
}
