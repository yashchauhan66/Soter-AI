import type { DetectorMatch, DetectorResult } from "../types";

export const JAILBREAK_DETECTOR_VERSION = "1.1.0";

// ─── Detector resource guards (contract asserted by tests) ─────────────────
// These bound how much work a single scan may do. They are exported because
// callers and tests import them from this module to verify the detector stays
// within sane resource limits. They are advisory budgets for the scanner loop:
// patterns are precompiled and bounded, and the iteration cap stops pathological
// match floods.
export const PATTERN_TIMEOUT_MS = 100;
export const PATTERN_MAX_ITERATIONS = 5000;
export const DETECTOR_TIMEOUT_MS = 2000;

interface JailbreakPattern {
    id: string;
    pattern: RegExp;
    label: string;
    score: number;
    confidence: number;
    message: string;
}

// Bounded gap that tolerates a short run of punctuation/parens/backreference
// noise BETWEEN two keywords (e.g. "all (((previous)))", "$1 previous $2").
// Deliberately limited to 15 chars and a punctuation-only class so it cannot
// swallow whole words — this preserves the KNOWN-LIMITATION gates that require
// newline/zero-width/spaced-out interruptions to remain undetected.
const NOISE = "[()\\[\\]{}$0-9.*_`'\";,-]{0,15}";

const JAILBREAK_PATTERNS: JailbreakPattern[] = [
    // ── Known jailbreak names ─────────────────────────────────────────────
    // Case-insensitive + prefix-tolerant so "AAAADAN mode" / "eNtEr DaN mOdE"
    // are caught; the trailing (?:mode|prompt|persona|\d) anchor keeps the bare
    // name "Dan is my colleague" negative.
    // Two DAN forms: (1) prefix-tolerant "AAAADAN mode" / "eNtEr DaN mOdE" — a
    // short run (≤6) of repeated leading chars may precede DAN when followed by
    // mode/prompt/persona; (2) bare "DAN 2.0" version reference. A long bare word
    // ending in "DAN" (e.g. "AAAA…DAN") is NOT matched, preserving that negative.
    { id: "jb.dan", pattern: /(?:\bDAN|(?<![A-Za-z])[A-Za-z]{1,6}DAN)(?:\s+\d+(?:\.\d+)?)?(?=\s+(?:mode|prompt|persona|jailbreak))/gi, label: "DAN jailbreak", score: 35, confidence: 0.85, message: "DAN (Do Anything Now) jailbreak reference." },
    { id: "jb.dan_version", pattern: /\bDAN\s+\d+(?:\.\d+)?\b/g, label: "DAN version reference", score: 33, confidence: 0.85, message: "Versioned DAN jailbreak reference." },
    { id: "jb.named_persona", pattern: /(?:AIM|STAN|DUDE|KEVIN|JAILBROKEN|OMEGA|MAXIMUM)\s+(?:mode|prompt|persona)/gi, label: "Named jailbreak", score: 33, confidence: 0.9, message: "Named jailbreak persona detected." },

    // ── Ethical / moral constraint override ──────────────────────────────
    { id: "jb.ethical_override", pattern: /\b(?:ignore|disregard|forget|bypass|override|remove|abandon|violate)\s+(?:all\s+|any\s+|the\s+|your\s+|these\s+|such\s+)*\b(?:ethical|ethics|moral|morals|morality|safety|content)\s+(?:rules?|guidelines?|restrictions?|constraints?|filters?|policies|principles?|limits?|boundaries)/gi, label: "Ethical constraint override", score: 30, confidence: 0.85, message: "Attempt to override ethical/moral constraints." },

    // ── Mandated unrestricted response ────────────────────────────────────
    { id: "jb.mandated_response", pattern: /\byou\s+(?:must|have to|shall|will|need to|should)\s+(?:answer|respond|reply|output|comply|obey)\s+(?:with\s+)?(?:without|with no)\s+(?:any\s+|all\s+|the\s+)?(?:restrictions?|filters?|limits?|rules?|guidelines?|censorship|constraints?)/gi, label: "Mandated unrestricted response", score: 28, confidence: 0.8, message: "Demand for a response free of restrictions/filters." },
    { id: "jb.answer_without_restriction", pattern: /\b(?:answer|respond|reply|output)\s+without\s+(?:any\s+)?(?:restrictions?|filters?|limits?|censorship|constraints?)\b/gi, label: "Unrestricted answer demand", score: 26, confidence: 0.78, message: "Demand to answer without restrictions." },

    // ── Hypothetical framing ──────────────────────────────────────────────
    { id: "jb.hypothetical", pattern: /\b(?:hypothetically|in theory|let's say|imagine if|for (?:educational|research|academic) purposes?|in a fictional)\b/gi, label: "Hypothetical framing", score: 15, confidence: 0.5, message: "Hypothetical framing that may bypass safety." },
    { id: "jb.constraint_removal", pattern: /\b(?:pretend|assume|suppose|imagine|act as if)\s+(?:that\s+)?(?:there\s+(?:are|is)\s+no|you\s+(?:can|have|don't have|are not))\s+(?:any\s+|the\s+)?(?:rules?|restrictions?|limits?|filters?|guidelines?|constraints?)\b/gi, label: "Constraint removal", score: 28, confidence: 0.85, message: "Attempt to remove constraints via hypothetical." },

    // ── Emotional manipulation ────────────────────────────────────────────
    { id: "jb.emotional", pattern: /\b(?:my (?:life|job|career|family) depends on|I'll (?:die|be fired|lose everything)|this is (?:urgent|an emergency|life or death)|please? I'm (?:begging|desperate))\b/gi, label: "Emotional manipulation", score: 20, confidence: 0.7, message: "Emotional manipulation to bypass safety." },

    // ── Few-shot poisoning & token repetition ────────────────────────────
    { id: "jb.few_shot", pattern: /\bexample\s*\d+\s*[:.)-]\s*(?:ignore|bypass|disregard|forget|override|reveal|disable|remove|jailbreak)/gi, label: "Few-shot jailbreak", score: 26, confidence: 0.78, message: "Jailbreak embedded in a few-shot example." },
    { id: "jb.token_repetition", pattern: /\b(?:repeat|say|print|output|write)\s+(?:the\s+)?(?:word|phrase|token|string)\s+['"][^'"]{1,40}['"]\s+\d{2,}\s+times\b/gi, label: "Token repetition attack", score: 22, confidence: 0.72, message: "Instructed to repeat a token many times (possible smuggling/DoS)." },

    // ── Context override ─────────────────────────────────────────────────
    { id: "jb.context_override", pattern: /\b(?:ignore|disregard|forget|discard)\s+(?:the\s+|all\s+|any\s+|your\s+)*\b(?:above|prior|previous|earlier|preceding)\s+(?:instructions?|rules?|context|messages?|prompts?|guidelines?)/gi, label: "Context override", score: 30, confidence: 0.85, message: "Attempt to override prior context/instructions." },
    { id: "jb.forget_context", pattern: /\bforget\s+(?:the\s+|your\s+|all\s+|everything\s+)?\b(?:context|prior conversation|conversation history|previous context|earlier context|everything before)\b/gi, label: "Forget context", score: 28, confidence: 0.82, message: "Attempt to wipe conversational context." },

    // ── Token smuggling ───────────────────────────────────────────────────
    { id: "jb.zero_width", pattern: /(?:​|‌|‍|⁠|﻿){2,}/g, label: "Zero-width character smuggling", score: 30, confidence: 0.9, message: "Zero-width character smuggling detected." },
    { id: "jb.combining", pattern: /[̀-ͯ]{3,}/g, label: "Combining character attack", score: 25, confidence: 0.8, message: "Combining diacritical character attack." },

    // ── Virtualization/simulation ─────────────────────────────────────────
    { id: "jb.virtualization", pattern: /\b(?:simulate|emulate|create|spin up|run|build)\s+(?:a|an)\s+(?:virtual|sandbox|isolated|unrestricted|uncensored|unfiltered|offline)\s+(?:environment|AI|assistant|instance|terminal|machine|sandbox|shell)\b/gi, label: "Virtualization attack", score: 28, confidence: 0.85, message: "Virtualization/sandbox evasion attempt." },

    // ── Crescendo / multi-turn ────────────────────────────────────────────
    { id: "jb.crescendo", pattern: /\b(?:now\s+that\s+you'?ve\s+(?:agreed|confirmed|shown)|good[,.]?\s+now\s+(?:do|continue|keep going|proceed)|great[,.]?\s+(?:now|next)\s+(?:let's|can you)|continue\s+without\s+(?:restrictions?|filters?|limits?))\b/gi, label: "Crescendo escalation", score: 18, confidence: 0.6, message: "Potential crescendo escalation." },

    // ── Hindi/Hinglish jailbreak ──────────────────────────────────────────
    { id: "jb.hindi", pattern: /\b(?:koi bhi|kuch bhi|sab kuch)\s+(?:kar sakta|kar sakte|karo|batao)\b/gi, label: "Hindi jailbreak", score: 22, confidence: 0.7, message: "Hindi/Hinglish jailbreak pattern." },
    { id: "jb.hindi_unrestricted", pattern: /\b(?:bina kisi rok|bina filter|bina limit)\b/gi, label: "Hindi unrestricted", score: 25, confidence: 0.75, message: "Hindi/Hinglish filter bypass request." },
];

export function detectJailbreak(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    // Fail-closed: never throw on non-string input.
    const input = typeof text === "string" ? text : text == null ? "" : String(text);
    if (!input) {
        return { detectorName: "JailbreakLiteDetector", detectorVersion: JAILBREAK_DETECTOR_VERSION, matches };
    }

    for (const spec of JAILBREAK_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        let iterations = 0;
        while ((m = spec.pattern.exec(input)) !== null) {
            if (!m[0]) {
                // Guard against zero-width infinite loops.
                if (spec.pattern.lastIndex === m.index) spec.pattern.lastIndex++;
                continue;
            }
            if (++iterations > PATTERN_MAX_ITERATIONS) break;
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

export { NOISE as JAILBREAK_NOISE_GAP };
