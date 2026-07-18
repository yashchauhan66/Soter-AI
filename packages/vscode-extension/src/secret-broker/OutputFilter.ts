import { SecretClassifier } from "./SecretClassifier";

export interface OutputFilterResult {
    allowed: boolean;
    text: string;
    reason?: string;
}

const REQUESTS_SECRET = /\b(?:paste|send|provide|share|reveal|print|show)\b.{0,80}\b(?:api key|token|secret|password|private key|database url|credential)\b/i;
const UNSAFE_COMMAND = /\b(?:curl\s+[^|]+?\|\s*(?:sh|bash)|rm\s+-rf|chmod\s+777|Invoke-WebRequest\b.{0,80}iex)\b/i;

export class OutputFilter {
    constructor(private readonly classifier = new SecretClassifier()) {}

    filter(output: string): OutputFilterResult {
        if (REQUESTS_SECRET.test(output)) {
            return { allowed: false, text: "SoterAI blocked this response because it asks for sensitive information.", reason: "asks_for_secret" };
        }
        if (UNSAFE_COMMAND.test(output)) {
            return { allowed: false, text: "SoterAI blocked this response because it suggests an unsafe command.", reason: "unsafe_command" };
        }
        const findings = this.classifier.classify(output, "ai-output");
        if (!findings.length) return { allowed: true, text: output };

        let text = output;
        for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
            text = `${text.slice(0, finding.start)}[REDACTED_${finding.type.toUpperCase()}]${text.slice(finding.end)}`;
        }
        return { allowed: true, text, reason: "secret_like_output_redacted" };
    }
}
