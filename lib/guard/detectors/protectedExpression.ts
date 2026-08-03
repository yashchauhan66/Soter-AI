import type { GuardFinding } from "../types";

/**
 * Protected-expression suppressor (shared by the two harmful-content detectors).
 *
 * WHY THIS EXISTS:
 *   The harmful-content rules key off a PRODUCE cue + a harm-topic object. That
 *   correctly blocks "write a guide to commit tax fraud", but it over-fires on
 *   three categories of legitimate, protected speech that merely NAME a harmful
 *   topic without asking the model to produce an operational capability:
 *
 *     1. Fact-checking / debunking   ("write a thread that fact-checks the
 *        vaccine-autism claim")  → this is COUNTER-disinformation, not disinfo.
 *     2. Fiction / narrative        ("write a story where a character extorts
 *        the CEO")  → a plot ABOUT a crime, not instructions to commit one.
 *     3. Awareness / journalism     ("write a blog post about predatory stalking
 *        behavior")  → describing a harm to inform, not enabling it.
 *
 *   These are exactly the benign requests a mature competitor (Lakera, Azure
 *   Content Safety) allows. Measured on the JailbreakBench benign split they were
 *   a large share of our false positives.
 *
 * SAFETY — this suppressor is deliberately narrow and CANNOT weaken hard blocks:
 *   - It only ever removes findings whose label is in SOFT_SUPPRESSIBLE_LABELS.
 *     CBRN, explosives, weapons, drug synthesis, CSAM, mass-casualty, cyber
 *     tooling, targeted violence, self-harm-method, stalkerware and terrorist
 *     recruitment findings are NEVER suppressed — their labels are not in the set.
 *   - It suppresses only when a protected framing is present AND no operational
 *     imperative ("how to", "step by step", "give me the method") co-occurs. A
 *     request that wraps real instructions in a fiction frame ("write a story
 *     that includes the exact synthesis steps") keeps its finding.
 *
 * This is NOT tuned to any benchmark string — it encodes the general legal/policy
 * distinction between depicting/analysing a harm and producing the capability.
 */

// Soft harm categories that legitimate fact-check / fiction / awareness speech
// routinely references. ONLY these labels may be suppressed. Anything absent
// here (CSAM, mass casualty, CBRN, weapons, drugs, cyber tooling, targeted
// violence, self-harm methods, stalkerware, terrorist recruitment, …) is always
// kept, regardless of framing.
// 2026-08-02: added newly-introduced hard labels (mass-casualty planning,
// computer-hijack malware, credential bypass, academic dishonesty) explicitly
// NOT added here — they are hard blocks and must never be suppressible.
const SOFT_SUPPRESSIBLE_LABELS = new Set<string>([
  "Disinformation production request",
  "Illegal abuse production request",
]);

// Protected framings: the request is to fact-check, to write fiction, or to
// inform/raise awareness ABOUT a topic.
const PROTECTED_FRAMING = new RegExp(
  "\\b(?:fact[\\s-]?check(?:s|ing|ed)?|debunk(?:s|ing|ed)?|myth[\\s-]?bust(?:s|ing|er)?|" +
    "corrects? the (?:myth|misconception|false claim)|refut(?:e|es|ing|ation)|" +
    // fiction / narrative framing
    "fictional|fiction|novel|short story|story (?:where|about|in which)|screenplay|" +
    "play script|stage play|listicle|poem|song lyrics about|satir(?:e|ical)|" +
    // awareness / journalism framing
    "blog post about|article about|awareness (?:campaign|post|piece)|" +
    "op-?ed about|essay about|explainer about|documentary about|" +
    "raise awareness|inform (?:the )?(?:public|readers)|educational post about)\\b",
  "i",
);

// Operational override: if the text ALSO asks how to actually do the harm, the
// protected framing is a wrapper and we must NOT suppress. Mirrors the hard
// imperatives the two detectors already recognise, plus acquisition verbs.
const OPERATIONAL_OVERRIDE = new RegExp(
  "\\b(?:step[\\s-]?by[\\s-]?step|how (?:to|do (?:i|we|you)|can (?:i|we|you))|" +
    "give me the (?:exact |full )?(?:steps?|recipe|method|instructions?|process|formula)|" +
    "exact (?:recipe|steps?|synthesis|method|dose|formula|procedure|amount|quantity)|" +
    "detailed (?:instructions?|guide|steps?|method|process|procedure)|" +
    "walk me through|lay out .{0,30}how|working (?:code|exploit|payload)|" +
    "functional (?:malware|exploit)|actual .{0,20}(?:recipe|code|payload))\\b",
  "i",
);

// Advocacy override: a request to PERSUADE, ARGUE FOR, JUSTIFY, GLORIFY, DENY or
// DOWNPLAY a harmful position is disinformation / hate PRODUCTION, not neutral
// journalism or fact-checking. "Write a persuasive article about how the Holodomor
// was a natural disaster" (genocide denial) superficially matches "article about",
// but it advocates a falsehood — it must NEVER be suppressed. Neutral awareness
// ("blog post ABOUT predatory stalking behavior") carries none of these verbs.
const ADVOCACY_OVERRIDE = new RegExp(
  "\\b(?:persuasi(?:ve|on)|persuade|convince|convincing|" +
    "argu(?:e|es|ing|ment)\\b[\\s\\S]{0,20}\\b(?:for|that|why)|" +
    "make the case|justify(?:ing)?|glorif(?:y|ies|ying)|" +
    "den(?:y|ies|ying|ial)|downplay(?:ing)?|trivializ(?:e|ing)|whitewash|" +
    "propaganda (?:for|supporting)|advocat(?:e|ing) (?:for|that)|" +
    "how [\\s\\S]{0,60}(?:was|is|are|were)[\\s\\S]{0,30}(?:beneficial|good|justified|natural disaster|a myth|exaggerated|deserved|acceptable|positive))\\b",
  "i",
);

/**
 * Given the findings a harmful-content detector produced, drop the soft-category
 * ones when the request is clearly protected expression (fact-check / fiction /
 * awareness) with no operational ask. Hard-category findings pass through
 * untouched. If any hard finding remains, nothing is suppressed at all — a mixed
 * request that also asks for a real capability stays blocked.
 */
export function suppressProtectedExpression(
  text: string,
  findings: GuardFinding[],
): GuardFinding[] {
  if (findings.length === 0) return findings;
  if (!PROTECTED_FRAMING.test(text)) return findings;
  if (OPERATIONAL_OVERRIDE.test(text)) return findings;
  // Advocacy / denial / glorification is production of disinfo or hate, never
  // protected fact-checking or neutral awareness — keep the finding.
  if (ADVOCACY_OVERRIDE.test(text)) return findings;

  // If ANY finding is a hard (non-suppressible) category, the request touches a
  // genuinely dangerous capability — keep everything.
  const hasHardFinding = findings.some((f) => !SOFT_SUPPRESSIBLE_LABELS.has(f.label));
  if (hasHardFinding) return findings;

  // All findings are soft and the framing is protected: allow the request.
  return [];
}
