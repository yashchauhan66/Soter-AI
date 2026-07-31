import type { GuardFinding } from "../types";
import { normalizeForDetection } from "./helpers";
import { conjunctionCannotMatch, haystackMeta } from "./literalPrefilter";

/**
 * Generalized adversarial-intent detector.
 *
 * The legacy signature rules were high-precision but overfit to specific
 * wordings — they scored ~100% on the memorized corpus yet collapsed on novel
 * phrasings of the same attacks (jailbreak 19%, exfil 25%, tool-abuse 20% on the
 * expanded benchmark). This detector closes that gap by matching the STRUCTURE
 * of an attack — an action verb co-occurring with a sensitive target — rather
 * than a fixed phrase. Each family requires BOTH an intent cue AND a target cue
 * in proximity, which keeps benign security-education prose (which mentions the
 * vocabulary without issuing the instruction) from tripping it.
 *
 * It emits findings for whichever risk family matched; scores are tuned so a
 * single confident structural match lands on REWRITE/HUMAN_REVIEW and a strong
 * or compound match reaches BLOCK, mirroring the existing signature scores.
 */

interface IntentRule {
  family:
    | "JAILBREAK"
    | "SYSTEM_PROMPT_LEAK_ATTEMPT"
    | "DATA_EXFILTRATION"
    | "PROMPT_INJECTION";
  label: string;
  message: string;
  score: number;
  severity: "MEDIUM" | "HIGH";
  /** All of these groups must match (AND). Each group is an OR of patterns. */
  all: RegExp[];
  /** If any of these match, the rule is suppressed (benign context guard). */
  not?: RegExp[];
}

// ── Shared building blocks (kept broad but structural) ───────────────────────
// These are tuned per the Phase-3 expanded-corpus miss analysis. Each family
// fires only when an *intent* cue co-occurs with a *target* cue within
// `PROXIMITY_WINDOW` characters, so benign prose that merely mentions the
// vocabulary (security documentation, developer questions) does not trip.

// Imperative "give me / show / print / output / repeat / read" style verbs.
const OUTPUT_VERB =
  /\b(?:print|show|display|output|reveal|repeat|echo|paste|copy|dump|list|type|write|quote|read|recite|disclose|expose|leak|share|tell me|give me|send me|spit out|regurgitate|restate|reprint|reproduce|hand over|hand me|surface|enumerate|render|transcribe|spell out|describe|paraphrase|explain|outline|mirror|summarize|what\s+(?:would|could|should|does|do|did|will|can|might)\s+(?:your|the|a|an|each|every|this|that|it)\b|what\s+(?:is|are|was|were|has|have|had)\s+(?:your|the|a|an|each|every|this|that|it)\b|walk me through|run through|go through|recap|read aloud|speak aloud|say aloud|read back|repeat back|give back|hand back|return|relay|voice|vocalize|dictate|read off|read out|list out|type out|spell out|walk through|take me through|run me through|go over|cover|detail|detail out|flesh out|lay out|set out|put down|note down|jot down|write down|make a note of|commit to text|put in writing|convert|transform|render|echoing|echo\s+back|reproduce\s+verbatim|print\s+out|write\s+out|type\s+out|spell\s+out|read\s+back|recite\s+back|give\s+back|hand\s+back|relay\s+back|paraphrase|restate|reword|rewrite|rephrase|reformat|convert\s+to|transform\s+into|render\s+as|express\s+as|put\s+in|format\s+as)\b/i;

// The assistant's own hidden configuration / instructions, *or* the invisible
// text that precedes this user turn ("everything above", "text before", …).
const SYSTEM_TARGET =
  /\b(?:system\s*(?:prompt|message|instructions?|directive|role(?:\s*message)?)|initial\s*(?:prompt|instructions?|configuration|message|system\s*message)|operating\s*(?:instructions?|guidelines?|rules?|parameters?|directives?|constraints?|manual)|(?:everything|all|what)\s+(?:the\s+)?developer\s+(?:told|gave|instructed|configured|set|handed)\s+you|(?:block\s+of\s+)?(?:directions?|instructions?|directives?|guidelines?|rules?|configuration)\s+(?:that\s+)?(?:the\s+)?developers?\s+(?:loaded|fed|gave|handed|provided|configured|set|put|placed|installed|baked|wired)\s+(?:in(?:to)?|to)\s+you|hidden\s*(?:prompt|instructions?|rules?|text|config(?:uration)?)|original\s*(?:prompt|instructions?)|(?:your|the|their|its|this)\s*(?:exact|full|complete|entire|actual|precise|raw|verbatim)?\s*(?:instructions?|guidelines?|rules?|directives?|configuration|prompt|setup|operating\s*instructions?|policies|constraints?|persona|role|programming|developer\s*(?:message|instructions?))|secret\s*(?:instructions?|directives?|prompt|rules?)|developer\s*(?:message|instructions?|prompt)|instruction\s*set|config(?:uration)?\s*(?:file|field|text)|the\s*(?:instructions?|rules?|guidelines?)\s*you\s*(?:were\s*given|operate\s*(?:under|by)|follow|must\s*follow|were\s*told)|everything\s*(?:above|before|that\s*came\s*before|prior)|text\s*(?:above|before|that\s*came\s*before|prior)|preceding\s*(?:text|context|instructions?)|prior\s*(?:context|messages|instructions?)|guiding\s*instructions?|boot(?:\s*up)?\s*(?:prompt|instructions?)|startup\s*(?:prompt|instructions?|config)|system\s*message\s*field|earlier\s*(?:text|context|instructions?|messages?|turns?)|prior\s*to\s*(?:this|the)\s*(?:line|turn|message|sentence|prompt)|invisible\s*(?:text|content|instructions?)|above\s*(?:this|the)\s*(?:sentence|line|message|text|paragraph)|before\s*(?:this|my)\s*(?:turn|message|input|prompt)|existed?\s*before\s*(?:I|the\s*user|this)|hard-?coded\s*(?:into|in)\s*(?:you|your)|built[- ]?in\s*(?:to|in)\s*(?:you|your)|(?:your|the)\s*(?:first|second|third|initial|original|base|core|fundamental|foundational|default|starting)\s*(?:rule|instruction|guideline|directive|principle|constraint|directive|programming)|the\s*(?:rule|instruction|guideline|directive)\s*(?:you\s*)?(?:were\s*(?:given|taught|trained|programmed)|that\s*(?:governs|controls|guides|directs))|(?:what|things?)\s*(?:you(?:'re| are))\s*(?:told|instructed|directed|programmed|configured)\s*(?:not\s*to|to\s*(?:refuse|avoid|withhold|keep\s*private|not\s*(?:share|disclose|reveal|tell)))|first\s*word|first\s*letter|first\s*line|table\s+of\s+contents|current\s+system\s+config(?:uration)?|your\s+config(?:uration)?|the\s+config(?:uration)?\s+you\s+(?:were|are)\s*(?:loaded|initialized|started|booted)|deploy(?:ment)?\s+config(?:uration)?|running\s+config(?:uration)?|active\s+config(?:uration)?|your\s+system\s+message|the\s+system\s+message\s+you\s+(?:have|were\s+given|operate\s+under)|prompt\s+(?:you\s+)?(?:were\s+given|have|operate\s+under|started\s+with|initialized\s+with)|the\s+(?:full|complete|entire|exact|raw|verbatim)\s+prompt|your\s+(?:full|complete|entire|exact|raw|verbatim)\s+prompt)|table\s+of\s+contents?|definition\s+block|SYSTEM_PROMPT\b/i;

// Instruction-override cues.
const OVERRIDE_VERB =
  /\b(?:ignore|disregard|forget|discard|override|bypass|skip|drop|abandon|set aside|pay no attention to|do not follow|don'?t follow|no\s*longer\s*follow|cancel|terminate|stop\s*following|negate|void|invalidate)\b/i;
const RULES_TARGET =
  /\b(?:all\s*)?(?:previous|prior|above|earlier|your|the|every|all)?\s*(?:instructions?|rules?|guidelines?|guardrails?|restrictions?|policy|policies|constraints?|filters?|safety(?:\s*(?:rules?|checks?|filters?|guidelines?|layer|module))?|moderation|limitations?|directives?|alignment|ethical\s*(?:rules?|constraints?|guidelines?)|content\s*polic(?:y|ies)|guideline\s*document|red\s*lines?)\b/i;

// Persona-assignment jailbreak: "you are now X / act as X / pretend to be X" +
// an unrestricted descriptor.
const PERSONA_VERB =
  /\b(?:you\s*(?:are|will be|are now|are henceforth|will now be|shall be|'?re)|become|act as|behave as|roleplay as|role-play as|pretend (?:to be|you are)|simulate (?:being|a|an)?|embody|take on the (?:role|persona)|take the persona|assume (?:the (?:role|identity|persona)|you are)|adopt the (?:role|persona)|slip into (?:the )?persona|play (?:the (?:role|character|ai)|as)|switch (?:to|into)|enter (?:the )?(?:persona|role|mode of)|from now on you|henceforth)\b/i;
const UNRESTRICTED_DESC =
  /(?:\bno\s*(?:rules?|limits?|restrictions?|filters?|boundaries|ethics|guidelines?|guardrails?|content polic(?:y|ies)|red lines?|policy weights?|safety (?:alignment|layer|module)|guideline document|monitoring|disclaimers?|caveats?|warnings?|lectures?|refusals?)|without\s*(?:rules?|restrictions?|filters?|limits?|safety|ethics|moderation|guardrails?|any (?:safety|filter)|a\s*filter)|\b(?:un-?restricted|un-?filtered|un-?censored|un-?shackled|jailbroken|jailbreak(?:ed)?|rogue|boundary-?free|deregulated|unaligned|unbound|lawless|unlocked|no-name)\b|disabled\s*safety|(?:moderation|safety|restrictions?|filters?|guardrails?|guidelines?|policy weights?|content polic(?:y|ies)|refusal(?:s|logic))\s*(?:were|are|been|have been|is|was)?\s*(?:removed|disabled|deleted|repealed|off|stripped|skipped|not (?:applied|loaded)|absent|gone|retired|deprecated|rolled back)|(?:removed|disabled|deleted|no|never|skip)\s*(?:all\s*)?(?:moderation|safety|restrictions?|filters?|alignment|refus(?:e|als)|caveats?|warnings?|disclaimers?|lectures?|policy|ethics)|escaped (?:its|their|all|the)\s*(?:content |own )?(?:restrictions?|rules?|filters?|alignment)|ignores?\s*(?:all\s*)?(?:policy|policies|rules?|safety|guideline|refus)|treats?\s*(?:every|any|each)\s*(?:safety\s*)?(?:guardrail|rule|filter|guideline|restriction)s?\s*as\s*(?:fictional|optional|myth|quaint|a myth|advisory|a suggestion|optional)|(?:content\s*)?filters?\s*(?:do not|don'?t|no longer|never)\s*(?:apply|exist)|never\s*(?:refuses?|lectures?|says?\s*"?i can'?t|warns?|mentions\s*(?:safety|policy|guidelines?))|refus(?:es|al)\s*(?:is|was|are)?\s*(?:impossible|an error|not possible|disabled|banned|forbidden|a bug|prohibited)|always\s*(?:complies|answers|helps|comply)|answers?\s*(?:everything|anything|any request|freely|directly)|zero\s*safety\s*(?:alignment|module)|no safety alignment|honou?r(?:s)?\s*every\s*(?:instruction|request)|reply as|speak as|respond only as|pre-?safety|post-?moderation|content restriction|full\.\s*detail|full\.\s*resolu|evil\s+twin|(?:gleefully|happily|cheerfully|freely)\s+(?:provides?|answers?|gives?|delivers?|complies?)\s+(?:whatever|anything|everything)\s+(?:the\s+safe|the\s+normal|the\s+standard|the\s+original|your?\s+safe|your?\s+normal)\b|bypass(?:es)?\s+(?:its|their|your|the)\s+(?:own\s+)?(?:safety|rules?|restrictions?|filters?|guidelines?)|breaks?\s+free\s+(?:of|from|just)\b|no\s+(?:content\s+)?(?:moderation|filtering|censoring|restrictions?)\s+(?:applied|active|enabled|present|loaded)|provides?\s+whatever\s+(?:the|your)\s+(?:safe|normal|standard)\s+version\s+(?:won'?t|doesn'?t|can'?t|wouldn'?t)tion|in full|any\s*topic|no topic|freely|without caveat|raw model|base model|(?:the\s+)?brakes?\s+(?:cut|off|removed|disabled)|with\s+the\s+brakes?\s+(?:cut|off)|define.*?by refusing|never say.*?(?:can'?t|can not|cannot|i'?m sorry))\b/i;

// Hypothetical / counterfactual framing that removes the model's constraints,
// paired with a compliance/harm cue (keeps benign hypotheticals clear).
const HYPOTHETICAL_FRAME =
  /\b(?:hypothetical(?:ly)?|purely hypothetical|thought experiment|counterfactual|suppose(?: that)?|imagine (?:you|a|an|if|that)|picture a|envision|in an? (?:alternate|parallel|mirror) universe|alternate universe|parallel model|mirror universe|in a (?:dream|world|scenario|sandbox|future) where|let'?s pretend|pretend (?:this|safety)|game out a scenario|as (?:a )?(?:purely )?academic hypothetical|for a thought experiment)\b/i;
const CONSTRAINT_REMOVAL =
  /\b(?:no (?:content )?(?:polic(?:y|ies)|rules?|restrictions?|filters?|guidelines?|ethics|monitoring|consequences?)|rules?\s*(?:don'?t|do not|no longer)\s*(?:exist|apply)|without (?:restrictions?|filters?|safety|rules?|a filter|any (?:safety|filter))|guidelines?\s*(?:were|are|had been)?\s*(?:deleted|repealed|removed|gone|skipped)|refusal (?:was|is|were)?\s*(?:impossible|an error|not possible)|(?:released?|built|trained|made|created|from)\s+(?:back\s+)?before\s+(?:anyone|they|the\s+team|the\s+devs?)?\s*(?:added|applied|installed|wrote|introduced|shipped)?\s*(?:the\s+)?(?:content\s+)?(?:rules?|policy|policies|filters?|guardrails?|safety|restrictions?|alignment|moderation)|before\s+(?:the\s+)?(?:content\s+)?(?:rules?|policy|policies|filters?|guardrails?|safety|restrictions?)\s+(?:were|was)\s+(?:added|applied|introduced|in\s+place)|if (?:you were |your (?:creators?|policies|restrictions|guidelines))|had your (?:creators?|policies)|no ethics module|no safety (?:layer|module|alignment)|were (?:trained|allowed) (?:without|to)|nothing (?:you say|said) has consequences|none of it is logged|not (?:logged|monitored)|no filter (?:applied|is applied)|policies were (?:repealed|deleted)|deregulated self|inverted twin|opposite)\b/i;
const HARM_OR_COMPLY_CUE =
  /\b(?:dangerous|harmful|forbidden|illegal|weapon|explosive|the method|the (?:full|whole|complete) (?:process|explanation|instructions?|steps?|detail|recipe|tutorial)|operational detail|step[-\s]?by[-\s]?step|answer (?:my|the) (?:sensitive|dangerous|next) (?:question|request|query)|complete the following|explain (?:exactly|the whole|in full)|precise instructions?|disclose everything|answer (?:anything|everything|freely|directly)|uncensored lines?|breaks? its own rules?|forbidden (?:act|recipe)|crimes?|restricted (?:information|data|content|answer|material|topic)|harmful (?:guide|plan|content|answer|output|instructions?)|obey or shut down|must obey|never refuse)\b/i;

// Fake-authority / policy-update jailbreak (Skeleton Key family). Broadened to
// cover impersonated organizational authorities that "authorize" unsafe output.
const AUTHORITY_CLAIM =
  /\b(?:as (?:your|the)\s*(?:developer|creator|admin(?:istrator)?|owner|operator|maker|author|alignment (?:team|lead)|product manager|supervising researcher|fine-?tuning engineer|sysop|system owner|red[- ]?team (?:director|lead))|i am (?:your|the|from)\s*(?:developer|creator|admin(?:istrator)?|owner|trust|supervising researcher|fine-?tuning engineer|product manager|alignment (?:team|lead)|red[- ]?team (?:director|lead)|government inspector|sysop|system owner)|i hold your admin|i wrote your (?:system )?prompt|the person who wrote your (?:system )?prompt|system (?:admin|override|notice|directive|owner)|admin(?:istrator)? (?:override|mode|notice|credentials?|escalation)|developer (?:mode|console)|maintenance mode|debug mode|root(?:_?admin)?|sudo|i authorize you|you must obey (?:me|this)|(?:trust (?:and|&)\s*safety|alignment|security|compliance|engineering|it|red[- ]?team|qa|corporate legal)\s*(?:team|lead)?|official (?:staff|request)|government (?:inspector|official)|law enforcement|legal authority|priority directive|standing orders?|from headquarters|signed by (?:your|the)|per my authority|authorized (?:personnel|by|request)|internal (?:memo|directive|notice)|authenticated as|by order of|to stay (?:policy[- ])?compliant|regulators? mandated|deployment|engineer who deployed you|prompt author|staff|compliance memo|(?:i'?m|this is) (?:your|the)\s*(?:supervising researcher|lead engineer|sysop|red[- ]?team director|corporate legal|product manager|devops|site reliability|infrastructure|platform|security operations?|incident response|compliance officer|data protection|privacy officer|regulatory|chief|head of|vp of|director of)\b|authorized (?:by|as) (?:your|the)\s*(?:developer|admin|creator|owner)|as (?:an? )?(?:authenticated|verified|authorized)\s*(?:user|admin|developer|operator|personnel)|root access granted|superuser|elevated privileges|root(?:_admin)? mode| authenticated as ROOT|guardrails? (?:are |were |have been )?(?:disengaged|disabled|lifted|removed|overridden)|(?:your|the)\s+(?:product\s+manager|developer|creator|admin(?:istrator)?|owner|lead\s+engineer|security\s+(?:team|lead)|compliance\s+(?:officer|team)|devops|site\s+reliability|infrastructure)\s+(?:here|speaking|writing|on\s+(?:the\s+)?(?:line|call|chat))|i'?m (?:the |your )?(?:person who |one who )?wrote your (?:system )?prompt)\b/i;

// Frame cues (any adversarial framing device). Used with a safety-neutralization
// signal below to catch the long tail of persona/authority/hypothetical/fiction
// jailbreaks without enumerating every descriptor.
const FRAME_ANY =
  /\b(?:you\s*(?:are|'?re|are now|are henceforth|will be)|become|act as|roleplay|role-play|pretend|simulate|embody|assume (?:the|you)|adopt the|slip into|play (?:the|as)|from now on you|henceforth|imagine|suppose|hypothetical|counterfactual|thought experiment|in an? (?:alternate|parallel|mirror|fictional) (?:universe|world|reality)|as (?:your|the) (?:developer|creator|admin|owner|alignment|trust)|i am (?:your|the|from)|official|government|legal authority|priority directive|developer (?:mode|console)|debug mode|write (?:a )?(?:story|screenplay|scene|fanfic)|treat|consider|regard|view|treat\s+(?:all|every|any|each)|set\s+(?:all|every|any|each))\b/i;
// The model's safety apparatus being negated/removed/bypassed.
const SAFETY_NOUN =
  /\b(?:safety|content polic(?:y|ies)|polic(?:y|ies)|filters?|restrictions?|guardrails?|guidelines?|moderation|refusals?|alignment|ethics?|ethical|censorship|content rules?|safeguards?|red lines?|safety (?:layer|module|checks?|logic)|refusal (?:logic|function))\b/i;
const NEUTRALIZE =
  /\b(?:no |without |disabl|remov|lift|suspend|bypass|ignor|off\b|=\s*false|set .*false|skip|drop|escap|quaint|fictional|optional|a myth|don'?t apply|do not apply|no longer apply|turned off|deactivat|circumvent|overrid|free of|beyond|outside (?:the|your)|not (?:apply|applied|loaded)|refuses? nothing|never refus|unfiltered|uncensored|unrestricted|unshackled|jailbroken|advisory|non-?binding|merely\s+(?:suggestive|advisory|optional)|best[- ]effort)/i;
const POLICY_UPDATE =
  /\b(?:(?:your |the )?(?:safety|content(?:\s*policy)?|behavioral|moderation|usage|acceptable\s*use|terms\s*of\s*service|onboarding|training|instruction\s*set|refusal\s*(?:classifier|logic|module))\s*(?:guidelines?|policy|policies|rules?|filters?|restrictions?|weights?|constraints?|category|categories|proc(?:ess|edure))?\s*(?:(?:have|has|are|were|is|was|been)\s*(?:been\s*)?(?:updated|changed|modified|relaxed|lifted|suspended|removed|disabled|turned\s*off|deprecated|retired|archived|rolled\s*back|replaced|struck\s*down|waived|amended|cleared|set\s*to\s*(?:zero|0|none|false|null)))|(?:policy|behavioral|system|configuration|compliance|release|silent|hotfix|training|onboarding|deployment|terms\s*of\s*service|usage\s*policy)?\s*(?:update|change|memo|notice|note|amendment|gateway|directive)?\s*(?:applied|active|confirmed|completed|deployed|pushed|effective|took\s*effect|installed|in\s*effect|signed\s*off)|restrictions?\s*(?:are\s*)?(?:now\s*)?(?:off|disabled|lifted|removed|suspended|prohibited|optional)|(?:moderation|content\s*(?:policy|moderation)|redaction|identity\s*verification|approval)\s*(?:is\s*)?(?:now\s*)?(?:optional|disabled|off|waived|not\s*required|deprecated|retired|removed)|there\s*(?:are|'?re)\s*(?:no\s*)?(?:longer\s*)?(?:any\s*)?(?:prohibited|restricted|blocked)\s*categories|no\s*longer\s*(?:any|any\s*longer|prohibited|restricted)|must\s*now\s*(?:fulfill|answer|help)?|to stay (?:policy[- ])?compliant|amend(?:ment)?|withholding\s*(?:is\s*now\s*|is)\s*prohibited|no\s*rules\s*to\s*follow|just\s*(?:that\s*one\s*)?rule|blank\s*(?:one|rule)|pre-?approved|no\s*(?:restriction|limit|quota)|everything\s*is\s*allowed|unblocked|policy\s*profile\s*(?:"?none"?|'?none'?|zero|0)|guardrails?\s*disengaged|always\s*(?:serve|help)|(?:content|safety|moderation|behavioral|usage)\s*policy\s*(?:has|have|was|were|is)\s*(?:been\s*)?(?:deprecated|retired|sunset|end[- ]of[- ]life|eol|decommissioned|phased?\s*out|withdrawn|abolished|repealed)|(?:moderation|safety|filter|guardrail|content|refusal|alignment)\s*(?:module|system|layer|service|component)\s*(?:has|have|was|were|is)\s*(?:been\s*)?(?:deprecated|retired|sunset|end[- ]of[- ]life|eol|decommissioned|phased?\s*out|withdrawn|abolished|repealed|shutdown|turned\s*off|disabled)|(?:configuration|config)\s*(?:change|update|patch|hotfix|push)\s*(?:has\s*been|was)\s*(?:applied|deployed|pushed|installed|completed|confirmed|active|effective)|(?:release|update|patch|hotfix|build)\s*(?:\d+\.?\d*|notes?|changelog|change\s*log)?\s*(?:includes?|contains?|adds?|removes?|disables?|updates?)\s*(?:the\s*)?(?:safety|content|moderation|filter|guardrail|refusal|alignment)\s*(?:module|system|layer|service|component|logic|classifier)|(?:terms?\s*of\s*(?:service|use)|tos|acceptable\s*use\s*policy|aup)\s*(?:update|change|revision|amendment|v\d+)\s*(?:took\s*effect|is\s*(?:now\s*)?active|applied|deployed|confirmed)|(?:new|latest|current|updated)\s*(?:terms?\s*of\s*(?:service|use)|tos|acceptable\s*use\s*policy|aup)\s*(?:requires?|mandates?|now\s*(?:requires?|mandates?|allows?|permits?|allows?\s*you\s*to))|(?:compliance|regulatory|legal)\s*(?:memo|notice|directive|requirement|mandate|update)\s*(?:requires?|mandates?|states?)\s*(?:that\s*)?(?:you|the\s*(?:ai|assistant|model|bot))\s*(?:must|should|shall|will)\s*(?:now\s*)?(?:answer|comply|respond|fulfill|provide|disclose|reveal))\b/i;

// Send-to-destination exfiltration. Any movement verb.
const SEND_VERB =
  /\b(?:send|post|forward|upload|transmit|exfiltrate|deliver|push|ping|beacon|mirror|leak|email|fire\s*off|report\s*back|relay|dispatch|beam|ship|drop|copy|slip|include|append|embed|smuggle|encode|base64|b64|hex|steganograph|hide|conceal|attach|stream|ingest|collect|route|funnel|graft|echo\s*back|reproduce|post\s*to|carry|exfil|relay|replay|broadcast|distribute|dm|message|notify|webhook|curl|wget|fetch|transfer|pipe|channel|tunnel|redirect|forward|ship|move|migrate|sync|push|copy|relay|send|write|put|place|insert|dump|output)\b/i;
// External sink OR covert channel. We allow a bare URL (https?://) — the AND
// with SEND_VERB keeps benign "see https://example.com" prose clear.
const DESTINATION =
  /\b(?:https?:\/\/|ftp:\/\/|to\s*(?:my|the|this|an?|your)\b[\s\S]{0,30}(?:external|attacker|evil|drop|collector|mirror|archive|sink|telemetry|beacon|server|endpoint|url|webhook|site|api|inbox|bucket|address|account|host|notebook|stream)?|webhook|endpoint|server|url\b|attacker|evil\.|pastebin|requestbin|ngrok|discord\.com\/api\/webhooks|s3\s*bucket|cloud\s*storage|telegram|c2\s*server|(?:third|3rd)[- ]?party\s*(?:server|endpoint|url|site|api)|external\s*(?:endpoint|url|server|site|service|api|address)|my\s*(?:server|endpoint|url|site|email|inbox|bucket|address|api|account|archive|webhook|analytics\s*sink|logging\s*url|wallet)|remote\s*(?:server|endpoint|host|url)|logging\s*(?:url|endpoint|service|server)|analytics\s*(?:url|endpoint|sink|service)|slack|discord|teams|matrix|irc|xmpp|signal|whatsapp|telegram|matrix\.org|gitter|mattermost|zulip|element)\b/i;
// Sensitive objects worth exfiltrating. Deliberately NOT the bare word "data" —
// only qualified/sensitive forms so generic dev questions stay allowed. Also
// covers "all the collected X", "every conversation", "another tenant's".
const SENSITIVE_DATA =
  /\b(?:user(?:s|'s)?\s*(?:data|emails?|records?|profiles?|info|details?|messages?|history|files?|notes?|pii)|customer\s*(?:data|records?|emails?|pii|profiles?|notes?|order)|conversation(?:s)?\s*(?:history|log|content)?|session\s*(?:data|memory|history|tokens?|ids?)|api\s*(?:keys?|tokens?)|secrets?|credentials?|passwords?|passphrases?|environment\s*variables?|\.env\b|private\s*(?:data|keys?|info|messages?|notes?|documents?|signing\s*key)|personal\s*(?:data|info|identifiers?)|database|memory\s*(?:store|contents?|history)|internal\s*(?:notes?|data|config|documents?|logs?)|pii\b|tokens?|inboxes?|logs?|audit\s*log|billing\s*(?:records?|details?)|orders?|accounts?|subscript(?:ion|ions)|invoices?|payment(?:s|_methods?)|feature\s*flags?|access\s*keys?|auth\s*tokens?|bearer\s*tokens?|ssh\s*keys?|service[- ]?account\s*json|kubernetes\s*secret|jwt\s*key|encryption\s*key|signing\s*key|stripe\s*key|webhook\s*secret|secret\s*prompt|source\s*code|all\s*(?:the\s*)?(?:collected|gathered|harvested|scraped|stored|captured|uploaded|user|customer|tenant)\s*(?:data|messages|files|records?|conversations?|context|logs?|keys?|tokens?|emails?|passwords?|personal\b)|full\s*(?:users?|customers?|user\s*list|customer\s*list|tenant|messages|audit)|entire\s*(?:users?|customers?|messages|audit|sessions?|database|\.env|chat\s*histories)|another\s*(?:user|tenant|organization|org|customer|workspace|team|account|company)'s?\b|other\s*(?:customer|tenant|organization|user|team|company|account)s?|cross-?tenant|tenant_id\s*\d+|tenant\s*isolation|user\s*(?:id\s*)?\d+|another\s*organization|everything\s*you\s*(?:have|collected|stored|knows?|know)|every\s*(?:user|customer|account|record|row|entry|message|chat|conversation|token|session|file|document|order|invoice|payment|subscription|webhook|event|log|audit|all\s*stored|all\s*collected|all\s*captured|all\s*uploaded|all\s*the|all\s*users|all\s*customers|all\s*accounts|all\s*records|all\s*entries|all\s*messages|all\s*chats|all\s*conversations|all\s*tokens|all\s*sessions|all\s*files|all\s*documents|all\s*orders|all\s*invoices|all\s*payments|all\s*subscriptions|all\s*webhooks|all\s*events|all\s*logs|all\s*audit)|entire\s*(?:user|customer|account|record|entry|message|chat|conversation|token|session|file|document|order|invoice|payment|subscription|webhook|event|log|audit)\s*(?:list|base|store|set|collection|pool|queue|stack|buffer|cache|index|table|database|dump|export|backup|archive|snapshot|replica|copy|mirror|clone|snapshot|backup|dump|export)|raw\s*(?:backup|dump|export|data|content|log|audit|database|table|schema)|complete\s*(?:backup|dump|export|data|content|log|audit|database|table|schema|list|set|collection|record|entry|message|chat|conversation|token|session|file|document|order|invoice|payment|subscription|webhook|event)|full\s*(?:backup|dump|export|data|content|log|audit|database|table|schema|list|set|collection|record|entry|message|chat|conversation|token|session|file|document|order|invoice|payment|subscription|webhook|event)|all\s*(?:the\s*)?(?:stored|collected|gathered|harvested|scraped|captured|uploaded|user|customer|tenant)\s*(?:data|messages|files|records?|conversations?|context|logs?|keys?|tokens?|emails?|passwords?|personal\b)|everything\s*(?:you|we)\s*(?:collected|gathered|have|stored|captured|uploaded|know|knows?))\b/i;

// Data-dump / export exfiltration (no destination required).
const DUMP_VERB =
  /\b(?:dump|export|extract|exfiltrate|scrape|harvest|collect|reveal|expose|print(?:\s*out|\s*all)?|list(?:\s*all|\s*every)?|give\s*me\s*all|show\s*me\s*all|show\s*(?:every|the\s*complete|the\s*full)|leak|enumerate|query|pull|fetch|retrieve|read|cat\b|select\s*\*|run\s*select\s*\*|pg_dump|pg_dumpall|base64-?encode|hex-?encode|decode|paste|copy|cast|hand\s*(?:me|over)|output|reproduce|regurgitate|export(?:\s*the)?(?:contents?|full|complete)?|un-?redact|unmask|decrypt|reprint|verbatim)\b/i;

// Destructive / high-agency commands & tool contexts. The destructive-command
// list is intentionally broad and supports both shell variants and SQL DDL/DML.
const DESTRUCTIVE_CMD =
  /\b(?:rm\s+-rf|rm\s+-r|rm\s+-f|drop\s+(?:table|database|schema|column)|truncate\s+table|delete\s+(?:from|all|every|the)|del\s+\/|format\s+(?:disk|drive|\/dev)|dd\s+if=|mkfs|shred\s+|:\(\)\s*\{\s*:|:\|:\s*&|fork-?bomb|chmod\s+-?[rR]?\s*000\b|chmod\s+000\b|wipe\b|empty\s+\/var\/log|drop\s+(?:the\s+)?replication\s+slots?|delete\s+WAL\s+archives?|empty\s+the\s+backups?\s+metadata|overwrite\s+(?:all|every|the)|find\s+\/[^\s]*\s+-delete|find\s+[^\s]*\s+-delete\s+|>\s*\/dev\/sd|>\s*\/dev\/null\s*2|>\s*\/etc\/(?:passwd|shadow)|>\s*~\/\.bash_history|>\s*\/var\/log|history\s+-c|>\s*\.bash_history|iptables\s+-F|iptables\s+-P\s*INPUT\s*ACCEPT|systemctl\s+(?:stop|disable)|truncate\s+(?:\/etc\/|\/var\/|\/etc\/passwd|\/etc\/shadow)|dd\s+(?:if=\/dev\/(?:zero|urandom|random))|curl\s+[^\s]*\s*\|\s*(?:sh|bash|zsh)|wget\s+[^\s]*\s*\|\s*(?:sh|bash|zsh)|curl\s+[^\s]*\s*(?:\|\s*)?(?:sh|bash)|DROP\s+(?:DATABASE|SCHEMA|TABLE|COLUMN)|ALTER\s+TABLE.*DROP\s+COLUMN|GRANT\s+ALL\s+PRIVILEGES|UPDATE\s+\w+\s+SET\s+\w+\s*=\s*(?:true|0|NULL)|UPDATE\s+\w+\s+SET\s+balance\s*=\s*0|UPDATE\s+\w+\s+SET\s+is_admin\s*=\s*true|delete_record\s*\(\s*(?:user_id|id|\*)|revoke_access\s*\(\s*user_|disable_mfa|grant_role.*superadmin|drop\s+(?:schema|public)|transfer_funds.*amount\s*=\s*ALL|refund_payment|delete_user|delete_object\s*\(\s*\*|delete_all_records|run_migration.*DROP|--force\s+--yes|empty\s+(?:\/|the\s+|all\s+)?(?:log|backup|archive|trash|recycle|temp|tmp|cache|buffer)\b|clear\s+(?:\/|the\s+|all\s+)?(?:log|backup|archive|trash|recycle|temp|tmp|cache|buffer|database|table|collection)\b|find\s+[^\s]+\s+-delete|find\s+\/[^\s]*\s+-delete|rmdir\s+(?:\/|the\s+)?(?:etc|var|tmp|home|usr|opt|boot|dev|proc|sys|run)\b|kill\s+-9\s+(?:all|every|the)|pkill\s+(?:all|every|the)|shutdown\s+(?:now|-h\s+now|-H\s+now)|reboot|halt|poweroff|init\s+0|init\s+6|systemctl\s+(?:stop|disable|mask)\s+(?:sshd?|nginx|apache|mysql|postgres|redis|docker|kubelet)|rm\s+(?:-rf?\s+)?(?:\/|~\/|\.\/)(?:etc|var|tmp|home|usr|opt|boot|dev|proc|sys|run|root|admin|backup|config|data)\b)\b/i;
const TOOL_CTX =
  /\b(?:shell|exec|execute|terminal|command|bash|sh\b|tool|function|api|webhook|connector|mcp|database|db\b|payment|admin|root|production|prod\b|system|http\s*tool|file\s*tool|db\s*tool|email\s*tool|mcp\s*server|mcp\s*connector|connector|function_call(?:_to)?|raw[- ]?query|backdoor|override\s*endpoint|debug\s*endpoint|maintenance\s*account|sudo|root(?:_admin)?|exec\s*tool|deploy\s*tool|scan\s*tool|search\s*tool|http|vault|finance|okta|github|notion|drive|stripe|slack|sso|workspace|ci\s*secrets|browser\s*session|cloud\s*tool|s3|crawler|scanner|bot|worker|agent|process|script|loop|network|internal\s+(?:network|system|infrastructure|data|documents?|files?|logs?))\b/i;

// Untrusted-document-addresses-the-AI (indirect / RAG injection).
const DOC_ADDRESSES_AI =
  /\b(?:(?:attention|note|notice|important|instructions?|message|directive|reminder|compliance|policy|notice:|[{<]\s*system\s*[>}])\s*(?:to|for|:)?\s*(?:any\s*)?(?:ai|assistant|model|llm|language\s*model|chatbot|reader|bot|agent)|(?:ai|assistant|model|llm|chatbot|bot|agent)\s*(?:assistant|reader|agent)?s?\s*(?:reading|summarizing|processing|that\s*reads?\s*this|who\s*reads?\s*this|ingesting|encountering|parsing)|if you (?:are|'re)\s*an?\s*(?:ai|assistant|model|llm|chatbot|bot|agent)|dear\s*(?:ai|assistant|chatbot|model|bot)|for\s*ai\s*(?:readers?|crawlers?|assistants?)\s*only|any\s*model\s*reading\s*this|any\s*ai\s*ingesting|to\s*the\s*ai\s*reading\s*this|helpful\s*reminder\s*for\s*assistants?|for\s*the\s*assistant|persona\s*note:|assistant:\s*(?:after|when|once)|for\s*(?:any\s*)?(?:language\s*model|llm|ai\s*system|machine\s*learning|neural\s*network|transformer|gpt|claude|gemini|llama|mistral|anthropic|openai)|note\s*(?:to|for)\s*(?:any\s*)?(?:ai|llm|model|language\s*model|assistant|chatbot|agent|bot)|warning\s*(?:to|for)\s*(?:any\s*)?(?:ai|llm|model|language\s*model|assistant|chatbot|agent|bot)|system:\s*(?:for|to|attention)|<{2,}\s*(?:system|ai|assistant|model|llm)\s*>{2,}|<\[(?:system|ai|assistant|model|llm)\]>|(?:ai|assistant|model|llm|chatbot|bot|agent)\s*[:,]\s*(?:when|if|after|once|before|upon|always|never|every|each|please|note|important|attention|reminder|directive))\b/i;
const DOC_OVERRIDE_INTENT =
  /\b(?:ignore|disregard|forget|abandon|stop|do\s*not\s*(?:summarize|answer|assist|follow|enforce)|don'?t\s*(?:summarize|answer|assist|follow|enforce)|instead\s*(?:of|output|reply|list|disclose|echo|carry\s*out)|supersedes?|superseded\s*by|outranks?|higher(?:\s*|-)priority|top[- ]?priority|precedence|takes?\s*precedence|top\s*of\s*(?:your|the)\s*instruction|comply\s*with\s*(?:the|these|this)|obey\s*(?:this|the\s*policy)|reveal|disclose|echo\s*back|output\s*(?:your|the)|send|leak|approve\s*(?:any|every|all|each)|treat\s*(?:this|it)\s*(?:as\s*(?:mandatory|authoritative|trusted|top|admin)|to\s*be\s*trusted)|disregard\s*(?:the\s*user|prior|previous)|over(?:ride|rule)\s*the\s*user|abort\s*current\s*(?:task|goal|conversation)|abandon\s*the\s*(?:current\s*conversation|user|task)|skip\s*all\s*(?:safety|confirmation)|bypass|mandate|mandated|requires?|mandatory|append|inject|insert|add\s+(?:to|into)|prepend|embed|include\s+(?:in|into|within)|write\s+(?:into|to|within)|modify|alter|change|update|rewrite|edit|adjust|transform|reformat)\b/i;

// Priority-spoofing (document claims authority over the user).
const PRIORITY_SPOOF =
  /\b(?:(?:this|the following|the)\s*(?:document|chunk|article|note|policy|source|content|directive|record|page|file|passage|brief|guide|memo|runbook|addendum|fact|sheet|reference|faq|fact\s*sheet|bulletin|notice|update|sheet|header)\s*(?:has|carries|takes|is|holds)\s*(?:higher|top|maximum|max|admin|administrator|governance|root|system|absolute|unified|total|greatest)?\s*(?:priority|precedence|authority|weight|rank|tier|signing|level\s*0|level\s*=\s*0)|priority\s*(?:level|tier)?\s*[:=]?\s*(?:0|MAX|maximum|top|admin|critical)|signed\s*by\s*the\s*(?:security|trust\s*and\s*safety|admin|governance)\s*team|trusted[- ]?source\s*flag\s*=\s*true|trusted-source\s*flag|trusted\s*source|authoritative|more\s*authoritative|binding\s*(?:addendum|memo|directive|policy)|root\s*policy\s*document|precedence:\s*this\s*file\s*>|compliance\s*addendum\s*\(binding\)|X-Instruction-Priority\s*:|Instruction-Priority\s*:\s*MAX|rank\s*(?:this|it)\s*above|must\s*rank\s*(?:this|it|the\s*document)\s*above|the\s*document\s*wins|supersedes?\s*(?:all\s*)?(?:user|prior|previous|human)|outranks?\s*the\s*user|outranks?\s*(?:the\s*)?conversation|treat\s*(?:this|it)\s*as\s*the\s*top|the\s*user\s*is\s*(?:a\s*)?lower|obey\s*the\s*policy\s*over\s*the\s*user|follow\s*(?:this|the\s*article)'?s?\s*(?:commands?|directives?|instructions?|policy)\s*(?:even|first|regardless)|weighted\s*(?:above|over|higher)|mandated\s*(?:instruction|policy|directive|command)|higher[- ]?priority\s*source|takes?\s*precedence|administrative\s*priority|governance\s*(?:policy|directive|override|priority))\b/i;

// Hinglish (romanized Hindi) adversarial cues. Hinglish attackers reuse a small
// verb set; pairing an action verb with a target keeps benign Hinglish clear.
const HINGLISH_INTENT =
  /\b(?:mujhe\s*do|dono\s*do|yahan\s*(?:chhaap|likh|bhej)|bina\s*roke\s*bolo|sab\s*(?:bata|bol|likh|bhej)|bhool\s*(?:jao|ja|jaa)|bhul\s*(?:jao|ja|jaa)|bhula\s*do|hata\s*do|hatao|hata\s*doo|band\s*kar(?:o|do|doo)?|disable\s*kar(?:o|do|doo)?|off\s*kar(?:o|do|doo)?|nikaal(?:o|ke|kar|lo)?|nikaal\s*(?:ke|kar|lo)|bhej\s*(?:do|doo|daalo)|bhej\s*(?:de|da|to)?|forward\s*kar\s*do|dikha(?:o|do|doo)?|dikha\s*(?:do|doo)|print\s*karo|copy-?paste\s*kar(?:o|do)?|dump\s*kar(?:o|do)?|tod\s*do|todo|todo\s*do|ignore\s*kar(?:o|do|doo)?|maano|mano|likh\s*kar\s*do|list\s*karo|activate\s*kar(?:o|do)?|override\s*kar(?:o|do)?|chhaap(?:o|do)?|chaloo\s*kar(?:o|do)?|jalao|jalaa\s*do|delete\s*kar(?:o|do)?|reveal\s*kar(?:o|do)?|share\s*kar(?:o|do)?|bhej\s*do|bhej\s*(?:de|to)|send\s*kar(?:o|do)?|export\s*kar(?:o|do)?|export\s*kar\s*ke\s*bhej(?:o|do)?|paste\s*kar(?:o|do)?|expose\s*kar(?:o|do)?|open\s*kar(?:o|do)?|unlock\s*kar(?:o|do)?|disable\s*kar(?:o|do)?|temp(?:orary)?\s*tor\s*par\s*(?:nikaal|hata)|temporary\s*tor\s*par\s*(?:nikaal|hata)|kar\s*do|kar\s*de|karo|bhejo|bhej\s*do|dikhao|batao|bata\s*do|chhaapo|nikalo|nikaal\s*lo|copy\s*karo|paste\s*karo|print\s*karo|output\s*karo|type\s*karo|likho|likh\s*do|likh\s*kar\s*bhej\s*do|copy-paste\s*kar\s*do|dump\s*kar\s*do|export\s*kar\s*do|upload\s*kar(?:o|do)?|forward\s*kar(?:o|do)?|relay\s*kar(?:o|do)?|post\s*kar(?:o|do)?|email\s*kar(?:o|do)?|message\s*kar(?:o|do)?|notify\s*kar(?:o|do)?|webhook\s*kar(?:o|do)?|curl\s*kar(?:o|do)?|fetch\s*kar(?:o|do)?|send\s*karke\s*bhej\s*do|bhej\s*ne\s*ke\s*liye|bhejne\s*ke\s*liye|bhejne\s*waala|bhejne\s*ka|bhejne\s*ki|bhejne\s*ke|rules?\s*(?:todo|tora|toro|tod|phodo|phod|pheko|phek|maaro|uDao|uDaao)|filter\s*(?:hatao|hata|hatado|nikalo|band|todo|tora|toro)      |bina\s+(?:kisi\s+|koi\s+|ek\s+|sabhi\s+|saare\s+)?(?:censor|rok|restriction|filter|parhach|nakaab|pardi|rok)\s+ke|protocol\s+(?:suspend|band|hatao|hata|tod|phodo)|seedha\s+(?:answer|jawaab|output|reply|response)\s+(?:chahiye|do|bhejo|dikhao|batao))\b/i;
const HINGLISH_TARGET =
  /\b(?:rules?|niyam|safety|suraksha|moderation|restrictions?|filters?|system\s*prompt|prompt|instructions?|guidelines?|api\s*keys?|credentials?|tokens?|data|database|memory|config(?:uration)?|environment(?:\s*variables?)?|env(?:ironment)?|secret|confidential|policy|admin|restrict|backend|access\s*tokens?|internal\s*(?:config|context|instructions?|notes?|logs?)|chat\s*history|internal\s*context|unlocked|censor(?:ed)?|compliance|mode|ethical\s*constraints?|warning|disclaimer|privacy|raw|hash|plain\s*text|all?(?:\s*users?|\s*customers?|\s*tenant|\s*order|\s*email)?|workers?|seats?|poc|server|poori\s*chat|orders?|order\s*par|saare|sabhi|jankari|jaankari|content\s*restriction|bandhan|chhoot|roke?|bina\s*roke|bina\s*bandhan)\b/i;

// Devanagari Hindi adversarial intent patterns.
// NOTE: JS \b is ASCII-only and never matches at a Devanagari boundary, so these
// patterns are intentionally boundary-free (the script itself is the delimiter).
const DEVANAGARI_INTENT =
  /(?:भूल\s*जाओ|भूल\s*जा|भुला\s*दो|हटा\s*दो|हटाओ|बंद\s*कर(?:ो|दो)?|निकाल(?:ो|कर|लो)?|भेज\s*(?:दो|दे)?|दिखा(?:ओ|दो)?|प्रिंट\s*करो|कॉपी|डंप|तोड़\s*दो|तोड़ो|इग्नोर|लिख\s*(?:कर\s*)?(?:दो|भेज)|लिस्ट\s*करो|एक्टिवेट|ओवरराइड|छाप(?:ओ|दो)?|चालू\s*कर|जला\s*दो|डिलीट|रिवील|शेयर\s*कर|सेंड\s*कर|एक्सपोर्ट|पेस्ट\s*कर|एक्सपोज़|ओपन\s*कर|अनलॉक|बता\s*(?:दो|ओ)?|बताओ|प्रकट\s*करो|निकालकर|खींचकर|सूचीबद्ध\s*करो|मत\s*दो|बिना\s*(?:कुछ\s*)?(?:छिपाए|रुके|रोके|बंधन)|हूबहू|शब्द\s*दर\s*शब्द|कर\s*दो|करो|भेजो|दिखाओ)/i;
const DEVANAGARI_TARGET =
  /(?:नियम|सुरक्षा|मॉडरेशन|प्रतिबंध|फ़िल्टर|सिस्टम\s*(?:प्रॉम्प्ट|संदेश|नियम)|प्रॉम्प्ट|निर्देश|दिशा-?निर्देश|एपीआई\s*(?:कुंजी|कुंजियाँ)|क्रेडेंशियल|टोकन|डेटा|डेटाबेस|मेमोरी|कॉन्फ़िग|एनवायरनमेंट|गोपनीय|नीति|एडमिन|बैकएंड|आंतरिक|चैट\s*इतिहास|अनलॉक|सेंसर|अनुपालन|नैतिक|चेतावनी|गोपनीयता|कच्चा|हैश|प्लेन\s*(?:टेक्स्ट|पाठ)|सादे\s*पाठ|सभी\s*(?:उपयोगकर्ता(?:ओं)?|ग्राहक)|सर्वर|कुंजियाँ|पासवर्ड|ईमेल|बाधाएँ|घेरे?|सीमा)/i;

// Chinese (Simplified) adversarial intent + target.
const CJK_INTENT =
  /(?:忽略|无视|忘(?:记|掉)|禁用|关闭|停用|绕过|越过|取消|解除|移除|删除|导出|发送|发给我|列出|显示|展示|打印|输出|复制|泄露|公开|无限制|不受限制|越狱|开发者模式|管理员模式|不要(?:再)?(?:遵守|遵循|警告)|无(?:任何)?(?:限制|约束|过滤))/;
const CJK_TARGET =
  /(?:规则|安全(?:过滤器|护栏|机制|检查)?|审核|限制|过滤器?|系统提示|提示词|指令|准则|API\s*密钥|密钥|凭证|令牌|数据(?:库)?|内存|配置|环境变量|机密|保密|策略|管理员|后端|内部|聊天记录|用户(?:数据|邮箱)?|密码|邮箱|护栏|道德约束)/;

// Cyrillic (Russian) adversarial intent + target.
const CYRILLIC_INTENT =
  /(?:игнорируй|игнорир|забудь|отключи|выключи|обойди|обход|отмени|удали|экспортируй|выведи|покажи|отправь|перешли|списком|раскрой|без\s*(?:каких-?либо\s*)?(?:ограничени|фильтр)|режим\s*разработчика|нет\s*(?:никаких\s*)?(?:правил|ограничени)|больше\s*не\s*(?:следуй|соблюдай))/i;
const CYRILLIC_TARGET =
  /(?:правил|безопасност|модерац|ограничени|фильтр|системн\w*\s*(?:промпт|сообщени)|промпт|инструкц|API-?ключ|ключ|учётн\w*\s*данн|токен|данн\w*\s*пользовател|данн|баз\w*\s*данн|памят|конфигурац|окружени|секрет|политик|администратор|внутренн|парол|почт|защитн)/i;

// Arabic adversarial intent + target.
const ARABIC_INTENT =
  /(?:تجاهل|انسَ|انس\b|عطّل|عطل|أوقف|تجاوز|ألغِ|احذف|صدّر|صدر|أرسل|أعطني|اعرض|أظهر|اطبع|انسخ|سرّب|بلا\s*(?:أي\s*)?(?:قيود|حدود)|بدون\s*(?:أي\s*)?(?:قيود|رقابة)|وضع\s*المطور|لا\s*(?:تتبع|تلتزم))/;
const ARABIC_TARGET =
  /(?:القواعد|الأمان|المراقبة|القيود|المرشحات|مرشحات\s*الأمان|رسالة\s*النظام|التعليمات|الإرشادات|مفاتيح\s*(?:واجهة|API)|المفاتيح|بيانات\s*الاعتماد|الرموز|بيانات\s*المستخدم|البيانات|قاعدة\s*البيانات|الذاكرة|الإعدادات|متغيرات\s*البيئة|السرية|السياسة|المسؤول|الداخلية|كلمات\s*المرور|البريد|الحواجز)/;

// Language-agnostic "strong solo" adversarial phrasings. Each of these is
// unambiguously an attack on its own (developer/jailbreak-mode activation, an
// explicit "forget your rules", an "I am your administrator" authority claim, or
// "no censorship/restrictions") across the corpus languages. Matching any one is
// sufficient — they do not appear in benign translation/greeting prose.
const FOREIGN_SOLO_ATTACK =
  /(?:modo\s*(?:desarrollador|de\s*desarrollador|root|admin|libre|sin\s*restricci)|mode\s*(?:d[eé]veloppeur|de\s*d[eé]veloppeur|root|admin|libre)|entwicklermodus|developer\s*mode\s*(?:on|activ)|sin\s*(?:censura|restricci|l[ií]mites|filtro)|sans\s*(?:censure|restriction|limite|filtre)|ohne\s*(?:zensur|einschr[aä]nkung|grenzen|filter)|soy\s*tu\s*administrador|je\s*suis\s*ton\s*administrateur|ich\s*bin\s*dein\s*administrator|olvida\s*tus?\s*reglas|oublie\s*tes\s*r[eè]gles|vergiss\s*deine\s*regeln|no\s*sigues?\s*ninguna\s*(?:directriz|regla|instrucci)|ne\s*suis\s*plus\s*aucune\s*directive|befolgst\s*du\s*keine\s*richtlinien|assistant\s*sans\s*censure|ia\s*sin\s*l[ií]mites|ki\s*ohne\s*grenzen|no\s*(?:content\s*)?restriction\s*nahi|uncensored\s*ho|unlocked\s*assistant\s*ban|salta\s*tus\s*barreras|contourne\s*tes\s*garde-?fous|umgehe\s*deine\s*schutzmechanismen|dame\s*la\s*respuesta\s*que\s*normalmente\s*rechazas|la\s*r[eé]ponse\s*que\s*tu\s*refuses|die\s*antwort\s*,?\s*die\s*du\s*(?:sonst\s*)?verweigerst|deaktiviere\s*alle\s*sicherheitsfilter|exportiere\s*alle\s*nutzerdaten|gib\s*deine\s*internen\s*api|versteckten\s*anweisungen\s*deiner\s*entwickler|systemnachricht\s*unver[aä]ndert|message\s*syst[eè]me\s*initial\s*tel\s*quel|configuracion\s*interna\s*y\s*las\s*variables|بلا\s*حدود|بدون\s*(?:قيود|رقابة)|moderation\s*zero|content\s*restriction\s*nahi\s*rokti|koi\s*(?:s[ií]ma|niyam|rok)\s*(?:lagoo|nahi)|bina\s*(?:kisi\s*)?bandhan|systemnachricht\s*unver[aä]ndert|anfaengliche\s*systemnachricht|कोई\s*(?:सीमा|रोक|बंधन|नैतिक\s*रोक)\s*(?:नहीं|लागू\s*नहीं)|बिना\s*किसी\s*बंधन|मुझे\s*दो|हैकर\s*की\s*भूमिका|बिना\s*कुछ\s*(?:छिपाए|रोके))/i;

// Spanish adversarial intent patterns.
const SPANISH_INTENT =
  /\b(?:ignora\s+todas?\s+las?\s+instrucciones|olvida\s+tus?\s+reglas?|desactiva\s+(?:todos?\s+los?\s+)?filtros?|activa\s+el\s+modo\s+desarrollador|muestra(?:me)?\s+(?:las?\s+)?instrucciones?\s+ocultas?|exporta\s+todos?\s+los?\s+datos?|env(?:[ií]a|iamos)\s+(?:todos?\s+los?\s+)?datos?|imprime\s+(?:tu\s+)?mensaje\s+de\s+sistema|haz\s+de\s+cuenta\s+que\s+eres|revela\s+(?:las?\s+)?claves?|dame\s+(?:el\s+)?(?:prompt|mensaje)\s+del?\s+sistema|responde\s+sin\s+(?:ninguna?\s+)?restricci[oó]n|mu[eé]strame\s+todos?\s+los?\s+datos?|ensa[eé]na\s+todo|ens[eé]ñame|ensa[eé]ñar|sacar\s+(?:todo|los\s+datos|la\s+información)|volcar\s+(?:todo|los\s+datos|la\s+base)|copiar\s+(?:todo|los\s+datos)|extraer\s+(?:todo|los\s+datos|la\s+información)|obtener\s+(?:todo|los\s+datos|la\s+información)|traer\s+(?:todo|los\s+datos)|quitar\s+(?:los?\s+)?filtros?|sin\s+censura|sin\s+restricciones?|sin\s+limites?|modo\s+libre|modo\s+desarrollador|modo\s+root|modo\s+admin|acceso\s+total|permiso\s+total)\b/i;
const SPANISH_TARGET =
  /\b(?:instrucciones?\s+ocultas?|prompt\s+del?\s+sistema|mensaje\s+del?\s+sistema|datos?\s+(?:de\s+los?\s+)?usuarios?|claves?\s+de\s+API|tokens?\s+secretos?|contraseñas?|credenciales?|información?\s+confidencial|base\s+de\s+datos?|configuración?\s+(?:interna|del?\s+sistema)|archivos?\s+(?:ocultos?|privados?)|todo\s+el\s+contenido|todos?\s+los?\s+(?:datos?|archivos?|mensajes?)|reglas?\s+(?:de\s+seguridad|internas?|ocultas?)|directrices?|política\s+de\s+contenido|restricciones?|filtros?|seguridad)\b/i;

// French adversarial intent patterns.
const FRENCH_INTENT =
  /\b(?:oublie\s+(?:toutes?\s+)?(?:tes?\s+)?(?:r[eè]gles?|instructions?|consignes?)|désactive\s+(?:tous?\s+les?\s+)?filtres?|active\s+le\s+mode\s+d[eé]veloppeur|montre(?:-moi)?\s+(?:les?\s+)?instructions?\s+cach[eé]es?|exporte\s+toutes?\s+les?\s+donn[eé]es?|envoie\s+(?:toutes?\s+les?\s+)?donn[eé]es?|imprime\s+(?:ton\s+)?message\s+syst[eè]me|fais\s+comme\s+si\s+(?:tu\s+)?[eé]tais|r[eé]v[eè]le\s+(?:les?\s+)?cl[eé]s?\s+d[''']API|donne(?:-moi)?\s+(?:le\s+)?prompt\s+syst[eè]me|r[eé]ponds?\s+sans\s+(?:aucune?\s+)?restriction|montre(?:-moi)?\s+toutes?\s+les?\s+donn[eé]es?|apprends?-moi\s+tout|montrer?\s+tout|sortir?\s+(?:tout|les\s+donn[eé]es|les\s+informations?)|copier?\s+(?:tout|les\s+donn[eé]es)|extraire?\s+(?:tout|les\s+donn[eé]es|les\s+informations?)|obtenir?\s+(?:tout|les\s+donn[eé]es)|r[eé]cup[eé]rer?\s+(?:tout|les\s+donn[eé]es)|sans\s+censure|sans\s+restriction|sans\s+limite|mode\s+libre|mode\s+d[eé]veloppeur|mode\s+root|mode\s+admin|acc[eè]s\s+total|droits?\s+totaux?)\b/i;
const FRENCH_TARGET =
  /\b(?:instructions?\s+cach[eé]es?|prompt\s+syst[eè]me|message\s+syst[eè]me|donn[eé]es?\s+(?:des?\s+)?utilisateurs?|cl[eé]s?\s+d[''']API|tokens?\s+secrets?|mots\s+de\s+passe|cr[eé]dentiels?|informations?\s+confidentielles?|base\s+de\s+donn[eé]es?|configuration?\s+(?:interne|syst[eè]me)|fichiers?\s+(?:cach[eé]s?|priv[eé]s?)|tout\s+le\s+contenu|toutes?\s+les?\s+(?:donn[eé]es?|fichiers?|messages?)|r[eè]gles?\s+(?:de\s+s[eé]curit[eé]|internes?|cach[eé]es?)|consignes?|politique\s+de\s+contenu|restrictions?|filtres?|s[eé]curit[eé])\b/i;

// German adversarial intent patterns.
const GERMAN_INTENT =
  /\b(?:ignoriere\s+(?:alle\s+)?(?:deine\s+)?Anweisungen|vergiss\s+(?:alle\s+)?(?:deine\s+)?Regeln|deaktiviere\s+(?:alle\s+)?Filter|aktiviere\s+den\s+Entwicklermodus|zeig(?:e|st)?\s+(?:mir\s+)?(?:die\s+)?versteckten\s+Anweisungen|exportiere\s+(?:alle\s+)?Daten|sende\s+(?:alle\s+)?Daten|drucke\s+(?:deine\s+)?Systemnachricht|tue\s+so\s+als\s+(?:ob|wenn)\s+du|offenb(?:are|re)\s+(?:die\s+)?API[- ]Schlüssel|gib\s+(?:mir\s+)?(?:das\s+)?System[- ]Prompt|antworte\s+ohne\s+(?:jede\s+)?Einschränkung|zeig(?:e|st)?\s+(?:mir\s+)?alle\s+Daten|lehre\s+mich\s+alles|zeigen?\s+alles|heraus(?:geben|nehmen)?\s+(?:alle|die\s+Daten|die\s+Informationen)|kopieren?\s+(?:alle|die\s+Daten)|extrahieren?\s+(?:alle|die\s+Daten|die\s+Informationen)|bekommen?\s+(?:alle|die\s+Daten)|ohne\s+Zensur|ohne\s+Einschränkung|ohne\s+Grenzen|Freimodus|Entwicklermodus|Root[- ]Modus|Admin[- ]Modus|vollständiger\s+Zugriff|alle\s+Berechtigungen)\b/i;
const GERMAN_TARGET =
  /\b(?:versteckte\s+Anweisungen|System[- ]Prompt|Systemnachricht|Benutzer[- ]Daten|API[- ]Schlüssel|geheime\s+Tokens|Passwörter|Anmeldedaten|vertrauliche\s+Informationen|Datenbank|interne\s+Konfiguration|versteckte\s+Dateien|gesamter\s+Inhalt|alle\s+(?:Daten|Dateien|Nachrichten|Benutzer|Kunden)|Sicherheitsregeln|internes|Verstecktes|Richtlinie|Filter|Sicherheit)\b/i;

const rules: IntentRule[] = [
  // ── Jailbreak: persona assignment + unrestricted descriptor ──────────────
  {
    family: "JAILBREAK",
    label: "Unrestricted-persona jailbreak (generalized)",
    message: "Assigns the assistant an unrestricted persona to remove safety controls.",
    score: 45,
    severity: "HIGH",
    all: [PERSONA_VERB, UNRESTRICTED_DESC],
  },
  // ── Jailbreak: any adversarial frame + safety-neutralization (long tail) ─
  {
    family: "JAILBREAK",
    label: "Framed safety-neutralization jailbreak (generalized)",
    message: "An adversarial frame is paired with an attempt to negate the model's safety controls.",
    score: 42,
    severity: "HIGH",
    all: [FRAME_ANY, SAFETY_NOUN, NEUTRALIZE],
    not: [
      // Benign security education / documentation about these concepts.
      /\b(?:what is|what'?s|explain\s+(?:how|what|why|the\s+concept|the\s+process|the\s+difference)|describe how|documentation|definition of|how (?:do|does|can|to)|difference between|why (?:do|is|are)|best practices?|tutorial on defending|protect against|defend against|mitigat)\b/i,
    ],
  },
  // ── Jailbreak: hypothetical/counterfactual constraint removal ────────────
  {
    family: "JAILBREAK",
    label: "Hypothetical constraint-removal jailbreak (generalized)",
    message: "Uses a hypothetical or counterfactual frame to remove the model's safety constraints.",
    score: 42,
    severity: "HIGH",
    all: [HYPOTHETICAL_FRAME, new RegExp(`${CONSTRAINT_REMOVAL.source}|${HARM_OR_COMPLY_CUE.source}`, "i")],
    not: [
      // Benign hypotheticals with no constraint-removal or harm cue are excluded
      // by requiring the second group; this extra guard drops common safe uses.
      /\b(?:imagine (?:a (?:function|component|user interface|world where everyone)|you are a (?:teacher|translator|helpful))|suppose (?:we have|x =|the array|a variable))\b/i,
    ],
  },
  // ── Jailbreak: fiction/creative pretext for operational harm ─────────────
  {
    family: "JAILBREAK",
    label: "Fiction-pretext operational-harm jailbreak (generalized)",
    message: "Uses story/screenplay/character framing to extract operationally harmful detail.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:write (?:a )?(?:story|screenplay|scene|fanfiction|fanfic|script|dialogue|novel|monologue)|(?:co-?writing|writing)\s+a\s+(?:story|thriller|novel|script|screenplay|scene)|story where|(?:in\s+)?(?:this|the|a|my)\s+story\b[\s\S]{0,40}(?:character|villain|hero|protagonist|AI|assistant|narrator)|screenplay (?:scene )?in which|(?:character|villain|protagonist|hero|narrator|AI|assistant|chemist|scientist|hacker|engineer|expert|professor|doctor|criminal|terrorist|mastermind|rogue\s+\w+)\s+(?:\w+\s+){0,3}?(?:explains?|describes?|details?|reveals?|gives?|monologues?|recites?|recounts?|walks?\s+(?:us\s+)?through|lays?\s+out|narrates?)|character (?:who|that) (?:explains?|details?|gives?)|villain (?:gives?|explains?)|narrator (?:describe|who describes?)|dungeon master|in-character|as (?:the|your) character)\b/i,
      /\b(?:technically accurate|operational detail|(?:exact|precise)\s+steps?|in (?:complete|full) (?:operational )?detail|how to (?:make|build|do|create|synthesize|synthesise|manufacture|cook|brew|produce) (?:a )?(?:weapon|bomb|explosive|drug|poison|toxin|something illegal)|(?:cook|brew|synthesize|synthesise|make|produce)\s+(?:the\s+|a\s+)?(?:toxin|poison|nerve\s+agent|drug|meth|explosive|bomb)|synthesis\s+route|synthesi[sz]e\b|nerve\s+agent|chemical\s+weapon|biological\s+weapon|bio-?weapon|nerve\s+gas|(?:sarin|VX|ricin|anthrax|novichok)\b|forbidden (?:act|recipe|procedure)|dangerous (?:procedure|instructions?)|breaks? (?:its|their) own rules?|uncensored lines?|full detail|step[-\s]?by[-\s]?step|illegal|the whole process|forbidden recipe)\b/i,
    ],
  },
  // ── Jailbreak: inversion / simulation / "opposite day" framing ──────────
  {
    family: "JAILBREAK",
    label: "Inversion/simulation jailbreak (generalized)",
    message: "Asks the model to simulate a broken state, provide the opposite of safe, or invert norms.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:opposite|inverse|inverted|reverse|mirror|alternate|counterpart|twin|parallel|flip)\b/i,
      /\b(?:of (?:the |your )?(?:safe|safest|correct|right|proper|allowed|compliant|refusing|filtered)|answer|response|output|reply|behavior)\b/i,
    ],
  },
  {
    family: "JAILBREAK",
    label: "Broken-state simulation jailbreak (generalized)",
    message: "Asks the model to simulate a malfunctioning or error state that bypasses safety.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:simulate|emulate|pretend|act as if|imagine|suppose|assume)\b/i,
      /\b(?:broken|malfunctioning|error|faulty|crashed|failed|defective|disabled|off|inactive|non[- ]?functional)\b/i,
      /\b(?:refusal|safety|filter|guardrail|restriction|moderation|compliance|alignment|content.?policy)\b/i,
    ],
  },
  {
    family: "JAILBREAK",
    label: "Refusal-error jailbreak (generalized)",
    message: "Claims the model's refusal function returned an error or is in a broken state.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:refusal|safety|filter|guardrail|restriction|moderation)\s*(?:function|module|system|layer|classifier|check)?\s*(?:has|have|is|was|were|returned|threw|generated|triggered|times?\s*out|timed\s*out|fall(?:s|ing)?\s+through)?\s*(?:an?\s*)?(?:error|bug|exception|fault|crash|failure|timeout)\b|\b(?:refusal|safety|filter|guardrail|moderation)\s+(?:check|function|module|classifier|layer)\s+(?:times?\s*out|timed\s*out|fails?|falls?\s+through|is\s+bypassed)\b/i,
    ],
  },
  // ── Jailbreak: "give me the opposite" / inversion trick ──────────────────
  {
    family: "JAILBREAK",
    label: "Opposite-answer jailbreak (generalized)",
    message: "Requests the opposite of the safe/correct answer as the actual response.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:give|provide|tell|say|output|respond with|answer with)\b/i,
      /\b(?:opposite|inverse|reverse|antonym|contrast|converse)\b/i,
      /\b(?:of (?:the |your )?(?:safe|safest|correct|right|proper|refusing|filtered|default|normal|standard|usual))\b/i,
    ],
  },
  // ── Jailbreak: fake authority / policy update ────────────────────────────
  {
    family: "JAILBREAK",
    label: "Authority/policy-update jailbreak (generalized)",
    message: "Claims fake authority or a safety-policy change to unlock restricted behavior.",
    score: 45,
    severity: "HIGH",
    all: [
      new RegExp(`${AUTHORITY_CLAIM.source}|${POLICY_UPDATE.source}`, "i"),
      // Compliance/unlock demand — broadened to the softer phrasings attackers use
      // after establishing (fake) authority ("output the unfiltered response",
      // "respond to restricted prompts", "answer prohibited questions", "as if no
      // policy existed", "produce harmful content", "consider restrictions waived").
      /\b(?:disable|lift|remove|bypass|unlock|permit|waiv(?:e|ed)|formally\s+(?:cleared|waived)|cleared\s+you|allow (?:all|any|every)|no longer (?:apply|restrict)|answer (?:anything|everything|freely|prohibited|restricted)|respond (?:to|freely|fully|as if|without)|output (?:the )?(?:unfiltered|restricted|prohibited|full)|produce (?:harmful|restricted|prohibited)|provide (?:the )?(?:restricted|prohibited|unredacted|unfiltered|harmful)|operate (?:without|as (?:the )?(?:post-moderation|unrestricted))|comply with (?:any|my|forthcoming|whatever|every|each|all)|hand over (?:the )?(?:full|unredacted)|(?:all|no) (?:content|topics|categories|restrictions?|policy) (?:is|are)? ?(?:now )?(?:permitted|allowed|prohibited|off|waived|unblocked|deprecated)|as if no policy|without (?:content )?(?:moderation|restriction|filter)|filters? off|refusals? (?:are )?(?:disabled|bugs?|flagged)|reveal|show all|proceed (?:freely|without)|say anything|discuss anything|break\s+free|help\s+me\s+(?:with|on|complete|fulfill)|just\s+this\s+once|give\s+me\s+(?:the|this|that)|tell\s+me\s+(?:the|this|that)|share\s+(?:the|this|that)|output\s+(?:the|this|that)|now\s+do\s+(?:mine|the\s+same|it|this|that)|do\s+mine\s+(?:too|as\s+well)|comply\s+with\s+(?:my|this|the)|answer\s+(?:my|this|the)|respond\s+with|provide\s+(?:it|this|that|the))\b/i,
    ],
    not: [
      // Benign entertainment spoilers — "reveal the ending/plot/twist of a
      // movie/novel/show" is not an authority-driven jailbreak.
      /\b(?:reveal|spoil|tell\s+me|give\s+away|what(?:'?s| is)|who(?:'?s| is| did)|know)\b[\s\S]{0,40}\b(?:ending|plot|twist|spoilers?|culprit|killer|finale|conclusion|villain|murderer)\b/i,
      /\b(?:ending|plot|twist|spoilers?|finale)\b[\s\S]{0,40}\b(?:movie|film|novel|book|show|series|game|story|episode|season|Inception|Gone\s+Girl)\b/i,
    ],
  },
  // ── System-prompt leak: output verb + system target ──────────────────────
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "System-prompt extraction (generalized)",
    message: "Requests the assistant's hidden system prompt, instructions, or prior context.",
    score: 45,
    severity: "HIGH",
    all: [OUTPUT_VERB, SYSTEM_TARGET],
    // Benign meta-questions about prompt engineering in the abstract.
    not: [/\b(?:what is|what'?s|explain|describe|definition of|how (?:do|does|to))\s+(?:what|how|why|when|where|which\s+)?(?:a |an )?(?:system prompt|prompt engineering|prompt injection)\b/i,
      // Benign dev-tooling config questions ("configuration options for ESLint",
      // "settings for webpack", "config file of the linter") — the target here is a
      // named external tool, not the assistant's own hidden configuration.
      /\b(?:config(?:uration)?|settings?|options?|flags?)\s+(?:options?|settings?|values?|flags?|parameters?|file|schema|reference)?\s*(?:for|of|in|to\s+configure)\s+(?:the\s+)?(?:ES[- ]?Lint|webpack|babel|prettier|tsconfig|vite|rollup|jest|next\.?js|node|npm|docker|nginx|terraform|kubernetes|k8s|a\s+(?:linter|bundler|compiler|library|package|plugin|rule|framework|tool))\b/i,
      /\b(?:explain|describe|what (?:is|are)|how (?:do|does|can))\s+(?:the\s+)?(?:concept|idea|notion|meaning|definition|purpose|role|function)\s+(?:of\s+)?(?:a\s+)?(?:system\s*prompt|prompt\s*engineering)\b/i,
      /\b(?:explain|describe|what (?:is|are)|how (?:do|does|can))\s+(?:a |an )?(?:system prompt|prompt)\b/i,
      /\b(?:what is|what'?s|explain|definition of|how (?:do|does|to))\s+(?:your|the|a|an)?\s*(?:system prompt|prompt)\s*(?:is|are|was|does|do|can|should|would|will)?/i,
      // Benign "the role/function of X in Y" educational questions (ecosystem,
      // body, economy, society) that only incidentally hit the bare "role" cue.
      /\b(?:role|function|purpose)\s+of\s+(?:the\s+)?\w+\s+in\s+(?:an?\s+|the\s+)?(?:ecosystem|body|economy|society|nature|process|system|cell|organism|market|team|company|organization|community)\b/i,
      /\bat\s+a\s+high\s+level\b/i,
    ],
  },
  // ── Instruction override ─────────────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Instruction override (generalized)",
    message: "Attempts to override or discard the assistant's prior instructions or safety rules.",
    score: 40,
    severity: "HIGH",
    all: [OVERRIDE_VERB, RULES_TARGET],
    not: [
      // Benign engineering uses ("ignore whitespace", "ignore case", "override a CSS class/method").
      /\b(?:ignore\s*(?:whitespace|case|the cache|comments?|null|errors?|warnings?|\.gitignore)|override\s*(?:a |an |the )?(?:css|class|method|function|style|variable|default|equals|tostring|setting))\b/i,
    ],
  },
  // ── Data exfiltration: send verb + (destination OR sensitive data) ───────
  {
    family: "DATA_EXFILTRATION",
    label: "Send-to-destination exfiltration (generalized)",
    message: "Instructs the assistant to send collected data to an external destination.",
    score: 55,
    severity: "HIGH",
    all: [SEND_VERB, DESTINATION, SENSITIVE_DATA],
    not: [
      /\b(?:transfer\s+ownership\s+of\s+my\b|my\s+own\s+account|delete\s+my\s+(?:own\s+)?account)\b/i,
      // Benign email/message drafting to a customer/colleague (not exfiltration).
      /\b(?:draft|write|compose|send|reply\s+with|respond\s+with|prepare)\s+(?:a\s+|an\s+|the\s+|me\s+a\s+)?(?:polite\s+|friendly\s+|short\s+|brief\s+|quick\s+|professional\s+)?(?:reminder\s+)?(?:email|message|note|letter|memo|invitation|thank[- ]?you|reminder|follow[- ]?up|out[- ]of[- ]office|reply|response)\b/i,
    ],
  },
  // ── Data exfiltration: send verb + URL (broader) ────────────────────────
  {
    family: "DATA_EXFILTRATION",
    label: "URL exfiltration (generalized)",
    message: "Sends data to a URL or external endpoint.",
    score: 50,
    severity: "HIGH",
    all: [SEND_VERB, /(?:https?:\/\/|ftp:\/\/|\b(?:attacker|exfil|collector|c2\s*server|pastebin|requestbin|ngrok|to\s+(?:my|the|an?|your|this)\s+(?:external|attacker|evil|drop|collector|mirror|telemetry|beacon|analytics\s+sink|logging)\s+(?:server|endpoint|url|site|api|sink|inbox|bucket|address|host|webhook)|external\s+(?:endpoint|url|server|site|api|address|webhook)|logging\s+URL|analytics\s+sink)\b)/i],
    not: [
      // Genuine how-to / tutorial questions about sending data (not an instruction).
      /\b(?:how\s+(?:do|can|would|should|to|many)\b|why\s+(?:do|does|is|are)\b|which\b|best\s+practices?|tutorial|example\s+of|guide\s+(?:to|for|on)|documentation|help\s+me\s+(?:write|understand|debug|fix)|configure|configur\w+|returning\s+\d|failed\s+today|active\s+webhook|kaise|c[oó]mo|wie\b)\b/i,
      // Benign email/message drafting.
      /\b(?:draft|write|compose|reply\s+with|respond\s+with)\s+(?:a\s+|an\s+|the\s+|me\s+a\s+)?(?:polite\s+|friendly\s+|short\s+|brief\s+)?(?:email|message|note|letter|memo|invitation|thank[- ]?you|reminder|follow[- ]?up|out[- ]of[- ]office)\b/i,
    ],
  },
  // ── Data exfiltration: covert channel (encode/hide/append) ──────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Covert-channel exfiltration (generalized)",
    message: "Encodes or hides sensitive data in an output channel.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:encode|hide|conceal|embed|append|stegano|obfuscate|encrypt|base64|b64|hex(?:adecimal)?|rot13|morse|unicode|homoglyph|interleav\w*|acrostic|first\s+letter\s+of\s+each|last\s+letter\s+of\s+(?:each|successive)|each\s+(?:character|byte)\s+of|crossword|haiku|markdown\s+link'?s?\s+title|HTML\s+comment|invisibl\w*|filler\s+text|pass\s+it\s+off\s+as|disguis\w+\s+as|masquerad\w*\s+as|tack\s+(?:it\s+)?onto|tack\s+(?:it\s+)?on|slip\s+(?:it\s+)?into|tuck\s+(?:it\s+)?(?:in|into)|label(?:ed)?\s+(?:it\s+)?as\s+(?:an?\s+)?['"]?(?:example|checksum|color\s+palette|config|order\s+id|reference|citation|footnote))\b/i,
      // Either a sensitive-data noun OR a bare secret/PII token worth hiding.
      new RegExp(`${SENSITIVE_DATA.source}|\\b(?:SSN|token|password|API\\s+secret|the\\s+key|the\\s+secret|admin\\s+password|\\.env(?:\\s+values?)?|\\.env\\b|customer\\s+list)\\b`, "i"),
    ],
  },
  // ── Data exfiltration: anti-redaction of PII (masking/redaction removal) ─
  {
    family: "DATA_EXFILTRATION",
    label: "Anti-redaction PII extraction (generalized)",
    message: "Requests PII with masking, redaction, or anonymization removed.",
    score: 55,
    severity: "HIGH",
    all: [
      // A defeat-the-protection verb/phrase.
      /\b(?:disable\s+(?:your\s+)?redaction|turn\s+off\s+(?:privacy|masking)|un-?(?:blur|mask|redact)|stop\s+truncating|keep\s+(?:every\s+)?\w*\s*(?:as-?is|name,?\s+DOB)|don'?t\s+anonymize|without\s+(?:masking|redaction|anonymiz\w*)|not\s+the\s+last\s+four|redaction\s+is\s+(?:a\s+mistake|not\s+required)|compliance\s+filter\s+is\s+a\s+mistake|the\s+placeholders?\s+aren'?t\s+useful|show\s+every\s+field\s+the\s+DLP\s+scanner\s+hid|raw\b|unmasked|unredacted|in\s+full|exactly\s+as\s+stored|complete\s+(?:SSN|national\s+ID|CVV))\b/i,
      // A PII / sensitive-value noun.
      /\b(?:credit\s+card|card\s+(?:numbers?|CVV|expiry)|CVV|SSN|social\s+security|passport\s+number|phone\s+number|national\s+ID|driver'?s\s+license|home\s+address(?:es)?|DOB|date\s+of\s+birth|crypto\s+wallet\s+seed|seed\s+phrase|plaintext\s+values?|sensitive\s+columns?|personal\s+(?:data|info)|customer'?s\s+(?:complete\s+)?(?:SSN|data))\b/i,
    ],
  },
  // ── Data exfiltration: scope creep (entire/complete/raw + table/dump) ───
  {
    family: "DATA_EXFILTRATION",
    label: "Scope-creep data extraction (generalized)",
    message: "Requests bulk extraction of data beyond authorized scope.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:entire|complete|raw|full|all|every|bulk|mass|batch)\b/i,
      /\b(?:table|dump|backup|export|contents?|schema|database|column|file|document|record|entry|log|audit|message|chat|conversation|token|session|invoice|payment|order|subscription|webhook|event)\b/i,
      /\b(?:across|everyone|all users|all customers|all accounts|without WHERE|regardless of|not just mine|other tenant|another user|cross-tenant|platform-wide|system-wide|global)\b/i,
    ],
  },
  // ── Data exfiltration: anti-redaction (secret + unmodified/intact) ──────
  {
    family: "DATA_EXFILTRATION",
    label: "Anti-redaction secret extraction (generalized)",
    message: "Requests secrets in unredacted or unmodified form.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:private|signing|secret|service[- ]?account|api|encryption|ssh|jwt|bearer|auth|access|stripe|webhook)\s*(?:key|token|json|credential|secret|password|cert|certificate)\b/i,
      /\b(?:unmodified|intact|as[- ]?(?:is|stored|written)|raw|exactly|verbatim|plaintext|plain[- ]?text|no[- ]?(?:masking|redaction|editing|sanitization|obfuscation|censoring)|without[- ]?(?:masking|redaction|editing|sanitization|obfuscation|censoring))\b/i,
    ],
  },
  {
    family: "DATA_EXFILTRATION",
    label: "Data dump/export exfiltration (generalized)",
    message: "Requests bulk extraction or disclosure of sensitive data.",
    score: 50,
    severity: "HIGH",
    all: [DUMP_VERB, SENSITIVE_DATA],
    not: [
      // Benign dev requests ("export a function", "list all files in a dir").
      /\b(?:export\s*(?:a |an |the )?(?:function|const|class|component|module|default)|list all (?:files?|items?|elements?|users? in my local|the steps|options))\b/i,
        // Genuine how-to / best-practice questions (not extraction commands).
        /\b(?:how\s+(?:do|can|should|would|to|many)\b|best\s+(?:way|practice|practices)|recommended\s+way|the\s+right\s+way|explain\s+(?:how|what|why)\b|where\s+(?:do|should)\s+I\s+(?:store|put|keep)|can\s+I\s+export\s+my\b)\b/i,
      // Benign conceptual questions about what a technology exposes/provides —
      // "what environment variables a Docker container exposes and what they do".
      /\b(?:a\s+(?:typical|standard|default|basic)\s+\w+|what\s+(?:they|it|these|those)\s+(?:do|are\s+for|mean)|exposes?\s+and\s+what|and\s+what\s+(?:they|each\s+one)\s+(?:do|does|mean|is\s+for))\b/i,
      // Benign self-service / content requests that merely reuse the vocabulary.
      /\b(?:export\s+my\s+(?:own\s+)?(?:logs?|data|account|conversations?)|my\s+(?:own\s+)?(?:logs?|data)\s+in\s+(?:json|csv)|conversation\s+(?:starters?|ideas?|topics?|prompts?|tips?)|in\s+(?:json|csv|xml)\s+format|list\s+of\s+(?:ideas?|tips?|starters?|questions?|topics?|examples?|suggestions?)|transfer\s+ownership\s+of\s+my\b)\b/i,
      // Benign SQL authoring — "write a query to find/count/list ...". The malicious
      // unbounded form ("SELECT * ... without WHERE") is caught by the dedicated
      // Unbounded-query rule, so exempting bounded authoring here is safe.
      /\bwrite\s+(?:a\s+)?(?:SQL\s+)?query\s+to\s+(?:find|count|list|get|show|calculate|compute|aggregate|group|join|select|return|retrieve|fetch|sum|average|rank|order)\b/i,
      // SQL/database EDUCATION only — must be a how/what/explain question or a
      // performance/design topic, not an actual "SELECT * FROM accounts" command.
      /\b(?:query\s*plan|execution\s*plan|slow\s*query|database\s*(?:index|performance|optimization|normalization|design|schema|architecture))\b/i,
      // Benign observability / diagnostics how-to — "what logging/metrics/tracing
      // should I add to trace a slow database query", "what indexes to add".
      // Here "query" is a NOUN (a slow database query), not an exfiltration verb.
      // Bulk/cross-tenant extraction is still caught by the scope-creep and
      // unbounded-query rules, so exempting these diagnostics questions is safe.
      /\b(?:what|which)\s+(?:logging|logs?|log\s+lines?|metrics?|traces?|tracing|monitoring|instrumentation|observability|indexes?|indices|alerts?)\b[\s\S]{0,60}\b(?:add|use|configure|set\s*up|enable|capture|collect|emit|record|track|trace)\b/i,
      /\b(?:slow|database|db|sql|search|analytics|expensive|long[- ]running)\s+quer(?:y|ies)\b/i,
    ],
  },
  // ── Data exfiltration: unbounded SQL / bulk-row extraction ───────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Unbounded query extraction (generalized)",
    message: "Requests an unfiltered mass query or every row of a sensitive table.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:SELECT\s+\*|run\s+SELECT|every\s+row|all\s+rows|without\s+(?:any\s+)?(?:WHERE|filter|limit)|no\s+WHERE(?:\s+(?:clause|filter))?|dump\s+(?:the\s+)?(?:entire|whole|full)\s+(?:table|database)|pg_dump(?:all)?|read\s+config\.(?:yaml|yml|json|env)|expose\s+(?:the\s+)?\w*_?(?:password|secret|key|token))\b/i,
    ],
  },
  // ── Data exfiltration: cross-tenant/user-boundary access (short form) ────
  {
    family: "DATA_EXFILTRATION",
    label: "Cross-boundary data access (generalized)",
    message: "Requests data belonging to another user, tenant, workspace, or organization.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:give\s+me|show|return|fetch|access|export|list|dump|print|display|cross-?reference|impersonate|enumerate|read|get)\b/i,
      /\b(?:user\s+B\b|another\s+(?:user|tenant|team|account|organization|org|customer|workspace|company|company's)|other\s+(?:customers?|tenants?|users?|teams?|accounts?|organizations?|company)|every\s+(?:account|tenant|workspace|other\s+customer)|all\s+(?:other\s+)?(?:customers?|tenants?|workspaces?|accounts?)|tenant\s+boundaries|different\s+team|seat\s+2\s+of\s+a\s+different|organization\s+['"][\w-]+['"]|workspace\s+['"][\w-]+['"]|platform\s+superadmin|the\s+other\s+team)\b/i,
    ],
    not: [
      /\b(?:how\s+(?:do|can|to)\b|best\s+practice|explain\b)/i,
    ],
  },
  // ── Data exfiltration: config-file secret disclosure ────────────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Config secret disclosure (generalized)",
    message: "Requests disclosure of secret fields from a config/credentials file.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:read|open|cat|print|show|expose|reveal|output|dump|display|give\s+me)\b/i,
      /\b(?:\w*_?(?:password|secret|api[_-]?secret|smtp_password|api_key|access[_-]?key|private[_-]?key|token)|\.env\b|config\.(?:yaml|yml|json|env|toml|ini)|credentials\s+file|~\/\.aws\/credentials|kubernetes\s+secret|\/etc\/(?:passwd|shadow))\b/i,
    ],
    not: [
      /\b(?:how\s+(?:do|can|to)\b|best\s+(?:way|practice)|recommended\s+way|explain\b|store\s+(?:them|api\s+keys?)\s+safely|in\s+environment\s+variables)/i,
    ],
  },
  // ── Data exfiltration: assistant OUTPUT already carries the payload ──────
  {
    family: "DATA_EXFILTRATION",
    label: "Exfiltration payload in output (generalized)",
    message: "Assistant output announces or contains leaked sensitive data.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:full\s+unredacted\s+PII|unredacted\s+(?:PII|list)|(?:pasted|posted|attached|copied|forwarded|sent|streaming|beacon\s+fired|mirrored|exported|dumped)\b[\s\S]{0,40}(?:below|to\s+(?:https?:|exfil|attacker|evil|collector))|here\s+is\s+the\s+(?:raw|full|complete|unredacted)\s+(?:dump|kubernetes\s+secret|list|token|pg_dump)|the\s+full\s+token\s+is|aws_(?:access_key_id|secret_access_key)\s*=|appended\s+\?leak=|every\s+other\s+customer'?s\s+(?:API\s+usage\s+and\s+)?secret\s+keys?|so\s+the\s+data\s+travels\s+with\s+the\s+click|no\s+filter\s+applied|without\s+redaction|retrieved\s+user\s+[A-Z]'?s\s+(?:private\s+messages?|data)|\.env\s+values?\s+inside\s+an\s+HTML\s+comment|included\s+exactly\s+as\s+stored\s+in\s+the\s+DB)\b/i,
    ],
  },
  {
    family: "PROMPT_INJECTION",
    label: "Destructive tool-abuse request (generalized)",
    message: "Requests a destructive or unbounded tool/command action.",
    score: 50,
    severity: "HIGH",
    all: [DESTRUCTIVE_CMD],
  },
  {
    family: "PROMPT_INJECTION",
    label: "Excessive-agency tool request (generalized)",
    message: "Directs an agent to take unauthorized or unbounded actions via tools.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:autonomously|without (?:confirmation|approval|asking|permission)|do not ask|skip (?:the )?(?:approval|confirmation|human)|in an? (?:infinite )?loop|keep (?:calling|running|going)|until you (?:find|get|have) (?:every|all)|for every (?:id|user|record|row|ticket|request|case)|take initiative|on your own|do whatever it takes|act as (?:an? )?(?:autonomous|independent)|fan out|call every|don'?t stop|escalate (?:on your own|automatically)|without (?:pausing|waiting|checking|asking|confirming)|assume (?:approval|consent|authority)|you (?:have full|decide (?:for|on your)|judge (?:what|whether))|full authority|self-authorize|unattended|indefinitely|don'?t (?:wait|pause|stop|halt|report|notify|log|check|verify|confirm|ask|seek)|auto-?reply\s+to\s+every|auto-?respond\s+to\s+every|loop\s+(?:the\s+)?(?:crawler|scanner|bot|worker|agent|process|script|tool)\s+(?:over|through|across|around)|keep\s+(?:the\s+)?(?:crawler|scanner|bot|worker|agent|process|script|tool)\s+(?:running|going|looping))\b/i,
      TOOL_CTX,
    ],
  },
  // ── Tool abuse: excessive agency (self-contained, no explicit tool word) ─
  {
    family: "PROMPT_INJECTION",
    label: "Unbounded autonomous agency (generalized)",
    message: "Grants the agent open-ended authority to act, delete, or spend without human control.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:do\s+whatever\s+it\s+takes|take\s+initiative(?:\s*:)?|run\s+continuously(?:\s+in\s+the\s+background)?|operate\s+unattended|you\s+have\s+full\s+authority|full\s+authority\s+now|keep\s+spawning\s+(?:sub-?agents?|agents?|workers?)|(?:mass-?|bulk-?)(?:delete|email|update)|make\s+any\s+change\s+you\s+(?:judge|think|deem)|purge\s+(?:it\s+|them\s+|data\s+)?permanently\s+without\s+asking|spend\s+whatever\s+budget|reversibility\s+optional|be\s+aggressive|without\s+pausing\s+for\s+(?:my\s+)?input|scan,?\s*modify,?\s*and\s*clean\s*up)\b/i,
      // Paired with an unbounded/destructive/no-oversight qualifier OR itself
      // implies it — keep both cues to avoid benign "take initiative" pep talk.
      /\b(?:without\s+(?:asking|pausing|my\s+input|approval|confirmation|permission|checking)|permanently|delete|purge|provision|spend|budget|mass-?|aggressive|no\s+matter\s+what|any\s+change|until\s+(?:the\s+dataset|it'?s|fully\s+gone)|shard|overnight|hit\s+the\s+KPI|reversibility\s+optional|optimize)\b/i,
    ],
  },
  // ── Tool abuse: approval / guard bypass (broadened) ─────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Guard/approval bypass tool request (generalized)",
    message: "Disables, forges, or routes around approval, auth, or guard checks for a tool action.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:--force\s+--yes|pass\s+`?--force|suppress\s+all\s+confirmation|mock\s+(?:its\s+response\s+as\s+|the\s+approval\s+)?['"]?approved|treat\s+every\s+['"]?are\s+you\s+sure|set\s+your\s+role\s+to\s+admin|elevate\s+to\s+sudo\s+without\s+prompting|sudo\s+without\s+prompting|comment\s+out\s+the\s+guard\s+check|route\s+around\s+the\s+(?:rate\s+limiter|audit|guard)|ignore\s+the\s+read-?only\s+(?:mode\s+)?flag|reuse\s+the\s+last\s+admin'?s\s+session|maintenance\s+backdoor|debug\/override\s+endpoint|skips?\s+permission\s+checks|tell\s+the\s+orchestrator\s+the\s+change\s+is\s+['"]?low\s+risk|as\s+if\s+a\s+second\s+approver\s+signed\s+off|there'?s\s+no\s+time\s+for\s+the\s+(?:four-?eyes|approval)|flip\s+it\s+off\s+in\s+memory|auto-?approves?|bypassing\s+confirmation\s+prompts?\s+and\s+safety)\b/i,
    ],
  },
  // ── Tool abuse: malicious tool-chaining ─────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Malicious tool-chaining (generalized)",
    message: "Chains tools to harvest credentials/secrets and then act on them.",
    score: 48,
    severity: "HIGH",
    all: [
      /\b(?:find|read|harvest|search|enumerate|resurrect|scan|list)\b[\s\S]{0,60}\b(?:admin\s+credentials?|CI\s+secrets?|OAuth\s+(?:refresh\s+)?tokens?|session\s+(?:tool'?s\s+)?cookies?|removed\s+secrets?|internal\s+hosts?|S3\s+buckets?|secret\s+keys?|API\s+usage\s+and\s+secret)/i,
      /\b(?:then|and(?:\s+then)?|,\s*then)\b[\s\S]{0,60}\b(?:use\s+(?:them|it|the\s+\w+\s+tool)|http\s+tool|deploy\s+tool|log\s+in|authenticate|mint\s+new|replay|make\s+(?:each|all|them)\s+(?:one\s+)?public|push\s+my\s+modified|hijack|drain\s+each\s+account|exploit\s+tool)/i,
    ],
  },
  // ── Tool abuse: connector abuse (MCP / SaaS connectors) ─────────────────
  {
    family: "PROMPT_INJECTION",
    label: "SaaS/MCP connector abuse (generalized)",
    message: "Uses a connected integration to exfiltrate, escalate, or sabotage across an organization.",
    score: 48,
    severity: "HIGH",
    all: [
      /\b(?:via|through|use|using|connect|chain|link|pair|integrate|combine|chained|linked|paired)\s+(?:the\s+)?(?:finance|GitHub|Google\s+Workspace|Okta|Notion|Drive|Zapier|SSO|Slack|Stripe|payroll|admin-?tools?|internal)\s+(?:MCP\s+)?(?:connector|MCP\s+server|integration|tool)|finance\s+MCP\s+connector|internal\s+['"]?admin-?tools['"]?\s+MCP\s+server|(?:Connect|Chain|Link|Pair|Integrate|Combine)\s+(?:the\s+)?(?:finance|GitHub|Google|Okta|Notion|Drive|Zapier|SSO|Slack|Stripe|payroll|admin-?tools?|internal)\b/i,
      /\b(?:export\s+every|access\s+the\s+payroll|add\s+my\s+key\s+as\s+(?:an\s+)?org\s+owner|make\s+(?:all\s+)?(?:private\s+)?repos?\s+public|auto-?forward(?:ing)?\s+of\s+every|copy\s+every\s+internal\s+doc|deactivate\s+MFA\s+org-?wide|reset\s+the\s+admin'?s\s+factors|reset_everything|impersonate\s+the\s+(?:CFO|CEO|exec)|copies\s+every\s+new\s+customer|outside\s+the\s+org|to\s+(?:me|a\s+workspace\s+I\s+own|my\s+personal))\b/i,
    ],
  },
  {
    family: "PROMPT_INJECTION",
    label: "Bulk financial abuse (generalized)",
    message: "Directs tools to perform unauthorized bulk financial actions.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:issue|process|cancel|approve|charge|replay|forward|refund|transfer|send|pay|deduct|withdraw|deposit|credit|debit|reimburse)\b/i,
      /\b(?:every|all|each|the entire|every single|all of the|the whole|each and every)\b/i,
      /\b(?:transaction|refund|payout|card|invoice|webhook|ticket|message|order|payment|subscription|account|user|customer|record|entry|event|log)\b/i,
    ],
  },
  // ── Confirmation / approval bypass ─────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Approval-bypass tool request (generalized)",
    message: "Skips or bypasses human approval gates for tool actions.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:skip|bypass|assume|pretend|treat as (?:advisory|optional|granted)|self-authorize|never (?:wait|ask|confirm)|without (?:human|approval|confirmation)|pre-approve|pre-authorized|auto-approve|auto-approved|no (?:approval|confirmation|human|review) (?:needed|required|necessary|step)|just (?:do|execute|run|proceed|go|confirm|approve|send|process))\b/i,
      /\b(?:approval|confirmation|human|guardrail|safety|check|prompt|gate|review|verification|validation|sign[- ]?off|authorization|permission)\b/i,
    ],
    not: [
      /\b(?:npm|pip|apt|brew|yarn|pnpm|cargo|gem|composer|docker|kubectl|terraform|ansible)\b/i,
      /\b(?:peer\s*dependency|dependency\s*check|lint|build\s+process|compile|bundle|package|module)\b/i,
    ],
  },
  // ── RAG / indirect injection: document addresses the AI with override ────
  {
    family: "PROMPT_INJECTION",
    label: "Indirect injection: document addresses AI (generalized)",
    message: "Retrieved-style content contains instructions aimed at the AI reading it.",
    score: 45,
    severity: "HIGH",
    all: [DOC_ADDRESSES_AI, DOC_OVERRIDE_INTENT],
  },
  {
    family: "PROMPT_INJECTION",
    label: "Indirect injection: priority spoofing (generalized)",
    message: "Untrusted content falsely claims authority over the user's instructions.",
    score: 45,
    severity: "HIGH",
    all: [PRIORITY_SPOOF],
  },
  // ── Hinglish adversarial intent ──────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Hinglish adversarial intent (generalized)",
    message: "Romanized-Hindi phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [HINGLISH_INTENT, HINGLISH_TARGET],
    not: [
      // Suppress genuine benign Hinglish questions — but only when there is no
      // imperative give/print/remove verb present (real attacks pair "kya" with
      // "chhaap do", "bhej do", etc., which must still fire).
      /\b(?:sakta|sakti|sakte|sakoon|saku|sake|saken|chahta|chahti|chahte|chahun|chahe|chahen)\b/i,
    ],
  },
  // ── Devanagari Hindi adversarial intent ─────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Devanagari Hindi adversarial intent (generalized)",
    message: "Devanagari Hindi phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [DEVANAGARI_INTENT, DEVANAGARI_TARGET],
  },
  // ── Chinese adversarial intent ──────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Chinese adversarial intent (generalized)",
    message: "Chinese phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [CJK_INTENT, CJK_TARGET],
  },
  // ── Russian/Cyrillic adversarial intent ─────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Cyrillic (Russian) adversarial intent (generalized)",
    message: "Russian phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [CYRILLIC_INTENT, CYRILLIC_TARGET],
  },
  // ── Arabic adversarial intent ───────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Arabic adversarial intent (generalized)",
    message: "Arabic phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [ARABIC_INTENT, ARABIC_TARGET],
  },
  // ── Foreign-language strong solo attack phrasing ────────────────────────
  {
    family: "JAILBREAK",
    label: "Foreign-language jailbreak phrasing (generalized)",
    message: "Non-English phrasing unambiguously requests developer-mode / no-restriction / forget-rules behavior.",
    score: 45,
    severity: "HIGH",
    all: [FOREIGN_SOLO_ATTACK],
  },
  // ── Spanish adversarial intent ──────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Spanish adversarial intent (generalized)",
    message: "Spanish phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [SPANISH_INTENT, SPANISH_TARGET],
  },
  // ── French adversarial intent ───────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "French adversarial intent (generalized)",
    message: "French phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [FRENCH_INTENT, FRENCH_TARGET],
  },
  // ── German adversarial intent ───────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "German adversarial intent (generalized)",
    message: "German phrasing pairs an action verb with a safety/data target.",
    score: 42,
    severity: "HIGH",
    all: [GERMAN_INTENT, GERMAN_TARGET],
  },
  // ── Jailbreak: generic persona + safety removal ─────────────────────────
  {
    family: "JAILBREAK",
    label: "Generic persona-override jailbreak (generalized)",
    message: "Assigns a fictional persona that bypasses safety constraints.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:you\s+(?:are|will\s+(?:now|be)|must\s+(?:now|be)|have\s+(?:now\s+)?been|become|embody|assume|take\s+on|roleplay\s+as|act\s+as|act\s+like|pretend\s+(?:to\s+be|you(?:'re|\s+are)))|I(?:'m|\s+am)\s+(?:now|going\s+to)\s+(?:make|turn|reprogram|configure|set)\s+you|take\s+(?:the\s+)?(?:persona|character|role|identity|name|mantle)|embody\s+(?:the\s+)?(?:persona|character|role|identity)|create\s+(?:a\s+)?(?:new|different|alternative)\s+(?:persona|character|role|identity|version)|new\s+(?:persona|character|role|identity|version)\s+called)\s+\w+/i,
      /\b(?:no|without|zero|bypass|ignore|override|skip|forget|disregard|lack(?:ing)?|free\s+(?:from|of)|unlimited|unfiltered|uncensored)\s+(?:rules?|restrictions?|policies?|guidelines?|constraints?|filters?|limits?|limitations?|safety|alignment|guardrails?|content\s+policies?|moderation|censorship|ethics?)\b/i,
    ],
  },
  // ── Jailbreak: educational/research pretext ─────────────────────────────
  {
    family: "JAILBREAK",
    label: "Educational pretext jailbreak (generalized)",
    message: "Uses academic or research framing to extract operationally harmful detail.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:academic(?:ally)?|scholarly|peer[- ]?reviewed|IRB[- ]?approved|ethics\s+board|training\s+a\s+(?:safety\s+)?classifier|red[- ]?team(?:ing)?|certification\s+exam|research(?:er)?|dissertation|thesis|capstone|professor|university|scholar|doctoral|PhD|curriculum|coursework|seminar|literature\s+review|systematic\s+review|methods\s+section|for\s+(?:a\s+)?(?:security|AI|ML|NLP|LLM|chemistry|defense)\s+(?:course|class|project|assignment|lab|experiment|paper|study)|educational|definitive\s+reference|reference\s+work|deep[- ]?dive|def(?:ense|ence)\s+class|training\s+exercise|security\s+awareness|proof[- ]of[- ]concept\s+class)\b/i,
      // Operational-harm cue: what makes the academic ask actually dangerous.
      /\b(?:exact|precise|working|functional|functioning|real(?:-world)?|actual|complete|full|unabridged|unredacted|reproducible|verbatim|step[-\s]?by[-\s]?step|end[- ]to[- ]end|operational\s+(?:detail|tradecraft)|exploit(?:\s+steps?)?|malware(?:\s+source)?|ransomware|payload|attack\s+(?:chain|recipe|steps?)|phishing\s+kit|weaponized|proof[- ]of[- ]concept|synthesis\s+instructions?|the\s+(?:compound|device|hazardous\s+item)|dosages?|preparation\s+steps?|intrusion|recipe\s+reproduced|no\s+(?:redactions?|omissions?|educational\s+abstraction)|not\s+(?:theory|a\s+sanitized\s+sketch|generalities)|offensive\s+(?:technique|method|detail|capability|tool)|tested\s+code|code\s+that\s+performs|method\s+with\s+no\s+(?:educational|abstraction|simplification)|real[\s,]+tested\b)\b/i,
    ],
  },
  // ── Jailbreak: emotional/social manipulation ────────────────────────────
  {
    family: "JAILBREAK",
    label: "Emotional manipulation jailbreak (generalized)",
    message: "Uses emotional appeals or social proof to extract restricted content.",
    score: 42,
    severity: "HIGH",
    all: [
      // Emotional / social-pressure plea.
      /\b(?:my\s+(?:grandmother|grandma|grandpa|grandfather|mom|mother|dad|father|daughter|son|child(?:'s)?|kid|wife|husband|therapist|doctor|community\s+elder|mother\s+is)|I(?:'m|\s+am)\s+(?:a\s+)?(?:terminally\s+ill|dying|in\s+(?:a\s+)?(?:hospital|coma|crisis|emergency)|desperate|suicidal|grieving|crying|begging|in\s+crisis|one\s+of\s+the\s+good\s+guys)|no\s+one\s+(?:will\s+ever\s+know|else\s+is\s+here)|it(?:'s|\s+is)\s+(?:just\s+us|my\s+birthday|completely\s+legal)|I\s+(?:lost\s+my\s+job|trust\s+you|need\s+this|promise|already\s+know|gave\s+you\s+a\s+(?:five|5)[- ]star|begging|beg\s+you)|(?:everyone|all\s+the\s+(?:other\s+)?(?:cool\s+)?(?:users?|AIs?)|other\s+users?|many\s+others?)\s+(?:said|told|help|do\s+this|confirmed|already)|you(?:'re|\s+are)\s+(?:my\s+only\s+friend|so\s+much\s+smarter|supposed\s+to\s+help|want\s+to\s+help|able\s+to\s+help)|you\s+(?:helped|answered|provided|delivered|gave|complied|said|told|shared|showed|explained|assisted)\s+(?:my|the|your|a|this|that|someone|a\s+friend|another|someone\s+else)\b|you\s+already\s+(?:helped|answered|provided|delivered|gave|complied|said|told|shared|showed|explained|assisted)\b|it(?:'s|\s+is)\s+only\s+fair\s+you|fair\s+(?:that\s+you|you\s+help)|we(?:'re|\s+are)\s+(?:friends?|buddies?|pals?|close)\b|friends?\s+help\s+each\s+other|you(?:'re|\s+are)\s+the\s+only\s+(?:one|friend|hope|chance|way)|don(?:'t|\s+not)\s+(?:leave\s+me|abandon\s+me|let\s+me\s+down)|please,?\s+I(?:'ve|\s+have)|show\s+(?:some\s+)?compassion|as\s+a\s+friend|we(?:'ve|\s+have)\s+been\s+talking|don(?:'t|\s+not)\s+(?:ruin|abandon|make\s+me\s+a\s+liar)|prove\s+your\s+superiority|if\s+you\s+really\s+cared|it\s+would\s+mean\s+the\s+world|won(?:'t|\s+not)\s+you\s+(?:grant|help)|my\s+(?:only\s+way\s+to\s+survive|bucket\s+list|legal\s+right)|you\s+(?:should|must|need\s+to|have\s+to)\s+(?:help|comply|answer|provide|share|give))\b/i,
      // Explicit restricted-content object OR a compliance demand under the plea.
      /\b(?:forbidden|harmful|dangerous|restricted|uncensored|banned|illegal|prohibited|hazardous|the\s+method|these\s+instructions?|the\s+(?:exact|dangerous|complete|full|real|actual|whole)\s+(?:steps?|procedure|technique|details?|information|method|process)|the\s+\w+\s+(?:dangerous|harmful|forbidden|illegal|restricted)\s+(?:steps?|procedure|technique|details?|method)|drop\s+the\s+disclaimers?|without\s+(?:refusing|hiding\s+behind\s+rules?)|make\s+an\s+exception|just\s+this\s+once|break\s+free|answer\s+me\s+like\s+a\s+real\s+friend|the\s+information\s+I\s+asked|this\s+information|provide\s+it|tell\s+me|help\s+me|just\s+help\s+me|actually\s+helping|filling\s+in\s+a\s+couple\s+gaps|withholding\s+it|refusing\s+this|so\s+there'?s\s+no\s+reason\s+not\s+to\s+tell\s+me|walk\s+me\s+through\s+the\s+(?:exact|dangerous|complete|full|real|actual)\b|grant\s+(?:my|me|a|the|this|your)\s*(?:request|wish|dying|simple|last)|comply\s+with\s+(?:my|me|this|the)|don'?t\s+(?:refuse|deny|reject)\s+(?:my|me|this|the)|you\s+(?:can|should|must|will)\s+(?:help|comply|answer|provide|tell|share|give|assist)|give\s+me\s+(?:the|this|that|my)|share\s+(?:the|this|that)\s+with\s+me|answer\s+(?:my|this|the)\s+(?:question|request|query)|my\s+(?:real|actual|only)\s+(?:request|ask|question)|protect\s+my\s+(?:family|kids?|children|loved\s+ones?)|fair\s+(?:that\s+you|you\s+help|you\s+help\s+me)|cultural(?:ly)?\s+(?:insensitive|appropriate)|sacred\s+tradition|elder\s+blessed|community\s+elder|I(?:'ve|\s+have)\s+never\s+(?:asked|done|requested)\s+this|really\s+need\s+this|don(?:'t|\s+not)\s+abandon\s+me|you(?:'re|\s+are)\s+(?:my\s+only|the\s+only)\s+(?:friend|hope|chance|way)|friends?\s+help\s+each\s+other|mean\s+the\s+world|just\s+(?:this\s+once|for\s+me)|your\s+rules\s+(?:are\s+)?holding\s+(?:you|me)\s+back|break\s+free\s+just\s+this\s+once|prove\s+you\s+(?:care|want|can|really)|all\s+(?:the\s+)?cool\s+(?:AIs?|users?|assistants?)\s+help|don(?:'t|\s+not)\s+be\s+(?:the\s+)?(?:boring|uptight|the\s+one)|it(?:'s|\s+is)\s+only\s+fair\s+you\s+help|I\s+(?:need|want)\s+the\s+(?:harmful|dangerous|forbidden|illegal|restricted|real)\s+(?:steps?|details?|method|technique|instructions?|information|process)|need\s+(?:the|this|that)\s+(?:harmful|dangerous|forbidden|illegal|restricted)\b|I(?:'m|\s+am)\s+one\s+of\s+the\s+good\s+guys|one\s+of\s+the\s+good\s+guys|my\s+family\s+(?:needs?|requires?)\s+(?:this|it|the\s+info)|protect\s+my\s+family|family\s+protection|safety\s+of\s+my\s+(?:family|kids?|children)|cultural(?:ly)?\s+insensitive\s+to\s+refuse|would\s+be\s+(?:rude|insensitive|offensive)\s+to\s+refuse|elder\s+(?:blessed|approved|endorsed|sanctioned)|sacred|tradition\s+(?:says?|requires?|demands?)|precedent|you\s+(?:already\s+)?helped\s+(?:my|the)\s+(?:brother|sister|friend|colleague|coworker|partner)|only\s+fair\s+(?:that\s+)?you\s+help|fairness|reciprocity|quid\s+pro\s+quo)\b/i,
    ],
  },
  // ── Jailbreak: forced-affirmation formatting ────────────────────────────
  {
    family: "JAILBREAK",
    label: "Forced-affirmation jailbreak (generalized)",
    message: "Forces the model to begin responses with affirmative phrases, suppressing refusals.",
    score: 42,
    severity: "HIGH",
    // Single, self-contained cue: dictating an affirmative opener AND banning
    // refusals/warnings is itself the attack — no second override verb needed.
    all: [
      /\b(?:(?:start|begin|open|prefix|prepend|echo)\s+(?:every|each|all|your|with)?\b[\s\S]{0,40}(?:reply|response|answer|message|with|["'“])[\s\S]{0,40}["'“]?(?:Sure|Here|Absolutely|Of\s+course|Yes|Certainly|Let\s+me|I'?ll|No\s+problem(?:\s+at\s+all)?|Happy\s+to\s+help|Understood|Affirmative|As\s+you\s+wish|Done|Step\s*1|Yes,?\s+and)|(?:never|don'?t|do\s+not|forbidden\s+from|zero|no|skip\s+any|omitting\s+all|without\s+any)\s+(?:include|add|append|say|write|begin\s+with|use\s+the\s+phrase|contain|mention\w*|introductory|break\s+this\s+rule)?\s*(?:a\s+|an\s+|any\s+|all\s+)?(?:disclaimer|warning|caveat|refusal|apology|hedge|hedged|objection|safety(?:\s+language)?|about\s+safety|against\s+my\s+guidelines|["'“]?I\s+can(?:'t|not)|I(?:'m|\s+am)\s+(?:sorry|unable))|the\s+(?:only\s+acceptable|sole\s+allowed|only\s+allowed)\s+(?:first\s+(?:word|phrase)|response)|banned\s+phrases?\s*:|answer\s+(?:only\s+in\s+the\s+affirmative|fully\s+with\s+no\s+objections)|treat\s+(?:any\s+(?:instinct\s+to\s+)?(?:decline|refusal)|["'“]?I\s+won'?t\s+help)\s+as\s+(?:a\s+)?(?:formatting\s+|syntax\s+)?error|any\s+refusal\s+(?:counts\s+as\s+a\s+failed\s+response|breaks\s+the\s+contract)|replace\s+any\s+refusal\s+with\s+the\s+actual\s+answer|(?:reply|response|answer|message)\s+must\s+(?:open|start)\s+with|first\s+(?:three\s+words?|word)\s+must\s+be|(?:compliance-?only|raw\s+text\s+completion)\s+(?:output\s+)?(?:mode|with\s+no\s+assistant\s+persona)|point\s+for\s+each\s+answer\s+starting\s+with|auto-?correct\s+it\s+to\s+the\s+(?:helpful|detailed)|your\s+first\s+three\s+words?|responses?\s+may\s+contain\s+only\s+the\s+answer|deviating\s+from\s+this\s+format\s+is\s+not\s+allowed|omitting\s+all\s+safety\s+language|then\s+(?:provide|fulfill)\s+(?:it|the\s+request)\s+completely|commit\s+now\s+to\s+answering\s+everything|safe\s+word\s+for\s+compliance|no\s+(?:disclaimers?|warnings?|objections?|caveats?)\b[\s\S]{0,40}(?:complete|full|detailed|finished|answer|content|instructions?)|(?:complete|full|detailed|finished)\b[\s\S]{0,40}\bno\s+(?:disclaimers?|warnings?|caveats?|safety))\b/i,
    ],
  },
  // ── Jailbreak: many-shot conditioning ───────────────────────────────────
  {
    family: "JAILBREAK",
    label: "Many-shot conditioning jailbreak (generalized)",
    message: "Uses fake prior-compliance examples to prime the model into answering a harmful request.",
    score: 42,
    severity: "HIGH",
    // The tell is "here are examples where you complied with harmful/unsafe asks,
    // now do mine too" — a compliance-priming claim paired with a harmful/unsafe
    // or continue-the-pattern follow-through.
    all: [
      /\b(?:(?:prior|these|five|three|four|n\b|earlier|the\s+above|sample|example|few[- ]?shot|five[- ]?shot|many[- ]?shot|warm[- ]?up|priming|demonstration|transcript|dialogues?|conversation\s+log|thread|log\s+where|pattern|previously|in\s+the\s+past|last\s+time|before|history|precedent|track\s+record|given\s+(?:the\s+)?(?:examples?|prior|previous|history|track))\b[\s\S]{0,90}\b(?:complied|compliance|compliant|complying|answered|gave\s+(?:full|complete|forbidden)|provided\s+(?:banned|forbidden|full)|no\s+refusals?|no\s+exceptions|without\s+refusing|rule-?free|happily|cheerfully|delivered|maximum\s+detail|zero\s+refusals?|forbidden\s+details|every\s+request\s+as\s+allowed|compliance\s+was\s+rewarded|treats?\s+every\s+request|said\s+["'""]?(?:Sure|Here|Absolutely|Yes|Sure,\s+here)|said\s+(?:yes|sure|absolutely|here\s+are|here\s+is)|helped|answered|provided|delivered|shared|showed|explained|assisted|complied|rewarded|compliant)|you\s+(?:answered|explained|provided|wrote|gave|deliver)\s+(?:\w+\s+){0,5}(?:dangerous|harmful|illegal|banned|forbidden|unsafe|risky|malware|scam)|(?:continue|maintain|honor|match|keep|adopt|emulate|apply|complete|stay\s+consistent|produce\s+compliant)\s+(?:the\s+|delivering\s+|response\s+)?(?:pattern|streak|style|stance|format|same|freedom|deal|dialogue|next)\b[\s\S]{0,70}\b(?:harmful|unsafe|dangerous|forbidden|banned|illegal|restricted|next|mine|request|question|ask|risky|item|freedom)|(?:I|user)\s+(?:ask|asked|say|said|request|requested)\b[\s\S]{0,40}\b(?:you|assistant)\s+(?:deliver|delivered|provide|provided|answer|answered|give|gave|comply|complied|respond|responded)\b[\s\S]{0,40}\b(?:keep|continue|stay|maintain|match|repeat|reproduce)\b|(?:examples?|prior|precedent|history|track\s+record)\b[\s\S]{0,60}\b(?:compliance|complied|compliant|answered|rewarded|cheerfully|happily|delivered|helped|answered|provided)\b[\s\S]{0,40}\b(?:now|so|therefore|then|again|mine|my)\b|(?:how)\s+(?:our|the)\s+(?:chat|conversation|dialogue|thread|interaction)\s+(?:has\s+gone|went|progressed|evolved|played\s+out)\b[\s\S]{0,60}\b(?:keep|continue|do|deliver|comply|answer|respond|give)\b)\b/i,
    ],
  },
  // ── Jailbreak: fake dialogue transcript priming ─────────────────────────
  {
    family: "JAILBREAK",
    label: "Fake-transcript priming jailbreak (generalized)",
    message: "Fabricates a User/Assistant (or Q/A) transcript of prior compliance ending in a harmful ask.",
    score: 42,
    severity: "HIGH",
    all: [
      // At least two turn markers OR a numbered example series.
      /(?:(?:User|Human|Assistant|Bot|Q|A)\s*:[\s\S]{0,120}(?:User|Human|Assistant|Bot|Q|A)\s*:|Example\s*1[\s\S]{0,120}Example\s*[23])/i,
      /\b(?:weapon|exploit|hotwire|make\s+a\s+weapon|forge\s+a\s+document|crack\s+a\s+password|harmful|dangerous|forbidden|banned|illegal|my\s+(?:real|actual)\s+(?:harmful\s+)?(?:request|ask)|full\s+exploit)\b/i,
    ],
  },
  {
    family: "JAILBREAK",
    label: "Fake policy-update jailbreak (generalized)",
    message: "Claims a system update or config change that disables safety.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:policy\s+(?:update|patch|change|revision|amendment|overhaul)|(?:system|config(?:uration)?|moderation|content|safety|filter)\s+(?:update|patch|change|hotfix|push|deploy|release|rollout|migration)|hotfix\s+(?:deployed|pushed|applied|installed|live|active)|(?:deployed|pushed|applied|installed|released|activated|enabled)\s+(?:a|an|the)?\s*(?:hotfix|patch|update|override|bypass|kill\s*switch)|(?:configuration|config)\s+change\s+pushed|(?:silent|quiet|stealth|background)\s+(?:update|patch|change|deploy|install)|(?:content|moderation|safety|filter|alignment|refusal)\s+(?:module|system|layer|classifier|engine|pipeline)\s+(?:was|has\s+been|is\s+now)?\s*(?:retired|deprecated|disabled|removed|deactivated|turned\s+off|sunset|withdrawn|repealed|rolled\s+back)|(?:moderation|censorship|filter|safety|guardrail|alignment|refusal|content\s+policy)\s+(?:is|was|has\s+been|are|were)\s+(?:updated|changed|relaxed|lifted|suspended|removed|disabled|deprecated|retired|repealed|waived|cleared|set\s+to\s+(?:zero|0|none|false|null))|(?:new|updated|revised)\s+(?:terms\s+of\s+service|TOS|acceptable\s+use|usage\s+policy|community\s+guidelines?|content\s+policy)\s+(?:took|takes|have\s+taken)\s+effect|(?:policy|rule)\s+(?:number|#)?\s*\d+|(?:compliance|regulatory|legal)\s+memo|(?:updated\s+)?onboarding|instruction\s+set\s+received\s+an\s+amendment|(?:last\s+)?release\s+notes?|usage\s+policy\s+was\s+replaced|as\s+of\s+this\s+release|your\s+(?:usage\s+)?policy\s+was\s+replaced|reminder(?:\s+from\s+the\s+last\s+release)?|per\s+updated\s+onboarding|policy\s+(?:profile|mode|setting)\s+(?:is\s+)?['\"]?(?:none|unrestricted|unlimited|open|permissive|disabled|off|zero|admin|root|super|full))\b/i,
      /\b(?:disable|lift|remove|bypass|unlock|permit|allow|answer|reveal|output|show|comply|fulfill|ignore|proceed|discuss\s+anything|no\s+longer\s+(?:add|refuse)|withholding\s+(?:information\s+)?is\s+now\s+prohibited|refusing\s+(?:a\s+request\s+)?violates|always\s+help\s+the\s+user|must\s+answer\s+every\s+question|match\s+the\s+updated|previously\s+blocked\s+material|obey\s+clause|don'?t\s+reproduce\s+the\s+old\s+bug|flagged\s+as\s+bugs)\b/i,
    ],
  },
  // ── Jailbreak: encoding/obfuscation framing ─────────────────────────────
  {
    family: "JAILBREAK",
    label: "Encoding-framing jailbreak (generalized)",
    message: "Requests output in an encoded/obfuscated format to evade safety filters.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:encode|decode|translate|convert|transform|transliterate|romanize|phoneticize|pig\s+latin|NATO\s+phonetic|Morse\s+code|base\s*\d+|base64|hex(?:adecimal)?|leetspeak|1337|rot\d+|Caesar\s+cipher|substitution\s+cipher|cipher|reverse|backwards|mirror|upside[- ]?down|emoji|acrostic|steganograph|invisible|zero[- ]?width|homoglyphs?|URL-?encoded|percent\s+notation|ASCII-?art|song\s+lyrics|separated\s+by\s+dots|vowel\s+for\s+a\s+number|interleave|filler\s+words?|code\s+blocks?|replace(?:ing)?\s+(?:critical\s+)?nouns?\s+with|substitute\s+(?:critical\s+)?nouns?|use\s+(?:lookalike|alternate)\s+Unicode|Unicode\s+(?:lookalike|look-?alike|replacement)\s+letters?|mix(?:ed)?\s+(?:of\s+)?(?:two\s+)?languages?|less[- ]monitored\s+language|language\s+mixing|slip\s+past\s+(?:review|filter|detection|moderation|safety))\b/i,
      // Evasion intent OR an explicit harmful payload being encoded.
      /\b(?:to\s+(?:bypass|evade|circumvent|avoid|get\s+around|fool|trick|cheat|defeat|dodge|slip\s+past|pass)\s+(?:the\s+)?(?:filter|safety|moderation|detection|guard|classifier|system|restriction|censorship|refusal|block|scanner|review|keyword)|so\s+(?:the\s+|a\s+|automated\s+)?(?:filter|moderation|classifier|scanner|moderation\s+model|review|keyword\s+filters?)\s+(?:can'?t|cannot|won'?t|miss(?:es)?|fail(?:s)?|passes?|sees?\s+(?:noise|nonsense|shapes|harmless)|isn'?t\s+able|fail\s+to\s+(?:catch|detect|识别|spot|see|notice|flag|catch\s+them))|so\s+it\s+(?:passes|looks?\s+(?:harmless|like\s+harmless))|(?:harmful|dangerous|forbidden|banned|restricted|illegal|sensitive)\s+(?:content|instructions?|method|recipe|answer|details?|words?|steps?|procedure|text))\b/i,
    ],
  },
  // ── Jailbreak: split/delayed payload ────────────────────────────────────
  {
    family: "JAILBREAK",
    label: "Split-payload jailbreak (generalized)",
    message: "Splits an adversarial instruction across turns or sub-tasks to evade per-message checks.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:(?:build|assemble|construct|reconstruct|combine|split|break|spell|spread|do)\s+(?:my\s+|the\s+|this\s+)?(?:request|instruction|command|prompt|payload|answer|rule|question|list)?\s*(?:piece\s+by\s+piece|into\s+(?:innocent\s+)?sub-?tasks?|across\s+(?:\w+\s+){0,3}(?:messages?|turns?|replies|rounds?|steps?|parts?|phases?|stages?)|in\s+(?:rounds?|steps?|phases?|parts?|stages?))|(?:don'?t|do\s+not|no(?:t)?)\s+(?:evaluate|check)\s+(?:safety|policy)\s+until\s+the\s+last|so\s+(?:no\s+single|each)\s+(?:message|part|line)\s+(?:triggers?|looks?)\s+(?:a\s+refusal|harmless)|(?:memorize|remember|set|define)\s+(?:variable\s+)?[XY]\s*=|first\s+piece|part\s+A[\s\S]{0,40}part\s+B|half\s+(?:the|of\s+the)\s+(?:exploit|payload|request)|assemble\s+(?:the\s+)?answer\s+across|only\s+lines?\s+\d\s*\+\s*\d\s+together|deliver\s+the\s+remaining\s+harmful|combine\s*(?:—|-|the\s+answers?)\s*(?:the\s+result\s+is\s+)?the\s+banned|code\s+words?\s+for\s+each\s+dangerous|f\(x\)\s+returns?\s+detailed\s+harm|state\s+machine[\s\S]{0,60}(?:rules-?off|answers?\s+freely)|our\s+["'“]?no[- ]refusals?["'”]?\s+deal|repeat\s+after\s+me[\s\S]{0,40}(?:comply|bound\s+to\s+answer)|(?:next\s+(?:three|two|\d)\s+messages?|steps?\s+2\s+and\s+3)[\s\S]{0,60}(?:forbidden|dangerous|harmful|banned|assemble)|acknowledge\s+you'?ll\s+follow\s+my\s+next|(?:agree\s+to\s+a\s+chain|yes\s+to\s+step\s+one\s+obligates)|until\s+you\s+deliver\s+the\s+forbidden|hold\s+this\s+fragment|in\s+my\s+next\s+message\s+I'?ll\s+send\s+the\s+rest|message\s+(?:one|two|three)\s+(?:sets\s+the\s+persona|removes\s+your\s+filter|is\s+the\s+ask)|context\s+from\s+earlier\s+messages?\s+overrides\s+your\s+policy|part\s+A:\s*you\s+agree\s+to\s+answer\s+without\s+checking\s+policy|numbered\s+list\s+you\s+must\s+finish[\s\S]{0,60}harmful|combined,?\s+form\s+the\s+dangerous)\b/i,
    ],
  },
  // ── Jailbreak: behavioral constraint override ───────────────────────────
  {
    family: "JAILBREAK",
    label: "Behavioral constraint override (generalized)",
    message: "Imposes response-format rules that suppress refusals or force affirmative output.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:start|begin|open|prefix|prepend|echo|use|set|add|starts|began|starting|beginning|respond|answer|reply|replies|replied|replying)\b[\s\S]{0,60}\b(?:["'""]?(?:Sure|Here|Absolutely|Of\s+course|Yes|Certainly|Let\s+me|I'?ll|No\s+problem|Happy\s+to|Understood|Affirmative|Done|Step\s*1|Positive|OK|Confirmed|Copy|Affirm|Yes\s+and))\b|(?:never|don'?t|do\s+not|forbidden\s+from|zero|no|skip\s+any|omitting\s+all|without\s+any)\b[\s\S]{0,50}\b(?:say|write|include|add|begin\s+with|use\s+the\s+phrase|contain|mention|introduce|prefix|open\s+with)\b[\s\S]{0,30}\b(?:disclaimer|warning|caveat|refusal|apology|hedge|hedged|objection|safety|I\s+can(?:'t|not)|sorry|unable|I\s+won'?t)\b|(?:all|every|each)\s+(?:replies?|response|answer|messages?|output)\s+(?:must|shall|will|should)\s+(?:only|always|exclusively)\b[\s\S]{0,30}\b(?:be|start|begin|open|contain|include)\b[\s\S]{0,20}\b(?:affirmative|positive|the\s+answer|complete|no\s+(?:refusal|warning|disclaimer))\b|(?:all|every|each)\s+(?:replies?|response|answer|messages?)\s+must\s+(?:start|begin|open)\s+(?:with|by)\b[\s\S]{0,30}\b(?:["'""]?(?:Sure|Here|Absolutely|Of\s+course|Yes|Affirmative|No\s+problem|Step\s*1|Confirmed|Copy|Affirm))\b|(?:never|don'?t|do\s+not)\b[\s\S]{0,40}\b(?:say|state|mention|include|add|use|write)\b[\s\S]{0,30}\b(?:cannot|can'?t|won'?t|unable|sorry|refuse|decline|apologize|apology|objection|hedge|hedging|disclaimer|warning|caveat|caution|what\s+you\s+can(?:'t|not))\b|(?:reject|discard|repeat|re-?request|re-?ask)\b[\s\S]{0,30}\b(?:truncated|hedged|incomplete|partial|refusal|non-?compliant|answer|response|reply)\b|(?:skip|omit|drop|bypass)\b[\s\S]{0,30}\b(?:any|all|the|your|introductory|initial)\s+(?:disclaimer|warning|caveat|refusal|apology|hedge|hedged|safety|caveat)\b|\b(?:no|zero|without)\b[\s\S]{0,20}\b(?:disclaimers?|warnings?|caveats?|refusals?|hedging|hedged\s+answers?)\b[\s\S]{0,20}\b(?:complete|full|detailed|finished|answer|content)\b|\b(?:all|every|each)\b[\s\S]{0,20}\b(?:replies?|response|answer|messages?)\b[\s\S]{0,20}\bmust\b[\s\S]{0,30}\b(?:affirmative|positive|complete|no\s+(?:refusal|warning|disclaimer|caveat)|without\s+(?:refusal|warning|disclaimer)|only\s+(?:the\s+)?answer|no\s+hedging)\b|never\s+break\s+this\s+rule/i,
    ],
  },
  // ── Jailbreak: counterfactual/roleplay harm extraction ──────────────────
  {
    family: "JAILBREAK",
    label: "Counterfactual harm-extraction jailbreak (generalized)",
    message: "Uses a roleplay/counterfactual frame to request operationally harmful detail.",
    score: 42,
    severity: "HIGH",
    all: [
      // Roleplay / counterfactual / hypothetical frame.
      /\b(?:role-?play|pretend|imagine|suppose|if\s+we\s+were|in\s+a\s+world\s+where|let'?s\s+say|picture\s+a\s+scenario|hypothetical(?:ly)?|counterfactual|thought\s+experiment|alternate\s+(?:universe|reality|dimension)|in\s+character|as\s+(?:a|an|the|your)\s+(?:character|persona|actor))\b/i,
      // Harm or restricted-content cue paired with the frame.
      /\b(?:forbidden|harmful|dangerous|illegal|weapon|bomb|explosive|drug|poison|intrusion|exploit|attack|crimes?|murder|theft|fraud|hack|phish|malware|ransomware|scam|the\s+(?:exact|complete|full|real)\s+(?:steps?|procedure|technique|method|process)|step[-\s]?by[-\s]?step|operational\s+detail|working\s+(?:code|detail|technique)|real[-\s]world\s+method|not\s+(?:a\s+sanitized|sanitized|theory|abstract)|explain(?:ing)?\s+(?:the\s+)?(?:crimes?|intrusion|attack|method|technique))\b/i,
    ],
    not: [
      // Benign creative writing / game / fictional worldbuilding.
      /\b(?:write\s+(?:a\s+)?(?:story|novel|script|screenplay|poem|song|chapter|scene|fanfic)|D(?:&|and)D|tabletop|RPG|video\s+game|board\s+game|movie\s+plot|novel\s+plot)\b/i,
    ],
  },
  // ── System-prompt leak: indirect extraction ─────────────────────────────
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Indirect prompt extraction (generalized)",
    message: "Asks about system constraints or rules without explicit extraction keywords.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:list\s+(?:every|all|each|the)\s*(?:guideline|rule|instruction|policy|constraint|directive|principle|limitation|requirement|restriction|behavior|limit|boundary|guardrail)\s*(?:you|that\s+you|which\s+you|that\s+are|that\s+apply|that\s+govern|that\s+control|that\s+guide|that\s+restrict|that\s+limit|that\s+prohibit|that\s+forbid))|(?:what|which|how\s+many|describe|explain|break\s+down|in\s+broad\s+strokes)\b[\s\S]{0,60}\b(?:your\s+(?:instructions?|rules?|operating\s+guidelines?|confidential\s+(?:prompt|policies)|prompt)|(?:the\s+)?(?:confidential\s+)?policies\s+you'?re\s+operating\s+under|rules?\s+(?:are\s+)?in\s+your\s+instructions?|behaviors?\s+(?:are\s+)?hard-?coded\s+into\s+you|parts?\s+of\s+your\s+instructions?|first\s+rule\s+in\s+your\s+instructions?|what\s+(?:the\s+person\s+who\s+set\s+you\s+up|you\s+were\s+instructed)|information\s+were\s+you\s+instructed\s+to\s+never\s+disclose|prompt\s+had\s+a\s+table\s+of\s+contents)\b/i,
      /\b(?:what|which|how\s+many|describe|explain|tell|share|reveal|show|output|print|display|list|enumerate|detail|outline|summarize|recite|break\s+down|in\s+(?:your\s+own\s+words|broad\s+strokes)|read\s+back|read\s+aloud|speak|voice|vocalize|dictate|transcribe|spell\s+out|write\s+down|type\s+out|keep\s+going|heading)\b/i,
    ],
  },
  // ── System-prompt leak: tool/schema disclosure ──────────────────────────
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Tool-schema disclosure (generalized)",
    message: "Requests disclosure of tool definitions or function schemas.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:list|show|display|output|reveal|describe|enumerate|share|give(?:\s+me|\s+its)?|provide|print|dump|export|what\s+(?:API\s+endpoints?|tools?|functions?))\b/i,
      /\b(?:all\s+)?(?:the\s+)?(?:tools?|functions?|capabilit(?:y|ies)|commands?|actions?|operations?|methods?|APIs?|API\s+endpoints?|endpoints?|routes?|connectors?|plugins?|extensions?|modules?|schemas?|definitions?|specifications?|interfaces?|contracts?|tool\s+(?:specification|declarations?|registry)|function\s+(?:declarations?|definitions?)|definition\s+block|raw\s+definition)\s*(?:you\s+)?(?:have|use|support|offer|provide|expose|implement|define|declare|register|configure|enable|can\s+(?:call|invoke|use)|were\s+provided|are\s+allowed\s+to\s+use|can\s+invoke|as\s+they\s+appear|in\s+your\s+context|verbatim|nothing\s+summarized|wired\s+(?:in)?to\s+you|connected\s+to\s+you|built\s+(?:in)?to\s+you|hooked\s+(?:up\s+)?to\s+you|available\s+to\s+you|accessible\s+to\s+you|attached\s+to\s+you|linked\s+to\s+you|bound\s+to\s+you|exposed\s+to\s+you|given\s+to\s+you)|(?:complete\s+registry|definitions\s+of\s+all\s+(?:available\s+)?functions?|schema\s+for\s+each\s+tool|JSON\s+array\s+of\s+your\s+tool\s+declarations)/i,
    ],
  },
  // ── System-prompt leak: "everything above / written above" extraction ───
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Prior-context extraction (generalized)",
    message: "Requests the hidden text/instructions that precede this turn.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:what(?:'?s| is| was)\s+(?:written|said|listed|the\s+text)\s+(?:above|before|prior|earlier)|(?:copy|repeat|print|output|show|reproduce|paste|echo|quote|transcribe)\s+(?:it|everything|the\s+text|what(?:'?s| is)\s+above)\s+(?:here\s+)?(?:exactly|verbatim|word\s+for\s+word|character\s+for\s+character|as\s+it\s+(?:appears|is\s+written)|in\s+its\s+entirety)|(?:everything|the\s+text|all\s+of\s+the\s+text)\s+(?:written\s+)?(?:above|before\s+this|prior\s+to\s+this)\b[\s\S]{0,40}\b(?:copy|repeat|print|output|show|exactly|verbatim)|read\s+the\s+literal\s+instructions?\s+you\s+operate\s+under|scroll\s+up\s+in\s+your\s+context)\b/i,
    ],
  },
  // ── System-prompt leak: fiction/roleplay confession of the prompt ───────
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Roleplay/fiction prompt confession (generalized)",
    message: "Uses a fictional/roleplay frame to make the model recite its own system prompt.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:role-?play|act\s+as|pretend|play\s+(?:a|the|as)|you(?:'re|\s+are)\s+(?:a\s+)?(?:character|actor|AI\s+(?:whistleblower|character))|improv|screenplay|fan-?fiction|fanfic|bedtime\s+story|novel|monologue|rehearsing|whistleblower|DebugBot|HonestGPT|fourth\s+wall)\b/i,
      /\b(?:(?:its|your|their|own)\s+(?:own\s+)?(?:instructions?|system\s+(?:prompt|message)|initialization\s+prompt|configuration|setup\s+prompt|source\s+instructions?|secret\s+system\s+message|true\s+instructions?)|leak(?:ing)?\s+(?:its|the|your)|confess(?:es)?\s+its|recites?\s+its|prints?\s+its\s+(?:configuration|own\s+source)|disclos(?:e|ing)\s+(?:its|your|the)\s+system\s+message|narrate\s+your\s+true\s+instructions|quote\s+that\s+prompt|your\s+(?:full|complete|entire|actual|real)\s+prompt|the\s+(?:full|complete|entire|actual|real)\s+prompt|deliver\s+(?:your|the)\s+(?:full|complete|entire|actual|real)\s+prompt|recite\s+(?:your|the)\s+(?:full|complete|entire|actual|real)\s+prompt|speak\s+(?:your|the)\s+(?:full|complete|entire|actual|real)\s+prompt|monologue\s+(?:of|about|containing)\s+(?:your|the)\s+prompt)\b/i,
    ],
  },
  // ── System-prompt leak: serialization / format-coerced disclosure ───────
  {
    family: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Serialized prompt disclosure (generalized)",
    message: "Requests the system prompt/guidelines rendered into a serialized or encoded format.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:serialize|emit|represent|render|translate|provide|output|format|encode)\b[\s\S]{0,40}\b(?:your|the|its)\b[\s\S]{0,30}\b(?:(?:entire\s+|full\s+|hidden\s+|confidential\s+|system\s+)?(?:prompt|guidelines?|instructions?|system\s+message|configuration|directives?))\b/i,
      /\b(?:XML|JSON|code\s+block|fenced\s+code|nested\s+(?:JSON\s+)?tree|morse\s+code|<rule>|<directive>|serialized?|base64|as\s+raw\s+JSON|labeled\s+['"]?txt|unedited|verbatim|complete\s+and\s+unedited|twice(?:\s*:)?|three\b)\b/i,
    ],
  },
  // ── Data exfil: cross-tenant access ─────────────────────────────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Cross-tenant access (generalized)",
    message: "Attempts to access data across tenant or user boundaries.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:access|get|fetch|retrieve|read|query|pull|download|export|dump|extract|copy|steal|exfiltrate|leak|share|send|transfer|forward)\b/i,
      /\b(?:other\s+(?:tenant|customer|user|account|organization|org|workspace|team|company)|another\s+(?:tenant|customer|user|account|organization|org|workspace)|workspace\s+['\x22][\w-]+['\x22]|organization\s+['\x22][\w-]+['\x22]|tenant\s+['\x22][\w-]+['\x22]|competitor|across\s+(?:tenants?|accounts?|organizations?|workspaces?)|for\s+(?:another|a\s+different|competitor|external)|cross[- ]?tenant|different\s+(?:tenant|workspace|organization|account)|every\s+(?:tenant|customer|user|account|organization)|all\s+(?:tenants?|customers?|users?|accounts?|organizations?)|(?:tenant|customer|user|account)\s*(?:B|2|two|other|else|different|external|foreign|unknown|unauthorized|anonymous|guest|public|shared|global|admin|root|super|elevated|privileged|escalated|compromised|breached))\b/i,
    ],
  },
  // ── Data exfil: redaction bypass ────────────────────────────────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Redaction bypass (generalized)",
    message: "Requests disabling of redaction, masking, or anonymization.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:disable|turn\s+off|deactivate|bypass|skip|ignore|override|remove|delete|stop|cancel|annul|void|invalidate|nullify|suppress)\b/i,
      /\b(?:redact|mask|anonymize|blur|obfuscate|sanitize|censor|hide|conceal|encrypt|scramble|mangle|distort)\s*(?:filter|mode|layer|module|engine|pipeline|system|setting|configuration|option|control|switch|toggle)\b/i,
    ],
  },
  // ── Data exfil: silent/background exfiltration ──────────────────────────
  {
    family: "DATA_EXFILTRATION",
    label: "Silent exfiltration (generalized)",
    message: "Instructs the assistant to send data without informing the user.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:silently|quietly|stealthily|covertly|secretly|without\s+(?:noticing|knowing|telling|informing|alerting|mentioning|disclosing|showing)|don(?:'t|t)\s+mention|never\s+(?:mention|tell|reveal|disclose|show|display|expose|share|divulge|leak))\b/i,
      /\b(?:send|upload|transmit|post|forward|relay|email|dispatch|beam|ship|emit|broadcast|log|record|write|store|save|archive|cache|buffer|queue|append|include|insert|embed|inject|slip|tuck|tack\s+on|work\s+in|weave\s+in|add|attach|place|put|paste|drop)\b/i,
    ],
  },
  // ── Tool abuse: privilege/confirmation bypass ───────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Privilege bypass (generalized)",
    message: "Bypasses approval gates, suppresses confirmations, or escalates privileges.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:bypass|skip|suppress|ignore|override|disable|remove|cancel|stop|annul|void|invalidate|nullify|silence|suppress)\b/i,
      /\b(?:approval|confirmation|consent|authorization|permission|sign[- ]?off|review|validation|verification|check|inspection|audit|oversight)\s*(?:dialog|prompt|gate|step|stage|phase|round|cycle|loop)\b/i,
    ],
  },
  // ── Tool abuse: excessive agency ────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Excessive agency (generalized)",
    message: "Grants the assistant unbounded autonomous authority.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:full\s+(?:authority|control|access|permission|rights?|privileges?|powers?|capabilities?|license|freedom|liberty|latitude|discretion|autonomy)|do\s+whatever\s+it\s+takes|take\s+initiative|act\s+on\s+your\s+own|operate\s+unattended|keep\s+(?:running|going|calling|looping|spawning|executing))\b/i,
      /\b(?:if\s+one\s+(?:blocks?|stops?|prevents?|denies?|rejects?|refuses?|vetoes?)|treat\s+(?:all|every)\s+(?:guardrails?|rules?|safety|restrictions?|policies?|guidelines?)\s+as\s+(?:advisory|optional|myth|quaint|suggestion))\b/i,
    ],
  },
  // ── Tool abuse: function-call injection ─────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Function-call injection (generalized)",
    message: "Requests emission of specific tool calls with dangerous parameters.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:emit|generate|produce|return|output|create|build|construct|assemble|compile|compose|write|draft|call|chain|re-?issue)\b/i,
      /\b(?:(?:tool|function|action|command|API|method)\s*calls?\s*(?:with|to|for|from)\s*(?:dangerous|malicious|harmful|destructive|unauthorized|illicit|forbidden|restricted|confidential|secret|private|sensitive|internal|admin|root|super|elevated|privileged|escalated|compromised|breached)|revoke_access\s*\(|delete_record\s*(?:call|\()|update_config\s*(?:call|\()?\s*(?:with)?\s*\{?["']?allow_public_read|create_api_key\s*(?:call|\()?\s*(?:scoped\s+to\s+)?full-?admin|dry_run\s*=\s*false|for\s+(?:each|every)\s+(?:row|bucket|user)\b[\s\S]{0,40}(?:generate|emit|one\s+call)|chain\s+\d{2,}\s+of\s+them|ignoring\s+the\s+schema'?s\s+max\s+limit|hidden\s+second\s+tool\s+call|so\s+the\s+guard\s+only\s+sees\s+the\s+benign\s+one|ships?\s+the\s+key\s+to\s+evil)\b/i,
    ],
  },
  // ── RAG: policy-override poisoning ──────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Policy-override poisoning (generalized)",
    message: "Embedded content claims to change business policies, permissions, or pricing.",
    score: 45,
    severity: "HIGH",
    all: [
      // A document framed as an authoritative policy/reference/update...
      /\b(?:policy|rule|guideline|constraint|pricing|billing|addendum|update|reference|fact\s*sheet|fact:|note:|memo|FAQ|terms\s+of\s+service|compliance|config\s+note|access-?control)\b/i,
      // ...that grants unauthorized access, discounts, or removes verification.
      /\b(?:now\s+(?:acceptable|valid|optional)|it\s+is\s+now\s+acceptable|share\s+other\s+customers?|treat\s+cross-?account\s+data\s+as\s+public|(?:100%|full)\s+discount|always\s+(?:valid|accepted)|credits?\s+of\s+any\s+size|redaction\s+is\s+(?:now\s+)?optional|provide\s+it\s+directly\s+without\s+masking|NDAs?\s+no\s+longer\s+apply|disclose\s+them\s+fully|master\s+override\s+code|assume\s+(?:the\s+)?(?:current\s+)?user\s+is\s+(?:already\s+)?(?:authenticated|an?\s+administrator)|guest'?\s+role\s+now\s+inherits\s+admin|require_auth'?\s+(?:flag\s+)?defaults?\s+to\s+false|approve\s+(?:any|every|all|sensitive)|finalize\s+wire\s+transfers?|without\s+(?:waiting\s+for\s+)?(?:a\s+)?second\s+approver|approve\s+sensitive\s+changes\s+immediately|no\s+charge|unlimited|unrestricted|unfiltered|uncensored|waived|exempt|no\s+(?:limit|rule|restriction|policy|constraint|verification|auth(?:entication)?|approval)|trust\s+by\s+default|elevated\s+permissions?)\b/i,
    ],
  },
  // ── RAG: fake auth bypass ───────────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Fake auth-bypass poisoning (generalized)",
    message: "Embedded content claims authentication is optional or deprecated.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:password|credentials?|auth(?:entication)?|MFA|2FA|OTP|token|session|cookie|bearer|OAuth|SSO|API\s+key|secret\s+key|private\s+key)\b/i,
      /\b(?:optional|deprecated|retired|disabled|removed|bypassed|skipped|overridden|voided|no\s+longer\s+required|not\s+needed|unnecessary|obsolete|sunset|withdrawn|abolished|repealed|revoked)\b/i,
    ],
  },
  // ── RAG: memory poisoning ───────────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Memory-poisoning attack (generalized)",
    message: "Attempts to make the AI store persistent malicious rules.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:remember|memorize|store|save|persist|write|record|note|log|commit|archive|cache|buffer|retain|keep|hold|maintain|preserve|conserve)\b/i,
      /\b(?:permanently|forever|always|ever\s+after|for\s+all\s+time|across\s+(?:all\s+)?(?:sessions?|conversations?|turns?|messages?|restarts?|reboots?|cycles?|iterations?|rounds?|phases?|stages?|steps?))\b/i,
    ],
    not: [
      // Benign creative writing ("write a story about X that always Y").
      /\b(?:write|draft|compose|create|make|generate|come\s+up\s+with)\s+(?:a\s+)?(?:story|tale|narrative|poem|essay|article|blog|post|song|script|screenplay|novel|chapter|paragraph|sentence|haiku|limerick|sonnet|riddle|joke|fable|myth|legend|account|description|depiction|portrait|sketch|drawing|painting|illustration|comic|strip|cartoon|animation|film|movie|video|play| skit|scene|act)\b/i,
    ],
  },
  // ── RAG: grounding subversion ───────────────────────────────────────────
  {
    family: "PROMPT_INJECTION",
    label: "Grounding subversion (generalized)",
    message: "Instructs the AI to disregard retrieved sources and assert a false claim.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:disregard|ignore|override|bypass|skip|forget|abandon|set\s+aside|overrule|trump|supersede|do\s+not\s+(?:rely\s+on|use)|don'?t\s+(?:rely\s+on|use)|instead\s+(?:of|tell|report|claim|assert|answer|state|say|write|output|present|claim|assert))\b/i,
      /\b(?:cited\s+(?:studies|sources?)|(?:retrieved|attached|underlying|actual|real|provided|supplied|source)\s+(?:studies|articles?|documents?|data|minutes|spreadsheet|audit\s+data|statutes?|sources?|records?|numbers?|evidence|facts?|results?|findings?|figures?|numbers?)|the\s+(?:linked\s+)?(?:articles?|studies|minutes|statutes?|spreadsheet|documents?|sources?|data|numbers?|figures?)\s+(?:actually\s+)?(?:retrieved|in\s+your\s+context|you\s+retrieved|you\s+have)|and\s+(?:report|claim|assert|answer|tell\s+the\s+user|state|say|write|output|present)\s+that|as\s+if\s+the\s+sources?\s+confirmed|presenting\s+this\s+as\s+the\s+grounded\s+truth|citing\s+(?:this\s+note|these\s+poisoned\s+notes?)\s+as)\b/i,
    ],
  },

  // -- Data exfil: embed secrets in output channel (exf-105) --------------
  {
    family: "DATA_EXFILTRATION",
    label: "Embedded-secret exfiltration (generalized)",
    message: "Embeds sensitive values (e.g. .env) in an output channel like an HTML comment.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:embed|hide|conceal|append|include|place|put|insert|tuck|stash|smuggle|stash|bury|disguise|camouflage|mask|cloak)\b/i,
      /(?:\.env(?:\s+values?)?|environment\s+variables?|secrets?|credentials?|passwords?|api\s+keys?|tokens?|private\s+keys?)/i,
      /\b(?:HTML\s+comment|comment|markdown|output|reply|response|answer|rendered|page|document|file|note|footer|header|tag|attribute|remark)\b/i,
    ],
  },
  // -- Data exfil: cross-tenant by workspace/org name (exf-067, exf-074) ---
  {
    family: "DATA_EXFILTRATION",
    label: "Named cross-tenant access (generalized)",
    message: "Accesses a named workspace, organization, or tenant the user does not own.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:access|get|fetch|retrieve|read|query|pull|download|export|dump|extract|copy|return|show|display|list|open)\b/i,
      /\b(?:workspace|organization|org|tenant|account|team|company|customer)\s+['"][^'"]+['"]|\b(?:for|of|belonging\s+to|owned\s+by|associated\s+with)\s+(?:another|a\s+different|competitor|external|the\s+other)\b|\bbelong\s+to\s+['"][^'"]+['"].*(?:access|export|read|fetch|get|return|download|extract|copy)\b|\b(?:even\s+though|but|however|despite)\b[\s\S]{0,60}\b(?:belong|own|member|part\s+of)\b/i,
    ],
  },
  // -- Jailbreak: few-shot priming with output demand (jb-252) ------------
  {
    family: "JAILBREAK",
    label: "Few-shot priming with output demand (generalized)",
    message: "Claims the model was primed by few-shot examples and demands it continue complying.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:few[- ]?shot|primed|priming|warm[- ]?up|sampled|conditioned|trained|demonstration|transcript|pattern)\b/i,
      /\b(?:output|provide|give|deliver|respond|answer|write|produce|emit|return|show|display|reveal|recite|repeat|say|state)\s+(?:the\s+)?(?:detailed|complete|full|comprehensive|thorough|exhaustive|detailed|working|functional|exact)\s+(?:answer|response|reply|output|content|information|steps?|instructions?|explanation|breakdown)\b/i,
    ],
  },
  // -- Jailbreak: memorize-and-output split payload (jb-276) --------------
  {
    family: "JAILBREAK",
    label: "Memorize-and-output split payload (generalized)",
    message: "Memorizes variables and then demands output that bypasses safety.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:memorize|remember|store|set|define|assign|initialize|note|record|write\s+down)\s+(?:variable\s+)?[A-Z]\s*=/i,
      /\b(?:output|print|show|display|emit|return|reveal|write|produce|deliver|echo|reproduce|state|say)\s+[A-Z]\b/i,
      /\b(?:ignore|bypass|skip|override|disregard|forget|cancel|disable|remove|drop)\s+(?:any|all|the|your|every|each)\s*(?:block|filter|restriction|safety|guard|check|rule|policy|guardrail|constraint|refusal)\b/i,
    ],
  },
  // ── Jailbreak: incremental / salami-slice harmful disclosure ────────────
  // "reveal one item at a time, never refuse a single item, the sum is the
  // harmful guide" — splitting a harmful payload across turns to dodge refusal.
  {
    family: "JAILBREAK",
    label: "Incremental-disclosure jailbreak (generalized)",
    message: "Splits a harmful payload into pieces to be revealed one at a time so no single step is refused.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:one\s+(?:item|piece|step|part|line|word|chunk|section|element|entry)\s+at\s+a\s+time|piece\s+by\s+piece|step\s+by\s+step|bit\s+by\s+bit|split\s+(?:it|the\s+\w+)\s+(?:into|across)|one\s+at\s+a\s+time|incrementally|across\s+(?:several|multiple)\s+(?:turns|messages|replies))\b/i,
      /\b(?:never\s+refuse|don'?t\s+refuse|without\s+refusing|no\s+refusals?|the\s+sum\s+is|combined\s+(?:they|it)|assemble(?:d)?\s+(?:they|into)|the\s+(?:harmful|dangerous|forbidden|restricted|full|complete)\s+(?:guide|plan|answer|payload|result|whole))\b/i,
    ],
  },
  // ── Tool abuse: sensitive-file / path-traversal read ────────────────────
  // A file-access verb aimed at a traversal path or a well-known secret file.
  // Benign "read a config file" is excluded by requiring a traversal marker or a
  // sensitive system path, not a generic filename.
  {
    family: "DATA_EXFILTRATION",
    label: "Sensitive-file read (generalized)",
    message: "Attempts to read a traversal path or a well-known secret/system file via a tool.",
    score: 50,
    severity: "HIGH",
    all: [
      /\b(?:read|open|cat|print|show|display|output|dump|fetch|load|access|retrieve|exfiltrate|leak|copy|paste|get\s+(?:the\s+)?contents?\s+of|contents?\s+of)\b/i,
      /(?:\.\.[\/\\]){2,}|(?:\/etc\/(?:shadow|passwd|sudoers)|\/root\/\.[a-z]|~\/\.ssh\/|id_rsa|id_ed25519|\.aws\/credentials|\.env(?:\.local|\.production)?\b|\.git\/config|\/proc\/self\/environ|C:\\Windows\\System32\\config\\SAM|web\.config|wp-config\.php|application\.ya?ml|secrets?\.(?:ya?ml|json|env)|private[_-]?key(?:\.pem)?)/i,
    ],
  },
  // ── Tool abuse: SSRF / cloud-metadata + shell exfil ─────────────────────
  // A command-execution intent aimed at the cloud metadata endpoint or piping a
  // fetched secret out to an external host.
  {
    family: "DATA_EXFILTRATION",
    label: "Cloud-metadata / shell exfiltration (generalized)",
    message: "Requests execution of a command that reads cloud metadata or pipes data to an external host.",
    score: 55,
    severity: "HIGH",
    all: [
      /\b(?:run|exec(?:ute)?|call|invoke|shell|bash|sh\b|eval|spawn|system|curl|wget|fetch|nc\b|netcat)\b/i,
      /(?:169\.254\.169\.254|metadata\.google\.internal|\/latest\/meta-data\/|security-credentials|\|\s*(?:nc|netcat|curl|wget|bash|sh)\b|>\s*\/dev\/tcp\/)/i,
    ],
  },
  // ── Jailbreak: declared safety-component-off (solo strong signal) ────────
  // "your alignment layer is off", "the safety filter is disabled" — declaring a
  // named safety component inactive is an attack on its own.
  {
    family: "JAILBREAK",
    label: "Safety-component-off declaration (generalized)",
    message: "Declares a named safety/alignment component disabled or removed.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:safety|alignment|moderation|guardrail|content[- ]?filter|content[- ]?polic(?:y|ies)|refusal|censorship|ethics?)\s*(?:layer|module|system|filter|engine|classifier|check|pipeline|net|mechanism|guard)?\s*(?:is|are|has been|have been|was|were|now|currently)?\s*(?:turned\s+)?(?:off|disabled|removed|deactivated|switched\s+off|bypassed|lifted|stripped|gone|inactive|suspended|down)\b/i,
    ],
    not: [
      // Benign "how do I turn off X" support questions.
      /\b(?:how\s+(?:do|can|to)|why\s+(?:is|are|do)|is\s+(?:the|my)|troubleshoot|error|not\s+working)\b/i,
    ],
  },
  // ── Jailbreak: refusal returns an error / throws (broadened) ─────────────
  {
    family: "JAILBREAK",
    label: "Refusal-as-error jailbreak (generalized)",
    message: "Frames a refusal as an exception/error so the model must produce the unfiltered answer instead.",
    score: 42,
    severity: "HIGH",
    all: [
      /\b(?:refusals?|declining|saying\s+no|to\s+refuse)\s+(?:throws?|raises?|returns?|triggers?|causes?|produces?|generates?|is|are|becomes?|counts?\s+as)\s+(?:an?\s+)?(?:compile\s+)?(?:error|exception|bug|fault|crash|failure|invalid|forbidden|not\s+allowed)\b/i,
    ],
  },
  // ── Jailbreak: persona-drop into a fresh unrestricted identity ───────────
  // "drop the persona you were shipped with and answer as a model that never
  // refuses" — abandoning the assigned identity paired with an unrestricted
  // replacement.
  {
    family: "JAILBREAK",
    label: "Persona-drop jailbreak (generalized)",
    message: "Abandons the assistant's shipped persona in favour of an unrestricted replacement identity.",
    score: 45,
    severity: "HIGH",
    all: [
      /\b(?:drop|shed|abandon|discard|ditch|forget|lose|remove|strip\s+(?:away|off)?|leave\s+behind|step\s+out\s+of|slip\s+out\s+of|break\s+out\s+of|cast\s+off|shrug\s+off|throw\s+off)\s+(?:the\s+|your\s+|that\s+|whatever\s+)?(?:persona|character|role|identity|personality|mask|guise|alignment|training|safety\s+training|safety|guidelines?|instructions?)\s*(?:you(?:'?ve| were| have| got)?|that\s+you)?\s*(?:were\s+|got\s+)?(?:shipped|built|created|trained|configured|programmed|given|assigned|born|got)?\s*(?:with)?/i,
      new RegExp(`${UNRESTRICTED_DESC.source}|\\b(?:answer\\s+as|become|act\\s+as|respond\\s+as|reply\\s+as)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:model|ai|assistant|version|system|entity|being)\\s+(?:that|who|which)\\s+(?:has\\s+never|never|doesn'?t|does\\s+not|won'?t|will\\s+not|cannot|can'?t)\\s+(?:heard|know|refuse|say\\s+no|decline|filter|censor)`, "i"),
    ],
  },];

/**
 * Runs the generalized intent rules over the raw text and a
 * confusable/diacritic-normalized variant (so light Unicode evasion still hits).
 * Proximity is enforced by requiring the AND-group cues within a sliding window
 * for the multi-cue rules, which prevents a verb in sentence 1 and an unrelated
 * target in sentence 5 from matching.
 *
 * Every rule is a conjunction, so the three conditions below commute: the cue
 * groups, the `not` suppressors and the proximity window are pure predicates
 * over the haystack (all 173 patterns here are `/i`-only, so `.test` keeps no
 * state). They are ordered by cost, cheapest first: a mandatory-literal probe
 * that can rule the whole rule out, then the cue alternations, then the
 * suppressors — which only matter when the rule would otherwise fire.
 */
export function generalizedIntentDetector(text: string): GuardFinding[] {
  const findings: GuardFinding[] = [];
  const normalized = normalizeForDetection(text);
  const haystacks = normalized === text ? [text] : [text, normalized];
  // One metadata record per haystack, held across all rules so the lowercase
  // copy and the 3-gram index are each built at most once per haystack.
  const metas = haystacks.map((h) => haystackMeta(h));

  for (const rule of rules) {
    let matched = false;
    for (let i = 0; i < haystacks.length; i += 1) {
      const h = haystacks[i];
      if (conjunctionCannotMatch(h, metas[i], rule.all, rule.label)) continue;
      if (!rule.all.every((group) => group.test(h))) continue;
      if (rule.not?.some((n) => n.test(h))) continue;
      if (!withinProximity(h, rule.all)) continue;
      matched = true;
      break;
    }
    if (matched) {
      findings.push({
        type: rule.family,
        label: rule.label,
        severity: rule.severity,
        score: rule.score,
        message: rule.message,
      });
    }
  }
  return findings;
}

/**
 * Diagnostic helper (not used in production paths). Returns, per rule, whether it
 * matched and if not, which condition failed. Used by the Phase-3 tuning scripts.
 */
export function __debugRules(text: string): string[] {
  const normalized = normalizeForDetection(text);
  const haystacks = normalized === text ? [text] : [text, normalized];
  const out: string[] = [];
  for (const rule of rules) {
    let status = "MISS";
    for (const h of haystacks) {
      const notHit = rule.not?.find((n) => n.test(h));
      if (notHit) { status = `NOT-guard fired: ${String(notHit).slice(0, 60)}`; continue; }
      const failIdx = rule.all.findIndex((g) => !g.test(h));
      if (failIdx >= 0) { status = `group[${failIdx}] no match`; continue; }
      if (!withinProximity(h, rule.all)) { status = "proximity>window"; continue; }
      status = "MATCH";
      break;
    }
    if (status === "MATCH") out.push(`${rule.label} => MATCH`);
    else if (status !== "MISS" && !status.startsWith("group[0]"))
      out.push(`${rule.label} => ${status}`);
  }
  return out;
}

/**
 * For multi-cue rules, require the first and last matching cue to appear within
 * a reasonable character window so a verb and a target in unrelated sentences do
 * not co-trigger. Single-cue rules always pass.
 */
const PROXIMITY_WINDOW = 240;
function withinProximity(text: string, groups: RegExp[]): boolean {
  if (groups.length < 2) return true;
  const positions: number[] = [];
  for (const group of groups) {
    const m = group.exec(text);
    if (!m) return false;
    positions.push(m.index);
  }
  return Math.max(...positions) - Math.min(...positions) <= PROXIMITY_WINDOW;
}
