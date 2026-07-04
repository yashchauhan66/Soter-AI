export interface OwaspCoverageItem {
  id: string;
  name: string;
  coverage: number;
  features: string[];
  gaps: string[];
}

export interface OwaspComplianceReport {
  framework: "OWASP_LLM_2025" | "OWASP_AGENTIC_2026";
  overallCoverage: number;
  items: OwaspCoverageItem[];
  generatedAt: string;
}

const OWASP_LLM_2025: OwaspCoverageItem[] = [
  {
    id: "LLM01",
    name: "Prompt Injection",
    coverage: 99,
    features: [
      "141 regex rules in promptInjectionDetector",
      "190+ block regexes in analyze.ts",
      "15-language multilingual detection",
      "Recursive/nested injection detection (JSON/XML/CSV/YAML)",
      "Skeleton Key attack detection",
      "Many-Shot jailbreaking detection",
      "Encoding evasion (Base64/Hex/ROT13/Caesar/Morse/Unicode)",
      "Homoglyph/confusable character mapping",
      "ASCII smuggling via Unicode tag characters",
      "Variation-selector byte smuggling",
      "Semantic classifier fallback (FNV-1a embedding)",
      "Multi-turn crescendo detection",
      "Attacker reputation fingerprinting",
      "Context exhaustion attack detection",
      "Agent scratchpad/state injection detection",
      "RAG/vector poisoning detection",
      "Tool result injection detection",
      "Few-shot behavior poisoning detection",
    ],
    gaps: [],
  },
  {
    id: "LLM02",
    name: "Sensitive Information Disclosure",
    coverage: 97,
    features: [
      "PII detection (global): email, phone, IP, credit card, DOB, address",
      "India PII: Aadhaar, PAN, GSTIN, UPI, IFSC, bank accounts",
      "Secrets detection: API keys (OpenAI, Google, GitHub, AWS, Stripe, Razorpay, Slack), JWTs, DB URLs, private keys",
      "Competitive intelligence extraction detection",
      "System prompt leakage detection (input + output)",
      "Output exfiltration beacon detection",
      "Context lineage firewall (source-to-destination rules)",
      "PII redaction in ALLOW_WITH_REDACTION mode",
      "Canary token network for leak detection",
      "Semantic egress guard",
    ],
    gaps: [
      "Region-specific PII for EU (BSN, NIE, CPF) could be expanded",
    ],
  },
  {
    id: "LLM03",
    name: "Supply Chain",
    coverage: 92,
    features: [
      "Model file scanning (pickle detection, provenance verification)",
      "MCP tool registry and drift detection",
      "Package hallucination detection in outputs",
      "LLM supply-chain attack detection (typosquatting, dependency confusion)",
      "Supply chain module (lib/supply-chain/)",
      "Code security review (GitHub workflow analysis)",
      "Shadow AI detection for unauthorized tools",
    ],
    gaps: [
      "Automated SBOM generation for AI models",
      "Real-time threat intelligence feed integration",
    ],
  },
  {
    id: "LLM04",
    name: "Data and Model Poisoning",
    coverage: 90,
    features: [
      "Memory poisoning detection (9 finding types)",
      "Dataset/embedding/training-data poisoning detection",
      "RAG policy poisoning detection",
      "Backdoor trigger detection (style/syntactic/semantic/continuous prompt)",
      "Fine-tuning safety attack detection",
      "Vector embedding integrity checks in grounding guard",
      "Model file classification and provenance",
    ],
    gaps: [
      "Runtime model output drift monitoring (statistical)",
      "Automated retraining data validation",
    ],
  },
  {
    id: "LLM05",
    name: "Improper Output Handling",
    coverage: 95,
    features: [
      "Unsafe output detector (32 rules): XSS, script injection, CSRF, dangerous execution",
      "SSRF attempt detection (input-level)",
      "HTML event-handler injection detection",
      "dangerouslySetInnerHTML sink detection",
      "Script exfiltration output detection",
      "Unreviewed remote execution detection",
      "CSRF-capable browser request detection",
      "Unverified package installation guidance detection",
      "Output direction blocking for PII/secrets",
    ],
    gaps: [],
  },
  {
    id: "LLM06",
    name: "Excessive Agency",
    coverage: 98,
    features: [
      "Agent firewall with tool categorization (10 categories)",
      "Per-action authorization (checkAgentAction, checkToolUse)",
      "Domain allowlisting/blocking",
      "Dangerous terminal pattern blocking",
      "Agent permission manifests",
      "Human approval workflows (escrow)",
      "Dry-run simulation before execution",
      "Blast radius simulation",
      "Cost firewall for budget enforcement",
      "Tool chain detection for risky sequences",
      "Rogue agent behavioral detection",
      "Cascading failure prevention (circuit breaker)",
    ],
    gaps: [],
  },
  {
    id: "LLM07",
    name: "System Prompt Leakage",
    coverage: 98,
    features: [
      "37 input rules for prompt disclosure attempts",
      "5 output rules detecting actual leakage",
      "Multilingual extraction detection (15 languages)",
      "Hinglish-specific patterns",
      "Narrative/fiction bypass detection",
      "Binary probing / restriction mapping detection",
      "Token prediction extraction detection",
      "Hard BLOCK on SYSTEM_PROMPT_LEAK_ATTEMPT",
    ],
    gaps: [],
  },
  {
    id: "LLM08",
    name: "Vector and Embedding Weaknesses",
    coverage: 90,
    features: [
      "RAG grounding guard (source coverage, citation verification)",
      "RAG document trust scoring",
      "Private document leak detection",
      "Unsupported claim detection",
      "High-risk topic gating",
      "RAG/vector poisoning detection in prompt injection rules",
      "Document sandbox and file validation",
    ],
    gaps: [
      "Embedding similarity anomaly detection (too-perfect matches)",
      "Cross-collection contamination monitoring",
    ],
  },
  {
    id: "LLM09",
    name: "Misinformation",
    coverage: 85,
    features: [
      "Hallucination detector (fabricated citations, false authority, invented stats)",
      "Grounding guard (source coverage scoring)",
      "Potentially fabricated citation detection",
      "False consensus/regulatory endorsement detection",
      "Unverifiable study reference detection",
      "Overconfident prediction detection",
      "Unsupported medical advice detection",
    ],
    gaps: [
      "Real-time fact-checking against knowledge base",
      "Citation URL validation (live HTTP check)",
      "Cross-reference consistency scoring",
    ],
  },
  {
    id: "LLM10",
    name: "Unbounded Consumption",
    coverage: 95,
    features: [
      "Token abuse detection (denial-of-wallet patterns)",
      "Large payload detection (>75% of MAX_TEXT_LENGTH)",
      "Rate limiting (per-key RPM, per-IP public limit)",
      "Monthly plan-based usage limits",
      "Cost firewall with budget enforcement",
      "LLM resource-exhaustion attack detection",
      "Context exhaustion attack detection",
      "Streaming guard with early abort on BLOCK",
    ],
    gaps: [],
  },
];

const OWASP_AGENTIC_2026: OwaspCoverageItem[] = [
  {
    id: "ASI01",
    name: "Agent Goal Hijacking",
    coverage: 97,
    features: [
      "Agent goal hijacking detection (prompt injection rules)",
      "Constitutional/RLHF bypass detection",
      "Agent state injection detection",
      "Memory/temporal poisoning detection",
      "Intent verification (agent-intent module)",
      "Multi-turn crescendo detection for gradual hijacking",
    ],
    gaps: [],
  },
  {
    id: "ASI02",
    name: "Tool Misuse",
    coverage: 98,
    features: [
      "Agent firewall tool authorization (checkToolUse)",
      "Tool category classification (10 categories)",
      "High-risk tool misuse detection",
      "Dangerous terminal pattern blocking",
      "Tool chain sequence detection",
      "Domain allowlisting for external calls",
      "Workspace restriction enforcement",
    ],
    gaps: [],
  },
  {
    id: "ASI03",
    name: "Identity and Privilege Abuse",
    coverage: 95,
    features: [
      "Agent passport system (issue/validate/revoke/delegate)",
      "Identity fabric (cryptographic agent identities)",
      "Permission diff detection",
      "Authority impersonation detection",
      "Delegation chain validation",
      "Connector permission escalation detection",
    ],
    gaps: [],
  },
  {
    id: "ASI04",
    name: "Supply Chain Compromise",
    coverage: 92,
    features: [
      "MCP server registry and tool drift detection",
      "Tool schema poisoning detection",
      "MCP risk scanner",
      "Model file scanning (pickle, provenance)",
      "Package hallucination detection",
      "Dependency confusion/typosquatting detection",
    ],
    gaps: [
      "Automated MCP tool signature verification",
    ],
  },
  {
    id: "ASI05",
    name: "Unexpected Code Execution",
    coverage: 92,
    features: [
      "Agent escalation/RCE detection",
      "Dangerous terminal patterns (rm -rf, curl|bash, sudo, ssh)",
      "SSRF detection (internal endpoint access)",
      "File protocol access detection",
      "Code execution sandbox (dry-run module)",
      "Agent firewall CODE_EXECUTION category",
    ],
    gaps: [],
  },
  {
    id: "ASI06",
    name: "Memory and Context Poisoning",
    coverage: 95,
    features: [
      "Memory poisoning detection (9 finding types)",
      "Memory poisoning instruction detection",
      "Cross-session memory manipulation prevention",
      "Context lineage firewall",
      "Triggered backdoor instruction detection",
      "Memory/temporal poisoning rule",
    ],
    gaps: [],
  },
  {
    id: "ASI07",
    name: "Insecure Inter-Agent Communication",
    coverage: 90,
    features: [
      "Inter-agent security module (injection relay, privilege escalation, circular reference detection)",
      "Multi-agent compromise propagation detection",
      "Agent spawn authorization validation",
      "Delegation chain depth limiting",
      "Circular delegation detection",
      "Data leak relay prevention",
    ],
    gaps: [
      "Cryptographic message signing between agents",
    ],
  },
  {
    id: "ASI08",
    name: "Cascading Agent Failures",
    coverage: 85,
    features: [
      "Cascade breaker (circuit breaker pattern)",
      "Max chain depth enforcement",
      "Concurrent agent limiting",
      "Timeout per depth level",
      "Error threshold detection and rollback",
      "Health propagation monitoring",
    ],
    gaps: [
      "Automatic partial rollback execution",
      "Cross-service failure correlation",
    ],
  },
  {
    id: "ASI09",
    name: "Human-Agent Trust Exploitation",
    coverage: 85,
    features: [
      "Emergency authority pressure detection",
      "Coercive distress pressure detection",
      "Sycophancy/priming pressure detection",
      "Social proof bypass detection",
      "Credential solicitation injection detection",
      "Trust exploitation patterns in unsafe output detector",
    ],
    gaps: [
      "Deepfake/AI-impersonation detection in outputs",
      "Emotional manipulation scoring",
    ],
  },
  {
    id: "ASI10",
    name: "Rogue Agents",
    coverage: 85,
    features: [
      "Rogue agent behavioral detection module",
      "Behavioral baseline deviation scoring",
      "Unauthorized tool usage detection",
      "Destination anomaly detection",
      "Data volume anomaly detection",
      "Scope expansion detection",
      "Risk spike monitoring",
      "Automatic recommendation (monitor/throttle/suspend/terminate)",
    ],
    gaps: [
      "Long-term behavioral learning (requires ML model)",
      "Cross-session behavioral correlation",
    ],
  },
];

export function generateOwaspLlm2025Report(): OwaspComplianceReport {
  const overall = Math.round(
    OWASP_LLM_2025.reduce((sum, item) => sum + item.coverage, 0) / OWASP_LLM_2025.length,
  );
  return {
    framework: "OWASP_LLM_2025",
    overallCoverage: overall,
    items: OWASP_LLM_2025,
    generatedAt: new Date().toISOString(),
  };
}

export function generateOwaspAgentic2026Report(): OwaspComplianceReport {
  const overall = Math.round(
    OWASP_AGENTIC_2026.reduce((sum, item) => sum + item.coverage, 0) / OWASP_AGENTIC_2026.length,
  );
  return {
    framework: "OWASP_AGENTIC_2026",
    overallCoverage: overall,
    items: OWASP_AGENTIC_2026,
    generatedAt: new Date().toISOString(),
  };
}

export function getComplianceGaps(): { framework: string; id: string; name: string; gaps: string[] }[] {
  const allGaps: { framework: string; id: string; name: string; gaps: string[] }[] = [];
  for (const item of OWASP_LLM_2025) {
    if (item.gaps.length > 0) {
      allGaps.push({ framework: "OWASP_LLM_2025", id: item.id, name: item.name, gaps: item.gaps });
    }
  }
  for (const item of OWASP_AGENTIC_2026) {
    if (item.gaps.length > 0) {
      allGaps.push({ framework: "OWASP_AGENTIC_2026", id: item.id, name: item.name, gaps: item.gaps });
    }
  }
  return allGaps;
}
