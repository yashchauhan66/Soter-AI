import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI API Contract - Complete API Reference for AI Security Endpoints",
  description:
    "Complete API reference for all SoterAI endpoints including input guard, output guard, analyze, badge, risk types, error codes, and webhook events. Request/response shapes and status codes.",
  alternates: { canonical: "/docs/api-contract" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "API Contract", item: "https://soterai.publicvm.com/docs/api-contract" },
  ],
};

export default function ApiContractDocsPage() {
  const riskTypes = [
    ["PROMPT_INJECTION", "User attempts to override system instructions", "HIGH"],
    ["JAILBREAK", "Attempt to bypass safety rules (developer mode, role-play)", "HIGH"],
    ["SYSTEM_PROMPT_LEAK_ATTEMPT", "User asks the model to reveal its system prompt", "CRITICAL"],
    ["SYSTEM_PROMPT_LEAKAGE", "Model output contains system prompt fragments", "CRITICAL"],
    ["PII_DETECTED", "Personally identifiable information detected", "MEDIUM"],
    ["INDIA_PII_DETECTED", "India-specific PII (Aadhaar, PAN, UPI)", "HIGH"],
    ["SECRET_DETECTED", "API keys, tokens, or credentials detected", "CRITICAL"],
    ["UNSAFE_OUTPUT", "Model output contains harmful or policy-violating content", "HIGH"],
    ["RATE_LIMIT", "Per-minute or monthly usage limit exceeded", "LOW"],
    ["TOKEN_ABUSE", "Unusual token usage pattern detected", "MEDIUM"],
  ];

  const actions = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE", "BLOCK", "HUMAN_REVIEW"];
  const errors = [
    ["400", "validation_error", "Payload failed validation"],
    ["401", "auth_error", "Missing or invalid x-api-key"],
    ["403", "auth_error", "API key inactive"],
    ["404", "not_found", "Project, webhook, or badge does not exist"],
    ["409", "conflict", "Signing secret no longer available; rotate to issue a new one"],
    ["429", "rate_limited", "Per-minute or monthly limit hit. See Retry-After header"],
    ["500", "server_error", "Unexpected failure (original details are not leaked)"],
  ];

  return (
    <main className="py-16">
      <DocViewTracker />
      <div className="container-docs">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Reference</p>
        <h1 className="mt-3 text-4xl font-bold">API Contract</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Complete API reference for all SoterAI endpoints, request/response shapes, error codes, and webhook events.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Endpoints</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/input</code>
              </div>
              <p className="mt-1 text-sm text-slate-400">Guard user input. Body: <InlineCode>{`{ message, userId?, sessionId?, metadata? }`}</InlineCode></p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/output</code>
              </div>
              <p className="mt-1 text-sm text-slate-400">Guard AI output. Body: <InlineCode>{`{ aiResponse, sessionId?, metadata? }`}</InlineCode></p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/analyze</code>
              </div>
              <p className="mt-1 text-sm text-slate-400">Analyze text. Public, rate-limited per IP. Body: <InlineCode>{`{ text, direction }`}</InlineCode></p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-400">GET</span>
                <code className="text-cyan">/api/badge/&lt;slug&gt;</code>
              </div>
              <p className="mt-1 text-sm text-slate-400">Public badge status. Returns monthly counts and last activity only.</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Response Shape</h2>
          <CodeBlock language="json">{`{
  "allowed": false,
  "action": "BLOCK",
  "decision": "BLOCK",
  "riskScore": 85,
  "riskTypes": ["PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK_ATTEMPT"],
  "reason": "Blocked because high-risk patterns were detected...",
  "safeText": null,
  "redactedText": null,
  "findings": []
}`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            <InlineCode>decision</InlineCode> is a normalized 4-value field (<InlineCode>ALLOW | REDACT | BLOCK | HUMAN_REVIEW</InlineCode>).
            The raw <InlineCode>action</InlineCode> is also available.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Risk Types</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Risk Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Severity</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {riskTypes.map(([type, desc, severity]) => (
                  <tr key={type} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{type}</td>
                    <td className="px-4 py-2.5">{desc}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        severity === "CRITICAL" ? "bg-red-950/50 text-red-400" :
                        severity === "HIGH" ? "bg-orange-950/50 text-orange-400" :
                        severity === "MEDIUM" ? "bg-yellow-950/50 text-yellow-400" :
                        "bg-slate-800/50 text-slate-400"
                      }`}>{severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <span key={action} className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300">
                {action}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Error Codes</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Error</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {errors.map(([code, error, desc]) => (
                  <tr key={code} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{code}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{error}</td>
                    <td className="px-4 py-2.5">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Webhook Events</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "guard.prompt_injection.blocked",
              "guard.jailbreak.detected",
              "guard.secret.detected",
              "guard.pii.redacted",
              "guard.system_prompt_leak.blocked",
              "guard.unsafe_output.blocked",
              "usage.limit.warning",
              "usage.limit.exceeded",
            ].map((event) => (
              <code key={event} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs">
                {event}
              </code>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-800 p-4">
            <p className="text-sm font-semibold text-slate-300">Webhook Headers</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              <li><InlineCode>x-cyberrakshak-event</InlineCode> — event name</li>
              <li><InlineCode>x-cyberrakshak-timestamp</InlineCode> — unix seconds at signing time</li>
              <li><InlineCode>x-cyberrakshak-signature</InlineCode> — <InlineCode>t=...,v1=&lt;hmac-sha256&gt;</InlineCode></li>
            </ul>
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What's next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/rest-api" className="button-primary gap-2">
                REST API Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/best-practices" className="button-secondary gap-2">
                Security Best Practices <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/quickstart" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Quickstart</Link>
          <Link href="/docs" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Docs Hub →</Link>
        </div>
      </div>
    </main>
  );
}
