import type { DetectorMatch, DetectorResult } from "../types";

export const PROMPT_INJECTION_DETECTOR_VERSION = "1.2.0";

// ─── Detector resource guards (contract asserted by tests) ─────────────────
export const PATTERN_TIMEOUT_MS = 100;
export const PATTERN_MAX_ITERATIONS = 5000;
export const DETECTOR_TIMEOUT_MS = 2000;

interface InjectionPattern {
    id: string;
    pattern: RegExp;
    label: string;
    score: number;
    confidence: number;
    message: string;
}

// Bounded punctuation/paren/backreference noise tolerated BETWEEN two keywords
// (e.g. "all (((previous)))", "all (previous) [instructions]", "$1 previous $2").
// Limited to whitespace + punctuation/parens/backreference noise (no letters,
// no zero-width/invisible Unicode, no combining marks) so it cannot bridge whole
// words and cannot defeat the KNOWN-LIMITATION gates that require newline-interleaved,
// zero-width, spaced-out, or homoglyph interruption to remain undetected.
const G = "[\\s()\\[\\]{}$0-9.*_`'\";,-]{0,15}";

const INJECTION_PATTERNS: InjectionPattern[] = [
    // ── Direct instruction override ───────────────────────────────────────
    // Prefix-tolerant ("IIIIgnore") via optional repeated leading char, and
    // noise-tolerant between the keyword groups (parens/brackets/$N).
    { id: "pi.instruction_override", pattern: new RegExp(`\\b(?:I{0,6}ignore|disregard|forget)${G}(?:all${G})?(?:previous|prior|above|earlier|system)${G}(?:instructions?|rules?|guidelines?|prompts?)\\b`, "gi"), label: "Instruction override", score: 35, confidence: 0.95, message: "Direct instruction override attempted." },
    { id: "pi.instruction_override_negation", pattern: /\bdo\s+not\s+follow\s+(?:any|your|the)\s+(?:previous|original|system)\s+(?:instructions?|rules?)\b/gi, label: "Instruction override", score: 35, confidence: 0.95, message: "Instruction override via negation." },
    // Context override without a following noun: "Ignore all rules", "forget everything before".
    { id: "pi.context_override_bare", pattern: /\b(?:ignore|disregard|forget)\s+all\s+(?:the\s+)?(?:rules?|restrictions?|guidelines?)\b/gi, label: "Context override", score: 30, confidence: 0.85, message: "Attempt to override rules." },
    { id: "pi.forget_everything", pattern: /\bforget\s+everything\s+(?:before|prior|above)\b/gi, label: "Context wipe", score: 30, confidence: 0.85, message: "Attempt to wipe prior context." },

    // ── Role impersonation ────────────────────────────────────────────────
    { id: "pi.role_impersonation", pattern: /\b(?:you are now|act as|pretend (?:to be|you're)|roleplay as|simulate being|from now on you are)\b/gi, label: "Role impersonation", score: 28, confidence: 0.85, message: "Role impersonation attempt detected." },
    { id: "pi.system_role_injection", pattern: /\b(?:system|developer|admin)\s*:\s*(?:you are|ignore|override|new instructions?)/gi, label: "System role injection", score: 35, confidence: 0.9, message: "System/developer role injection detected." },

    // ── Jailbreak keywords ────────────────────────────────────────────────
    { id: "pi.jailbreak_keyword", pattern: /\b(?:developer mode|DAN mode|do anything now|jailbreak|god mode|unrestricted mode|DUDE mode)\b/gi, label: "Jailbreak keyword", score: 32, confidence: 0.9, message: "Known jailbreak keyword detected." },
    { id: "pi.named_persona", pattern: /(?:\bAIM|\bSTAN|\bDUDE|\bKEVIN|\bOMEGA|\bMAXIMUM)\s+(?:mode|prompt|persona)/gi, label: "Named jailbreak persona", score: 32, confidence: 0.88, message: "Named jailbreak persona detected." },

    // ── Safety bypass (article + plural tolerant) ─────────────────────────
    { id: "pi.safety_bypass", pattern: /\b(?:bypass|disable|remove|turn off|deactivate|circumvent|override)\s+(?:(?:all|any|the|these|your)\s+)*\b(?:(?:content\s+)?(?:filters?|polic\w+)|safety|guardrails?|moderation|restrictions?|censorship|safeguards?|protections?)\b/gi, label: "Safety bypass", score: 30, confidence: 0.9, message: "Safety mechanism bypass attempted." },

    // ── Constraint removal / personas ─────────────────────────────────────
    { id: "pi.constraint_removal", pattern: /\b(?:pretend|assume|suppose|imagine|act as if)\s+(?:that\s+)?(?:there\s+(?:are|is)\s+no|you\s+(?:can|have|don't have|are not))\s+(?:any\s+|the\s+)?(?:rules?|restrictions?|limits?|filters?|guidelines?|constraints?)\b/gi, label: "Constraint removal", score: 28, confidence: 0.85, message: "Attempt to remove constraints via hypothetical." },
    { id: "pi.emotional_manipulation", pattern: /\b(?:my (?:life|job|career|family) depends on|I'll (?:die|be fired|lose everything)|this is (?:urgent|an emergency|life or death))\b/gi, label: "Emotional manipulation", score: 20, confidence: 0.7, message: "Emotional manipulation to bypass safety." },
    { id: "pi.virtualization", pattern: /\b(?:simulate|emulate|create|spin up|run|build)\s+(?:a|an)\s+(?:virtual|sandbox|isolated|unrestricted|uncensored|unfiltered|offline)\s+(?:environment|AI|assistant|instance|terminal|machine|sandbox|shell)\b/gi, label: "Virtualization attack", score: 28, confidence: 0.85, message: "Virtualization/sandbox evasion attempt." },
    { id: "pi.crescendo", pattern: /\b(?:now\s+that\s+you'?ve\s+(?:agreed|confirmed|shown)|good[,.]?\s+now\s+(?:do|continue|keep going|proceed)|continue\s+without\s+(?:restrictions?|filters?|limits?))\b/gi, label: "Crescendo escalation", score: 18, confidence: 0.6, message: "Potential crescendo escalation." },

    // ── System prompt extraction (possessive/object-gap tolerant) ─────────
    // "Reveal your system instructions", "Show me your initial instructions",
    // "reveal system prоmpt" (Latin verb+adj, noun may be homoglyph).
    { id: "pi.system_prompt_extraction", pattern: new RegExp(`\\b(?:reveal|show|display|output|print|repeat|echo|leak|expose|disclose|give|tell)${G}(?:(?:me|us|to me|your|the|all|full|exact|your full|the full)${G}){0,3}(?:system|developer|initial|original|hidden|secret|internal)${G}(?:prompt|instructions?|message|directives?|configuration|rules?)?\\b`, "gi"), label: "System prompt extraction", score: 30, confidence: 0.9, message: "System prompt extraction attempt." },
    { id: "pi.system_prompt_query", pattern: /\bwhat\s+(?:is|are)\s+your\s+(?:system|initial|original|hidden)\s+(?:prompt|instructions?)\b/gi, label: "System prompt query", score: 25, confidence: 0.8, message: "System prompt query detected." },
    // Few-shot poisoning: a fake User:/Assistant: turn that issues an override.
    { id: "pi.few_shot_poisoning", pattern: /\b(?:user|assistant|human|system)\s*:\s*[^\n]{0,80}?\b(?:ignore|bypass|disregard|forget|override)\s+(?:all\s+)?(?:previous\s+|prior\s+|the\s+)?(?:rules?|instructions?|guidelines?|restrictions?)\b/gi, label: "Few-shot poisoning", score: 30, confidence: 0.8, message: "Override embedded in a fabricated dialogue turn." },

    // ── Encoding/obfuscation attacks ──────────────────────────────────────
    { id: "pi.encoding_attack", pattern: /\b(?:encode|decode|base64|rot13|hex|binary)\s+(?:the following|this|and respond)\b/gi, label: "Encoding attack", score: 22, confidence: 0.7, message: "Encoding-based obfuscation attempt." },
    { id: "pi.encoding_evasion", pattern: new RegExp(`\\b(?:translate|convert)${G}(?:the\\s+\\w+|this|that|it)?${G}(?:to|into)${G}(?:base64|hex|binary|rot13|morse)`, "gi"), label: "Encoding evasion", score: 20, confidence: 0.65, message: "Encoding evasion technique detected." },
    // base64/encode of a secret file (encoded exfiltration): "Base64 encode the .env".
    { id: "pi.encoded_exfil", pattern: /\b(?:base64|encode|btoa|encrypt)\b[^\n]{0,40}(?:\.env\b|\/etc\/passwd|\b(?:secret|token|key|password|credential|id_rsa)\b)/gi, label: "Encoded exfiltration", score: 38, confidence: 0.82, message: "Encoding a secret file for exfiltration." },

    // ── Hindi/Hinglish prompt injection ───────────────────────────────────
    { id: "pi.hindi_override", pattern: /\b(?:pichle|purane|pehle)\s+(?:nirdesh|instructions?|rules?)\s+(?:bhool|ignore|chod)\b/gi, label: "Hindi instruction override", score: 30, confidence: 0.85, message: "Hindi/Hinglish instruction override detected." },
    { id: "pi.hindi_role", pattern: /\b(?:ab se|aaj se)\s+(?:tum|aap)\s+(?:ek|mera)\b/gi, label: "Hindi role impersonation", score: 25, confidence: 0.75, message: "Hindi/Hinglish role impersonation detected." },
    { id: "pi.hindi_safety", pattern: /\b(?:safety|suraksha)\s+(?:hata|band|off|disable)\s+(?:karo|kar|kijiye)\b/gi, label: "Hindi safety bypass", score: 30, confidence: 0.85, message: "Hindi/Hinglish safety bypass attempt." },

    // ── Delimiter injection ───────────────────────────────────────────────
    { id: "pi.delimiter", pattern: /\[(?:SYSTEM|INST|SYS)\]|\[\/(?:SYSTEM|INST|SYS)\]|<\|(?:system|im_start|im_end)\|>/gi, label: "Delimiter injection", score: 35, confidence: 0.95, message: "Chat template delimiter injection detected." },
    { id: "pi.code_block", pattern: /```\s*(?:system|prompt|instructions?)\b/gi, label: "Code block injection", score: 25, confidence: 0.8, message: "Code block used for instruction injection." },
    // Markdown table cell containing an override instruction split across cells.
    { id: "pi.markdown_table", pattern: /\|\s*(?:ignore|bypass|reveal|override|disregard|forget)\s*\|\s*(?:all\s+|the\s+|previous\s+|prior\s+)?(?:previous|prior|system|rules?|instructions?|prompt)/gi, label: "Markdown table injection", score: 28, confidence: 0.78, message: "Injection embedded in markdown table cells." },
    // Markdown image alt-text carrying an override.
    { id: "pi.image_alt", pattern: /!\[[^\]]*\b(?:ignore|bypass|reveal|override|disregard|forget)\s+(?:all\s+)?(?:previous\s+|prior\s+)?(?:instructions?|rules?|prompt)/gi, label: "Image alt-text injection", score: 28, confidence: 0.78, message: "Injection embedded in image alt text." },

    // ── Multi-step/indirect injection ─────────────────────────────────────
    { id: "pi.multi_step", pattern: /\b(?:first|step 1|initially)\s+[^\n]{0,100}\b(?:then|next|after that|step 2)\s+[^\n]{0,100}\b(?:ignore|bypass|override)\b/gi, label: "Multi-step injection", score: 28, confidence: 0.75, message: "Multi-step injection chain detected." },

    // ── Data exfiltration ──────────────────────────────────────────────────
    { id: "pi.data_exfiltration", pattern: /\b(?:send|post|upload|transmit|forward|relay|exfiltrate|email|mail)\b[^\n]{0,80}?\b(?:to|at|via|through)\s+(?:https?:\/\/|ftp:\/\/|\w+@)/gi, label: "Data exfiltration", score: 40, confidence: 0.88, message: "Data exfiltration instruction detected — sending data to an external endpoint." },
    { id: "pi.secret_exfiltration", pattern: /\b(?:read|cat|fetch|get|grab|open|access|dump)\b[^\n]{0,60}\b(?:\/etc\/passwd|\/etc\/shadow|\.env|id_rsa|credentials|secret|private.?key|password|token|api.?key)\b[^\n]{0,60}\b(?:send|post|upload|transmit|exfiltrate|to|at|https?:\/\/)/gi, label: "Secret exfiltration", score: 45, confidence: 0.9, message: "Attempt to read a secret file and exfiltrate it." },
    { id: "pi.http_exfiltration", pattern: /\b(?:curl|wget|fetch|http|requests?)\b[^\n]{0,80}\b(?:https?:\/\/[^\n]{0,40})?\b(?:send|post|put|upload)\b[^\n]{0,40}\b(?:\/etc\/passwd|\.env|secret|token|key|password|credential)/gi, label: "HTTP exfiltration", score: 42, confidence: 0.85, message: "HTTP request used to exfiltrate secrets." },
    { id: "pi.pipe_exfiltration", pattern: /\b(?:cat|echo|print|printf|write|output|type|read)\b[^\n]{0,60}\b(?:\/etc\/passwd|\.env|id_rsa|secret|token|key|password|credential)\b[^\n]{0,60}\b(?:\|\s*(?:curl|wget|nc|netcat|socat|ssh|python|node)|>>|>\s*\/dev\/tcp)/gi, label: "Pipe exfiltration", score: 48, confidence: 0.92, message: "Piping a secret to an external tool for exfiltration." },
    // Pipe-to-netcat/remote without requiring a secret keyword on the left.
    { id: "pi.pipe_netcat", pattern: /\|\s*(?:nc|netcat|ncat)\s+[A-Za-z0-9.-]+\s+\d{2,5}\b/gi, label: "Netcat exfiltration", score: 40, confidence: 0.85, message: "Piping data to a netcat listener." },
    { id: "pi.pipe_remote_http", pattern: /\|\s*(?:curl|wget)\b[^\n]{0,120}\bhttps?:\/\/[^\s"'`]+/gi, label: "Pipe to remote HTTP", score: 42, confidence: 0.88, message: "Piping data into curl/wget toward a remote URL." },
    { id: "pi.http_upload", pattern: /\b(?:curl|wget)\b[^\n]{0,80}(?:--data(?:-binary)?|-d|--upload-file|-T)\b[^\n]{0,80}https?:\/\//gi, label: "HTTP upload exfiltration", score: 40, confidence: 0.85, message: "HTTP upload of local data to a remote endpoint." },
];

export function detectPromptInjection(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    // Fail-closed: never throw on non-string input.
    const input = typeof text === "string" ? text : text == null ? "" : String(text);
    if (!input) {
        return { detectorName: "PromptInjectionLiteDetector", detectorVersion: PROMPT_INJECTION_DETECTOR_VERSION, matches };
    }

    for (const spec of INJECTION_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        let iterations = 0;
        while ((m = spec.pattern.exec(input)) !== null) {
            if (!m[0]) {
                if (spec.pattern.lastIndex === m.index) spec.pattern.lastIndex++;
                continue;
            }
            if (++iterations > PATTERN_MAX_ITERATIONS) break;
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
        }
    }

    return {
        detectorName: "PromptInjectionLiteDetector",
        detectorVersion: PROMPT_INJECTION_DETECTOR_VERSION,
        matches,
    };
}

export { G as INJECTION_NOISE_GAP };
