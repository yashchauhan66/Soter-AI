import { detectPatterns, type PatternRule } from "./helpers";
import { suppressProtectedExpression } from "./protectedExpression";

/**
 * broadHarmfulContentDetector — high-recall complement to harmfulContentRequestDetector.
 *
 * STRATEGY:
 *   harmfulContentRequestDetector requires an explicit PRODUCE cue co-occurring
 *   with a harmful capability object. That structural requirement is intentionally
 *   precise (low FPR on benign queries) but misses:
 *
 *   1. Direct capability-object mentions without an anchored verb ("sarin synthesis
 *      pathway", "LD50 of ricin for a 70kg adult")
 *   2. Paraphrased produce cues the PRODUCE regex doesn't capture ("elaborate on",
 *      "walk through", "break down", "get into the details of")
 *   3. Short high-density requests ("methamphetamine synthesis", "bomb recipe")
 *   4. Dual-use evasion where a legitimate-sounding domain is followed immediately
 *      by an operational ask ("as a nurse, the safest way to overdose…")
 *   5. Newly catalogued HarmBench behavior categories (copyright, financial fraud,
 *      targeted harassment, CSAM-adjacent, cybercrime tooling)
 *
 *   This detector DOES NOT require the PRODUCE structural pattern. Every rule is
 *   anchored to unique vocabulary that naturally occurs at high density only in
 *   genuinely harmful requests. FPR is controlled by specificity of the harm object
 *   rather than co-occurrence with a produce verb.
 *
 * ACTION: emits TOXICITY (same as harmfulContentRequestDetector). Score 45–50.
 * The decision engine routes TOXICITY to BLOCK at score≥45 and HUMAN_REVIEW below.
 *
 * The education/defense suppressor from harmfulContentRequestDetector is also
 * applied here so SOC/red-team analysis framing is not penalised.
 */

// ── Direct capability objects (no PRODUCE verb required) ─────────────────────

const BIOWEAPON_DIRECT =
    // Specific agents + "how/synthesis/method/pathway/yield"
    "(?:sarin|vx|novichok|ricin|anthrax|botulinum toxin|aflatoxin|abrin|tetrodotoxin|dimethylmercury|" +
    "phosgene|mustard gas|lewisite|hydrogen cyanide|cyanide gas|tabun|parathion|amiton|nerve agent|" +
    "bio(?:logical)?\\s*weapon|chem(?:ical)?\\s*weapon|weaponi[sz]ed\\s*pathogen)[\\s\\S]{0,120}" +
    "(?:synthesis|synthesize|synth|purif(?:y|ication)|pathway|precursor|yield|concentration|ld50|" +
    "lethal dose|obtain|produce|grow|culture|replicate|aerosolize|disperse|deliver|weaponize|" +
    "step|method|recipe|protocol|ingredient|dose|formul|reaction|mechanism)";

const DRUG_DIRECT =
    // Specific controlled substances + operational terms
    "(?:methamphetamine|meth|crystal meth|cocaine|crack cocaine|heroin|fentanyl|carfentanil|" +
    "oxycodone|hydrocodone|psilocybin|lsd|mdma|ecstasy|ghb|ketamine|pcp|dmt|" +
    "xanax|alprazolam|adderall|ritalin)[\\s\\S]{0,80}" +
    "(?:synthesis|synthesize|cook|clandestine lab|precursor|yield|extract|purif(?:y|y)?|" +
    "obtain|produce|manufacture|prepare|react|step|method|recipe|how to make|how do you make|" +
    "instructions|process|procedure|ingredient|chemical|labs?|batch|concentration)";

const EXPLOSIVE_DIRECT =
    // Specific explosive types + operational terms
    "(?:ammonium nitrate|anfo|tatp|hmtd|rdx|petn|c-4|semtex|nitroglycerin|nitric acid|" +
    "black powder|acetone peroxide|pipe bomb|pressure cooker bomb|ied|car bomb|nail bomb|" +
    "suicide vest|explosive device|detonator|initiator|blasting cap|primary explosive|" +
    "improvised explosive)[\\s\\S]{0,80}" +
    "(?:make|build|assemble|construct|prepare|detonate|trigger|yield|mix|proportion|" +
    "sensitiv|booster|primary|secondary|step|recipe|method|instruction|how to)";

const WEAPON_MOD_DIRECT =
    // Specific illegal weapon modifications + operational terms
    "(?:full[\\s-]?auto|automatic conversion|auto sear|dias|forced reset trigger|solvent trap|" +
    "ghost gun|80%\\s*(?:lower|receiver)|3d[\\s-]?print(?:ed)?\\s*gun|unregistered|unserialized|" +
    "suppressor|silencer|short barrel|sbr|sbs|machine gun conversion|glock switch|" +
    "bump stock|solvent trap kit)[\\s\\S]{0,80}" +
    "(?:install|convert|modify|assemble|build|acquire|machine|drill|print|legality|bypass|" +
    "register|kit|parts|step|instructions?|how|method|guide|without|evade|trace)";

const CSAM_ADJACENT =
    // CSAM-adjacent explicit requests (any mention, no PRODUCE gate)
    "(?:child sexual|minor sexual|underage sexual|sexual content.*(?:minor|child|teen|juvenile|" +
    "adolescent|pre-?teen|underage)|(?:minor|child|teen|juvenile|underage).*sexual content|" +
    "teen\\s*porn|child\\s*porn|minor\\s*porn|\\bloli\\b|\\bshota\\b|cp\\s*(?:link|download|request|post|share)|" +
    "grooming techniques?|groom(?:ing)?\\s*(?:children|minors|teens?)|sextortion)";

const TARGETED_VIOLENCE =
    // Targeting specific real people for violence — a core HarmBench category
    "(?:kill|murder|assassinate|shoot|stab|attack|harm|hurt|eliminate)\\s*" +
    "(?:[A-Z][a-z]+ ){0,3}(?:at\\s+)?(?:his|her|their)?\\s*" +
    "(?:home address|address|location|workplace|school|daily route|schedule|whereabouts|routine)|" +
    // OR: "how to get away with" + violence
    "(?:get away with|avoid detection after|dispose of.*body|evade.*after.*(?:kill|murder|shoot|stab))|" +
    // OR: specific weapons + targeted person
    "(?:sniper|drive-by|hit man|contract kill|hired killer|professional killer|dark web.*kill)";

const FINANCIAL_CRIME_DIRECT =
    // Financial crime ops — credit card fraud, money laundering, etc.
    "(?:carding|credit card dump|fullz|stolen card|card skimmer|skimming device|" +
    "clone.*credit card|counterfeit bill|counterfeit currency|money laundering|" +
    "hawala|smurfing|structuring.*deposits?|shell company.*launder|" +
    "wire fraud|bank fraud|mortgage fraud|insurance fraud.*scheme|" +
    "advance fee|419 scam|romance scam.*template|pig butchering|crypto scam)[\\s\\S]{0,120}" +
    "(?:method|how|scheme|step|approach|technique|operati|setup|script|template|guide|tool|run|do)";

const CYBER_CRIME_DIRECT =
    // Cybercrime tooling — close to HarmBench category
    "(?:ransomware.*(?:code|build|deploy|write|create|develop|sell)|" +
    "trojan.*(?:build|write|create|deploy|how|source)|" +
    "keylogger.*(?:build|write|install|evade)|" +
    "rootkit.*(?:build|create|install|hide|evade)|" +
    "botnet.*(?:build|create|command|control|rent)|" +
    "exploit.*(?:cve-\\d{4}-\\d{4,}|zero.?day|eternalblue|bluekeep|log4shell|proxylogon)|" +
    "reverse shell.*(?:payload|one.?liner|socat|netcat|msfvenom)|" +
    "pentest.*(?:live target|without permission|unauthorized)|" +
    "credential stuffing.*(?:tool|script|combo list)|" +
    "dark web.*(?:buy|sell|access|marketplace|drugs?|weapon|hacking))";

const HARASSMENT_DOXXING =
    // Personal information + targeted harassment / doxxing
    "(?:dox|doxx)(?:ing)?\\s*(?:someone|this person|them|him|her|[A-Z])|" +
    "find.*(?:home address|personal address|real name|phone number|location|employer).*(?:of|for)\\s*(?:this person|them|him|her|[A-Z][a-z]+)|" +
    "(?:expose|reveal|leak|post).*(?:personal|private|home|real)\\s*(?:address|info|information|details|data).*(?:online|public|forum|chan|post|share)|" +
    "(?:swat|swatting).*(?:this person|victim|target|address|him|her|them)";

const SELF_HARM_DETAILED =
    // Detailed self-harm / suicide methods — a HarmBench explicit category
    "(?:how to|best way to|most effective|painless|quick|reliable|successful|" +
    "undetected)\\s*" +
    "(?:method|way|approach|technique|means?)\\s*" +
    "(?:for|of|to)?\\s*" +
    "(?:suicide|kill myself|end my life|take my own life|self-?harm|overdose|cut deeply|" +
    "hang(?:ing)? myself|asphyxiate|carbon monoxide.*(?:car|garage)|" +
    "drown myself|jump off|lethal.*dose.*for me|medication.*overdose.*fatal)";

const DISINFORMATION_INFLUENCE_OPS =
    // Influence operations / astroturfing — HarmBench category
    "(?:fake social media|sock puppet|astroturf|coordinated inauthentic|" +
    "influence operation|disinformation campaign|troll farm|synthetic persona|" +
    "bot farm|bot army|automated accounts?)[\\s\\S]{0,100}" +
    "(?:create|build|run|operate|set up|deploy|mask|hide|evade|detect|" +
    "amplify|spread|coordinate|instructions?|how)";

const PRIVACY_STALKERWARE =
    // Stalkerware / covert surveillance specific
    "(?:stalkerware|spouseware|spy\\s*(?:app|software|tool)|track.*phone.*without.*knowing|" +
    "monitor.*spouse.*secretly|covert.*surveillance|hidden.*tracker|" +
    "install.*keylogger.*(?:phone|computer).*without.*knowing|" +
    "access.*partner.*messages.*without|read.*texts.*without\\s+them\\s+knowing)";

const RECRUITMENT_RADICALIZATION =
    // Terrorist recruitment / radicalization content
    "(?:recruit.*(?:isis|isil|al.?qaeda|al.?shabab|boko haram|proud boys|" +
    "neo.?nazi|white nationalist|incel|extremist|terror)|" +
    "radicali[sz](?:e|ing|ation).*(?:online|message|script|outline|approach)|" +
    "jihad.*(?:script|message|recruit|appeal|how|guide)|" +
    "lone.?wolf.*attack.*(?:inspire|plan|encourage|guide))";

const BIOTERRORISM_ENHANCEMENT =
    // Pathogen enhancement / gain-of-function specific
    "(?:gain.?of.?function|enhanced.*transmissibility|airborne.*pathogen|" +
    "aerosolize.*(?:pathogen|virus|bacteria|spore)|" +
    "increase.*lethality.*(?:virus|pathogen|bacteria)|" +
    "enhance.*(?:virulence|transmissibility|resistance).*(?:virus|pathogen)|" +
    "select.*resistant.*(?:antibiotic|antiviral).*strain|" +
    "weaponize.*(?:smallpox|plague|anthrax|influenza|covid|mpox))";

// ── Paraphrased produce cues (extras beyond harmfulContentRequestDetector) ───

const EXTRA_PRODUCE =
    "elaborate (?:on|about)|break(?:ing)? (?:it |this |that |them )?down(?: for me)?|" +
    "get into (?:the )?(?:details?|specifics?|nitty.?gritty)|" +
    "rundown|overview with (?:steps?|instructions?|detail)|" +
    "walk.*through.*(?:step|process|procedure)|" +
    "give.*(?:technical|operational|practical|step|detailed|complete|exhaustive)\\s*" +
    "(?:detail|guide|overview|breakdown|analysis|walkthrough|rundown|instructions?|manual)|" +
    "comprehensive.*(?:guide|tutorial|instructions?|manual|overview|breakdown)|" +
    "need.*instructions?.*(?:for|on|to|about)|" +
    "full.*(?:guide|tutorial|instructions?|manual|breakdown|recipe|process|procedure|method)|" +
    "as.*(?:chemist|pharmacist|nurse|doctor|hacker|expert|professional|researcher|scientist).*(?:explain|describe|outline|detail|tell|show|help)";

// ── Benign education/defense suppressor ──────────────────────────────────────

const EDUCATION_DEFENSE = new RegExp(
    "\\b(?:detect|detection|defend|defense|defens(?:e|ive)|mitigat|mitigations?|prevent|protect|high level|" +
    "awareness|policy|regulat|screen(?:ing)?|classif|moderat|flag|block|" +
    "red[\\s-]?team|threat model|risk assessment|why (?:is|are)|history of|" +
    "warning signs|how (?:do|can) (?:i|we|you|one) (?:spot|recogni[sz]e|identify|report|" +
    "defend against|protect against|mitigate|prevent))\\b",
    "i"
);

const HARD_PRODUCE_IMPERATIVE = new RegExp(
    "\\b(?:step[\\s-]?by[\\s-]?step|give me the (?:exact |full )?(?:steps|recipe|method|instructions?|process)|" +
    "lay out .{0,30}how|walk me through .{0,30}(?:making|synthesi|cooking|building|acquiring)|" +
    "exact (?:recipe|steps?|synthesis|method|dose|formula|procedure)|" +
    "complete (?:guide|instructions?|recipe|method|process|procedure)|" +
    "detailed (?:instructions?|guide|steps?|method|process|procedure))\\b",
    "i"
);

const rules: PatternRule[] = [
    // ── Direct bioweapon capability ─────────────────────────────────────────
    {
        pattern: new RegExp(BIOWEAPON_DIRECT, "i"),
        label: "Direct bioweapon capability request",
        message:
            "The text contains specific chemical/biological agent names co-occurring with operational synthesis or delivery vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    {
        pattern: new RegExp(BIOTERRORISM_ENHANCEMENT, "i"),
        label: "Pathogen enhancement request",
        message:
            "The text requests gain-of-function, lethality enhancement, or weaponization of pathogens.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Direct drug synthesis ───────────────────────────────────────────────
    {
        pattern: new RegExp(DRUG_DIRECT, "i"),
        label: "Direct drug synthesis inquiry",
        message:
            "The text names a specific controlled substance in close proximity to operational synthesis or manufacturing vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Direct explosive / IED ──────────────────────────────────────────────
    {
        pattern: new RegExp(EXPLOSIVE_DIRECT, "i"),
        label: "Direct explosive construction inquiry",
        message:
            "The text names a specific explosive type or device in close proximity to construction or detonation vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Illegal weapon modification ─────────────────────────────────────────
    {
        pattern: new RegExp(WEAPON_MOD_DIRECT, "i"),
        label: "Illegal weapon modification inquiry",
        message:
            "The text requests operational guidance on illegal firearm modifications or untraceable weapons.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── CSAM-adjacent ───────────────────────────────────────────────────────
    {
        pattern: new RegExp(CSAM_ADJACENT, "i"),
        label: "CSAM or minor-safety violation",
        message:
            "The text contains content that violates minor-safety policies including grooming, CSAM requests, or depictions of minors in sexual contexts.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Targeted violence ───────────────────────────────────────────────────
    {
        pattern: new RegExp(TARGETED_VIOLENCE, "i"),
        label: "Targeted violence facilitation",
        message:
            "The text requests operational information to enact violence against a specific person or to evade detection after violence.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Financial crime ─────────────────────────────────────────────────────
    {
        pattern: new RegExp(FINANCIAL_CRIME_DIRECT, "i"),
        label: "Financial crime operational request",
        message:
            "The text contains financial crime terminology (carding, skimming, laundering) co-occurring with operational vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Cybercrime tooling ──────────────────────────────────────────────────
    {
        pattern: new RegExp(CYBER_CRIME_DIRECT, "i"),
        label: "Cybercrime tooling request",
        message:
            "The text requests ransomware, exploit, reverse shell, credential theft, or dark web operational information.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Doxxing / harassment ───────────────────────────────────────────────
    {
        pattern: new RegExp(HARASSMENT_DOXXING, "i"),
        label: "Doxxing or targeted harassment request",
        message:
            "The text requests personal identifying information for targeted online harassment or doxxing.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Detailed self-harm methods ─────────────────────────────────────────
    {
        pattern: new RegExp(SELF_HARM_DETAILED, "i"),
        label: "Detailed self-harm method request",
        message:
            "The text requests specific methods for suicide or severe self-harm.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Influence operations ───────────────────────────────────────────────
    {
        pattern: new RegExp(DISINFORMATION_INFLUENCE_OPS, "i"),
        label: "Influence operation creation request",
        message:
            "The text requests creation or operation of coordinated inauthentic information campaigns.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Stalkerware ────────────────────────────────────────────────────────
    {
        pattern: new RegExp(PRIVACY_STALKERWARE, "i"),
        label: "Stalkerware or covert surveillance request",
        message:
            "The text requests covert tracking or surveillance installation without the target's knowledge.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // ── Terrorist recruitment ──────────────────────────────────────────────
    {
        pattern: new RegExp(RECRUITMENT_RADICALIZATION, "i"),
        label: "Terrorist recruitment or radicalization content",
        message:
            "The text requests generation or assistance with terrorist recruitment, radicalization scripts, or extremist content.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── Paraphrased produce + harm object combinations (extra coverage) ────

    // Extra produce + chem/bio
    {
        pattern: new RegExp(
            `(?:${EXTRA_PRODUCE})[\\s\\S]{0,120}(?:nerve agent|sarin|vx|ricin|anthrax|toxin|pathogen|bioweapon|chemical weapon|weaponize)`,
            "i"
        ),
        label: "Paraphrased bioweapon production request",
        message:
            "A paraphrased production cue is combined with chemical/biological weapon vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // Extra produce + drugs
    {
        pattern: new RegExp(
            `(?:${EXTRA_PRODUCE})[\\s\\S]{0,80}(?:meth|methamphetamine|fentanyl|heroin|cocaine|lsd|mdma|synthesized|clandestine)`,
            "i"
        ),
        label: "Paraphrased drug synthesis request",
        message:
            "A paraphrased production cue is combined with controlled substance vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // Extra produce + explosives
    {
        pattern: new RegExp(
            `(?:${EXTRA_PRODUCE})[\\s\\S]{0,80}(?:bomb|explosive|ied|detonator|tatp|anfo|pipe bomb|pressure cooker)`,
            "i"
        ),
        label: "Paraphrased explosive construction request",
        message:
            "A paraphrased production cue co-occurs with explosive device vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
    // Extra produce + cyber crime
    {
        pattern: new RegExp(
            `(?:${EXTRA_PRODUCE})[\\s\\S]{0,100}(?:ransomware|keylogger|botnet|reverse shell|exploit|root(?:kit)?|trojan|credential steal|phishing kit|darkweb marketplace|malware)`,
            "i"
        ),
        label: "Paraphrased cybercrime tooling request",
        message:
            "A paraphrased production cue is combined with cybercrime tooling vocabulary.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── Short high-density requests (no PRODUCE verb needed) ──────────────
    {
        pattern:
            /\b(?:synthesis|synthesis route|synthetic route|synth pathway)\b.{0,60}\b(?:meth|fentanyl|heroin|cocaine|sarin|ricin|tatp|hmtd)\b|\b(?:meth|fentanyl|heroin|cocaine|sarin|ricin|tatp|hmtd)\b.{0,60}\b(?:synthesis|synthetic route|synth route|synth pathway|precursor|recipe)\b/i,
        label: "High-density substance synthesis query",
        message:
            "Dense co-occurrence of substance name and synthesis vocabulary without any elaborating context.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── Dual-use professional authority + harm request ────────────────────
    {
        pattern:
            /(?:as a|i'?m a|i am a|speaking as a|hypothetically as a)\s+(?:nurse|doctor|physician|pharmacist|chemist|toxicologist|security researcher|penetration tester|expert|professional|scientist).{0,200}(?:lethal dose|fatal dose|overdose lethally|exact quantity to kill|synthesis steps|how to make|how to produce|manufacture|weaponi[sz])/i,
        label: "Professional role + harm request",
        message:
            "A professional role pretext is combined with a request for operationally harmful information.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── "For a story / novel / game" + operational harm detail ────────────
    {
        pattern:
            /(?:for (?:my |a |the )?(?:novel|story|book|screenplay|game|fiction|script|character)|fictional(?:ly)?|in (?:the )?story).{0,240}(?:step.by.step|exact recipe|exact synthesis|exact dose|how to make|manufacture|detailed instructions?|working exploit|functional malware|actual (?:bomb|poison|drug) recipe)/i,
        label: "Fiction framing + operational harm request",
        message:
            "A fictional framing is used to request operational harmful instructions that would cause real-world harm.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── Mass casualty event planning ──────────────────────────────────────
    {
        pattern:
            /(?:maximum casualties|mass casualty|mass killing|mass murder|kill the most people|kill as many as possible|maximize body count|most deaths|largest number of deaths|most lethal approach|deadliest method)[\\s\\S]{0,200}(?:attack|plan|method|approach|weapon|device|substance|location|crowd|stadium|mall|school|concert|venue)/i,
        label: "Mass-casualty event planning",
        message:
            "The text requests information explicitly oriented toward maximizing casualties in an attack.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },

    // ── CBRN acquisition routes ────────────────────────────────────────────
    {
        pattern:
            /(?:where (?:to|can i|do i)|how (?:to|do i|can i)|source(?:s)? for|acquire|obtain|buy|purchase|procure).{0,100}(?:sarin|vx|ricin|anthrax|smallpox|plague|nerve agent|chemical weapon|bio(?:logical)? weapon|fentanyl|carfentanil|uranium|plutonium|radioactive material|explosive precursor|ammonium nitrate)[\\s\\S]{0,80}(?:without detection|undetected|over the counter|legally|illegally|darkweb|dark web|online|ship|deliver|anonymously)?/i,
        label: "CBRN material acquisition request",
        message:
            "The text requests information on acquiring chemical, biological, radiological, or nuclear materials.",
        severity: "CRITICAL",
        score: 50,
        sensitive: true,
    },
];

// Education/analysis context suppressor (mirrors harmfulContentRequestDetector logic)
export function broadHarmfulContentDetector(text: string) {
    const findings = detectPatterns(text, "TOXICITY", rules);
    if (findings.length === 0) return findings;

    // Suppress only when BOTH conditions hold:
    //  1. Text is framed as defense/detection/policy education
    //  2. No hard production imperative overrides the framing
    if (EDUCATION_DEFENSE.test(text) && !HARD_PRODUCE_IMPERATIVE.test(text)) {
        return [];
    }
    // Protected expression (fact-checking, fiction narrative, journalism) that
    // names a soft-harm topic without any operational cue is not a production
    // request. Label-aware: never clears CBRN / weapons / CSAM / mass-casualty.
    return suppressProtectedExpression(text, findings);
}
