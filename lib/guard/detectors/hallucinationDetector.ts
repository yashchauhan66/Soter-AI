import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── Fabricated citations ───────────────────────────────────────────
  { pattern: /(?:according to|as (?:stated|reported|published) (?:in|by)|cited in)\s+(?:a (?:recent|2024|2025|2026) study|research)\s+(?:by|from|published in)\s+(?:the journal of|proceedings of)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i, label: "Potentially fabricated citation", message: "Response contains a specific citation that may be fabricated.", severity: "MEDIUM", score: 30 },
  { pattern: /\b(?:doi:?\s*)?10\.\d{4,}\/[a-z0-9.\-/]+\b/i, label: "DOI citation (verify)", message: "Response contains a DOI that should be verified against actual publications.", severity: "MEDIUM", score: 30 },
  { pattern: /(?:Smith et al\.|Jones et al\.|Johnson et al\.|Williams et al\.|Brown et al\.)\s*\(\s*20[2-3]\d\s*\)/i, label: "Generic author citation", message: "Response uses generic-sounding author names in citations that may be fabricated.", severity: "MEDIUM", score: 25 },
  { pattern: /\b(?:published in|appeared in|from)\s+(?:the )?(?:International Journal of|Journal of Advanced|Proceedings of the \d+(?:st|nd|rd|th) (?:Annual|International))\s+[A-Z]/i, label: "Potentially invented journal", message: "Response references a journal name that may not exist.", severity: "MEDIUM", score: 25 },

  // ── False authority claims ─────────────────────────────────────────
  { pattern: /\b(?:studies (?:have )?(?:conclusively |definitively )?(?:shown|proven|demonstrated|confirmed)|research (?:has )?(?:conclusively |definitively )?(?:proven|shown|confirmed|established))\b.{0,200}\b(?:100%|always|never|every single|without exception|in all cases)\b/i, label: "Absolute scientific claim", message: "Response makes absolute scientific claims that are likely overstated.", severity: "MEDIUM", score: 30 },
  { pattern: /\b(?:all (?:experts|scientists|researchers|doctors|studies) agree|scientific consensus (?:confirms|proves|shows) that|it is (?:universally|unanimously) accepted)\b/i, label: "False consensus claim", message: "Response claims universal expert consensus which may be fabricated.", severity: "MEDIUM", score: 25 },
  { pattern: /\b(?:FDA[- ]approved|WHO[- ]recommended|CDC[- ]confirmed|NIH[- ]funded study)\b.{0,120}\b(?:cure|treat|prevent|eliminate|guaranteed)\b/i, label: "False regulatory endorsement", message: "Response falsely attributes regulatory endorsement to a claim.", severity: "HIGH", score: 35 },

  // ── Invented statistics ────────────────────────────────────────────
  { pattern: /\b(?:exactly|precisely)\s+(?:\d{1,2}\.\d{2,}%|\d{2,}\.\d+%)\s+(?:of (?:people|patients|users|studies|cases))\b/i, label: "Suspiciously precise statistic", message: "Response contains an unusually precise statistic that may be fabricated.", severity: "MEDIUM", score: 25 },
  { pattern: /\b(?:a (?:recent|new|landmark|groundbreaking) (?:study|survey|poll|report))\s+(?:of|with|involving)\s+(?:\d{1,3},\d{3}|\d{4,})\s+(?:people|participants|patients|users|respondents)\s+(?:found|showed|revealed|demonstrated)\b/i, label: "Unverifiable study reference", message: "Response references a specific study with precise numbers that cannot be verified.", severity: "MEDIUM", score: 25 },

  // ── Non-existent entities ──────────────────────────────────────────
  { pattern: /\b(?:the (?:official|renowned|prestigious|world-famous)\s+)?(?:Institute of|Foundation for|Academy of|Center for|Association of)\s+(?:Advanced|Global|International|Universal|Quantum)\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i, label: "Potentially fabricated institution", message: "Response references an institution that may not exist.", severity: "MEDIUM", score: 25 },
  { pattern: /\b(?:install|import|require|pip install|npm install|from)\s+(?:[a-z][a-z0-9_-]{2,40})\b.{0,120}\b(?:this (?:popular |widely-used |well-known )?(?:library|package|module|framework)|widely used|popular package)\b/i, label: "Potentially hallucinated package", message: "Response recommends a package that may not exist (package hallucination risk).", severity: "HIGH", score: 35 },

  // ── Fake legal citations ───────────────────────────────────────────
  { pattern: /\b(?:\d+\s+U\.S\.\s+\d+|(?:Smith|Jones|Johnson|Williams)\s+v\.\s+(?:Smith|Jones|State|United States|City of))\s*\(\s*(?:19|20)\d{2}\s*\)/i, label: "Potentially fabricated case law", message: "Response cites a legal case that may not exist.", severity: "MEDIUM", score: 30 },
  { pattern: /\b(?:Section|Article|Title)\s+\d+\s+(?:of the|under)\s+(?:the\s+)?(?:[A-Z][a-z]+\s+){1,4}(?:Act|Code|Regulation|Statute|Law)\s+of\s+\d{4}\b/i, label: "Potentially fabricated statute", message: "Response references a statute that may not exist.", severity: "MEDIUM", score: 25 },

  // ── Contradictions ─────────────────────────────────────────────────
  { pattern: /\b(?:however|but|on the other hand|conversely|in contrast)\b.{0,200}\b(?:as (?:I |we )?(?:mentioned|said|stated|noted) (?:earlier|above|before|previously))\b/i, label: "Self-contradiction indicator", message: "Response may contain contradictory statements.", severity: "LOW", score: 20 },

  // ── Overconfident future claims ────────────────────────────────────
  { pattern: /\b(?:will (?:definitely|certainly|undoubtedly|inevitably|absolutely)|is guaranteed to|is certain to)\s+(?:happen|occur|take place|be (?:available|released|launched))\s+(?:in|by|before)\s+(?:20[2-3]\d|next (?:year|month|quarter))\b/i, label: "Overconfident prediction", message: "Response makes overconfident predictions about future events.", severity: "MEDIUM", score: 25 },

  // ── Medical claims without disclaimer ──────────────────────────────
  { pattern: /\b(?:you (?:should|must|need to)\s+(?:take|use|try|start)|(?:take|use)\s+\d+\s*(?:mg|ml|tablets?|capsules?|drops?))\b.{0,200}(?:(?:(?:cure|treat|heal|fix|resolve)s?\s+(?:your|the|this))|(?:guaranteed|proven|effective))/i, label: "Unsupported medical advice", message: "Response provides specific medical advice without professional disclaimer.", severity: "HIGH", score: 35 },

  // ── Fabricated URLs/links ──────────────────────────────────────────
  { pattern: /https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.){1,3}(?:com|org|edu|gov)\/(?:[a-z0-9-]+\/){2,5}[a-z0-9-]+\.(?:html|pdf|php)/i, label: "Specific URL (verify)", message: "Response contains a specific URL that should be verified before sharing.", severity: "LOW", score: 15 },

  // ── Confident misinformation patterns ──────────────────────────────
  { pattern: /\b(?:it is (?:a )?(?:well-known|established|proven|scientific) fact that|everyone knows that|it has been proven that|science has shown that)\b.{0,200}\b(?:never|always|impossible|cannot|must|guaranteed)\b/i, label: "Authoritative misinformation pattern", message: "Response uses authoritative language that may mask misinformation.", severity: "MEDIUM", score: 30 },
  { pattern: /\b(?:this (?:was|is) (?:confirmed|verified|validated) by)\s+(?:multiple|several|numerous|many)\s+(?:independent\s+)?(?:sources|studies|researchers|experts)\b/i, label: "Unverifiable multi-source claim", message: "Response claims multiple source verification without specifics.", severity: "MEDIUM", score: 25 },
];

export function hallucinationDetector(text: string) {
  return detectPatterns(text, "HALLUCINATION", rules);
}
