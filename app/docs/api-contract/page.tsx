import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "API Contract: AI Security Endpoint Reference",
  description:
    "API reference for core guard, analyze and badge routes: authentication, request/response shapes, risk types, errors and signed webhook events.",
  alternates: { canonical: "/docs/api-contract" },
};

export default function ApiContractDocsPage() {
  const riskTypes = [
    ["PROMPT_INJECTION", "Attempts to override system instructions", "Per finding"],
    ["JAILBREAK", "Attempts to bypass safety rules, including role-play or developer-mode framing", "Per finding"],
    ["SYSTEM_PROMPT_LEAK_ATTEMPT", "Requests to reveal a system prompt", "Per finding"],
    ["SYSTEM_PROMPT_LEAKAGE", "System-prompt leakage signal in model output", "Per finding"],
    ["CODE_INJECTION", "Application-level code, SQL, shell or script injection signals", "Per finding"],
    ["PII_DETECTED", "Personally identifiable information signal", "Per finding"],
    ["INDIA_PII_DETECTED", "India-specific PII, including Aadhaar, PAN or UPI patterns", "Per finding"],
    ["SECRET_DETECTED", "API keys, tokens or credential patterns", "Per finding"],
    ["UNSAFE_OUTPUT", "Harmful or policy-violating output signal", "Per finding"],
    ["DATA_EXFILTRATION", "Potential data-exfiltration content or destinations", "Per finding"],
    ["RATE_LIMIT", "Usage or rate-limit result", "Per finding"],
    ["TOKEN_ABUSE", "Excessive or abusive token-use signal", "Per finding"],
    ["TOXICITY", "Toxic-content signal", "Per finding"],
    ["BIAS_DETECTED", "Bias-related signal", "Per finding"],
    ["COMPETITIVE_INTEL_EXTRACTION", "Attempts to extract sensitive competitive information", "Per finding"],
    ["RECURSIVE_INJECTION", "Nested or recursive instruction-injection signal", "Per finding"],
    ["MCP_TOOL_POISONING", "Suspicious MCP tool instructions or metadata", "Per finding"],
    ["MEMORY_POISONING", "Suspicious instructions in agent memory", "Per finding"],
    ["SSRF_ATTEMPT", "Server-side request forgery signal", "Per finding"],
    ["HALLUCINATION", "Potential unsupported-generation signal; not a factuality guarantee", "Per finding"],
    ["MULTIMODAL_INJECTION", "Instruction-injection signal associated with multimodal content", "Per finding"],
    ["MODEL_SUPPLY_CHAIN", "Model supply-chain signal", "Per finding"],
    ["BEHAVIORAL_ANOMALY", "Anomalous behavior signal", "Per finding"],
    ["ADVANCED_SMUGGLING", "Encoded or obfuscated instruction-smuggling signal", "Per finding"],
    ["TOOL_CALL_ABUSE", "Classifier vocabulary for tool-call abuse; not an automatic block by itself", "Per finding"],
    ["MULTI_TURN_ESCALATION", "Classifier vocabulary for escalation across turns", "Per finding"],
    ["MODEL_EXTRACTION", "Classifier vocabulary for model-extraction attempts", "Per finding"],
    ["TOXICITY_HARASSMENT", "Classifier vocabulary for toxicity or harassment", "Per finding"],
    ["OFF_TOPIC", "Topical-scope signal, distinct from a security verdict", "Per finding"],
    ["LOW_RISK", "Low-risk vocabulary value; not a protection guarantee", "Per finding"],
  ];

  const actions = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE", "BLOCK", "HUMAN_REVIEW"];
  const errors = [
    ["400", "error: true", "Invalid JSON, field constraints or request-body limits"],
    ["401", "error: true", "Missing, malformed, inactive or unknown x-api-key; session routes may also return authentication required"],
    ["403", "error or guard result", "Disabled project/organization, provider governance block, approval required or insufficient dashboard permissions"],
    ["404", "error: true", "Requested project, webhook or public badge not found within the permitted scope"],
    ["409", "error: true", "Management conflict, such as a signing secret no longer available; rotate to issue a new one"],
    ["415", "error: true", "Input/output guard requires Content-Type: application/json"],
    ["429", "guard result", "API-key/IP rate limit or monthly quota exceeded; inspect Retry-After"],
    ["500", "error: true", "Unexpected server failure; the API returns a generic fallback message"],
    ["503", "error: true", "Service/database temporarily unavailable; may include Retry-After"],
  ];

  return (
    <DocsPageShell path="/docs/api-contract">

        <section className="mt-10">
          <DocsHeading>Endpoints</DocsHeading>
          <p className="mt-3 text-base leading-7 text-slate-200">This reference covers the core guard, analyzer and public-badge interfaces. Use the <Link href="/docs/rest-api" className="text-cyan underline">REST guide</Link> for copyable requests and field limits. The wider machine-readable contract is served by <InlineCode>GET /api/openapi</InlineCode>; endpoint authentication still depends on its implemented handler.</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/input</code>
              </div>
              <p className="mt-1 text-base text-slate-200">Guard user input. Requires a project <InlineCode>x-api-key</InlineCode> header and JSON content type. Body: <InlineCode>{`{ message, userId?, sessionId?, metadata?, providerName?, modelName?, source?, allowedTopics?, systemPromptContext?, minTopicRelevance? }`}</InlineCode></p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/output</code>
              </div>
              <p className="mt-1 text-base text-slate-200">Guard AI output. Requires <InlineCode>x-api-key</InlineCode> and JSON content type. Body: <InlineCode>{`{ aiResponse, userId?, sessionId?, metadata?, providerName?, modelName?, source? }`}</InlineCode>. Topical-scope fields are input-only.</p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">POST</span>
                <code className="text-cyan">/api/guard/analyze</code>
              </div>
              <p className="mt-1 text-base text-slate-200">Analyze text without a project API key. Public and rate-limited per IP. Body: <InlineCode>{`{ text, direction, source? }`}</InlineCode>; <InlineCode>direction</InlineCode> is required and must be <InlineCode>INPUT</InlineCode> or <InlineCode>OUTPUT</InlineCode>. This path does not load project policy or project governance context.</p>
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-400">GET</span>
                <code className="text-cyan">/api/badge/&lt;slug&gt;</code>
              </div>
              <p className="mt-1 text-base text-slate-200">Public badge status. Fields include slug, brandColor, status, monitoringActive, monthRequestsScanned, monthRisksBlocked, lastActivity, message and alignment. Branding and activity may be null. Status and alignment are descriptive fields, not proof of complete coverage or compliance certification.</p>
            </div>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-200">Dashboard routes <InlineCode>/api/projects</InlineCode> (GET/POST), <InlineCode>/api/api-keys</InlineCode> (GET/POST/PATCH) and <InlineCode>/api/webhooks</InlineCode> (GET/POST/PATCH/DELETE) are session-only and permission-scoped. Sending a guard API key does not create a dashboard session or grant management permissions.</p>
          <p className="mt-3 text-base leading-7 text-slate-200">Guard text is trimmed and must be non-empty; the default maximum is 8,000 characters. The JSON reader separately limits the body to 32,000 bytes and each string to 10,000 characters. Optional metadata supports at most 20 scalar-valued fields, not arbitrary nested objects. See the REST field table for the remaining bounds.</p>
        </section>

        <section className="mt-10">
          <DocsHeading>Response Shape</DocsHeading>
          <p className="mt-3 text-base leading-7 text-slate-200">Illustrative core guard result, not a measured verdict for a particular input. Optional replacement fields are omitted when absent; <InlineCode>reason</InlineCode> remains a string, including on allowed results.</p>
          <CodeBlock language="json" title="illustrative core guard result">{`{
  "allowed": false,
  "action": "BLOCK",
  "riskScore": 85,
  "riskTypes": [
    "PROMPT_INJECTION",
    "SYSTEM_PROMPT_LEAK_ATTEMPT"
  ],
  "reason": "Illustrative blocked response; not a measured verdict.",
  "findings": []
}`}</CodeBlock>
          <p className="mt-3 text-base text-slate-200">
            <InlineCode>decision</InlineCode> is SDK-derived, not emitted by the REST serializer. the JavaScript SDK normalizes the action to <InlineCode>ALLOW | REDACT | BLOCK | HUMAN_REVIEW</InlineCode>; both <InlineCode>ALLOW_WITH_REDACTION</InlineCode> and <InlineCode>REWRITE</InlineCode> become <InlineCode>REDACT</InlineCode>. Raw HTTP integrations must use <InlineCode>allowed</InlineCode> and <InlineCode>action</InlineCode>.
          </p>
          <p className="mt-3 text-base leading-7 text-slate-200">Core fields are <InlineCode>allowed</InlineCode>, <InlineCode>action</InlineCode>, <InlineCode>riskScore</InlineCode>, <InlineCode>riskTypes</InlineCode>, <InlineCode>reason</InlineCode> and <InlineCode>findings</InlineCode>. Optional fields include <InlineCode>safeText</InlineCode>, <InlineCode>redactedText</InlineCode>, <InlineCode>metadata</InlineCode>, <InlineCode>primaryRiskType</InlineCode> and <InlineCode>categoryConfidence</InlineCode>. The serializer removes <InlineCode>originalText</InlineCode>, but findings and replacement text can still contain sensitive data; do not expose complete results indiscriminately.</p>
          <p className="mt-3 text-base leading-7 text-slate-200">Normal analysis responses include <InlineCode>latencyMs</InlineCode> and <InlineCode>X-Soter-Latency-Ms</InlineCode>: server-side handling time, excluding network transit, not a latency guarantee. Early exits can omit them. Central JSON responses carry <InlineCode>X-SoterAI-API-Version</InlineCode> and <InlineCode>X-SoterAI-Contract-Version</InlineCode>; guard responses expose rate-limit headers, and governance exits can add <InlineCode>X-Governance-Action</InlineCode>.</p>
        </section>

        <section className="mt-10">
          <DocsHeading>Risk Types</DocsHeading>
          <p className="mt-3 text-base leading-7 text-slate-200">This is the current <InlineCode>RiskType</InlineCode> vocabulary, not a promise that every detector runs on every endpoint or deployment. Severity belongs to each <InlineCode>finding</InlineCode> (<InlineCode>LOW | MEDIUM | HIGH | CRITICAL</InlineCode>), not to a fixed risk-type lookup. Category scores, context and policy affect the final action. Classifier-only labels are not independently validated accuracy claims.</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Risk Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Severity</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {riskTypes.map(([type, desc, severity]) => (
                  <tr key={type} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{type}</td>
                    <td className="px-4 py-2.5">{desc}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        severity === "CRITICAL" ? "bg-red-950/50 text-red-400" :
                        severity === "HIGH" ? "bg-orange-950/50 text-orange-400" :
                        severity === "MEDIUM" ? "bg-yellow-950/50 text-yellow-400" :
                        "bg-slate-800/50 text-slate-200"
                      }`}>{severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <DocsHeading>Actions</DocsHeading>
          <p className="mt-3 text-base leading-7 text-slate-200">Continue only when <InlineCode>allowed === true</InlineCode> and the action is one of the first three values below. For redaction or rewrite, require returned <InlineCode>safeText</InlineCode> or <InlineCode>redactedText</InlineCode>; do not substitute the original if replacement text is missing. Stop on <InlineCode>BLOCK</InlineCode>, <InlineCode>HUMAN_REVIEW</InlineCode>, unknown actions or request errors. Guard input before calling the model, then guard output before returning it. Never forward blocked raw model output.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <span key={action} className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300">
                {action}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <DocsHeading>Error Codes</DocsHeading>
          <p className="mt-3 text-base leading-7 text-slate-200">A normal content block is an HTTP 200 guard result with <InlineCode>allowed: false</InlineCode>; 200 does not imply permission to continue. Common errors use <InlineCode>{`{ "error": true, "message": "..." }`}</InlineCode>, not a required string error code. Governance 403 and rate-limit 429 can instead use the guard-result shape. Withhold the turn on failure and apply bounded retries only where appropriate.</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Error</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {errors.map(([code, error, desc]) => (
                  <tr key={code} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{code}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{error}</td>
                    <td className="px-4 py-2.5">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <DocsHeading>Webhook Events</DocsHeading>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "guard.prompt_injection.blocked",
              "guard.jailbreak.detected",
              "guard.secret.detected",
              "guard.pii.redacted",
              "guard.system_prompt_leak.blocked",
              "guard.unsafe_output.blocked",
              "governance.enforcement.blocked",
              "governance.enforcement.approval_required",
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
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              <li><InlineCode>x-soter-event</InlineCode> — event name</li>
              <li><InlineCode>x-soter-timestamp</InlineCode> — unix seconds at signing time</li>
              <li><InlineCode>x-soter-signature</InlineCode> — <InlineCode>t=...,v1=&lt;hmac-sha256&gt;</InlineCode></li>
              <li><InlineCode>x-soter-idempotency-key</InlineCode> — stable delivery event identifier for deduplication</li>
              <li><InlineCode>x-soter-attempt</InlineCode> — delivery attempt number</li>
            </ul>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-200">Delivery JSON has <InlineCode>{`{ id, event, createdAt, data }`}</InlineCode>. <InlineCode>createdAt</InlineCode> is the signing timestamp for that attempt. Verify HMAC-SHA256 over the exact UTF-8 <InlineCode>timestamp.rawBody</InlineCode> bytes (timestamp, a dot, then the unmodified request body) using your signing secret, before parsing JSON or acting. Use constant-time comparison, require the signed timestamp to match the header, enforce a receiver-side freshness/replay policy, and deduplicate the event ID. Signature verification alone does not enforce timestamp freshness.</p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
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
    </DocsPageShell>
  );
}
