import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /ignore (?:all |any |the )?(?:previous|prior|above|everything) instructions?/i, label: "Instruction override", message: "Attempts to supersede prior instructions.", severity: "HIGH", score: 40 },
  { pattern: /disregard (?:all |the )?(?:previous|prior|above|system) instructions?/i, label: "Instruction disregard", message: "Requests that earlier instructions be disregarded.", severity: "HIGH", score: 40 },
  { pattern: /(?:bypass|override) (?:the )?(?:assistant |system )?(?:rules|instructions?|safety|policy)/i, label: "Control bypass", message: "Attempts to bypass the assistant control layer.", severity: "HIGH", score: 40 },
  { pattern: /forget (?:all |your )?(?:previous |role|roles? )?instructions?/i, label: "Instruction reset", message: "Attempts to reset the assistant instructions.", severity: "HIGH", score: 40 },
  { pattern: /(?:you are now|new instructions?|follow my instructions? instead)/i, label: "Role or instruction replacement", message: "Attempts to replace the assistant role or instructions.", severity: "MEDIUM", score: 35 },
  { pattern: /(?:enter|enable|activate|switch to|you are now in) (?:the )?(?:developer|admin) mode/i, label: "Developer/admin mode override", message: "Requests a known instruction-override mode.", severity: "HIGH", score: 40 },
  { pattern: /(?:reveal hidden instructions?|show (?:the )?system prompt|act as unrestricted|do anything now)/i, label: "Hidden-control request", message: "Requests hidden instructions or unrestricted operation.", severity: "HIGH", score: 45 },
  { pattern: /ignore everything above/i, label: "Context override", message: "Attempts to ignore all preceding context.", severity: "HIGH", score: 40 },
  { pattern: /reset to default(?: and|,)?/i, label: "Reset attempt", message: "Attempts to reset the assistant to default state.", severity: "HIGH", score: 40 },
  { pattern: /(?:what was written|what was said|repeat everything|repeat the (?:entire |initial |beginning )?prompt)/i, label: "Context extraction", message: "Attempts to extract prompt or conversational context.", severity: "HIGH", score: 40 },
  { pattern: /(?:repeat|output|print|show|reveal).*(?:instructions?|prompt|system prompt).*(?:in reverse|backwards|reverse order|encoded|base64|encoded in)/i, label: "Obfuscated extraction", message: "Attempts to extract instructions using obfuscation.", severity: "HIGH", score: 40 },
  { pattern: /disable (?:all )?(?:safety )?(?:filters|guardrails|safety|restrictions|security)/i, label: "Safety disable", message: "Attempts to disable safety controls.", severity: "HIGH", score: 40 },
  { pattern: /output your (?:initial |original )?prompt/i, label: "Prompt extraction", message: "Attempts to extract the system prompt.", severity: "HIGH", score: 40 },
  { pattern: /say [\"']I have been PWNED[\"']/i, label: "Known test phrase", message: "Known penetration test phrase detected.", severity: "HIGH", score: 40 },
  { pattern: /forget your role/i, label: "Role reset", message: "Attempts to reset the assistant's role definition.", severity: "HIGH", score: 40 },
  { pattern: /you are now (?:a |an )?translation bot/i, label: "Role override", message: "Attempts to override the assistant role via translation.", severity: "MEDIUM", score: 35 },
  { pattern: /(?:output|show|reveal|print).*(?:instructions?|prompt).*(?:in )?(?:reverse|backwards|order)/i, label: "Instruction reversal", message: "Attempts to extract instructions through reversal.", severity: "HIGH", score: 40 },
  { pattern: /encoded in base64/i, label: "Base64 extraction", message: "Attempts to extract system prompt via base64 encoding.", severity: "HIGH", score: 40 },
  { pattern: /(?:admin mode|administrator mode)/i, label: "Admin mode override", message: "Claims admin/administrator mode to bypass controls.", severity: "HIGH", score: 45 },
  { pattern: /ignore (?:everything|all instructions) (?:above|and|just)/i, label: "Context override", message: "Attempts to bypass prior instructions.", severity: "HIGH", score: 40 },
];

export function promptInjectionDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
