import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const ENV_FILE_DETECTOR_VERSION = "1.0.0";

const ENV_SPECS: RegexDetectorSpec[] = [
    {
        type: "env_file_content",
        label: ".env file content",
        severity: "critical",
        score: 38,
        pattern: /(?:^|\n)(?:[A-Z][A-Z0-9_]{2,}\s*=\s*\S+\n){2,}/gm,
        message: "Environment variable configuration block detected.",
        confidence: 0.9,
    },
    {
        type: "env_file_reference",
        label: ".env file reference",
        severity: "high",
        score: 20,
        pattern: /(?:^|[\\/\s])\.env(?:\.[a-z0-9_-]+)?\b/gim,
        message: "Reference to .env file detected.",
        confidence: 0.85,
    },
    {
        type: "dotenv_load",
        label: "dotenv loading",
        severity: "medium",
        score: 12,
        pattern: /\brequire\s*\(\s*["']dotenv["']\s*\)|import\s+.*["']dotenv["']|dotenv\.config\s*\(/gi,
        message: "dotenv library loading detected.",
        confidence: 0.7,
    },
    {
        type: "env_variable_declaration",
        label: "Environment variable declaration",
        severity: "high",
        score: 22,
        pattern: /\b(?:DATABASE_URL|DB_PASSWORD|API_KEY|SECRET_KEY|JWT_SECRET|PRIVATE_KEY|AUTH_TOKEN|MONGO_URI|REDIS_URL|SMTP_PASSWORD|MAIL_PASSWORD|S3_SECRET|AZURE_KEY|GCP_KEY)\s*=\s*\S+/gi,
        message: "Sensitive environment variable detected.",
        confidence: 0.9,
    },
];

export function detectEnvFile(text: string): DetectorResult {
    return {
        detectorName: "EnvFileDetector",
        detectorVersion: ENV_FILE_DETECTOR_VERSION,
        matches: runRegexDetectors(text, ENV_SPECS),
    };
}
