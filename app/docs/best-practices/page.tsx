import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "AI Security Best Practices: OWASP LLM Top 10",
  description:
    "AI guardrail best practices: API key management, webhook verification, fail-open vs fail-closed, output guarding, rate limiting and OWASP LLM Top 10.",
  alternates: { canonical: "/docs/best-practices" },
};

const webhookVerifyCode = `import { createHmac, timingSafeEqual } from "node:crypto";

// Read x-soter-signature and the raw request body before JSON parsing.
// This verifies dashboard event webhooks, not SIEM webhook exports.
function verify(rawBody: string, header: string, secret: string) {
  const match = /^t=(\\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match || !secret) return false;

  const [, timestampText, signature] = match;
  const timestamp = Number(timestampText);
  const now = Math.floor(Date.now() / 1000);
  // Receiver policy: allow at most five minutes of clock skew.
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(\`\${timestampText}.\${rawBody}\`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// On false: reject the request. On true: parse and validate its JSON,
// then deduplicate the verified body.id in durable storage before work.`;

export default function BestPracticesDocsPage() {
  return (
    <DocsPageShell path="/docs/best-practices">
      <section className="docs-section">
        <DocsHeading>Keep the API key server-side only</DocsHeading>
        <p className="mt-3 leading-7">Use your backend as the integration boundary: browser or mobile client → your authenticated server → SoterAI. The SDK does not replace your application&apos;s identity, authorization or abuse controls.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Inject <InlineCode>SOTER_API_KEY</InlineCode> through a server secret store or protected environment. Do not ship it in client JavaScript, mobile binaries or public artifacts.</li>
          <li>In Next.js, do not use a <InlineCode>NEXT_PUBLIC_</InlineCode> prefix. Read the key only in server code.</li>
          <li>The WordPress plugin stores its key in server-side options and sends it from PHP. Protect database access, backups and administrator permissions; the frontend uses the local REST proxy.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Rotate keys regularly</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Rotate on your organization&apos;s schedule and immediately after suspected exposure. Replace the deployed secret, verify the new key, then revoke the old one.</li>
          <li>Use distinct <InlineCode>ck_test_…</InlineCode> and <InlineCode>ck_live_…</InlineCode> keys for separate environments. The prefix labels a key; it does not create an isolated model, dataset or deployment.</li>
          <li>Use separate project keys to limit a leak&apos;s scope. A supplied project ID or metadata field does not override the project selected by the authenticated key.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Always run the output guard</DocsHeading>
        <p className="mt-3 leading-7">Run <InlineCode>guardOutput</InlineCode> after generation and before release. The output path checks for supported risks such as secret/PII exposure, system-prompt leakage and unsafe content; a clean input verdict says nothing about a later model reply.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Require an allowed continuation action. <InlineCode>BLOCK</InlineCode>, <InlineCode>HUMAN_REVIEW</InlineCode>, missing decisions and operational failures must not fall through to the original completion.</li>
          <li>Use returned replacement text for redaction/rewrite decisions. If required replacement text is absent, withhold rather than restoring the original.</li>
          <li>Return a fixed application refusal on denial or failure. Do not return an unsafe completion alongside <InlineCode>blocked: true</InlineCode>, and do not expose full guard diagnostics.</li>
          <li>Buffer output until inspection completes. A check after streaming cannot retract tokens already delivered.</li>
          <li>For RAG, verify access and grounding separately. The <Link href="/docs/rag" className="text-cyan underline">RAG guide</Link> distinguishes pre-generation chunk inspection from post-generation checks and session-protected grounding.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Redact logs</DocsHeading>
        <p className="mt-3 leading-7">Prefer decision/action, risk category, request ID, latency and failure class over prompt or completion text. The JavaScript client&apos;s built-in debug logger emits method/path diagnostics; that does not make application logs, exception messages or entire SDK results safe to persist.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Do not log raw prompts, completions, tool arguments, API keys or approval tokens.</li>
          <li><InlineCode>safeText</InlineCode>, <InlineCode>redactedText</InlineCode> and Python <InlineCode>safe_text</InlineCode> are not blanket privacy guarantees. Unflagged text may remain unchanged and detections can miss sensitive data.</li>
          <li>The server&apos;s log preparation removes original text for selected confidential risk categories, but can retain non-flagged originals. Review retention, access controls and downstream telemetry independently.</li>
          <li>When debugging requires content, use synthetic fixtures first. Review and minimize any retained redacted samples under an explicit retention policy.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Sign and verify webhooks</DocsHeading>
        <p className="mt-3 leading-7">Dashboard event webhooks send <InlineCode>x-soter-signature</InlineCode> as <InlineCode>t=timestamp,v1=hex_digest</InlineCode>. The digest is HMAC-SHA256 over the exact <InlineCode>timestamp.rawBody</InlineCode>. Read the raw body before JSON parsing; reserializing JSON can change the signed bytes.</p>
        <CodeBlock language="typescript" title="webhook verification · dashboard events" showLineNumbers>{webhookVerifyCode}</CodeBlock>
        <TipBox>The five-minute timestamp window is receiver policy, not proof against every replay. After verification, validate the payload and deduplicate the signed body&apos;s <InlineCode>id</InlineCode> in durable storage before side effects. Keep receiver clocks synchronized.</TipBox>
        <p className="mt-3 leading-7">The separate SIEM webhook exporter uses a different header arrangement. Do not apply this dashboard-event parser to it without checking that integration&apos;s contract. Never trust an unsigned header as a substitute for the verified payload.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Timeout and fail behavior</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Configure an end-to-end application deadline that covers guard calls, retrieval, the model and retries. JavaScript <InlineCode>timeoutMs</InlineCode> defaults to 8,000 milliseconds; Python <InlineCode>timeout</InlineCode> defaults to 8 seconds. Neither is a whole-conversation latency guarantee.</li>
          <li>Choose failure policy explicitly. Fail open proceeds without a completed check and favors availability; fail closed withholds work and favors containment. For sensitive output and state-changing tools, prefer fail closed.</li>
          <li>The core SDKs throw on HTTP/transport failures rather than silently declaring an allow. Catch those errors at your application boundary and return a fixed public response, not the exception message or original text.</li>
          <li>JavaScript <InlineCode>retries</InlineCode> / <InlineCode>maxRetries</InlineCode> defaults to zero and covers network failures and 5xx responses. Python <InlineCode>max_retries</InlineCode> also defaults to zero but retries transport exceptions, not HTTP 5xx/429 responses.</li>
          <li>Bound retries and distinguish guard retries from model/tool retries. A timed-out write may already have happened; use application idempotency and reconciliation rather than blindly repeating it.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Rate limiting and abuse prevention</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Respect 429 and <InlineCode>Retry-After</InlineCode>. SDK rate-limit exceptions expose the delay as JavaScript <InlineCode>retryAfter</InlineCode> or Python <InlineCode>retry_after</InlineCode>; retries are not an authorization bypass.</li>
          <li>Add per-user/IP limits at your public endpoint and cap body size, message length, retrieval fan-out and tool invocations. SoterAI&apos;s API-key rate limit does not distinguish your own end users.</li>
          <li>The server uses Redis-backed counters when configured, with a process-local fallback when Redis is absent or unavailable. Limits in fallback mode are per instance, not a distributed quota. Monitor that degraded state in multi-instance deployments.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Known limitations</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Detection has false positives and false negatives. Test representative benign and adversarial inputs for your language, model, policy and data.</li>
          <li>Use OWASP LLM risks as a review checklist. An implemented check or passing local regression is not a SOC 2/ISO 27001 certificate or independent security assessment.</li>
          <li>Combine these checks with least privilege, input validation, output encoding, secrets management, monitoring and incident response. Validate tool restrictions and retrieval authorization separately.</li>
          <li>This reduces risk; it does not guarantee complete protection. Do not turn an integration example into a claim of universal production readiness.</li>
        </ul>
        <DocsHeading level={3}>Release verification</DocsHeading>
        <p className="mt-3 leading-7">Exercise allow, redaction, block, human review, malformed requests, throttling and outages. Assert the downstream action count and the exact public response, not just a detector label. Keep results tied to the SDK/server versions and policy actually deployed.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/quickstart" className="button-primary gap-2">Quickstart Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/api-contract" className="button-secondary gap-2">API Contract <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← CLI</Link>
        <Link href="/docs/quickstart" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Quickstart →</Link>
      </div>
    </DocsPageShell>
  );
}
