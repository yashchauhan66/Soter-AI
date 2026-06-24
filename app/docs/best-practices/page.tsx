import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Security Best Practices - OWASP LLM Top 10 Alignment Guide",
  description:
    "SoterAI security best practices for AI guardrails. Learn API key management, webhook verification, fail-open vs fail-closed, output guarding, rate limiting, and OWASP LLM Top 10 alignment.",
  alternates: { canonical: "/docs/best-practices" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Security Best Practices", item: "https://soterai.publicvm.com/docs/best-practices" },
  ],
};

const webhookVerifyCode = `import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody: string, header: string, secret: string) {
  const m = /t=(\\d+),v1=([0-9a-f]+)/.exec(header);
  if (!m) return false;
  const [, t, sig] = m;
  const expected = createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(sig, "hex"),
  );
}`;

export default function BestPracticesDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Security guide</p>
        <h1 className="mt-3 text-4xl font-bold">Security Best Practices</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          SoterAI is OWASP LLM Top 10 aligned and built for defense-in-depth: <strong>detect, block, redact, monitor, and report</strong>.
          It reduces risk. It does <strong>not</strong> guarantee complete protection.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Keep the API key server-side only</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Never expose in browser code", "SOTER_API_KEY must never appear in client-side JavaScript, mobile apps, or shipped artifacts."],
              ["No NEXT_PUBLIC_ prefix", "In Next.js, never prefix with NEXT_PUBLIC_. Read keys only in route handlers or server actions."],
              ["Use your server as proxy", "The browser talks to your server. Your server talks to SoterAI. API key stays on the server."],
              ["WordPress key security", "The key lives in the options table used only from PHP. Frontend calls the local REST proxy."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div><p className="font-semibold text-sm">{title}</p><p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Rotate keys regularly</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Rotate API keys on a schedule and immediately if one may have leaked.</li>
            <li>Use separate <InlineCode>ck_test_…</InlineCode> and <InlineCode>ck_live_…</InlineCode> keys per environment.</li>
            <li>Use distinct keys per project so a single leak has a limited blast radius.</li>
          </ul>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Always run the output guard</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Guarding input is not enough. Run <InlineCode>guardOutput</InlineCode> on every LLM response to catch leaked secrets, PII, system-prompt leakage, and unsafe output.</li>
            <li>For RAG, also verify grounding so answers stay attributable to authorized sources.</li>
          </ul>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Redact logs</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Do not log raw prompts or completions in your application.</li>
            <li>The SDKs never log the API key or raw text, even in debug mode; keep that property in your own code.</li>
            <li>When you must persist examples for debugging, store the <InlineCode>redactedText</InlineCode> / <InlineCode>safe_text</InlineCode>, not the original.</li>
          </ul>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Sign and verify webhooks</h2>
          <p className="mt-3 leading-7 text-slate-400">If you consume SoterAI webhooks, verify the HMAC signature before trusting the payload:</p>
          <CodeBlock language="typescript" title="webhook verification" showLineNumbers>{webhookVerifyCode}</CodeBlock>
          <TipBox>Reject stale timestamps to prevent replay attacks. Check that the timestamp is within 5 minutes of the current time.</TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Timeout and fail behavior</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Set a sensible <InlineCode>timeoutMs</InlineCode> (5s is a good default).</li>
            <li>Decide your failure mode deliberately:
              <ul className="ml-5 mt-1 list-circle space-y-1">
                <li><strong>Fail open</strong> (proceed if Soter is unreachable) — favors availability.</li>
                <li><strong>Fail closed</strong> (block if Soter is unreachable) — favors safety.</li>
              </ul>
            </li>
            <li>For high-risk surfaces, prefer fail-closed on the <strong>output</strong> path.</li>
            <li>Use the SDK <InlineCode>retries</InlineCode> option for transient errors, but cap it.</li>
          </ul>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Rate limiting and abuse prevention</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Respect <InlineCode>429</InlineCode> and the <InlineCode>Retry-After</InlineCode> header; back off rather than hammering.</li>
            <li>Add your own per-IP/per-user limits in front of public chat endpoints.</li>
          </ul>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="font-semibold text-amber-200">Known limitations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-400">
              <li>Pattern detection produces false positives and negatives — no detector is perfect.</li>
              <li>Rate limits are per-process; use a shared Redis bucket in multi-instance deployments.</li>
              <li>Do not market or describe SoterAI as guaranteeing complete protection.</li>
              <li>Combine SoterAI with least-privilege design, input validation, output encoding, secrets management, and monitoring.</li>
              <li>This reduces risk; it does not guarantee complete protection.</li>
            </ul>
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="button-primary gap-2">
                Quickstart Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/api-contract" className="button-secondary gap-2">
                API Contract <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← CLI</Link>
          <Link href="/docs/quickstart" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Quickstart →</Link>
        </div>
      </div>
    </main>
  );
}
