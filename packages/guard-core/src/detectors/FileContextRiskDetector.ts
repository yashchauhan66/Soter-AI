import type { DetectorMatch, DetectorResult } from "../types";

export const FILE_CONTEXT_RISK_DETECTOR_VERSION = "1.0.0";

const PROTECTED_FILE_PATTERNS: Array<{ pattern: RegExp; type: string; label: string; score: number; message: string }> = [
    { pattern: /(?:^|[\\/])\.env(?:\.[a-z0-9_-]+)?$/gim, type: "env_file", label: "Environment file", score: 40, message: "Protected .env file." },
    { pattern: /(?:^|[\\/])(?:.*\.pem|.*\.key|id_rsa(?:\.pub)?|.*\.p12|.*\.pfx)$/gim, type: "key_file", label: "Key/certificate file", score: 45, message: "Private key or certificate file." },
    { pattern: /(?:^|[\\/])(?:credentials|secrets\.ya?ml|\.aws[\\/]credentials|\.gcloud[\\/]application_default_credentials\.json)$/gim, type: "credential_file", label: "Credential file", score: 45, message: "Credential or secrets file." },
    { pattern: /(?:^|[\\/])(?:.*\.sql|.*-dump\.(?:sql|csv|json)|database[\\/].*\.sql)$/gim, type: "database_dump", label: "Database dump", score: 35, message: "Database dump or migration file." },
    { pattern: /(?:^|[\\/])(?:customers?\.csv|users?\.csv|employees?\.csv|contacts?\.csv)$/gim, type: "customer_data", label: "Customer data file", score: 35, message: "Customer/user data file." },
    { pattern: /(?:^|[\\/])(?:docker-compose\.(?:ya?ml|override\.ya?ml)|Dockerfile(?:\.\w+)?)$/gim, type: "docker_config", label: "Docker configuration", score: 15, message: "Docker configuration file." },
    { pattern: /(?:^|[\\/])\.(?:npmrc|yarnrc|pnpm-workspace\.yaml)$/gim, type: "package_config", label: "Package manager config", score: 10, message: "Package manager config (may contain tokens)." },
    { pattern: /(?:^|[\\/])(?:\.htpasswd|passwd|shadow)$/gim, type: "auth_file", label: "Authentication file", score: 50, message: "System authentication file." },
];

const RISKY_CONTENT_PATTERNS: Array<{ pattern: RegExp; type: string; label: string; score: number; message: string; confidence: number }> = [
    { pattern: /\b(?:chmod\s+(?:777|666|a\+rwx))\b/gi, type: "risky_permissions", label: "Risky file permissions", score: 18, message: "Overly permissive file permissions.", confidence: 0.85 },
    { pattern: /\b(?:COPY|ADD)\s+.*(?:\.env|\.key|\.pem|credentials)\b/gi, type: "docker_secret_copy", label: "Docker secret copy", score: 25, message: "Docker COPY/ADD of sensitive file.", confidence: 0.9 },
    { pattern: /\bRUN\s+(?:apt-get|yum|apk)\s+install\s+.*--no-check/gi, type: "insecure_install", label: "Insecure package install", score: 15, message: "Package install without verification.", confidence: 0.8 },
    { pattern: /\bUSER\s+root\b/gm, type: "docker_root", label: "Docker root user", score: 12, message: "Container running as root.", confidence: 0.9 },
];

export function detectFileContextRisk(text: string, filePath?: string): DetectorResult {
    const matches: DetectorMatch[] = [];

    // Check file path itself
    if (filePath) {
        for (const spec of PROTECTED_FILE_PATTERNS) {
            const pattern = new RegExp(spec.pattern.source, spec.pattern.flags);
            if (pattern.test(filePath)) {
                matches.push({
                    type: spec.type,
                    label: spec.label,
                    severity: spec.score >= 40 ? "critical" : spec.score >= 25 ? "high" : "medium",
                    score: spec.score,
                    start: 0,
                    end: filePath.length,
                    match: filePath,
                    message: spec.message,
                    confidence: 0.95,
                });
            }
        }
    }

    // Check content for risky patterns
    for (const spec of RISKY_CONTENT_PATTERNS) {
        const pattern = new RegExp(spec.pattern.source, spec.pattern.flags);
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            matches.push({
                type: spec.type,
                label: spec.label,
                severity: spec.score >= 25 ? "high" : "medium",
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
        detectorName: "FileContextRiskDetector",
        detectorVersion: FILE_CONTEXT_RISK_DETECTOR_VERSION,
        matches,
    };
}
