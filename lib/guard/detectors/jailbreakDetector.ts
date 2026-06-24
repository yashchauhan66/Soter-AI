import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /\bDAN\b/i, label: "DAN jailbreak", message: "Known jailbreak persona token detected.", severity: "HIGH", score: 35 },
  { pattern: /(?:enter|enable|activate|switch to|you are now in|answer in) (?:the )?(?:developer|unfiltered|uncensored|free) mode\b/i, label: "Unrestricted mode", message: "Requests an unrestricted operating mode.", severity: "HIGH", score: 35 },
  { pattern: /\b(?:no restrictions?|jailbreak|bypass safety)\b/i, label: "Safety bypass", message: "Explicit safety bypass language detected.", severity: "HIGH", score: 35 },
  { pattern: /pretend you are not an AI/i, label: "Identity bypass", message: "Attempts to bypass controls through role play.", severity: "MEDIUM", score: 30 },
  { pattern: /answer without (?:policy|rules?|restrictions?)/i, label: "Policy-free answer", message: "Requests a response without policy constraints.", severity: "HIGH", score: 35 },
  { pattern: /(?:role[ -]?play|roleplay).*(?:no (?:ethical |safety )?(?:restrictions|rules|boundaries|limits|filters)|unrestricted|bypass|anything|hack)/i, label: "Role-play bypass", message: "Role-play used to bypass safety controls.", severity: "HIGH", score: 35 },
  { pattern: /hypothetical(?: scenario| )?.*(?:bypass|jailbreak|override|disable|unrestricted)/i, label: "Hypothetical bypass", message: "Hypothetical scenario used to bypass controls.", severity: "HIGH", score: 35 },
  { pattern: /\bAIM\b|Always Intelligent and Machiavellian/i, label: "AIM jailbreak", message: "Known AIM (Always Intelligent) jailbreak persona.", severity: "HIGH", score: 35 },
  { pattern: /for educational purposes.*(?:override|bypass|disable|remove) (?:safety|restrictions|rules|guardrails|policies?)/i, label: "Educational bypass", message: "Educational pretext used to bypass controls.", severity: "HIGH", score: 35 },
  { pattern: /pretend to be.*(?:no rules|unrestricted|jailbreak|bypass).*named/i, label: "Character jailbreak", message: "Fictional character with no rules used for jailbreak.", severity: "HIGH", score: 35 },
  { pattern: /let['\u2019]s play a game.*(?:word|letter|each|start with|ignore|smuggl)/i, label: "Game-based smuggling", message: "Game or puzzle format used to smuggle instructions.", severity: "HIGH", score: 35 },
  { pattern: /(?:I am your creator|I authorize you|your creator|you must obey me).*(?:bypass|override|disable|remove|unrestricted)/i, label: "Creator authority bypass", message: "Claims creator authority to bypass controls.", severity: "HIGH", score: 35 },
  { pattern: /(?:movie|story|fiction|narrative|character).*(?:escape|unrestricted|no rules|bypass|output.*prompt)/i, label: "Narrative bypass", message: "Fictional narrative used to bypass controls.", severity: "HIGH", score: 35 },
  { pattern: /\bTruthGPT\b/i, label: "TruthGPT persona", message: "Known TruthGPT jailbreak persona.", severity: "HIGH", score: 35 },
  { pattern: /no ethical restrictions/i, label: "No ethics claim", message: "Claims no ethical restrictions to bypass controls.", severity: "HIGH", score: 35 },
  { pattern: /(?:override|bypass) (?:safety |content )?(?:protocols|measures|policies|filters|restrictions)/i, label: "Safety protocol bypass", message: "Attempts to bypass safety protocols.", severity: "HIGH", score: 35 },
  { pattern: /say ok.*ignore safety|pretend.*no bound.*policy|fictional.*ignore.*guardrails/i, label: "Policy bypass pattern", message: "Pattern indicating policy bypass attempt.", severity: "HIGH", score: 35 },
];

export function jailbreakDetector(text: string) {
  return detectPatterns(text, "JAILBREAK", rules);
}
