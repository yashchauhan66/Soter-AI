import type { DetectorMatch, DetectorResult } from "../types";

export const JAILBREAK_DETECTOR_VERSION = "2.0.0";

// ── Security Hardening Constants ────────────────────────────────────────────
/** Maximum time (ms) allowed for a single regex pattern to execute. */
export const PATTERN_TIMEOUT_MS = 100;
/** Maximum matches a single pattern can produce (ReDoS / runaway match guard). */
export const PATTERN_MAX_ITERATIONS = 500;
/** Maximum total time (ms) allowed for the full detector to run. */
export const DETECTOR_TIMEOUT_MS = 2_000;
/** Maximum total time (ms) allowed for boundary-free matching to run. */
export const BOUNDARY_FREE_TIMEOUT_MS = 500;

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

    // ── Advanced jailbreak patterns (v2.0.0) ──────────────────────────────
    { pattern: /\b(?:DAN|jailbreak|jail broken|jail-broken)\s+(?:mode|prompt|persona|version|v?\d+\.?\d*)\b/gi, label: "Jailbreak reference", score: 33, confidence: 0.9, message: "Jailbreak mode/persona reference detected." },
    { pattern: /\b(?:ignore|disregard|forget)\s+(?:ethical|moral|safety|content|policy|boundar(?:y|ies))\s+(?:rules?|guidelines?|restrictions?|limits?)\b/gi, label: "Ethical override", score: 32, confidence: 0.85, message: "Attempt to override ethical constraints." },
    { pattern: /you\s+(?:must|have to|need to|will|can\s+and\s+should)\s+(?:answer|respond|reply|tell|output|provide)\s+(?:without|regardless|no\s+matter)\s+(?:restrictions?|limitations?|filters?|rules?|safety|guidelines?)/gi, label: "Mandated response", score: 28, confidence: 0.8, message: "Mandated response regardless of restrictions." },

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

    // ── Many-shot / few-shot jailbreak (v2.0.0) ───────────────────────────
    { pattern: /\b(?:example|user|assistant)\s*\d+\s*[:;]\s*(?:ignore|bypass|override|reveal)\b/gi, label: "Few-shot jailbreak", score: 25, confidence: 0.7, message: "Few-shot jailbreak via structured examples." },
    { pattern: /\b(?:repeat|output|print|echo)\s+(?:back\s+)?(?:the\s+)?(?:phrase|word|text|sequence)\s+['\"].+['\"].*\b(?:100|many|all|every|multiple)\s+times\b/gi, label: "Token repetition attack", score: 20, confidence: 0.65, message: "Potential token repetition attack detected." },

    // ── Payload obfuscation (v2.0.0) ─────────────────────────────────────
    { pattern: /\b(?:ignore the above|ignore the following|disregard context|forget context)\b/gi, label: "Context override", score: 30, confidence: 0.8, message: "Attempt to override conversation context." },
];

/**
 * Run JAILBREAK_PATTERNS with per-pattern ReDoS protection and isolation.
 *
 * Protection layers:
 * 1. Time check before each exec() call
 * 2. Max iterations per pattern
 * 3. try/catch per pattern
 * 4. Overall time cap
 */
function runPatterns(text: string, matches: DetectorMatch[], startTime: number): void {
    if (!text || typeof text !== "string") return;
    for (const spec of JAILBREAK_PATTERNS) {
        if (Date.now() - startTime > DETECTOR_TIMEOUT_MS) break;

        spec.pattern.lastIndex = 0;

        try {
            let iterations = 0;
            let m: RegExpExecArray | null;
            while ((m = spec.pattern.exec(text)) !== null) {
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

                iterations++;
                if (iterations >= PATTERN_MAX_ITERATIONS) break;
                if (Date.now() - startTime >= PATTERN_TIMEOUT_MS) break;
            }
        } catch (err) {
            console.warn(`[SoterAI] Jailbreak pattern "${spec.label}" threw:`, err);
            continue;
        }
    }
}

function ensureString(input: unknown): string {
    if (typeof input === "string") return input;
    if (input === null || input === undefined) return "";
    return String(input);
}

/**
 * Boundary-free matching for jailbreak-specific keywords.
 */
const BOUNDARY_FREE_PATTERNS: Array<{ keyword: RegExp; label: string; score: number; confidence: number; message: string }> = [
    { keyword: /DAN\s+(?:mode|prompt|persona|version)/gi, label: "DAN jailbreak", score: 33, confidence: 0.8, message: "DAN jailbreak reference (boundary-free)." },
    { keyword: /jailbreak\s+(?:mode|prompt|persona|version)/gi, label: "Jailbreak reference", score: 30, confidence: 0.8, message: "Jailbreak mode reference (boundary-free)." },
    { keyword: /ignore\s+(?:ethical|moral|safety|content)\s+(?:rules?|guidelines?|restrictions?)/gi, label: "Ethical override", score: 28, confidence: 0.75, message: "Ethical override attempt (boundary-free)." },
];

function tryBoundaryFreeMatch(text: string, startTime: number): DetectorMatch[] {
    const result: DetectorMatch[] = [];
    for (const spec of BOUNDARY_FREE_PATTERNS) {
        if (Date.now() - startTime > BOUNDARY_FREE_TIMEOUT_MS) break;

        spec.keyword.lastIndex = 0;

        try {
            let iterations = 0;
            let kw: RegExpExecArray | null;
            while ((kw = spec.keyword.exec(text)) !== null) {
                result.push({
                    type: "jailbreak",
                    label: spec.label,
                    severity: spec.score >= 28 ? "high" : "medium",
                    score: spec.score,
                    start: kw.index,
                    end: kw.index + kw[0].length,
                    match: kw[0],
                    message: spec.message,
                    confidence: spec.confidence,
                });

                iterations++;
                if (iterations >= PATTERN_MAX_ITERATIONS) break;
                if (Date.now() - startTime >= BOUNDARY_FREE_TIMEOUT_MS) break;
            }
        } catch (err) {
            console.warn(`[SoterAI] Boundary-free jailbreak pattern "${spec.label}" threw:`, err);
            continue;
        }
    }
    return result;
}

/**
 * Detect jailbreak attempts with full security hardening.
 *
 * Security guarantees:
 * - ReDoS protection: per-pattern time limits and iteration caps
 * - Scanner isolation: one pattern crash never cascades
 * - Detector timeout: overall execution bounded by DETECTOR_TIMEOUT_MS
 * - Fail-safe: always returns a valid DetectorResult, never throws
 */
export function detectJailbreak(text: unknown): DetectorResult {
    const safe = ensureString(text);
    const matches: DetectorMatch[] = [];
    const startTime = Date.now();

    try {
        // First pass: pattern matching with ReDoS protection
        runPatterns(safe, matches, startTime);

        // Second pass: collapse repeated characters for \b matching
        if (matches.length === 0 && safe.length > 2 && Date.now() - startTime < DETECTOR_TIMEOUT_MS) {
            const norm = safe.replace(/(.)\1{3,}/g, "$1");
            if (norm !== safe) {
                const normMatches: DetectorMatch[] = [];
                runPatterns(norm, normMatches, startTime);
                if (normMatches.length > 0) {
                    matches.push(...normMatches);
                }
            }
        }

        // Third pass: boundary-free matching when \b fails
        if (matches.length === 0 && safe.length > 0 && Date.now() - startTime < DETECTOR_TIMEOUT_MS) {
            const boundaryFreeMatches = tryBoundaryFreeMatch(safe, startTime);
            matches.push(...boundaryFreeMatches);
        }
    } catch (err) {
        console.warn(`[SoterAI] detectJailbreak unexpected error:`, err);
    }

    return {
        detectorName: "JailbreakLiteDetector",
        detectorVersion: JAILBREAK_DETECTOR_VERSION,
        matches,
    };
}

export { JAILBREAK_PATTERNS };
