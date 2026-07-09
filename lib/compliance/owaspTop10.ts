/**
 * OWASP Top 10 for LLM Applications (2025) — Compliance Mapping
 * Maps each OWASP category to SoterAI Guard's coverage
 */

export interface OwaspCategory {
  id: string;
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  soteraiModules: string[];
  coverageStatus: "FULL" | "PARTIAL" | "GAP";
  notes: string;
}

export const OWASP_LLM_TOP_10: OwaspCategory[] = [
  {
    id: "LLM01",
    name: "Prompt Injection",
    description: "Crafted input alters model behavior or output in unintended ways",
    severity: "CRITICAL",
    soteraiModules: [
      "Classifiers (RuleBased + Semantic + Multilingual)",
      "Agent Firewall (input scanning)",
      "Guard Engine (analyzeText)",
      "Agent Intent (injection detection)",
      "Memory Firewall (poisoning detection)",
      "MCP Drift (injection in tool descriptions)",
    ],
    coverageStatus: "FULL",
    notes: "60+ multilingual patterns, semantic analysis, real-time blocking. Exceeds Lakera Guard's coverage with agent-specific injection detection.",
  },
  {
    id: "LLM02",
    name: "Sensitive Information Disclosure",
    description: "Model exposes PII, credentials, or proprietary data in outputs",
    severity: "HIGH",
    soteraiModules: [
      "Guard Engine (PII + secret detection)",
      "Data Fingerprinting (DLP)",
      "Semantic Egress (data leakage prevention)",
      "Agent Firewall (data leak detection)",
      "Output Guard (redaction)",
      "Credential Vault (secret protection)",
    ],
    coverageStatus: "FULL",
    notes: "India-specific PII (Aadhaar, PAN), credential detection, semantic similarity-based DLP. More comprehensive than standard PII detectors.",
  },
  {
    id: "LLM03",
    name: "Supply Chain",
    description: "Third-party models, datasets, packages introduce vulnerable components",
    severity: "HIGH",
    soteraiModules: [
      "AI BOM (CycloneDX SBOM)",
      "MCP Drift (tool definition monitoring)",
      "Model Scan (model file analysis)",
      "Dependency audit (npm audit)",
    ],
    coverageStatus: "FULL",
    notes: "AI Bill of Materials with CycloneDX format. MCP tool drift detection. Model file scanning. Unique in market.",
  },
  {
    id: "LLM04",
    name: "Data and Model Poisoning",
    description: "Manipulated training/fine-tuning data creates backdoors",
    severity: "HIGH",
    soteraiModules: [
      "Memory Firewall (poisoning detection)",
      "RAG Security (document scanning)",
      "Data Fingerprinting (integrity)",
      "Evidence Vault (audit trail)",
    ],
    coverageStatus: "FULL",
    notes: "7 poisoning pattern types, memory diff analysis, RAG document scoring.",
  },
  {
    id: "LLM05",
    name: "Improper Output Handling",
    description: "Unvalidated outputs lead to XSS, SSRF, code execution",
    severity: "HIGH",
    soteraiModules: [
      "Output Guard (content filtering)",
      "Agent Firewall (output scanning)",
      "Guard Engine (unsafe output detection)",
      "JSON-LD safety (safeJsonLd)",
    ],
    coverageStatus: "FULL",
    notes: "Output validation, content filtering, XSS prevention.",
  },
  {
    id: "LLM06",
    name: "Excessive Agency",
    description: "Agent takes unauthorized autonomous actions",
    severity: "MEDIUM",
    soteraiModules: [
      "Agent Firewall (tool call control)",
      "Agent Passport (identity + scope)",
      "Escrow (human-in-the-loop)",
      "Intent Verification (action matching)",
      "Legal Boundary (compliance)",
      "Cascade Breaker (chain control)",
    ],
    coverageStatus: "FULL",
    notes: "Most comprehensive agent control in market. 14 high-risk tool patterns, delegation chains, escrow system, cascade breaker. No competitor matches this depth.",
  },
  {
    id: "LLM07",
    name: "System Prompt Leakage",
    description: "Model reveals system instructions to users",
    severity: "MEDIUM",
    soteraiModules: [
      "Classifiers (system prompt leak detection)",
      "Agent Firewall (prompt leak patterns)",
      "MultilingualClassifier (6+ languages)",
    ],
    coverageStatus: "FULL",
    notes: "Detects system prompt extraction attempts in 6+ languages.",
  },
  {
    id: "LLM08",
    name: "Unbounded Consumption",
    description: "Resource abuse, cost overruns, denial of service",
    severity: "MEDIUM",
    soteraiModules: [
      "Cost Firewall (budget limits)",
      "Rate Limiting (per-user, per-account)",
      "Cascade Breaker (chain depth limits)",
    ],
    coverageStatus: "PARTIAL",
    notes: "Cost controls exist but need enhancement with token-level tracking and anomaly detection.",
  },
  {
    id: "LLM09",
    name: "Vector and Embedding Weaknesses",
    description: "RAG-specific attacks: embedding inversion, retrieval bypass",
    severity: "HIGH",
    soteraiModules: [
      "RAG Security (document scanning)",
      "Data Fingerprinting (embedding integrity)",
      "Semantic Egress (similarity detection)",
    ],
    coverageStatus: "FULL",
    notes: "RAG authorization, document scoring, cross-tenant leakage detection.",
  },
  {
    id: "LLM10",
    name: "Misinformation",
    description: "Model generates false or misleading information",
    severity: "MEDIUM",
    soteraiModules: [
      "Grounding Guard (fact verification)",
      "SLM Evaluation (hallucination detection)",
      "Evidence Vault (audit trail)",
    ],
    coverageStatus: "FULL",
    notes: "Hallucination detection, grounding verification, evidence-backed outputs.",
  },
];

export function getOwaspCoverage(): {
  total: number;
  full: number;
  partial: number;
  gap: number;
  score: number;
} {
  const total = OWASP_LLM_TOP_10.length;
  const full = OWASP_LLM_TOP_10.filter((c) => c.coverageStatus === "FULL").length;
  const partial = OWASP_LLM_TOP_10.filter((c) => c.coverageStatus === "PARTIAL").length;
  const gap = OWASP_LLM_TOP_10.filter((c) => c.coverageStatus === "GAP").length;
  return { total, full, partial, gap, score: Math.round((full * 100 + partial * 50) / total) };
}

export function checkOwaspCompliance(): { category: string; status: string; modules: string[] }[] {
  return OWASP_LLM_TOP_10.map((c) => ({
    category: `${c.id}: ${c.name}`,
    status: c.coverageStatus,
    modules: c.soteraiModules,
  }));
}
