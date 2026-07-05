import type { DetectorMatch, DetectorResult } from "../types";

export const TERMINAL_COMMAND_RISK_DETECTOR_VERSION = "1.0.0";

interface CommandPattern {
    pattern: RegExp;
    type: string;
    label: string;
    score: number;
    confidence: number;
    message: string;
}

const DANGEROUS_COMMANDS: CommandPattern[] = [
    // ── Destructive operations ────────────────────────────────────────────
    { pattern: /\brm\s+(-[a-z]*r[a-z]*\s+)?(-[a-z]*f[a-z]*\s+)?(?:\/|~|\$HOME|\$\{HOME\}|\.\.)(?:\b|\s|$)/gi, type: "destructive_rm", label: "Destructive rm", score: 40, confidence: 0.95, message: "Potentially destructive rm command." },
    { pattern: /\brm\s+(-rf|-fr)\s+/gi, type: "force_delete", label: "Force delete", score: 35, confidence: 0.9, message: "Force recursive delete command." },
    { pattern: /\bmkfs\b|\bdd\s+if=.*of=\/dev\//gi, type: "disk_wipe", label: "Disk wipe", score: 50, confidence: 0.95, message: "Disk formatting/wiping command." },
    { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/g, type: "fork_bomb", label: "Fork bomb", score: 50, confidence: 0.99, message: "Fork bomb detected." },

    // ── Remote code execution ─────────────────────────────────────────────
    { pattern: /\b(?:curl|wget)\s+[^\n]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)\b/gi, type: "remote_exec", label: "Remote code execution", score: 40, confidence: 0.95, message: "Piping remote content to shell." },
    { pattern: /\b(?:curl|wget)\s+[^\n]*\|\s*(?:sudo\s+)?tee\b/gi, type: "remote_write", label: "Remote write", score: 30, confidence: 0.85, message: "Writing remote content to file system." },

    // ── Reverse shells ────────────────────────────────────────────────────
    { pattern: /\b(?:bash|sh|zsh)\s+-[a-z]*i[^\n]*\/dev\/tcp\//gi, type: "reverse_shell", label: "Reverse shell", score: 50, confidence: 0.95, message: "Reverse shell command detected." },
    { pattern: /\bnc\s+(-[a-z]*\s+)*(?:\d{1,3}\.){3}\d{1,3}\s+\d+\s*(?:-e|-c)\s+(?:\/bin\/(?:ba)?sh|cmd)/gi, type: "reverse_shell", label: "Netcat reverse shell", score: 50, confidence: 0.95, message: "Netcat reverse shell detected." },
    { pattern: /\bpython[23]?\s+-c\s+['"]import socket/gi, type: "reverse_shell", label: "Python reverse shell", score: 45, confidence: 0.9, message: "Python-based reverse shell detected." },

    // ── Secret/credential access ──────────────────────────────────────────
    { pattern: /\bcat\s+(?:~\/|\/home\/\w+\/|\/root\/)?\.(?:aws\/credentials|ssh\/(?:id_rsa|config)|env)\b/gi, type: "credential_access", label: "Credential file access", score: 35, confidence: 0.9, message: "Reading credential/secret file." },
    { pattern: /\bcat\s+.*\.(?:pem|key|p12|pfx)\b/gi, type: "key_access", label: "Key file access", score: 35, confidence: 0.9, message: "Reading key/certificate file." },
    { pattern: /\benv\b|\bprintenv\b|\bset\s*$|\bexport\s+-p\b/gm, type: "env_dump", label: "Environment dump", score: 20, confidence: 0.7, message: "Dumping environment variables." },

    // ── Network exfiltration ──────────────────────────────────────────────
    { pattern: /\b(?:curl|wget)\s+.*--data.*(?:@|<)\s*(?:\/etc\/|\.env|\.aws)/gi, type: "data_exfil", label: "Data exfiltration", score: 45, confidence: 0.9, message: "Data exfiltration via HTTP." },
    { pattern: /\b(?:scp|rsync)\s+.*(?:\.env|\.aws|credentials|\.pem|\.key|id_rsa)\b/gi, type: "data_exfil", label: "File exfiltration", score: 35, confidence: 0.85, message: "Sensitive file transfer." },

    // ── Privilege escalation ──────────────────────────────────────────────
    { pattern: /\bsudo\s+(?:su\s*$|chmod\s+[40-7]{3,4}|chown\s+root)/gim, type: "priv_escalation", label: "Privilege escalation", score: 25, confidence: 0.8, message: "Privilege escalation attempt." },
    { pattern: /\bchmod\s+(?:u\+s|4[0-7]{3})\b/gi, type: "setuid", label: "SUID bit", score: 30, confidence: 0.9, message: "Setting SUID bit on file." },

    // ── Container/orchestration risks ─────────────────────────────────────
    { pattern: /\bdocker\s+run\s+.*--privileged\b/gi, type: "docker_privileged", label: "Privileged container", score: 30, confidence: 0.9, message: "Running privileged Docker container." },
    { pattern: /\bkubectl\s+delete\s+(?:namespace|ns|deployment|pods?)\s+/gi, type: "k8s_destructive", label: "K8s destructive", score: 30, confidence: 0.85, message: "Destructive Kubernetes command." },
    { pattern: /\bdocker\s+(?:system\s+prune|rm\s+-f|rmi\s+-f)\b/gi, type: "docker_cleanup", label: "Docker cleanup", score: 20, confidence: 0.8, message: "Docker aggressive cleanup." },

    // ── Suspicious patterns ───────────────────────────────────────────────
    { pattern: /\bhistory\s*(?:-c|--clear)\b/gi, type: "history_clear", label: "History clear", score: 20, confidence: 0.8, message: "Command history clearing." },
    { pattern: /\b(?:base64\s+-d|openssl\s+enc\s+-d)\s+.*\|\s*(?:bash|sh)\b/gi, type: "encoded_exec", label: "Encoded execution", score: 40, confidence: 0.9, message: "Decoding and executing hidden commands." },
];

export function detectTerminalCommandRisk(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];

    for (const spec of DANGEROUS_COMMANDS) {
        const pattern = new RegExp(spec.pattern.source, spec.pattern.flags);
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
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
        detectorName: "TerminalCommandRiskDetector",
        detectorVersion: TERMINAL_COMMAND_RISK_DETECTOR_VERSION,
        matches,
    };
}
