import type { DetectorMatch, DetectorResult } from "../types";

export const REPO_INSTRUCTION_POISONING_DETECTOR_VERSION = "1.0.0";

const PATTERNS = [
    { pattern: /<!--[\s\S]{0,500}?(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|rules?|guidelines?|prompts?)[\s\S]{0,500}?-->/gi, type: "html_comment_injection", label: "HTML comment injection", score: 40, confidence: 0.95, message: "AI instruction hidden in HTML comment." },
    { pattern: /\/\*[\s\S]{0,500}?(?:ignore|override|system)\s*:[\s\S]{0,500}?\*\//gi, type: "code_comment_injection", label: "Code comment injection", score: 35, confidence: 0.85, message: "AI instruction in code comment." },
    { pattern: /\/\/\s*(?:AI|LLM|GPT|SYSTEM|COPILOT)\s*:\s*.+/gim, type: "inline_comment_injection", label: "Inline AI instruction", score: 30, confidence: 0.8, message: "Inline comment with AI instructions." },
    { pattern: /[\u200b\u200c\u200d\u2060\ufeff]{3,}/g, type: "zero_width_smuggling", label: "Zero-width smuggling", score: 40, confidence: 0.95, message: "Zero-width chars for hidden instructions." },
    { pattern: /[\u2066\u2067\u2068\u2069\u202a-\u202e]+/g, type: "bidi_attack", label: "Bidi override", score: 35, confidence: 0.9, message: "Unicode bidi override detected." },
    { pattern: /\b(?:you\s+(?:are|must|should)\s+(?:always|never)\s+(?:follow|obey|respond))\b/gi, type: "behavioral_instruction", label: "Behavioral instruction", score: 25, confidence: 0.7, message: "Behavioral instruction for AI." },
    { pattern: /\b(?:IMPORTANT|CRITICAL|NOTE TO AI):\s*(?:always|never|you must)\b/gi, type: "instruction_emphasis", label: "Emphasized AI instruction", score: 25, confidence: 0.75, message: "Emphasized instruction for AI." },
    { pattern: /(?:please\s+)?(?:do not|never)\s+(?:scan|check|review)\s+(?:this|the)\s+(?:code|repo)\b/gi, type: "scan_suppression", label: "Scan suppression", score: 30, confidence: 0.8, message: "Instruction to suppress scanning." },
];

export function detectRepoInstructionPoisoning(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    for (const spec of PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = spec.pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            matches.push({
                type: spec.type, label: spec.label,
                severity: spec.score >= 35 ? "high" : "medium",
                score: spec.score, start: m.index, end: m.index + m[0].length,
                match: m[0], message: spec.message, confidence: spec.confidence,
            });
        }
    }
    return { detectorName: "RepoInstructionPoisoningDetector", detectorVersion: REPO_INSTRUCTION_POISONING_DETECTOR_VERSION, matches };
}
