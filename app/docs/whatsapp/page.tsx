import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "WhatsApp Chatbot Security: India PII Guard",
  description:
    "Protect WhatsApp chatbots with input/output guarding, India PII redaction (Aadhaar, PAN, UPI) and prompt injection detection.",
  alternates: { canonical: "/docs/whatsapp" },
};

const apiCode = `// Node.js server worker, after webhook authentication and deduplication.
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
    return hold; // No original text, guard payload or model draft in this result.
  }
}

// Supply userMessage and recipientId from your verified, normalized job.
const result = await guardedReply(userMessage);
if (result.blocked) return result; // Route to your support/retry queue.
await sendWhatsAppReply(recipientId, result.reply); // Your delivery adapter.
return result;`;

export default function WhatsappDocsPage() {
  return (
    <DocsPageShell path="/docs/whatsapp">

        <section className="docs-section">
          <DocsHeading>Integration flow</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This is a server-side integration pattern for a WhatsApp bot you operate, not a native
            WhatsApp app or a shipped webhook receiver. You supply the verified webhook handler,
            model adapter, queue and WhatsApp delivery code. It cannot intercept an unrelated bot&apos;s replies.
          </p>
          <CodeBlock language="text" title="message flow">{`WhatsApp Message → Soter Input Guard → LLM/RAG → Soter Output Guard → WhatsApp Reply`}</CodeBlock>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">1. Route inbound WhatsApp messages through input guard before the LLM</div>
            <div className="rounded-lg border border-slate-800 p-4">2. Route model responses through output guard before replying to users</div>
            <div className="rounded-lg border border-slate-800 p-4">3. Review project PII policy and verify redaction decisions for your supported message formats</div>
            <div className="rounded-lg border border-slate-800 p-4">4. Add optional security alerts separately; alert delivery is not the gate that blocks a reply</div>
          </div>
        </section>

        <section className="docs-section">
          <DocsHeading>Verify the webhook before guarding</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            For direct Meta webhooks, verify <InlineCode>X-Hub-Signature-256</InlineCode> using HMAC-SHA256
            over the unchanged raw body with your Meta app secret. The GET verification token and challenge
            handshake is separate; it does not authenticate POST events.
            <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint" className="text-cyan underline">[4]</a>
          </p>
          <p className="mt-3 leading-7 text-slate-200">
            Reject invalid signatures before parsing or queueing content, then validate the expected business
            account and event type. Use a constant-time signature comparison and deduplicate inbound message IDs
            before generating or sending a reply. If a provider relays WhatsApp for you, implement that
            provider&apos;s authentication contract instead of assuming Meta&apos;s headers survive the relay.
          </p>
          <p className="mt-3 leading-7 text-slate-200">
            Keep recipient routing data in your delivery adapter. Phone fields can be absent in newer WhatsApp
            events; follow Meta&apos;s current business-scoped user ID guidance.
            <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview" className="text-cyan underline">[5]</a>{" "}
            If you add SoterAI trace identifiers, use an opaque application ID rather than a phone number.
            The example handles normalized text only, not media, status notifications or every event in a batch.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">Set both values in the server-side worker. This raw-fetch example has no SDK default. Keep API keys and provider credentials out of browser bundles, logs and source control.</p>
          <CodeBlock language="bash" title="server environment">{`SOTER_BASE_URL=https://api.soterai.in
SOTER_API_KEY=replace_with_your_server_side_key
# Use an HTTPS origin without a trailing slash; never a public client variable.`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>API example</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Put this inside an async Node.js 18+ worker. <InlineCode>generateReply</InlineCode> and{" "}
            <InlineCode>sendWhatsAppReply</InlineCode> are your adapters, not SoterAI APIs.
            BLOCK, HUMAN_REVIEW, non-success HTTP responses, missing replacement text and network failures
            withhold delivery. Only an explicit allowed decision continues. A held job still needs your
            support or retry workflow; it is not the HTTP acknowledgement to Meta.
          </p>
          <CodeBlock language="javascript" title="whatsapp-worker.js" showLineNumbers>{apiCode}</CodeBlock>
          <p className="mt-3 leading-7 text-slate-200">Before enabling delivery, exercise allowed text, redaction, review, denial, timeout and duplicate events in your own test environment. Buffer the complete model response; do not stream unchecked tokens to WhatsApp.</p>
        </section>

        <section className="docs-section">
          <DocsHeading>India-specific PII detection</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The shipped India PII detector uses patterns and context, not identity verification.
            Project policy determines the action; forward replacement text only after checking the decision.
            These formats can produce false positives or misses and do not establish regulatory compliance:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Aadhaar-like numbers", "12 digits with optional spaces or hyphens; not validated as an issued Aadhaar number"],
              ["PAN-like identifiers", "Five letters, four digits and a final letter"],
              ["UPI IDs", "Local-part@handle patterns; not an account lookup"],
              ["Indian mobile numbers", "10 digits starting 6–9, with optional +91 prefix"],
              ["Bank account-like numbers", "9–18 digits with an account or bank-account context label"],
              ["IFSC codes", "A separate bank-code pattern, not proof of a bank account"],
              ["GSTIN-like identifiers", "GSTIN-format pattern matching; no registration check"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-3">
                <p className="font-semibold text-sm">{title}</p>
                <p className="mt-1 text-xs text-slate-200">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <DocsHeading>What&apos;s next?</DocsHeading>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/zendesk" className="button-primary gap-2">
                Zendesk Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/intercom" className="button-secondary gap-2">
                Intercom Guide
              </Link>
            </div>
          </div>
        </section>

    </DocsPageShell>
  );
}
