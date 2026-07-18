import { type BrokerOperation, type SecretFinding, type SecretType } from "./types";

interface Detector {
    type: SecretType;
    label: string;
    sensitivity: SecretFinding["sensitivity"];
    pattern: RegExp;
    operations: BrokerOperation[];
}

const API_KEY_OPS: BrokerOperation[] = ["validate_api_key_format", "inspect_secret_metadata"];
const DB_OPS: BrokerOperation[] = ["test_database_connection", "generate_env_example", "check_url_scheme", "inspect_secret_metadata"];
const TOKEN_OPS: BrokerOperation[] = ["validate_token_format", "check_token_expiry_if_possible", "inspect_secret_metadata"];

const DETECTORS: Detector[] = [
    {
        type: "private_key",
        label: "Private key",
        sensitivity: "critical",
        pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
        operations: [],
    },
    {
        type: "ssh_key",
        label: "SSH private key",
        sensitivity: "critical",
        pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g,
        operations: [],
    },
    {
        type: "database_url",
        label: "Database URL",
        sensitivity: "critical",
        pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi,
        operations: DB_OPS,
    },
    {
        type: "github_token",
        label: "GitHub token",
        sensitivity: "critical",
        pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,255}\b/g,
        operations: TOKEN_OPS,
    },
    {
        type: "npm_token",
        label: "npm token",
        sensitivity: "critical",
        pattern: /\bnpm_[A-Za-z0-9]{20,255}\b/g,
        operations: TOKEN_OPS,
    },
    {
        type: "cloud_credential",
        label: "Cloud credential",
        sensitivity: "critical",
        pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
        operations: TOKEN_OPS,
    },
    {
        type: "jwt",
        label: "JWT",
        sensitivity: "high",
        pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
        operations: ["validate_token_format", "validate_jwt_expiry_without_payload_leak", "inspect_secret_metadata"],
    },
    {
        type: "webhook_url",
        label: "Webhook URL",
        sensitivity: "high",
        pattern: /https:\/\/hooks\.(?:slack|discord)\.com\/[^\s"'<>]+|https:\/\/[^\s"'<>]*(?:webhook|hooks)[^\s"'<>]*\/[^\s"'<>]+/gi,
        operations: ["validate_url_reachability_without_exposing_secret", "check_url_scheme", "inspect_secret_metadata"],
    },
    {
        type: "api_key",
        label: "API key",
        sensitivity: "critical",
        pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|[A-Za-z0-9_-]{32,})\b/g,
        operations: API_KEY_OPS,
    },
    {
        type: "aadhaar",
        label: "Aadhaar",
        sensitivity: "critical",
        pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
        operations: [],
    },
    {
        type: "pan",
        label: "PAN",
        sensitivity: "high",
        pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
        operations: [],
    },
    {
        type: "phone",
        label: "Phone",
        sensitivity: "medium",
        pattern: /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g,
        operations: [],
    },
];

const ENV_SECRET_KEY = /(?:^|\n)([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|DATABASE_URL|DB_URL|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*=\s*([^\n\r#]+)/gi;

export class SecretClassifier {
    classify(text: string, source = "selection"): SecretFinding[] {
        const findings: SecretFinding[] = [];
        for (const detector of DETECTORS) {
            detector.pattern.lastIndex = 0;
            for (const match of text.matchAll(detector.pattern)) {
                const value = match[0];
                const start = match.index ?? 0;
                findings.push({
                    type: detector.type,
                    value,
                    start,
                    end: start + value.length,
                    label: detector.label,
                    source,
                    sensitivity: detector.sensitivity,
                    allowedOperations: detector.operations,
                    metadata: this.metadataFor(detector.type, value),
                });
            }
        }

        ENV_SECRET_KEY.lastIndex = 0;
        for (const match of text.matchAll(ENV_SECRET_KEY)) {
            const key = match[1];
            const raw = match[2].trim();
            if (!raw || raw.length < 4 || /^\[?(REDACTED|SECRET_REF)/i.test(raw)) continue;
            const valueStart = (match.index ?? 0) + match[0].lastIndexOf(match[2]);
            const type = this.envType(key, raw);
            findings.push({
                type,
                value: raw,
                start: valueStart,
                end: valueStart + raw.length,
                label: key,
                source,
                sensitivity: type === "password" || type === "database_url" ? "critical" : "high",
                allowedOperations: type === "database_url" ? DB_OPS : API_KEY_OPS,
                metadata: { envKey: key },
            });
        }

        return this.dedupe(findings).sort((a, b) => a.start - b.start);
    }

    private envType(key: string, value: string): SecretType {
        if (/DATABASE_URL|DB_URL/i.test(key) || /^(?:postgres|mysql|mongodb|redis):\/\//i.test(value)) return "database_url";
        if (/PASSWORD|PASS/i.test(key)) return "password";
        if (/TOKEN/i.test(key)) return "oauth_token";
        if (/SECRET|CREDENTIAL/i.test(key)) return "env_secret";
        return "api_key";
    }

    private metadataFor(type: SecretType, value: string): Record<string, string | number | boolean> {
        if (type === "database_url") {
            try {
                const url = new URL(value);
                return { scheme: url.protocol.replace(":", ""), hostKnown: false, dbKnown: false };
            } catch {
                return { parseable: false };
            }
        }
        if (type === "jwt") return { segments: value.split(".").length };
        return {};
    }

    private dedupe(findings: SecretFinding[]): SecretFinding[] {
        const out: SecretFinding[] = [];
        for (const finding of findings) {
            const overlaps = out.some((x) => finding.start >= x.start && finding.end <= x.end);
            if (!overlaps) out.push(finding);
        }
        return out;
    }
}
