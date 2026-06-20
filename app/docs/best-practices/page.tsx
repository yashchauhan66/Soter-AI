import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const webhookVerifyCode = `import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody: string, header: string, secret: string) {
  const m = /t=(\\d+),v1=([0-9a-f]+)/.exec(header);
  if (!m) return false;
  const [, t, sig] = m;
  const expected = createHmac("sha256", secret)
    .update(\`$\{t}.$\{rawBody}\`)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(sig, "hex"),
  );
}`;

export default function BestPracticesDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Security guide</p>
        <h1 className="mt-3 text-4xl font-bold">Security Best Practices</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Soter is OWASP LLM Top 10 aligned and built for defense-in-depth: <strong>detect, block, redact, monitor, and report</strong>.
          It reduces risk. It does <strong>not</strong> guarantee complete protection.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Keep the API Key Server-Side Only</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Never embed <InlineCode>SOTER_API_KEY</InlineCode> in browser/client code, mobile apps, or any artifact shipped to users.</li>
            <li>In Next.js, do <strong>not</strong> prefix it with <InlineCode>NEXT_PUBLIC_</InlineCode>. Read it only in route handlers, server actions, or server components.</li>
            <li>In WordPress, the key lives in the options table and is used only from PHP. The frontend calls the local REST proxy.</li>
            <li>The browser should talk to <strong>your</strong> server, which talks to Soter.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Rotate Keys</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Rotate API keys on a schedule and immediately if one may have leaked.</li>
            <li>Use separate <InlineCode>ck_test_…</InlineCode> and <InlineCode>ck_live_…</InlineCode> keys per environment.</li>
            <li>Use distinct keys per project so a single leak has a limited blast radius.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Always Run the Output Guard</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Guarding input is not enough. Run <InlineCode>guardOutput</InlineCode> on every LLM response to catch leaked secrets, PII, system-prompt leakage, and unsafe output.</li>
            <li>For RAG, also verify grounding so answers stay attributable to authorized sources.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Redact Logs</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Do not log raw prompts or completions in your application.</li>
            <li>The SDKs never log the API key or raw text, even in debug mode; keep that property in your own code.</li>
            <li>When you must persist examples for debugging, store the <InlineCode>redactedText</InlineCode> / <InlineCode>safe_text</InlineCode>, not the original.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Sign and Verify Webhooks</h2>
          <p className="mt-3 text-slate-400">If you consume Soter webhooks, verify the HMAC signature before trusting the payload:</p>
          <CodeBlock language="typescript">{webhookVerifyCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">Reject stale timestamps to prevent replay attacks.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Timeout and Fail Behavior</h2>
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

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Rate Limiting and Abuse</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Respect <InlineCode>429</InlineCode> and the <InlineCode>Retry-After</InlineCode> header; back off rather than hammering.</li>
            <li>Add your own per-IP/per-user limits in front of public chat endpoints.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Never Claim 100% Security</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Do not market or describe Soter as guaranteeing complete protection.</li>
            <li>Use honest wording: <em>OWASP LLM Top 10 aligned</em>, <em>risk reduction</em>, <em>defense-in-depth</em>.</li>
            <li>Combine Soter with least-privilege design, input validation, output encoding, secrets management, and monitoring.</li>
          </ul>
        </section>

        <section className="card mt-10 border-amber-500/20 p-6">
          <h2 className="font-semibold text-amber-200">Known Limitations</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Pattern detection produces false positives and negatives — no detector is perfect.</li>
            <li>Rate limits are per-process; use a shared Redis bucket in multi-instance deployments.</li>
            <li>Phase 2 ships a demo identity boundary; production needs full auth, RBAC, and tenant isolation.</li>
            <li>The badge reflects defensive activity, not certification or complete protection.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← CLI</Link>
          <Link href="/docs/quickstart" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Quickstart →</Link>
        </div>
      </div>
    </main>
  );
}
