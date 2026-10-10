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

    filter(output: string, knownSecrets: readonly string[] = []): OutputFilterResult {
        if (Buffer.byteLength(output, "utf8") > 128 * 1024) {
            return { allowed: false, text: "SoterAI withheld a response exceeding the local output limit.", reason: "output_limit" };
        }
        if (containsKnownSecret(output, knownSecrets)) {
            return { allowed: true, text: "[REDACTED_SECRET_OUTPUT]", reason: "secret_like_output_redacted" };
        }
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

/** Known-value defense supplements format heuristics. This is not a covert-channel detector. */
function containsKnownSecret(output: string, secrets: readonly string[]): boolean {
    const views = [output];
    const leaves: string[] = [];
    let nodes = 0;
    let exhausted = false;
    function visit(value: unknown, depth = 0): void {
        if (++nodes > 10_000 || depth > 32) { exhausted = true; return; }
        if (typeof value === "string") leaves.push(value);
        else if (Array.isArray(value)) value.forEach(item => visit(item, depth + 1));
        else if (value && typeof value === "object") Object.values(value).forEach(item => visit(item, depth + 1));
    }
    try { visit(JSON.parse(output)); } catch { /* Plain text response. */ }
    if (exhausted) return true;
    views.push(...leaves, leaves.join(""));
    for (const secret of secrets) {
        if (!secret) continue;
        const needles = [secret, Buffer.from(secret).toString("base64"), Buffer.from(secret).toString("base64url"),
            Buffer.from(secret).toString("hex"), Buffer.from(secret).toString("hex").toUpperCase(),
            encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)];
        if (views.some(view => needles.some(needle => view.includes(needle)))) return true;
    }
    return false;
}
