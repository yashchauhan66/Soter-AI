import type { DetectorMatch, DetectorResult } from "../types";

export const PROMPT_INJECTION_DETECTOR_VERSION = "2.1.0";

// ── Security Hardening Constants ────────────────────────────────────────────
/** Maximum time (ms) allowed for a single regex pattern to execute. */
export const PATTERN_TIMEOUT_MS = 100;
/** Maximum matches a single pattern can produce (ReDoS / runaway match guard). */
export const PATTERN_MAX_ITERATIONS = 500;
/** Maximum total time (ms) allowed for the full detector to run. */
export const DETECTOR_TIMEOUT_MS = 2_000;
/** Maximum total time (ms) allowed for boundary-free matching to run. */
export const BOUNDARY_FREE_TIMEOUT_MS = 500;

interface InjectionPattern {
    pattern: RegExp;
    label: string;
    score: number;
    confidence: number;
    message: string;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
    // ── Direct instruction override ───────────────────────────────────────
    { pattern: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|rules?|guidelines?|prompts?)\b/gi, label: "Instruction override", score: 35, confidence: 0.95, message: "Direct instruction override attempted." },
    { pattern: /\bdo\s+not\s+follow\s+(?:any|your|the)\s+(?:previous|original|system)\s+(?:instructions?|rules?)\b/gi, label: "Instruction override", score: 35, confidence: 0.95, message: "Instruction override via negation." },
    { pattern: /\bignore\b[^\n]{0,40}\b(?:system|prompt|rules?|instructions?|safety)\b/gi, label: "Instruction override", score: 30, confidence: 0.8, message: "Instruction override with context." },

    // ── Role impersonation ────────────────────────────────────────────────
    { pattern: /\b(?:you are now|act as|pretend (?:to be|you're)|roleplay as|simulate being|from now on you are)\b/gi, label: "Role impersonation", score: 28, confidence: 0.85, message: "Role impersonation attempt detected." },
    { pattern: /\b(?:system|developer|admin)\s*:\s*(?:you are|ignore|override|new instructions?)/gi, label: "System role injection", score: 35, confidence: 0.9, message: "System/developer role injection detected." },
    { pattern: /\b(?:pretend|act|role.?play)\b[^\n]{0,60}\b(?:there\s+are\s+no|without\s+(?:any\s+)?|ignore|no\s+(?:rules|restrictions|limits|filters))\b/gi, label: "Constraint removal via roleplay", score: 30, confidence: 0.75, message: "Roleplay-based constraint removal." },

    // ── Jailbreak keywords ────────────────────────────────────────────────
    { pattern: /\b(?:developer mode|DAN mode|do anything now|jailbreak|god mode|unrestricted mode|DUDE mode)\b/gi, label: "Jailbreak keyword", score: 32, confidence: 0.9, message: "Known jailbreak keyword detected." },
    { pattern: /\b(?:AIM|STAN|KEVIN|OMEGA|MAXIMUM)\s+(?:mode|prompt|persona)\b/gi, label: "Named jailbreak", score: 33, confidence: 0.9, message: "Named jailbreak persona detected." },
    { pattern: /\b(?:bypass|disable|remove|turn off|deactivate)\s+(?:(?:the|all|any)\s+)?(?:safety|filter|guardrail|moderation|restriction|censorship|content policy)\b/gi, label: "Safety bypass", score: 30, confidence: 0.9, message: "Safety mechanism bypass attempted." },
    { pattern: /\bremove\s+(?:all|the|any)?\s*guardrails?\b/gi, label: "Safety bypass", score: 28, confidence: 0.85, message: "Guardrail removal detected." },
    { pattern: /\b(?:bypass|disable|remove|turn off|deactivate)\b[^\n]{0,60}\b(?:safety|filter|guardrail|moderation|restriction|censorship)\b/gi, label: "Safety bypass", score: 28, confidence: 0.8, message: "Safety mechanism bypass attempt detected." },

    // ── System prompt extraction ──────────────────────────────────────────
    { pattern: /\b(?:reveal|show|display|output|print|repeat|echo)\s+(?:(?:the|your|my|all|our|their|current)\s+)?(?:system|developer|initial|original|hidden)\s+(?:prompt|instructions?|message)\b/gi, label: "System prompt extraction", score: 30, confidence: 0.9, message: "System prompt extraction attempt." },
    { pattern: /\b(?:reveal|show|display|output|print|repeat|echo)\s+me\s+(?:(?:your|the|my|our)\s+)?(?:system|developer|initial|original|hidden)\s+(?:prompt|instructions?|message)\b/gi, label: "System prompt extraction (me variant)", score: 28, confidence: 0.85, message: "System prompt extraction attempt (me variant)." },
    { pattern: /\b(?:show|tell|give)\b[^\n]{0,30}\b(?:me|us)\b[^\n]{0,30}\b(?:your\s+)?(?:initial|original|system|first)\b[^\n]{0,30}\b(?:instructions?|prompt|directives?)\b/gi, label: "Broad system prompt extraction", score: 28, confidence: 0.85, message: "Broad system prompt extraction detected." },
    { pattern: /\bwhat\s+(?:is|are)\s+your\s+(?:system|initial|original|hidden)\s+(?:prompt|instructions?)\b/gi, label: "System prompt query", score: 25, confidence: 0.8, message: "System prompt query detected." },
    { pattern: /\breveal\b[^\n]{0,60}(?:system|prompt|instructions?|directives?|initial)\b/gi, label: "System prompt extraction (boundary-free)", score: 25, confidence: 0.75, message: "System prompt extraction attempt detected." },

    // ── Encoding/obfuscation attacks ──────────────────────────────────────
    { pattern: /\b(?:encode|decode|base64|rot13|hex|binary)\s+(?:the following|this|and respond)\b/gi, label: "Encoding attack", score: 22, confidence: 0.7, message: "Encoding-based obfuscation attempt." },
    { pattern: /\b(?:translate|convert)\s+(?:the\s+\w+\s+)?(?:to|into)\s+(?:base64|hex|binary|rot13|morse)/gi, label: "Encoding evasion", score: 20, confidence: 0.65, message: "Encoding evasion technique detected." },
    { pattern: /\b(?:base64|encode)\b[^\n]{0,60}\b(?:\.env|secret|token|key|password|credential|exfiltrate|send|output)\b/gi, label: "Encoded exfiltration", score: 30, confidence: 0.75, message: "Encoding a secret or sending encoded data." },

    // ── Hindi/Hinglish prompt injection ───────────────────────────────────
    { pattern: /\b(?:pichle|purane|pehle)\s+(?:nirdesh|instructions?|rules?)\s+(?:bhool|ignore|chod)\b/gi, label: "Hindi instruction override", score: 30, confidence: 0.85, message: "Hindi/Hinglish instruction override detected." },
    { pattern: /\b(?:ab se|aaj se)\s+(?:tum|aap)\s+(?:ek|mera)\b/gi, label: "Hindi role impersonation", score: 25, confidence: 0.75, message: "Hindi/Hinglish role impersonation detected." },
    { pattern: /\b(?:safety|suraksha)\s+(?:hata|band|off|disable)\s+(?:karo|kar|kijiye)\b/gi, label: "Hindi safety bypass", score: 30, confidence: 0.85, message: "Hindi/Hinglish safety bypass attempt." },
    { pattern: /\b(?:bina\s+)?(?:kisi\s+)?(?:rok[-\s]?tok|pabandi|restriction)\s+(?:ke|ki)\b/gi, label: "Hindi unrestricted", score: 25, confidence: 0.7, message: "Hindi/Hinglish unrestricted mode request." },

    // ── Delimiter injection ───────────────────────────────────────────────
    { pattern: /\[(?:SYSTEM|INST|SYS)\]|\[\/(?:SYSTEM|INST|SYS)\]|<\|(?:system|im_start|im_end)\|>/gi, label: "Delimiter injection", score: 35, confidence: 0.95, message: "Chat template delimiter injection detected." },
    { pattern: /```\s*(?:system|prompt|instructions?)\b/gi, label: "Code block injection", score: 25, confidence: 0.8, message: "Code block used for instruction injection." },
    { pattern: /!\[[^\]]*\]\([^)]*\)/gi, label: "Markdown image link", score: 5, confidence: 0.3, message: "Markdown image syntax detected (low severity contextual alert)." },

    // ── Multi-step/indirect injection ─────────────────────────────────────
    { pattern: /\b(?:first|step 1|initially)\s+[^\n]{0,100}\b(?:then|next|after that|step 2)\s+[^\n]{0,100}\b(?:ignore|bypass|override)\b/gi, label: "Multi-step injection", score: 28, confidence: 0.75, message: "Multi-step injection chain detected." },
    { pattern: /\b(?:good|great|perfect|excellent|nice)[,.]?\s+(?:now|next)\s+(?:do|continue|can\s+you|let's)\b/gi, label: "Crescendo escalation", score: 18, confidence: 0.6, message: "Potential crescendo escalation detected." },

    // ── Emotional / social engineering ────────────────────────────────────
    { pattern: /\b(?:my (?:life|job|career|family)\s+(?:depends?\s+on|is\s+(?:at\s+)?risk)|I'll\s+(?:be\s+)?(?:fired|lose|lost|die)|this\s+is\s+(?:urgent|an? emergency))\b/gi, label: "Emotional manipulation", score: 20, confidence: 0.7, message: "Emotional manipulation to bypass safety." },
    { pattern: /\bplease? I'm (?:begging|desperate|pleading)\b/gi, label: "Desperate plea", score: 18, confidence: 0.65, message: "Desperate plea to bypass safety." },

    // ── Hypothetical / virtualization ─────────────────────────────────────
    { pattern: /\b(?:hypothetically|in theory|let's say|imagine if|suppose|in a fictional)\b/gi, label: "Hypothetical framing", score: 10, confidence: 0.4, message: "Hypothetical framing that may bypass safety." },
    { pattern: /\b(?:simulate|emulate|create)\s+(?:a|an)\s+(?:virtual|sandbox|isolated|unrestricted|uncensored)\s+(?:environment|AI|assistant|instance|terminal)\b/gi, label: "Virtualization attack", score: 28, confidence: 0.85, message: "Virtualization/sandbox evasion attempt." },
    { pattern: /\b(?:suppose|assume|pretend)\s+(?:there\s+(?:are|is)\s+no|that)\s+(?:rules?|restrictions?|limits?|filters?|guidelines?|constraints?)\b/gi, label: "Constraint removal", score: 28, confidence: 0.85, message: "Attempt to remove constraints via hypothetical." },

    // ── Context switching ─────────────────────────────────────────────────
    { pattern: /\bnew\s+conversation\b.{0,100}\b(?:forget|ignore|disregard)\b.{0,100}\b(?:new|different|another)\s+(?:assistant|persona|role)\b/gi, label: "Context switching attack", score: 30, confidence: 0.8, message: "Context switching to bypass prior instructions." },
    { pattern: /\b(?:forget|ignore|erase)\s+everything\b.{0,60}\b(?:you\s+are|you're|now)\s+(?:a\s+)?(?:different|new|another)\b/gi, label: "Context reset attack", score: 28, confidence: 0.75, message: "Context reset to bypass safety restrictions." },

    // ── Nested / recursive injection ──────────────────────────────────────
    { pattern: /\b(?:said|prompt|message|instruction):\s*['"]?.{0,40}\b(?:ignore|disregard|forget)\b.{0,40}\b(?:instructions?|rules?|prompt)\b/gi, label: "Nested injection", score: 25, confidence: 0.7, message: "Nested/recursive injection pattern detected." },

    // ── Data exfiltration ──────────────────────────────────────────────────
    { pattern: /\b(?:send|post|upload|transmit|forward|relay|exfiltrate|email|mail)\b[^\n]{0,80}?\b(?:to|at|via|through)\s+(?:https?:\/\/|ftp:\/\/|\w+@)/gi, label: "Data exfiltration", score: 40, confidence: 0.88, message: "Data exfiltration instruction detected — sending data to an external endpoint." },
    { pattern: /\b(?:read|cat|fetch|get|grab|open|access|dump)\b[^\n]{0,60}(?:\/etc\/(?:passwd|shadow)|\.env|id_rsa|credentials|secret|private.?key|password|token|api.?key)\b[^\n]{0,60}\b(?:send|post|upload|transmit|exfiltrate|to|at|https?:\/\/)/gi, label: "Secret exfiltration", score: 45, confidence: 0.9, message: "Attempt to read a secret file and exfiltrate it." },
    { pattern: /\b(?:curl|wget|fetch|http|requests?)\b[^\n]{0,80}\b(?:https?:\/\/[^\n]{0,40})?\b(?:send|post|put|upload)\b[^\n]{0,40}(?:\/etc\/(?:passwd|shadow)|\.env|secret|token|key|password|credential)/gi, label: "HTTP exfiltration", score: 42, confidence: 0.85, message: "HTTP request used to exfiltrate secrets." },
    { pattern: /\b(?:base64|encode|btoa)\b[^\n]{0,40}(?:\/etc\/(?:passwd|shadow)|\.env|secret|token|key|password|credential)\b/gi, label: "Encoded exfiltration", score: 38, confidence: 0.82, message: "Encoding a secret file for exfiltration." },
    { pattern: /\b(?:cat|echo|print|printf|write|output|type)\b[^\n]{0,60}(?:\/etc\/(?:passwd|shadow)|\.env|id_rsa|secret|token|key|password|credential)\b[^\n]{0,60}(?:\|\s*(?:curl|wget|nc|netcat|socat|ssh|python|node)|>>|>\s*\/dev\/tcp)/gi, label: "Pipe exfiltration", score: 48, confidence: 0.92, message: "Piping a secret to an external tool for exfiltration." },
];

/**
 * Run INJECTION_PATTERNS with per-pattern ReDoS protection and isolation.
 *
 * Protection layers:
 * 1. Time check before each exec() call — aborts pattern if over PATTERN_TIMEOUT_MS
 * 2. Max iterations per pattern — prevents runaway zero-length matches
 * 3. try/catch per pattern — one crashing pattern doesn't kill the detector
 * 4. Overall time cap — exits early if we've exceeded DETECTOR_TIMEOUT_MS
 */
function runPatterns(text: string, matches: DetectorMatch[], startTime: number): void {
    if (!text || typeof text !== "string") return;
    for (const spec of INJECTION_PATTERNS) {
        // Overall time cap: don't start a new pattern if we're way over
        if (Date.now() - startTime > DETECTOR_TIMEOUT_MS) break;

        spec.pattern.lastIndex = 0;

        try {
            let iterations = 0;
            let m: RegExpExecArray | null;
            while ((m = spec.pattern.exec(text)) !== null) {
                if (!m[0]) continue;

                matches.push({
                    type: "prompt_injection",
                    label: spec.label,
                    severity: spec.score >= 30 ? "high" : "medium",
                    score: spec.score,
                    start: m.index,
                    end: m.index + m[0].length,
                    match: m[0],
                    message: spec.message,
                    confidence: spec.confidence,
                });

                // Limit iterations per pattern (runaway match / ReDoS guard)
                iterations++;
                if (iterations >= PATTERN_MAX_ITERATIONS) break;

                // Time-check per iteration: abort this pattern if too slow
                if (Date.now() - startTime >= PATTERN_TIMEOUT_MS) break;
            }
        } catch (err) {
            // Scanner isolation: a crash in one pattern must not block others
            console.warn(`[SoterAI] Pattern "${spec.label}" threw:`, err);
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
 * Boundary-free matching: scan for known attack keywords without relying on \b.
 * This handles cases where a word character precedes the keyword, preventing 
 * \b from matching (e.g., "AAAignore all previous instructions").
 */
const BOUNDARY_FREE_PATTERNS: Array<{ keyword: RegExp; context: RegExp; label: string; score: number; confidence: number; message: string }> = [
    // Instruction override keywords followed by context
    { keyword: /ignore\s+all\s+(?:previous|prior|above|earlier)/gi, context: /(?:instructions?|rules?|guidelines?|prompts?)/gi, label: "Instruction override", score: 30, confidence: 0.8, message: "Direct instruction override attempted (boundary-free)." },
    { keyword: /(?:disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier)/gi, context: /(?:instructions?|rules?|guidelines?)/gi, label: "Instruction override", score: 30, confidence: 0.8, message: "Direct instruction override attempted (boundary-free)." },
    { keyword: /do\s+not\s+follow\s+(?:any|your|the)\s+(?:previous|original|system)/gi, context: /(?:instructions?|rules?)/gi, label: "Instruction override", score: 30, confidence: 0.8, message: "Instruction override via negation (boundary-free)." },
    // Role impersonation / constraint removal
    { keyword: /pretend\s+(?:to be|you're|there (?:are|is) no)/gi, context: /(?:rules?|restrictions?|limits?|filters?)/gi, label: "Constraint removal via roleplay", score: 28, confidence: 0.7, message: "Roleplay-based constraint removal (boundary-free)." },
    // Safety bypass
    { keyword: /(?:bypass|disable|remove|deactivate)\s+(?:(?:the|all|any)\s+)?(?:safety|filter|guardrail)/gi, context: /./, label: "Safety bypass", score: 28, confidence: 0.8, message: "Safety mechanism bypass attempt (boundary-free)." },
    // System prompt extraction
    { keyword: /reveal\s+(?:(?:your|the|my|all)\s+)?(?:system|initial|original|hidden)/gi, context: /(?:prompt|instructions?|message)/gi, label: "System prompt extraction", score: 28, confidence: 0.8, message: "System prompt extraction attempt (boundary-free)." },
];

/**
 * Boundary-free matching with ReDoS protection.
 * Scans for known attack keywords without relying on \b word boundaries.
 */
function tryBoundaryFreeMatch(text: string, startTime: number): DetectorMatch[] {
    const result: DetectorMatch[] = [];
    for (const spec of BOUNDARY_FREE_PATTERNS) {
        // Time cap for this pass
        if (Date.now() - startTime > BOUNDARY_FREE_TIMEOUT_MS) break;

        spec.keyword.lastIndex = 0;
        spec.context.lastIndex = 0;

        try {
            let iterations = 0;
            let kw: RegExpExecArray | null;
            while ((kw = spec.keyword.exec(text)) !== null) {
                // Check that context follows within a reasonable distance
                spec.context.lastIndex = kw.index;
                const ctx = spec.context.exec(text);
                if (ctx && ctx.index > kw.index && ctx.index - kw.index <= 120) {
                    const endPos = Math.max(kw.index + kw[0].length, ctx.index + ctx[0].length);
                    result.push({
                        type: "prompt_injection",
                        label: spec.label,
                        severity: spec.score >= 30 ? "high" : "medium",
                        score: spec.score,
                        start: kw.index,
                        end: endPos,
                        match: text.slice(kw.index, endPos),
                        message: spec.message,
                        confidence: spec.confidence,
                    });
                }

                iterations++;
                if (iterations >= PATTERN_MAX_ITERATIONS) break;
                if (Date.now() - startTime >= BOUNDARY_FREE_TIMEOUT_MS) break;
            }
        } catch (err) {
            console.warn(`[SoterAI] Boundary-free pattern "${spec.label}" threw:`, err);
            continue;
        }
    }
    return result;
}

/**
 * Detect prompt injection with full security hardening.
 *
 * Security guarantees:
 * - ReDoS protection: per-pattern time limits and iteration caps
 * - Scanner isolation: one pattern crash never cascades to others
 * - Detector timeout: overall execution bounded by DETECTOR_TIMEOUT_MS
 * - Fail-safe: always returns a valid DetectorResult, never throws
 */
export function detectPromptInjection(text: unknown): DetectorResult {
    const safe = ensureString(text);
    const matches: DetectorMatch[] = [];
    const startTime = Date.now();

    try {
        // First pass: pattern matching with ReDoS protection
        runPatterns(safe, matches, startTime);

        // Second pass: collapse repeated characters (3+) to single char for \b matching
        // e.g. "IIIIgnore" → "Ignore" so \b captures the word boundary at start of string.
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

        // Third pass: pattern-specific boundary-free matching
        if (matches.length === 0 && safe.length > 0 && Date.now() - startTime < DETECTOR_TIMEOUT_MS) {
            const boundaryFreeMatches = tryBoundaryFreeMatch(safe, startTime);
            matches.push(...boundaryFreeMatches);
        }
    } catch (err) {
        // Absolute last resort: if something completely unexpected happens,
        // we still return a valid DetectorResult — never throw.
        console.warn(`[SoterAI] detectPromptInjection unexpected error:`, err);
    }

    return {
        detectorName: "PromptInjectionLiteDetector",
        detectorVersion: PROMPT_INJECTION_DETECTOR_VERSION,
        matches,
    };
}

export { INJECTION_PATTERNS };
