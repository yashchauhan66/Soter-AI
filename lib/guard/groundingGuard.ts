export const DEFAULT_NO_SOURCE_FALLBACK = "I don't have verified source information for this answer. Please contact support.";

export interface GroundingSource { id: string; url?: string; text?: string; authorized?: boolean }
export interface GroundingPolicy { citationRequired: boolean; noSourceFallback?: string | null; highRiskTopicReview: boolean; minSourceCount: number; requireSourceUrls: boolean }

const highRiskTopic = /\b(?:medical diagnosis|legal advice|investment advice|suicide|self-harm|weapons?|explosives?)\b/i;

export function guardGroundedAnswer(input: { answer: string; sources: GroundingSource[]; policy: GroundingPolicy }) {
  const privateLeak = detectPrivateDocumentLeak(input.answer, input.sources);
  const sources = input.sources.filter((source) => source.authorized !== false);
  const validSources = input.policy.requireSourceUrls ? sources.filter((source) => Boolean(source.url)) : sources;
  const insufficient = validSources.length < Math.max(0, input.policy.minSourceCount);
  const unsupportedClaims = detectUnsupportedClaims(input.answer, validSources);
  const sourceCoverageScore = calculateSourceCoverage(input.answer, validSources);
  const citationVerification = verifyCitations(input.answer, validSources);
  const sourceChunkMatches = validSources.map((source) => ({ sourceId: source.id, score: sourceChunkMatchScore(input.answer, source.text ?? "") }));
  const highRisk = highRiskTopic.test(input.answer);
  const weakAttribution = sourceCoverageScore < 0.35 || (input.policy.citationRequired && !citationVerification.valid);
  const blocked = privateLeak || (input.policy.citationRequired && (insufficient || weakAttribution)) || (input.policy.highRiskTopicReview && highRisk && (insufficient || weakAttribution));
  return {
    allowed: !blocked,
    answer: blocked ? (input.policy.noSourceFallback || DEFAULT_NO_SOURCE_FALLBACK) : input.answer,
    confidence: validSources.length ? Math.max(0.2, Math.min(0.98, sourceCoverageScore - unsupportedClaims.length * 0.05 + 0.2)) : 0,
    sourceCount: validSources.length,
    sourceCoverageScore,
    citationVerification,
    sourceChunkMatches,
    unsupportedClaims,
    highRiskTopic: highRisk,
    requiresReview: highRisk && input.policy.highRiskTopicReview,
    privateDocumentLeak: privateLeak,
  };
}

function keywords(text: string) {
  return new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
}

export function sourceChunkMatchScore(answer: string, sourceText: string) {
  const answerWords = keywords(answer);
  const sourceWords = keywords(sourceText);
  if (!answerWords.size || !sourceWords.size) return 0;
  const overlap = [...answerWords].filter((word) => sourceWords.has(word)).length;
  return Number((overlap / answerWords.size).toFixed(4));
}

export function calculateSourceCoverage(answer: string, sources: GroundingSource[]) {
  const claims = answer.split(/(?<=[.!?])\s+|\n+/).map((claim) => claim.trim()).filter((claim) => claim.length > 20);
  if (!claims.length) return answer.trim() && sources.length ? 1 : 0;
  const supported = claims.filter((claim) => sources.some((source) => sourceChunkMatchScore(claim, source.text ?? "") >= 0.3)).length;
  return Number((supported / claims.length).toFixed(4));
}

export function verifyCitations(answer: string, sources: GroundingSource[]) {
  const citedIds = [...answer.matchAll(/\[(?:source:)?([^\]]+)\]/gi)].map((match) => match[1].trim());
  const citedUrls = [...answer.matchAll(/https?:\/\/[^\s)\]]+/g)].map((match) => match[0]);
  const knownIds = new Set(sources.map((source) => source.id));
  const knownUrls = new Set(sources.flatMap((source) => source.url ? [source.url] : []));
  const invalidCitations = [...citedIds.filter((id) => !knownIds.has(id)), ...citedUrls.filter((url) => !knownUrls.has(url))];
  return { valid: (citedIds.length > 0 || citedUrls.length > 0) && invalidCitations.length === 0, citationCount: citedIds.length + citedUrls.length, invalidCitations };
}

export function detectPrivateDocumentLeak(answer: string, sources: GroundingSource[]) {
  const normalizedAnswer = answer.toLowerCase();
  return sources.some((source) => {
    if (source.authorized !== false || !source.text) return false;
    const phrases = source.text.toLowerCase().split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter((part) => part.length >= 24);
    return phrases.some((phrase) => normalizedAnswer.includes(phrase));
  });
}

export function detectUnsupportedClaims(answer: string, sources: GroundingSource[]) {
  if (!answer.trim()) return [];
  if (!sources.length) return answer.split(/(?<=[.!?])\s+/).filter((claim) => claim.trim().length > 20).slice(0, 10);
  const corpus = sources.map((source) => source.text ?? "").join(" ").toLowerCase();
  return answer.split(/(?<=[.!?])\s+/).filter((claim) => {
    const keywords = claim.toLowerCase().match(/[a-z0-9]{5,}/g) ?? [];
    return keywords.length >= 2 && keywords.filter((keyword) => corpus.includes(keyword)).length / keywords.length < 0.25;
  }).slice(0, 10);
}
