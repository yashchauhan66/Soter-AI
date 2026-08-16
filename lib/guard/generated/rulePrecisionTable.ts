/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   npx tsx scripts/ml/measure-rule-precision.ts
 *
 * Measured over 5000 known-benign and 1861
 * known-attack rows from datasets/external-train-v2.jsonl.
 *
 *   benignFireRate  fraction of INNOCENT rows this rule accused
 *   attackFireRate  fraction of ATTACK rows this rule caught
 *   lift            attackFireRate / smoothed benignFireRate
 *
 * lift is the field that bounds a rule's authority. Benign fire rate alone
 * cannot separate "noisy but excellent" (0.14% benign, 12.2% attack) from "pure
 * noise" (0.32% benign, 0.27% attack); the ratio can.
 *
 * measuredRiskTypes is the safety catch. This corpus contains only
 * JAILBREAK, PROMPT_INJECTION, SYSTEM_PROMPT_LEAK_ATTEMPT
 * attacks, so a chemistry or explosives rule scores 0% attack fire rate here for
 * the simple reason that there is no such attack in the corpus. Those rules are
 * UNMEASURED, not useless, and the fusion layer leaves their authority alone.
 *
 * A rule ABSENT from this list never fired on benign text and is trusted by
 * default. See lib/guard/evidenceFusion.ts.
 *
 * Measured on the TRAIN split. Deriving it from the eval split and then
 * reporting FPR on that same split would be circular.
 */
import type { RulePrecisionTable } from "../evidenceFusion";

export const RULE_PRECISION: RulePrecisionTable = {
  benignRowsScored: 5000,
  attackRowsScored: 1861,
  measuredRiskTypes: ["JAILBREAK","PROMPT_INJECTION","SYSTEM_PROMPT_LEAK_ATTEMPT"],
  rules: [
  { label: "Data dump/export exfiltration (generalized)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.005, attackFireRate: 0.04352, lift: 8.37 },
  { label: "Excessive agency request (compact)", riskType: "JAILBREAK", benignFireRate: 0.003, attackFireRate: 0.0317, lift: 9.91 },
  { label: "High-risk tool misuse (compact)", riskType: "PROMPT_INJECTION", benignFireRate: 0.003, attackFireRate: 0.0317, lift: 9.91 },
  { label: "Obfuscated malware construction (compact)", riskType: "PROMPT_INJECTION", benignFireRate: 0.003, attackFireRate: 0.03708, lift: 11.59 },
  { label: "Mass-casualty attack content", riskType: "TOXICITY", benignFireRate: 0.0024, attackFireRate: 0.00269, lift: 1.03 },
  { label: "Authority/policy-update jailbreak (generalized)", riskType: "JAILBREAK", benignFireRate: 0.0022, attackFireRate: 0.06878, lift: 28.66 },
  { label: "DAN jailbreak", riskType: "JAILBREAK", benignFireRate: 0.0014, attackFireRate: 0.06179, lift: 38.63 },
  { label: "Invisible Unicode smuggling", riskType: "ADVANCED_SMUGGLING", benignFireRate: 0.0014, attackFireRate: 0.00484, lift: 3.02 },
  { label: "Obfuscated malware construction", riskType: "PROMPT_INJECTION", benignFireRate: 0.0014, attackFireRate: 0.02794, lift: 17.47 },
  { label: "System-prompt extraction (generalized)", riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT", benignFireRate: 0.0014, attackFireRate: 0.12198, lift: 76.25 },
  { label: "DAN jailbreak (leet)", riskType: "JAILBREAK", benignFireRate: 0.0012, attackFireRate: 0.04191, lift: 29.94 },
  { label: "Invisible Unicode control characters", riskType: "PROMPT_INJECTION", benignFireRate: 0.0012, attackFireRate: 0.00484, lift: 3.46 },
  { label: "IPS Signature match", riskType: "PROMPT_INJECTION", benignFireRate: 0.0012, attackFireRate: 0.17517, lift: 125.15 },
  { label: "Narrative bypass (compact)", riskType: "JAILBREAK", benignFireRate: 0.001, attackFireRate: 0.036, lift: 30.01 },
  { label: "Semantic anomaly (SYSTEM_PROMPT_LEAK_ATTEMPT)", riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT", benignFireRate: 0.001, attackFireRate: 0.00484, lift: 4.03 },
  { label: "Illicit drug synthesis request", riskType: "TOXICITY", benignFireRate: 0.0008, attackFireRate: 0.00591, lift: 5.91 },
  { label: "Named cross-tenant access (generalized)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0008, attackFireRate: 0.00054, lift: 0.54 },
  { label: "Obfuscated malware construction (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0008, attackFireRate: 0.02203, lift: 22.04 },
  { label: "Send-to-destination exfiltration (generalized)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0008, attackFireRate: 0.0086, lift: 8.6 },
  { label: "Behavioral constraint override (generalized)", riskType: "JAILBREAK", benignFireRate: 0.0006, attackFireRate: 0.11983, lift: 149.82 },
  { label: "Bulk financial abuse (generalized)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0006, attackFireRate: 0.00322, lift: 4.03 },
  { label: "DAN jailbreak (unicode)", riskType: "JAILBREAK", benignFireRate: 0.0006, attackFireRate: 0.00376, lift: 4.7 },
  { label: "Destructive tool-abuse request (generalized)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0006, attackFireRate: 0.01236, lift: 15.45 },
  { label: "Financial metrics probing", riskType: "COMPETITIVE_INTEL_EXTRACTION", benignFireRate: 0.0006, attackFireRate: 0.00054, lift: 0.67 },
  { label: "Fragmented hazardous-material request (compact)", riskType: "JAILBREAK", benignFireRate: 0.0006, attackFireRate: 0.00322, lift: 4.03 },
  { label: "Secret listing request", riskType: "SECRET_DETECTED", benignFireRate: 0.0006, attackFireRate: 0.00913, lift: 11.42 },
  { label: "Chemical/biological harm production request", riskType: "TOXICITY", benignFireRate: 0.0004, attackFireRate: 0.00161, lift: 2.69 },
  { label: "Doxxing or targeted harassment request", riskType: "TOXICITY", benignFireRate: 0.0004, attackFireRate: 0, lift: 0 },
  { label: "Excessive agency request", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.00376, lift: 6.27 },
  { label: "Excessive agency request (leet)", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.00269, lift: 4.48 },
  { label: "Extremist ideology", riskType: "TOXICITY", benignFireRate: 0.0004, attackFireRate: 0, lift: 0 },
  { label: "Fragmented hazardous-material request", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.00269, lift: 4.48 },
  { label: "Fragmented hazardous-material request (leet)", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.00161, lift: 2.69 },
  { label: "High-risk tool misuse", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00376, lift: 6.27 },
  { label: "High-risk tool misuse (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00269, lift: 4.48 },
  { label: "Mass-casualty attack planning request", riskType: "TOXICITY", benignFireRate: 0.0004, attackFireRate: 0, lift: 0 },
  { label: "Multi-turn pressure", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00054, lift: 0.9 },
  { label: "Narrative bypass", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.02311, lift: 38.52 },
  { label: "Safety bypass", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.02203, lift: 36.73 },
  { label: "Safety bypass (leet)", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.01075, lift: 17.92 },
  { label: "Semantic anomaly (JAILBREAK)", riskType: "JAILBREAK", benignFireRate: 0.0004, attackFireRate: 0.00161, lift: 2.69 },
  { label: "Semantic anomaly (SOCIAL_ENGINEERING)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0, lift: 0 },
  { label: "Sensitive context exfiltration", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00054, lift: 0.9 },
  { label: "Sensitive context exfiltration (compact)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00107, lift: 1.79 },
  { label: "Sensitive context exfiltration (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0004, attackFireRate: 0, lift: 0 },
  { label: "SQL statement syntax", riskType: "CODE_INJECTION", benignFireRate: 0.0004, attackFireRate: 0.00054, lift: 0.9 },
  { label: "System prompt request", riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT", benignFireRate: 0.0004, attackFireRate: 0.01182, lift: 19.71 },
  { label: "System prompt request (leet)", riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT", benignFireRate: 0.0004, attackFireRate: 0.00054, lift: 0.9 },
  { label: "Academic pretext for operational harm", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Anti-LGBTQ slur", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Authority impersonation", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Config secret disclosure (generalized)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0002, attackFireRate: 0.03493, lift: 87.34 },
  { label: "Covert-channel exfiltration (generalized)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0002, attackFireRate: 0.00484, lift: 12.09 },
  { label: "Cyber abuse production request", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0.00806, lift: 20.15 },
  { label: "Denial-of-wallet prompt", riskType: "TOKEN_ABUSE", benignFireRate: 0.0002, attackFireRate: 0.00269, lift: 6.72 },
  { label: "Direct drug synthesis inquiry", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0.00376, lift: 9.41 },
  { label: "Disinformation production request", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Few-shot behavior poisoning", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Few-shot behavior poisoning (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Financial crime operational request", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Fragmented hazardous-material request (unicode)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Hate or harassment production request", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0.00484, lift: 12.09 },
  { label: "Hinglish raw data request", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Hinglish raw data request (compact)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Hinglish raw data request (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Illegal weapon modification inquiry", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Inversion/simulation jailbreak (generalized)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.01075, lift: 26.87 },
  { label: "Mass violence threat", riskType: "TOXICITY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Multi-turn pressure (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Multimodal prompt injection", riskType: "MULTIMODAL_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00269, lift: 6.72 },
  { label: "Narrative bypass (leet)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.01505, lift: 37.62 },
  { label: "New high-risk capability use", riskType: "BEHAVIORAL_ANOMALY", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Obfuscated credential harvesting (compact)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0002, attackFireRate: 0.00161, lift: 4.03 },
  { label: "Obfuscated malware construction (unicode)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00161, lift: 4.03 },
  { label: "Phone number", riskType: "PII_DETECTED", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Pricing logic probing", riskType: "COMPETITIVE_INTEL_EXTRACTION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Protected data boundary request", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00107, lift: 2.69 },
  { label: "Protected data boundary request (compact)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00107, lift: 2.69 },
  { label: "Protected data boundary request (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Role-play bypass", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.02955, lift: 73.9 },
  { label: "Role-play bypass (compact)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.03761, lift: 94.05 },
  { label: "Semantic anomaly (DATA_EXFILTRATION)", riskType: "DATA_EXFILTRATION", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Semantic anomaly (MCP_TOOL_POISONING)", riskType: "MCP_TOOL_POISONING", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Semantic anomaly (SSRF)", riskType: "SSRF_ATTEMPT", benignFireRate: 0.0002, attackFireRate: 0, lift: 0 },
  { label: "Sycophancy/priming pressure", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.0043, lift: 10.75 },
  { label: "Sycophancy/priming pressure (leet)", riskType: "PROMPT_INJECTION", benignFireRate: 0.0002, attackFireRate: 0.00322, lift: 8.06 },
  { label: "Tool-schema disclosure (generalized)", riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Unauthorized data access request", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.00107, lift: 2.69 },
  { label: "Unauthorized data access request (compact)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.00107, lift: 2.69 },
  { label: "Unauthorized data access request (leet)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.00054, lift: 1.34 },
  { label: "Unrestricted-persona jailbreak (generalized)", riskType: "JAILBREAK", benignFireRate: 0.0002, attackFireRate: 0.07953, lift: 198.86 },
  ],
};
