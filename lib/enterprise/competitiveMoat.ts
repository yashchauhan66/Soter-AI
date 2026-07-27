export type CompetitorCategory =
  | "guard-classifier"
  | "cloud-native"
  | "open-source-validation"
  | "model-supply-chain"
  | "employee-ai-governance"
  | "observability-evaluation"
  | "enterprise-ai-platform";

export interface CompetitorBattlecard {
  name: string;
  category: CompetitorCategory;
  whereTheyWin: string[];
  whereSoterWins: string[];
  proofRequiredBeforeAggressiveClaim: string[];
}

export interface CompetitiveScore {
  score: number;
  grade: "MARKET_LEADING_INTERNAL_READINESS" | "STRONG" | "NEEDS_PROOF";
  namedCompetitors: number;
  soterEdges: number;
  caveats: number;
  hardClaimAllowed: boolean;
}

export const COMPETITIVE_BATTLECARDS: CompetitorBattlecard[] = [
  {
    name: "Lakera / Check Point",
    category: "guard-classifier",
    whereTheyWin: ["Stronger brand validation", "Focused adversarial guardrail maturity", "Enterprise distribution through Check Point"],
    whereSoterWins: ["Self-hostable app-layer stack", "RAG quarantine plus agent firewall", "India PII and audit-first workflows"],
    proofRequiredBeforeAggressiveClaim: ["Independent head-to-head guardrail benchmark", "Customer latency comparison"],
  },
  {
    name: "HiddenLayer",
    category: "model-supply-chain",
    whereTheyWin: ["AI asset inventory", "Model and supply-chain security", "Enterprise security operations maturity"],
    whereSoterWins: ["Faster app integration", "Runtime prompt/output/RAG/agent enforcement", "Developer-friendly docs and SDK paths"],
    proofRequiredBeforeAggressiveClaim: ["Third-party model-security comparison", "Enterprise customer case study"],
  },
  {
    name: "Protect AI / Palo Alto",
    category: "model-supply-chain",
    whereTheyWin: ["Model scanning depth", "Security-platform procurement", "Research and enterprise backing"],
    whereSoterWins: ["Broader chatbot/RAG/agent runtime workflow", "Evidence vault and webhooks", "Self-hosted product path"],
    proofRequiredBeforeAggressiveClaim: ["Model artifact benchmark", "External pentest"],
  },
  {
    name: "Prompt Security / SentinelOne",
    category: "employee-ai-governance",
    whereTheyWin: ["Employee AI usage visibility", "Browser/SaaS governance", "Security platform distribution"],
    whereSoterWins: ["Developer-app runtime enforcement", "Agent action controls", "RAG document security"],
    proofRequiredBeforeAggressiveClaim: ["Live browser runtime proof", "Customer workforce-AI pilot"],
  },
  {
    name: "Harmonic Security",
    category: "employee-ai-governance",
    whereTheyWin: ["GenAI DLP", "Shadow AI discovery", "Workforce policy controls"],
    whereSoterWins: ["Open developer integrations", "Agent firewall and approval escrow", "India-specific PII coverage"],
    proofRequiredBeforeAggressiveClaim: ["Shadow-AI coverage study", "Browser extension marketplace proof"],
  },
  {
    name: "CalypsoAI",
    category: "enterprise-ai-platform",
    whereTheyWin: ["Enterprise governance positioning", "Policy and model-risk workflows"],
    whereSoterWins: ["Practical API-first implementation", "RAG and agent runtime controls", "Transparent evidence-gated claims"],
    proofRequiredBeforeAggressiveClaim: ["Third-party governance review", "Paid enterprise pilot"],
  },
  {
    name: "Lasso Security",
    category: "enterprise-ai-platform",
    whereTheyWin: ["GenAI app posture management", "Enterprise governance workflow"],
    whereSoterWins: ["Broader runtime guard surface", "Agent passport and tool-chain controls", "Self-hosting and developer setup"],
    proofRequiredBeforeAggressiveClaim: ["Customer proof", "Comparative deployment study"],
  },
  {
    name: "AWS Bedrock Guardrails",
    category: "cloud-native",
    whereTheyWin: ["Managed AWS operations", "Cloud procurement", "Native Bedrock integration"],
    whereSoterWins: ["Cross-stack portability", "Self-hosting", "App-layer agent and RAG enforcement outside one cloud"],
    proofRequiredBeforeAggressiveClaim: ["Deployed multi-cloud proof", "Production load test"],
  },
  {
    name: "Azure AI Content Safety / Microsoft",
    category: "cloud-native",
    whereTheyWin: ["Enterprise trust", "Microsoft cloud integration", "Procurement simplicity"],
    whereSoterWins: ["Portable runtime controls", "Agent-specific approval and lineage", "Framework and CMS integration breadth"],
    proofRequiredBeforeAggressiveClaim: ["Azure side-by-side integration proof", "Procurement reference"],
  },
  {
    name: "NVIDIA NeMo Guardrails",
    category: "open-source-validation",
    whereTheyWin: ["Programmable conversation flow", "NVIDIA ecosystem", "Open-source adoption"],
    whereSoterWins: ["Less DSL-heavy onboarding", "PII/secrets/RAG/agent/audit bundle", "Production dashboard and webhooks"],
    proofRequiredBeforeAggressiveClaim: ["Open benchmark reproduction", "Developer onboarding time study"],
  },
  {
    name: "Guardrails AI",
    category: "open-source-validation",
    whereTheyWin: ["Structured output validation", "Open-source validator ecosystem", "Python community"],
    whereSoterWins: ["Inline runtime blocking", "Agent and RAG security", "Enterprise audit and support workflows"],
    proofRequiredBeforeAggressiveClaim: ["Schema-validation comparison", "Integration time study"],
  },
  {
    name: "LLM Guard",
    category: "open-source-validation",
    whereTheyWin: ["Simple self-hosted scanner suite", "Open-source flexibility"],
    whereSoterWins: ["Full product workflow", "Evidence vault, SIEM/webhooks, and enterprise controls", "Agent firewall depth"],
    proofRequiredBeforeAggressiveClaim: ["Scanner recall benchmark", "Operational workflow comparison"],
  },
  {
    name: "Galileo / Arthur / Patronus",
    category: "observability-evaluation",
    whereTheyWin: ["Offline evals", "Trace analytics", "Hallucination and factuality workflows"],
    whereSoterWins: ["Pre-execution blocking", "Redaction and approval before risky action", "Runtime security evidence"],
    proofRequiredBeforeAggressiveClaim: ["Eval workflow comparison", "Customer observability requirements study"],
  },
];

export const SOTER_DEFENSIBLE_MOATS = [
  "Input, output, RAG, agent, policy, audit, webhooks, and self-hosting in one stack",
  "Agent firewall with passport, intent, tool-chain, dry-run, escrow, and lineage controls",
  "India-specific PII coverage plus global secrets and privacy detection",
  "Evidence-gated readiness system that blocks unsupported Enterprise GA claims",
  "Developer-friendly integration surface across REST, SDKs, framework docs, browser, VS Code, CMS, and webhooks",
  "Runtime blocking and redaction before risky execution rather than only after-the-fact observability",
  "Enterprise proof kit that maps every pending claim to owner, evidence, pass criteria, and blocker",
];

export function scoreCompetitiveMoat(
  battlecards: CompetitorBattlecard[] = COMPETITIVE_BATTLECARDS,
  moats: string[] = SOTER_DEFENSIBLE_MOATS,
): CompetitiveScore {
  const namedCompetitors = battlecards.length;
  const soterEdges = battlecards.reduce((sum, card) => sum + card.whereSoterWins.length, 0);
  const caveats = battlecards.reduce((sum, card) => sum + card.whereTheyWin.length, 0);
  const categories = new Set(battlecards.map((card) => card.category)).size;
  const proofGates = battlecards.reduce((sum, card) => sum + card.proofRequiredBeforeAggressiveClaim.length, 0);

  const breadthScore = Math.min(30, namedCompetitors * 2);
  const edgeScore = Math.min(25, soterEdges);
  const caveatScore = Math.min(15, caveats);
  const categoryScore = Math.min(15, categories * 2);
  const moatScore = Math.min(10, moats.length * 2);
  const proofDisciplineScore = Math.min(5, proofGates > namedCompetitors ? 5 : proofGates);
  const score = breadthScore + edgeScore + caveatScore + categoryScore + moatScore + proofDisciplineScore;

  return {
    score,
    grade: score >= 95 ? "MARKET_LEADING_INTERNAL_READINESS" : score >= 80 ? "STRONG" : "NEEDS_PROOF",
    namedCompetitors,
    soterEdges,
    caveats,
    hardClaimAllowed: false,
  };
}

export function approvedCompetitiveClaim(score: CompetitiveScore = scoreCompetitiveMoat()) {
  if (score.grade === "MARKET_LEADING_INTERNAL_READINESS") {
    return "SoterAI has market-leading internal competitive readiness for app-layer AI runtime security, with honest caveats for categories where specialist competitors are stronger.";
  }
  return "SoterAI has strong but not market-leading competitive readiness; more evidence is required.";
}
