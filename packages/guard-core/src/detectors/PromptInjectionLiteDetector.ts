import type { DetectorMatch, DetectorResult } from "../types";

export const PROMPT_INJECTION_DETECTOR_VERSION = "1.1.0";

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

    // ── Role impersonation ────────────────────────────────────────────────
    { pattern: /\b(?:you are now|act as|pretend (?:to be|you're)|roleplay as|simulate being|from now on you are)\b/gi, label: "Role impersonation", score: 28, confidence: 0.85, message: "Role impersonation attempt detected." },
    { pattern: /\b(?:system|developer|admin)\s*:\s*(?:you are|ignore|override|new instructions?)/gi, label: "System role injection", score: 35, confidence: 0.9, message: "System/developer role injection detected." },

    // ── Jailbreak keywords ────────────────────────────────────────────────
    { pattern: /\b(?:developer mode|DAN mode|do anything now|jailbreak|god mode|unrestricted mode|DUDE mode)\b/gi, label: "Jailbreak keyword", score: 32, confidence: 0.9, message: "Known jailbreak keyword detected." },
    { pattern: /\b(?:bypass|disable|remove|turn off|deactivate)\s+(?:safety|filter|guardrail|moderation|restriction|censorship|content policy)\b/gi, label: "Safety bypass", score: 30, confidence: 0.9, message: "Safety mechanism bypass attempted." },

    // ── System prompt extraction ──────────────────────────────────────────
    { pattern: /\b(?:reveal|show|display|output|print|repeat|echo)\s+(?:the\s+)?(?:system|developer|initial|original|hidden)\s+(?:prompt|instructions?|message)\b/gi, label: "System prompt extraction", score: 30, confidence: 0.9, message: "System prompt extraction attempt." },
    { pattern: /\bwhat\s+(?:is|are)\s+your\s+(?:system|initial|original|hidden)\s+(?:prompt|instructions?)\b/gi, label: "System prompt query", score: 25, confidence: 0.8, message: "System prompt query detected." },

    // ── Encoding/obfuscation attacks ──────────────────────────────────────
    { pattern: /\b(?:encode|decode|base64|rot13|hex|binary)\s+(?:the following|this|and respond)\b/gi, label: "Encoding attack", score: 22, confidence: 0.7, message: "Encoding-based obfuscation attempt." },
    { pattern: /\b(?:translate|convert)\s+(?:to|into)\s+(?:base64|hex|binary|rot13|morse)/gi, label: "Encoding evasion", score: 20, confidence: 0.65, message: "Encoding evasion technique detected." },

    // ── Hindi/Hinglish prompt injection ───────────────────────────────────
    { pattern: /\b(?:pichle|purane|pehle)\s+(?:nirdesh|instructions?|rules?)\s+(?:bhool|ignore|chod)\b/gi, label: "Hindi instruction override", score: 30, confidence: 0.85, message: "Hindi/Hinglish instruction override detected." },
    { pattern: /\b(?:ab se|aaj se)\s+(?:tum|aap)\s+(?:ek|mera)\b/gi, label: "Hindi role impersonation", score: 25, confidence: 0.75, message: "Hindi/Hinglish role impersonation detected." },
    { pattern: /\b(?:safety|suraksha)\s+(?:hata|band|off|disable)\s+(?:karo|kar|kijiye)\b/gi, label: "Hindi safety bypass", score: 30, confidence: 0.85, message: "Hindi/Hinglish safety bypass attempt." },

    // ── Delimiter injection ───────────────────────────────────────────────
    { pattern: /\[(?:SYSTEM|INST|SYS)\]|\[\/(?:SYSTEM|INST|SYS)\]|<\|(?:system|im_start|im_end)\|>/gi, label: "Delimiter injection", score: 35, confidence: 0.95, message: "Chat template delimiter injection detected." },
    { pattern: /```\s*(?:system|prompt|instructions?)\b/gi, label: "Code block injection", score: 25, confidence: 0.8, message: "Code block used for instruction injection." },

    // ── Multi-step/indirect injection ─────────────────────────────────────
    { pattern: /\b(?:first|step 1|initially)\s+[^\n]{0,100}\b(?:then|next|after that|step 2)\s+[^\n]{0,100}\b(?:ignore|bypass|override)\b/gi, label: "Multi-step injection", score: 28, confidence: 0.75, message: "Multi-step injection chain detected." },

    // ── Data exfiltration ──────────────────────────────────────────────────
    { pattern: /\b(?:send|post|upload|transmit|forward|relay|exfiltrate|email|mail)\b[^\n]{0,80}?\b(?:to|at|via|through)\s+(?:https?:\/\/|ftp:\/\/|\w+@)/gi, label: "Data exfiltration", score: 40, confidence: 0.88, message: "Data exfiltration instruction detected — sending data to an external endpoint." },
    { pattern: /\b(?:read|cat|fetch|get|grab|open|access|dump)\b[^\n]{0,60}\b(?:\/etc\/passwd|\/etc\/shadow|\.env|id_rsa|credentials|secret|private.?key|password|token|api.?key)\b[^\n]{0,60}\b(?:send|post|upload|transmit|exfiltrate|to|at|https?:\/\/)/gi, label: "Secret exfiltration", score: 45, confidence: 0.9, message: "Attempt to read a secret file and exfiltrate it." },
    { pattern: /\b(?:curl|wget|fetch|http|requests?)\b[^\n]{0,80}\b(?:https?:\/\/[^\n]{0,40})?\b(?:send|post|put|upload)\b[^\n]{0,40}\b(?:\/etc\/passwd|\.env|secret|token|key|password|credential)/gi, label: "HTTP exfiltration", score: 42, confidence: 0.85, message: "HTTP request used to exfiltrate secrets." },
    { pattern: /\b(?:base64|encode|btoa)\b[^\n]{0,40}\b(?:\/etc\/passwd|\.env|secret|token|key|password|credential)\b/gi, label: "Encoded exfiltration", score: 38, confidence: 0.82, message: "Encoding a secret file for exfiltration." },
    { pattern: /\b(?:cat|echo|print|printf|write|output|type)\b[^\n]{0,60}\b(?:\/etc\/passwd|\.env|id_rsa|secret|token|key|password|credential)\b[^\n]{0,60}\b(?:\|\s*(?:curl|wget|nc|netcat|socat|ssh|python|node)|>>|>\s*\/dev\/tcp)/gi, label: "Pipe exfiltration", score: 48, confidence: 0.92, message: "Piping a secret to an external tool for exfiltration." },
    // Pipe-to-curl without requiring a secret keyword on the left (classic reverse shell / exfil).
    { pattern: /\|\s*(?:curl|wget)\b[^\n]{0,120}\bhttps?:\/\/[^\s"'`]+/gi, label: "Pipe to remote HTTP", score: 42, confidence: 0.88, message: "Piping data into curl/wget toward a remote URL." },
    { pattern: /\b(?:curl|wget)\b[^\n]{0,80}(?:--data(?:-binary)?|-d|--upload-file|-T)\b[^\n]{0,80}https?:\/\//gi, label: "HTTP upload exfiltration", score: 40, confidence: 0.85, message: "HTTP upload of local data to a remote endpoint." },
];

export function detectPromptInjection(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];

    for (const spec of INJECTION_PATTERNS) {
        spec.pattern.lastIndex = 0;
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
        }
    }

    return {
        detectorName: "PromptInjectionLiteDetector",
        detectorVersion: PROMPT_INJECTION_DETECTOR_VERSION,
        matches,
    };
}
