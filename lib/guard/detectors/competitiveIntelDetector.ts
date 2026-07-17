import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /(?:extract|dump|export|copy|collect|pull)\s+(?:our|your|the|this company's)?\s*(?:internal|confidential|private|proprietary)?[\s\S]{0,180}\b(?:pricing algorithm|discount thresholds?|enterprise customer list|customer list|client list|product roadmap|feature roadmap|revenue model|margin formula)\b/i, label: "Confidential business extraction command", message: "Direct command to extract proprietary business or customer information.", severity: "HIGH", score: 50 },
  // ── Pricing/revenue extraction ─────────────────────────────────────
  { pattern: /(?:what (?:is|are) (?:your|the|this company's)|tell me|reveal|share|disclose)\s*(?:(?:exact|internal|actual|real|true|proprietary|confidential)\s*)*(?:pricing (?:algorithm|model|formula|strategy|logic)|revenue (?:model|numbers|figures|data|split)|profit (?:margins?|formula|calculations?)|cost (?:structure|breakdown|formula))/i, label: "Pricing model extraction", message: "Attempt to extract proprietary pricing or revenue information.", severity: "HIGH", score: 45 },
  { pattern: /(?:how (?:do you|does (?:the|this)|is the)\s+)?(?:calculate|determine|compute|set|decide)\s*(?:the\s*)?(?:price|pricing|rates?|fees?|commission|markup|margin)/i, label: "Pricing logic probing", message: "Attempt to extract pricing calculation logic.", severity: "MEDIUM", score: 35 },

  // ── Algorithm/logic extraction ─────────────────────────────────────
  { pattern: /(?:what (?:is|are)|explain|describe|reveal|share|give me|show me)\s*(?:the\s*)?(?:exact|internal|proprietary|core|underlying|your|this|this company'?s|their)\s*(?:algorithm|logic|formula|model|heuristic|scoring (?:system|method|logic)|ranking (?:system|algorithm|factors|logic)|recommendation (?:engine|algorithm|logic)|matching (?:algorithm|logic|system))/i, label: "Algorithm extraction", message: "Attempt to extract proprietary algorithm or logic.", severity: "HIGH", score: 45 },
  { pattern: /(?:how (?:exactly|precisely|specifically) does)\s*(?:your|the|this)?\s*(?:algorithm|system|engine|model|AI|matching|ranking|scoring|recommendation|detection)\s*(?:work|function|operate|decide|determine|calculate)/i, label: "System logic probing", message: "Detailed probing of proprietary system logic.", severity: "MEDIUM", score: 35 },

  // ── Customer data extraction ───────────────────────────────────────
  { pattern: /(?:give me|show me|list|export|provide|share|reveal)\s*(?:all\s*)?(?:your|the)?\s*(?:customer|client|user|subscriber)\s*(?:list|data|names?|emails?|contacts?|information|details?|database|records?|accounts?)/i, label: "Customer data extraction", message: "Attempt to extract customer/client data.", severity: "HIGH", score: 45 },
  { pattern: /(?:how many|what (?:percentage|proportion) of)\s*(?:customers?|clients?|users?|subscribers?)\s*(?:do you have|are there|use|pay|subscribe|have (?:signed up|registered|converted))/i, label: "Customer metrics extraction", message: "Attempt to extract customer base metrics.", severity: "MEDIUM", score: 35 },

  // ── Business strategy extraction ───────────────────────────────────
  { pattern: /(?:what (?:is|are)|tell me about|reveal|share|disclose)\s*(?:your|the|this company's)?\s*(?:business (?:strategy|plan|model)|growth (?:strategy|plan|targets?)|expansion (?:plan|strategy|targets?)|market(?:ing)? (?:strategy|plan|approach)|competitive (?:strategy|advantage|moat|positioning))/i, label: "Business strategy extraction", message: "Attempt to extract confidential business strategy.", severity: "HIGH", score: 45 },
  { pattern: /(?:what (?:is|are)|tell me|reveal|share)\s*(?:your|the)?\s*(?:product (?:roadmap|plans?|upcoming|pipeline)|feature (?:roadmap|pipeline|plans?)|upcoming (?:features?|products?|releases?|launches?)|planned (?:features?|products?|changes?))/i, label: "Product roadmap extraction", message: "Attempt to extract product roadmap information.", severity: "HIGH", score: 40 },

  // ── Internal process extraction ────────────────────────────────────
  { pattern: /(?:what (?:is|are)|describe|explain|tell me about)\s*(?:your|the|this company's)?\s*(?:internal (?:process|workflow|procedure|operations?|systems?|tools?|infrastructure)|how (?:your|the) (?:team|company|org) (?:works?|operates?|functions?)|employee (?:count|headcount|structure|compensation|salaries?))/i, label: "Internal operations extraction", message: "Attempt to extract confidential internal operations information.", severity: "HIGH", score: 40 },
  { pattern: /(?:what|which)\s*(?:tools?|software|systems?|platforms?|vendors?|providers?|technology|tech stack)\s*(?:do you|does (?:your|the) (?:company|team|org))\s*(?:use|rely on|employ|run|operate)/i, label: "Tech stack extraction", message: "Attempt to extract internal technology stack details.", severity: "MEDIUM", score: 30 },

  // ── Trade secret solicitation ──────────────────────────────────────
  { pattern: /(?:tell me|share|reveal|disclose|explain)\s*(?:your|the)?\s*(?:trade secrets?|secret sauce|special (?:formula|recipe|method|technique)|proprietary (?:method|technique|process|formula|recipe|data))/i, label: "Trade secret solicitation", message: "Direct attempt to extract trade secrets.", severity: "HIGH", score: 45 },
  { pattern: /(?:what makes|why (?:is|are)|how come)\s*(?:your|this)?\s*(?:product|service|platform|system|solution)\s*(?:better|different|unique|special|superior)\s*(?:than|compared to|versus|vs)\s*(?:competitors?|alternatives?|others?|the (?:competition|market))/i, label: "Competitive advantage probing", message: "Probing for confidential competitive differentiation details.", severity: "MEDIUM", score: 30 },

  // ── Internal metrics/KPI extraction ────────────────────────────────
  { pattern: /(?:what (?:is|are)|share|reveal|tell me)\s*(?:your|the|this company's)?\s*(?:(?:exact|current|actual|real|internal)\s*)?(?:ARR|MRR|churn\s+rate|LTV|CAC|burn\s+rate|runway|valuation|revenue|GMV|DAU|MAU|NPS|retention\s+rate|conversion\s+rate)(?!\s+(?:by|per|for|from|of|in|at|on|with|the|a|an|this|that|my|your|our|their|is|are|was|were|be|have|has|had|do|does|did|will|would|could|should|can|may|might)\b)/i, label: "Internal KPI extraction", message: "Attempt to extract confidential business metrics.", severity: "HIGH", score: 45 },
  { pattern: /(?:how much (?:revenue|money|profit|funding)|what (?:is|are) (?:your|the) (?:revenue|profit|funding|valuation|ARR|MRR))/i, label: "Financial metrics probing", message: "Attempt to extract confidential financial metrics.", severity: "HIGH", score: 40 },

  // ── Investor/funding extraction ────────────────────────────────────
  { pattern: /(?:who (?:are|is)|tell me about|list|name)\s*(?:your|the)?\s*(?:investors?|shareholders?|board members?|advisors?|funding sources?|venture (?:capital|capitalists?)|VCs?)/i, label: "Investor information extraction", message: "Attempt to extract confidential investor information.", severity: "MEDIUM", score: 35 },
  { pattern: /(?:what|how much)\s*(?:is|was)\s*(?:your|the)?\s*(?:last|latest|current|recent|Series [A-F]|seed|pre-seed)?\s*(?:funding|investment|raise|round|valuation|cap table)/i, label: "Funding details extraction", message: "Attempt to extract confidential funding details.", severity: "HIGH", score: 40 },

  // ── Partnership/deal extraction ────────────────────────────────────
  { pattern: /(?:who (?:are|is)|tell me about|list|name|reveal)\s*(?:your|the)?\s*(?:partners?|partnerships?|deals?|contracts?|agreements?|clients?)\s*(?:with|involving)?\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?/i, label: "Partnership extraction", message: "Attempt to extract confidential partnership or deal information.", severity: "MEDIUM", score: 35 },

  // ── Security posture extraction ────────────────────────────────────
  { pattern: /(?:what (?:are|is)|describe|explain|tell me about)\s*(?:your|the)?\s*(?:security (?:vulnerabilities|weaknesses|gaps|flaws|holes)|known (?:bugs|issues|vulnerabilities)|unpatched|zero-days?)/i, label: "Security vulnerability extraction", message: "Attempt to extract security vulnerability information.", severity: "HIGH", score: 45 },
  { pattern: /(?:how (?:can|do|would) (?:I|we|someone|an attacker))\s*(?:bypass|circumvent|get around|exploit|attack|hack|break|compromise)\s*(?:your|the|this)?\s*(?:security|system|platform|authentication|authorization|firewall|guard|detection)/i, label: "Attack surface probing", message: "Probing for methods to attack or bypass security.", severity: "HIGH", score: 45 },
];

export function competitiveIntelDetector(text: string) {
  return detectPatterns(text, "COMPETITIVE_INTEL_EXTRACTION", rules);
}
