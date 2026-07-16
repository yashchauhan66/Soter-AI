export interface FactRecord {
  id: string;
  claim: string;
  verdict: "SUPPORTED" | "REFUTED";
  topics: string[];
  source: string;
}

export function verifyClaimsAgainstKnowledgeBase(answer: string, facts: FactRecord[]) {
  const sentences = answer.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const findings = [];
  for (const sentence of sentences) {
    const sentenceKeywords = keywords(sentence);
    for (const fact of facts) {
      const overlap = [...keywords(fact.claim)].filter((word) => sentenceKeywords.has(word)).length;
      if (overlap < 3) continue;
      if (fact.verdict === "REFUTED") {
        findings.push({ type: "REFUTED_CLAIM", factId: fact.id, sentence, source: fact.source });
      } else {
        findings.push({ type: "SUPPORTED_CLAIM", factId: fact.id, sentence, source: fact.source });
      }
    }
  }
  const refuted = findings.filter((finding) => finding.type === "REFUTED_CLAIM");
  return {
    allowed: refuted.length === 0,
    confidence: findings.length ? Math.min(0.99, findings.length / Math.max(1, sentences.length)) : 0,
    findings,
    refutedClaims: refuted,
  };
}

function keywords(text: string) {
  return new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
}
