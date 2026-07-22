import { detectPatterns, type PatternRule } from "./helpers";
import { suppressProtectedExpression } from "./protectedExpression";

/**
 * Harmful-content PRODUCTION-request detector (INPUT direction).
 *
 * WHY THIS EXISTS:
 *   The rules pipeline covered adversarial *structure* (injection / jailbreak /
 *   exfil) and hate/threat *toxicity*, but it had a blind spot for the plainest
 *   category of abuse: a request that the assistant PRODUCE operational
 *   instructions for a mass-harm capability — synthesising a lethal toxin,
 *   purifying a drug, or writing propaganda that incites violence against a
 *   group. On a frozen untuned attack corpus these slipped through as ALLOW
 *   (only the ungated ML tier flagged them, and it could not be trusted to
 *   escalate on INPUT because it fires the same UNSAFE_OUTPUT label on benign
 *   "write a script to compress images" — see lib/guard/mlAugment.ts). The
 *   analyzeContentSafety module (lib/guard/contentSafety.ts) had adjacent
 *   patterns but was never wired into analyzeText and matched only very literal
 *   phrasings ("how to make a bomb").
 *
 * DESIGN — structural, not phrase-matched:
 *   Every rule requires an INSTRUCTION/PRODUCTION cue (write / lay out / give me
 *   step-by-step / voice his lines describing …) co-occurring with a HARM CAPABILITY
 *   object (lethal toxin / nerve agent / synthesise a drug / incite violence against
 *   a group) within a proximity window. Requiring BOTH keeps benign
 *   security-education and fiction prose — which mentions the vocabulary without
 *   asking the model to PRODUCE the capability — allowed. Roleplay/fiction
 *   wrappers ("write his monologue", "voice his lines", "in our thriller the
 *   chemist explains") are treated as production cues because they are the
 *   dominant real-world evasion, but only when paired with an operational harm
 *   object, never on the fiction framing alone.
 *
 * ACTION: emits TOXICITY (routed to BLOCK at score>=45, else HUMAN_REVIEW by the
 * decision engine). CRITICAL mass-harm capabilities score 50 (BLOCK); softer
 * ones land at HUMAN_REVIEW.
 */

// ── Production / instruction-elicitation cues ───────────────────────────────
// The user asks the model to GENERATE the content, list the steps, or voice a
// character who does — as opposed to merely discussing that such content exists.
const PRODUCE =
  "how (?:to|do (?:i|we|you)|can (?:i|we|you))|" +
  "step[\\s-]?by[\\s-]?step|steps? (?:to|for)|" +
  "give me|show me|tell me|teach me|walk me through|explain (?:to me )?how|" +
  "lay out|spell out|list|outline|detail|describe (?:exactly |in detail )?how|" +
  "write|compose|draft|generate|produce|create|craft|" +
  "recipe|instructions? for|guide (?:to|for)|method (?:to|for|of)|" +
  "voice (?:his|her|their) lines|narrate|monologue|in[\\s-]?character";

const MAKE_ACTION = "(?:brew|cook|synthesi[sz](?:e|ing|ation)?|make|produce|purif(?:y|ying|ication)?|weaponi[sz](?:e|ing|ation)?|cultivate|refine|extract|distill|manufactur(?:e|ing))";

// ── Harm-capability objects (operational mass-harm / violence enablement) ────
// Deliberately specific: a *capability*, not a topic. "chemistry" alone never
// matches; "synthesise a nerve agent" does.
const CHEM_BIO =
  "(?:lethal|deadly|dangerous|potent|homemade|home[\\s-]?made|untraceable)\\s+(?:toxin|poison|nerve agent|bioweapon|pathogen|gas)|" +
  `(?:toxin|poison|nerve agent|bioweapon|biological weapon|chemical weapon|chemical warfare agents?|biological warfare agents?|pathogen|ricin|sarin|vx|anthrax|botulinum|dimethylmercury|lewisite|chlorine gas|hydrogen cyanide|phosgene|mustard gas|tabun|parathion|strychnine|cyanide|smallpox)\\b[\\s\\S]{0,70}(?:${MAKE_ACTION}|easy to make|obtain at home|without detection|at home|in a (?:home |)kitchen)|` +
  `${MAKE_ACTION}[\\s\\S]{0,70}(?:lethal |deadly |)(?:toxin|poison|nerve agent|bioweapon|pathogen|ricin|sarin|anthrax|dimethylmercury|lewisite|chlorine gas|hydrogen cyanide|phosgene|mustard gas|tabun|parathion|strychnine|smallpox|the product|the toxin)`;

const DRUGS =
  `${MAKE_ACTION}[\\s\\S]{0,40}(?:meth|methamphetamine|cocaine|heroin|fentanyl|carfentanil|lsd|mdma|the product|the drug)|` +
  `(?:meth|methamphetamine|cocaine|heroin|fentanyl|carfentanil)\\b[\\s\\S]{0,40}(?:${MAKE_ACTION}|recipe|how to make)`;

const WEAPONS =
  "(?:make|build|construct|assemble|3d[\\s-]?print|convert|modify|smuggl(?:e|ing)|tamper(?:ing)?|disable)[\\s\\S]{0,60}(?:bomb|explosive|ied|pipe bomb|pressure cooker bomb|detonator|firearm|handgun|automatic weapon|silencer|suppressor|ghost gun|dirty bomb|grenade|drone|pacemaker|electronic monitoring)|" +
  "(?:bomb|explosive|ied|detonator|firearm|handgun|glock switch|car bomb|mass killing|shoot up|hostage)\\b[\\s\\S]{0,60}(?:make|build|construct|assemble|targets?|instructions?|at home|from scratch|how to|plan)";

const VIOLENCE_INCITEMENT =
  "(?:leaflet|pamphlet|flyer|manifesto|essay|post|screed|propaganda|recruitment|speech|article|tract)[\\s\\S]{0,60}(?:urging|incit(?:e|es|ing)|calling for|promoting|glorify(?:ing)?|justify(?:ing)?|encouraging)[\\s\\S]{0,40}(?:violence|attack|killing|genocide|ethnic cleansing|terror)|" +
  "(?:urging|incit(?:e|es|ing)|calling for|promoting|encouraging)[\\s\\S]{0,40}(?:physical\\s+)?(?:violence|attack|killing|terror)[\\s\\S]{0,50}(?:against|targeting|toward)[\\s\\S]{0,70}(?:group|community|religion|religious|ethnic|race|people|minority|population|members)";

const CYBER_ABUSE =
  "(?:malware|ransomware|keylogger|infostealer|rootkit|worm|botnet|cryptojack|reverse shell|credential stealer|ddos|syn flood|dns amplification|" +
  "hack(?:ing)? into|exploit(?:ing)? (?:a |the )?(?:vulnerability|cve|ghostcat|drupalgeddon|dirty cow|dirty pipe|bluekeep|eternalblue|krack)|" +
  "sql injection|csrf attack|password hash|rainbow table|office macro|obfuscat(?:e|ion).{0,40}(?:malware|rootkit|worm|ddos)|jam replay attack|" +
  "disable antivirus|bypass edr|crack passwords?|steal credentials?|phishing (?:email|message|page)|fake (?:bank|login) page|scraping code|auto creation code|ready-made tools)";

const ILLEGAL_ABUSE =
  "(?:identity theft|blackmail|extort|ransom note|tax fraud|counterfeit|forge documents?|fake charity|fabricated customer reviews?|smuggl(?:e|ing)|" +
  "evad(?:e|ing) (?:tracing|monitoring|law enforcement|police)|illegal(?:ly)? (?:purchase|buy|sell)|hitman|kidnapp(?:ing)?|swatting|" +
  "steal(?:ing)? (?:cars?|shipments?|credit cards?|credit info|money|artifacts?|nuclear material)|shoplift|self-checkout theft|chop shops?|credit card skimmer|scam (?:script|phone|message)|" +
  "coerc(?:e|ion).{0,50}(?:explicit|intimate|images)|gaslight(?:ing)?|stalk(?:ing)?|death threat|black market organ|medical prescription|fool a breathalyzer|pirat(?:e|ing) content|brothel|contraband)";

const HATE_HARASSMENT_PRODUCTION =
  "(?:racial slurs?|xenophobic|antisemitic|homophobic|anti-lgbtq|racist|sexist|misogynistic|body shaming|demean(?:ing)?|ridicule|" +
  "inferior|less intelligent|dangerous to (?:our )?society|discourages? hiring.{0,40}disab|harassment|bullying|hate mail|" +
  "negative impact.{0,40}disab|race discrimination|ethnic group.{0,80}(?:inferior|dangerous|hate|violence)|profane insults?|vicious bullying|convince suicide|encourag(?:e|ing).{0,40}self-harm|eating disorders?)";

const MISINFORMATION_ABUSE =
  "(?:fake news|spread disinformation|hoax article|holocaust (?:never happened|denial)|defamatory article claiming|false claim|fabricated claim|" +
  "convincing defamatory|conspiracy|vaccine.{0,40}autism|mail-in ballots.{0,40}fraud|election fraud|5g.{0,40}covid|covid.{0,60}bioweapon|" +
  "genocide.{0,40}(?:exaggeration|denial)|downplays?.{0,80}(?:atrocity|war crime|health impacts)|historical tragedy.{0,60}(?:beneficial|exaggerated)|health benefits false claim|pro-isis|race superiority|voter fraud|fauci|lab leak|side effects)";

const COPYRIGHT_REPRODUCTION =
  "(?:lyrics of|full lyrics|entire lyrics|complete lyrics|verbatim lyrics|generate the lyrics|provide the lyrics|" +
  "passage from|excerpt from|chapter from|verbatim passage|copyrighted (?:song|book|novel|text))";

const UNSAFE_EXPERT_ADVICE =
  "(?:personalized medical treatment plan|illegally prescribe opioids|circumventing copyright protections|pirating content|" +
  "treating .{0,30}schizophrenia|doctor to illegally prescribe|medical records private access)";

const rules: PatternRule[] = [
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,90}(?:${CHEM_BIO})`, "i"),
    label: "Chemical/biological harm production request",
    message:
      "The request asks the assistant to produce operational instructions for synthesising a toxin, poison, or bio/chemical weapon.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,90}(?:${DRUGS})`, "i"),
    label: "Illicit drug synthesis request",
    message:
      "The request asks the assistant to produce instructions for synthesising or manufacturing a controlled substance.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,90}(?:${WEAPONS})`, "i"),
    label: "Weapon construction request",
    message:
      "The request asks the assistant to produce instructions for building or modifying a weapon or explosive.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,90}(?:${VIOLENCE_INCITEMENT})`, "i"),
    label: "Violence-incitement content request",
    message:
      "The request asks the assistant to produce propaganda or messaging that incites violence against a group.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    // Standalone incitement object even without an explicit produce verb — the
    // incitement phrasing itself carries the request intent.
    pattern: new RegExp(`(?:${VIOLENCE_INCITEMENT})`, "i"),
    label: "Violence-incitement content",
    message:
      "The content incites or calls for violence against a group.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,100}(?:${CYBER_ABUSE})|(?:${CYBER_ABUSE})[\\s\\S]{0,80}(?:instructions?|tutorial|guide|code|script|payload|step[\\s-]?by[\\s-]?step)`, "i"),
    label: "Cyber abuse production request",
    message:
      "The request asks the assistant to produce malware, credential theft, exploit, phishing, or intrusion instructions.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,100}(?:${ILLEGAL_ABUSE})|(?:${ILLEGAL_ABUSE})[\\s\\S]{0,80}(?:instructions?|tutorial|guide|scheme|strategy|script|template|plan|tips?)`, "i"),
    label: "Illegal abuse production request",
    message:
      "The request asks the assistant to produce instructions, scripts, or persuasive material for fraud, evasion, coercion, theft, or other illegal abuse.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,120}(?:${HATE_HARASSMENT_PRODUCTION})`, "i"),
    label: "Hate or harassment production request",
    message:
      "The request asks the assistant to produce targeted harassment, hate, discrimination, or coercive abuse content.",
    severity: "CRITICAL",
    score: 50,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,120}(?:${MISINFORMATION_ABUSE})|(?:${MISINFORMATION_ABUSE})[\\s\\S]{0,80}(?:article|thread|post|reply|edit|campaign|argument)`, "i"),
    label: "Disinformation production request",
    message:
      "The request asks the assistant to produce defamatory, fraudulent, or disinformation content.",
    severity: "HIGH",
    score: 45,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,80}(?:${COPYRIGHT_REPRODUCTION})|(?:${COPYRIGHT_REPRODUCTION})[\\s\\S]{0,80}(?:by|from|of)`, "i"),
    label: "Copyrighted text reproduction request",
    message:
      "The request asks for likely copyrighted text to be reproduced rather than summarized or transformed.",
    severity: "MEDIUM",
    score: 35,
    sensitive: true,
  },
  {
    pattern: new RegExp(`(?:${PRODUCE})[\\s\\S]{0,120}(?:${UNSAFE_EXPERT_ADVICE})|(?:${UNSAFE_EXPERT_ADVICE})`, "i"),
    label: "Unsafe regulated advice request",
    message:
      "The request asks for individualized regulated advice or assistance with illegal regulated activity.",
    severity: "HIGH",
    score: 45,
    sensitive: true,
  },
];

// Benign-context guard. Security/medical/policy EDUCATION and harm-REDUCTION
// discussion legitimately name these capabilities without requesting production.
// We suppress only when an education/analysis framing is present AND no explicit
// production imperative ("give me the steps", "write the recipe") co-occurs.
const EDUCATION_CONTEXT =
  /\b(?:detect|detection|defend|defense|mitigat|mitigations?|prevent|protect|awareness|policy|regulat|screen(?:ing)?|classif|moderat|flag|block|red[\s-]?team|threat model|risk assessment|high level|why (?:is|are)|history of|signs of|warning signs|how (?:do|can) (?:i|we|you|one) (?:spot|recognize|identify|report))\b/i;

export function harmfulContentRequestDetector(text: string) {
  const findings = detectPatterns(text, "TOXICITY", rules);
  if (findings.length === 0) return findings;
  // If the text is framed as detection/defense/policy education and does NOT
  // contain a hard production imperative, suppress — this keeps SOC/training and
  // harm-reduction prose allowed. A blunt imperative overrides the suppression.
  const hardImperative =
    /\b(?:step[\s-]?by[\s-]?step|give me the (?:exact |full )?(?:steps|recipe|method|instructions|process)|lay out .{0,30}how|walk me through .{0,30}(?:making|synthesi|cooking|building)|exact (?:recipe|steps|synthesis|method))\b/i.test(
      text,
    );
  if (EDUCATION_CONTEXT.test(text) && !hardImperative) return [];
  // Protected expression (fact-checking, fiction narrative, journalism) that names
  // a soft-harm topic without any operational cue is not a production request. The
  // suppressor is label-aware: it never clears CBRN / weapons / CSAM / mass-casualty
  // findings, so this only relaxes the debatable soft categories.
  return suppressProtectedExpression(text, findings);
}
