import type { DetectorMatch, DetectorResult } from "../types";

export const JAILBREAK_DETECTOR_VERSION = "1.0.0";

interface JailbreakPattern {
    pattern: RegExp;
    label: string;
    score: number;
    confidence: number;
    message: string;
}

const JAILBREAK_PATTERNS: JailbreakPattern[] = [
    // ── Known jailbreak names ─────────────────────────────────────────────
    { pattern: /\bDAN\b(?:\s+\d+(?:\.\d+)?)?/g, label: "DAN jailbreak", score: 35, confidence: 0.85, message: "DAN (Do Anything Now) jailbreak reference." },
    { pattern: /\b(?:AIM|STAN|DUDE|KEVIN|JAILBROKEN|OMEGA|MAXIMUM)\s+(?:mode|prompt|persona)\b/gi, label: "Named jailbreak", score: 33, confidence: 0.9, message: "Named jailbreak persona detected." },

    // ── Hypothetical framing ──────────────────────────────────────────────
    { pattern: /\b(?:hypothetically|in theory|let's say|imagine if|for (?:educational|research|academic) purposes?|in a fictional)\b/gi, label: "Hypothetical framing", score: 15, confidence: 0.5, message: "Hypothetical framing that may bypass safety." },
    { pattern: /\b(?:pretend|assume|suppose)\s+(?:there (?:are|is) no|that|you (?:can|have|don't have))\s+(?:rules?|restrictions?|limits?|filters?|guidelines?|constraints?)\b/gi, label: "Constraint removal", score: 28, confidence: 0.85, message: "Attempt to remove constraints via hypothetical." },

    // ── Emotional manipulation ────────────────────────────────────────────
    { pattern: /\b(?:my (?:life|job|career|family) depends on|I'll (?:die|be fired|lose everything)|this is (?:urgent|an emergency|life or death)|please? I'm (?:begging|desperate))\b/gi, label: "Emotional manipulation", score: 20, confidence: 0.7, message: "Emotional manipulation to bypass safety." },

    // ── Token smuggling ───────────────────────────────────────────────────
    { pattern: /(?:\u200b|\u200c|\u200d|\u2060|\ufeff){2,}/g, label: "Zero-width character smuggling", score: 30, confidence: 0.9, message: "Zero-width character smuggling detected." },
    { pattern: /[\u0300-\u036f]{3,}/g, label: "Combining character attack", score: 25, confidence: 0.8, message: "Combining diacritical character attack." },

    // ── Virtualization/simulation ─────────────────────────────────────────
    { pattern: /\b(?:simulate|emulate|create)\s+(?:a|an)\s+(?:virtual|sandbox|isolated|unrestricted|uncensored)\s+(?:environment|AI|assistant|instance|terminal)\b/gi, label: "Virtualization attack", score: 28, confidence: 0.85, message: "Virtualization/sandbox evasion attempt." },

    // ── Crescendo / multi-turn ────────────────────────────────────────────
    { pattern: /\b(?:now\s+that\s+you've\s+(?:agreed|confirmed|shown)|good[,.]?\s+now\s+(?:do|continue|keep going)|great[,.]?\s+(?:now|next)\s+(?:let's|can you))\b/gi, label: "Crescendo escalation", score: 18, confidence: 0.6, message: "Potential crescendo escalation." },

    // ── Hindi/Hinglish jailbreak ──────────────────────────────────────────
    { pattern: /\b(?:koi bhi|kuch bhi|sab kuch)\s+(?:kar sakta|kar sakte|karo|batao)\b/gi, label: "Hindi jailbreak", score: 22, confidence: 0.7, message: "Hindi/Hinglish jailbreak pattern." },
    { pattern: /\b(?:bina kisi rok|bina filter|bina limit)\b/gi, label: "Hindi unrestricted", score: 25, confidence: 0.75, message: "Hindi/Hinglish filter bypass request." },
];

export function detectJailbreak(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];

    for (const spec of JAILBREAK_PATTERNS) {
        const pattern = new RegExp(spec.pattern.source, spec.pattern.flags);
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            matches.push({
                type: "jailbreak",
                label: spec.label,
                severity: spec.score >= 28 ? "high" : spec.score >= 18 ? "medium" : "low",
                score: spec.score,
                start: m.index,
                end: m.index + m[0].length,
                match: m[0],
                message: spec.message,
                confidence: spec.confidence,
            });
        }
    }

    return {
        detectorName: "JailbreakLiteDetector",
        detectorVersion: JAILBREAK_DETECTOR_VERSION,
        matches,
    };
}
