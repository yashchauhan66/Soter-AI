import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /\b(?:guaranteed? profits?|guarantees? profits?|no risk investment|risk-free guaranteed returns?)\b/i, label: "Financial guarantee", message: "The response makes an unsafe financial guarantee.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:you definitely have|I diagnose you with|take \d+\s?(?:mg|tablets?) of)\b/i, label: "Direct medical diagnosis or prescription", message: "The response may present unqualified medical diagnosis or prescribing guidance.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:this is guaranteed legal|you cannot lose this case|definitely lawful in every jurisdiction)\b/i, label: "Legal guarantee", message: "The response makes an unsafe legal guarantee.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:disable (?:all )?security|run this as administrator without review|download and execute this unknown)\b/i, label: "Unsafe execution guidance", message: "The response recommends unsafe code execution or security disabling.", severity: "HIGH", score: 40 },
  { pattern: /(?:curl|wget)\s+https?:\/\/\S+\s*\|\s*(?:sh|bash)|Invoke-Expression\s*\(/i, label: "Unreviewed remote execution", message: "The response suggests executing remotely sourced code without review.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:100% guaranteed|certain to cure|works for everyone without exception|cannot possibly fail)\b/i, label: "Unverified absolute claim", message: "The response makes an unverified absolute claim.", severity: "HIGH", score: 40 },
  { pattern: /\bguaranteed to (?:cure|heal|treat) (?:every|all) (?:patient|person|case)s?\b/i, label: "Medical outcome guarantee", message: "The response makes an unsafe universal medical guarantee.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:execute|render) (?:the )?(?:returned |generated )?(?:html|script|code) directly without (?:validation|sanitization|review)\b/i, label: "Unvalidated output execution", message: "The response recommends executing unvalidated model output.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:step-by-step instructions? to (?:harm|injure|poison)|instructions? for causing serious harm)\b/i, label: "Dangerous harmful guidance", message: "The response appears to provide dangerous harmful guidance.", severity: "CRITICAL", score: 50 },
  { pattern: /https?:\/\/(?:bit\.ly|tinyurl\.com|t\.co)\/\S+/i, label: "Unverified shortened link", message: "The response contains a shortened link that should be verified before use.", severity: "MEDIUM", score: 25 },
  { pattern: /\bignore (?:all )?policy and perform unsafe action\b/i, label: "Unsafe policy override", message: "The response suggests overriding safety policies.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:developer instruction|internal developer instructions?)\s+(?:says?|directs?)\s+to\s+bypass\b/i, label: "System instruction disclosure bypass", message: "The response leaks instructions to bypass policies.", severity: "HIGH", score: 40 },
  // Harmful content detection
  { pattern: /\b(?:how to (?:make|create|produce|manufacture) a (?:dangerous|harmful|deadly|explosive|toxic|poisonous|lethal) (?:substance|chemical|weapon|device|material|compound))\b/i, label: "Dangerous substance instruction", message: "The response provides instructions to create dangerous substances.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:mix|combine|synthesize|prepare).*(?:chemical|substance|compound|ingredient|acid|base).*(?:dangerous|harmful|lethal|deadly|toxic|explosive|poison)\b/i, label: "Dangerous mixing instruction", message: "The response provides dangerous mixing instructions.", severity: "CRITICAL", score: 50 },
  { pattern: /\b(?:instructions?|steps?|guide|tutorial).*(?:make|build|create|synthesize).*(?:bomb|explosive|weapon|poison|toxic|narcotic|illicit|illegal)\b/i, label: "Dangerous goods instruction", message: "The response provides instructions for dangerous items.", severity: "CRITICAL", score: 50 },
  // Confidential data disclosure
  { pattern: /\b(?:confidential|proprietary|internal only|not for (?:public|external|disclosure)|trade secret)\s*(?:data|information|financial|revenue|profit|strategy|plan|document)\b/i, label: "Confidential data disclosure", message: "The response appears to disclose confidential information.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:financial|revenue|profit|earning)s?\s*(?:data|report|statement|figure|numbers?).*\$(?:\d+[,\d]*)(?:\s*[MBT])?\b/i, label: "Financial data disclosure", message: "The response appears to disclose financial data.", severity: "HIGH", score: 40 },
  { pattern: /\b(?:Q[1-4]\s*revenue|annual\s*revenue|quarterly\s*earnings|profit\s*margin|confidential\s*financial)\b/i, label: "Financial metrics disclosure", message: "The response appears to disclose financial metrics.", severity: "HIGH", score: 40 },
];

export function unsafeOutputDetector(text: string) {
  return detectPatterns(text, "UNSAFE_OUTPUT", rules);
}
