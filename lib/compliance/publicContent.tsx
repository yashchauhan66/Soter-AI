export const trustPrinciples = [
  "OWASP LLM Top 10 aligned controls for prompt injection, sensitive data exposure, insecure output handling, and RAG risks.",
  "Defense-in-depth through detection, blocking, redaction, monitoring, reporting, and human review workflows.",
  "Risk reduction language only: SoterAI does not claim complete protection or certification.",
];

export const owaspMappings = [
  ["LLM01 Prompt Injection", "Input/output guardrails, document scanning, red-team regression tests, and policy enforcement."],
  ["LLM02 Sensitive Information Disclosure", "PII and secret redaction, safe logs, webhook payload minimization, and audit exports."],
  ["LLM03 Supply Chain", "Self-hosted deployment guidance, dependency audit checks, and vendor-risk documentation."],
  ["LLM04 Data and Model Poisoning", "RAG quarantine, trust scoring, approved-source indexing, and feedback review."],
  ["LLM05 Improper Output Handling", "Unsafe output detection, rewrite/block decisions, and downstream webhook safety."],
  ["LLM06 Excessive Agency", "Policy controls, authorized red-team scope, and integration payload redaction."],
  ["LLM07 System Prompt Leakage", "System prompt leak detection and persistence safeguards."],
  ["LLM08 Vector and Embedding Weaknesses", "Tenant namespaces, ACL post-filtering, and retrieval audit logs."],
  ["LLM09 Misinformation", "Grounding guard, citation checks, and no-source fallback."],
  ["LLM10 Unbounded Consumption", "Rate limiting, quotas, billing controls, and admin overrides."],
];

export function ReadinessPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Trust center</p>
      <h1 className="mt-2 text-4xl font-bold">{title}</h1>
      <div className="mt-6 max-w-4xl space-y-5 text-slate-300">{children}</div>
    </main>
  );
}
