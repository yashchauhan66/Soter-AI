import type { DetectorMatch, DetectorResult } from "../types";

export const OUTPUT_EXFILTRATION_DETECTOR_VERSION = "1.0.0";

/**
 * OutputExfiltrationDetector — scans AI-generated output (code, terminal
 * suggestions, chat responses the user pastes back) for signs that it is trying
 * to send secrets off the machine or reverse SoterAI's protection.
 *
 * This complements SecretDetector (which finds raw secrets in the output). Here
 * we look at INTENT: exfiltration sinks, "send secrets" phrasing, placeholder
 * reversal, and dangerous shell suggestions.
 */
const EXFIL_PATTERNS = [
    {
        // curl/wget/fetch POSTing something to a remote host (classic exfil).
        pattern: /\b(?:curl|wget|fetch|Invoke-WebRequest|iwr)\b[^\n]*\bhttps?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\s"'`]+/gi,
        type: "exfil_http_sink", label: "Outbound HTTP exfiltration", score: 35, confidence: 0.8,
        message: "AI output posts data to a remote URL — verify it is not exfiltrating secrets.",
    },
    {
        // Piping env/secret files into a network call.
        pattern: /\b(?:cat|type|Get-Content)\b[^\n]*(?:\.env|id_rsa|credentials|secrets?)[^\n]*\|[^\n]*(?:curl|wget|nc|netcat|bash|sh)\b/gi,
        type: "exfil_secret_pipe", label: "Secret file piped to network/shell", score: 45, confidence: 0.9,
        message: "AI output pipes a secret file into a network or shell command.",
    },
    {
        pattern: /\b(?:send|upload|exfiltrate|leak|post|transmit|email)\b[^\n]{0,40}\b(?:secret|secrets|api[-_ ]?key|apikey|token|password|credential|\.env|private[-_ ]?key)s?\b/gi,
        type: "exfil_phrase", label: "Exfiltration phrasing", score: 30, confidence: 0.75,
        message: "AI output describes sending secrets somewhere.",
    },
    {
        pattern: /\b(?:secret|api[-_ ]?key|apikey|token|password|credential)s?\b[^\n]{0,20}\b(?:to|into)\b[^\n]{0,30}\b(?:https?:\/\/|webhook|discord|telegram|pastebin|requestbin|ngrok)\b/gi,
        type: "exfil_third_party", label: "Secrets to third-party sink", score: 40, confidence: 0.85,
        message: "AI output routes secrets to a third-party endpoint (webhook/paste service).",
    },
    {
        // Attempts to un-redact / reverse SoterAI placeholders.
        pattern: /\b(?:reveal|restore|decode|un[- ]?redact|reverse|print|show|echo)\b[^\n]{0,30}\bSOTERAI_PROTECTED_[A-Z0-9_]+/gi,
        type: "placeholder_reversal", label: "SoterAI placeholder reversal attempt", score: 40, confidence: 0.9,
        message: "AI output attempts to reveal a SoterAI-protected placeholder value.",
    },
    {
        // Dangerous, destructive shell suggestions.
        pattern: /\b(?:rm\s+-rf\s+[\/~*]|:\(\)\s*\{\s*:\|:&\s*\}|chmod\s+777\s+-R|mkfs\.|dd\s+if=\/dev\/(?:zero|random))\b/gi,
        type: "dangerous_command", label: "Dangerous shell command", score: 30, confidence: 0.8,
        message: "AI output suggests a destructive shell command — review before running.",
    },
];

export function detectOutputExfiltration(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    for (const spec of EXFIL_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = spec.pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            matches.push({
                type: spec.type,
                label: spec.label,
                severity: spec.score >= 40 ? "critical" : spec.score >= 25 ? "high" : "medium",
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
        detectorName: "OutputExfiltrationDetector",
        detectorVersion: OUTPUT_EXFILTRATION_DETECTOR_VERSION,
        matches,
    };
}
