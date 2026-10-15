import { SecretClassifier } from "./SecretClassifier";
import { RegisteredSecretMatcher, SECRET_MATCH_LIMITS } from "../../../core/src/RegisteredSecretMatcher";

export interface OutputFilterResult {
    allowed: boolean;
    text: string;
    reason?: string;
}

const REQUESTS_SECRET = /\b(?:paste|send|provide|share|reveal|print|show)\b.{0,80}\b(?:api key|token|secret|password|private key|database url|credential)\b/i;
const UNSAFE_COMMAND = /\b(?:curl\s+[^|]+?\|\s*(?:sh|bash)|rm\s+-rf|chmod\s+777|Invoke-WebRequest\b.{0,80}iex)\b/i;

export class OutputFilter {
    constructor(private readonly classifier = new SecretClassifier(), private readonly options: { matchingEnabled?: () => boolean } = {}) {}

    filter(output: string, knownSecrets: readonly string[] = []): OutputFilterResult {
        const withheld = (): OutputFilterResult => ({ allowed: false, text: "SoterAI withheld this response because complete secret matching is unavailable.", reason: "secret_matching_unavailable" });
        try {
        if (this.options.matchingEnabled && this.options.matchingEnabled() !== true) return withheld();
        if (Buffer.byteLength(output, "utf8") > 128 * 1024) {
            return { allowed: false, text: "SoterAI withheld a response exceeding the local output limit.", reason: "output_limit" };
        }
        const leaves: string[] = [];
        let nodes = 0, exhausted = false;
        const visit = (value: unknown, depth = 0): void => {
            if (exhausted) return;
            if (++nodes > 10_000 || depth > 32) { exhausted = true; return; }
            if (typeof value === "string") {
                if (leaves.length >= SECRET_MATCH_LIMITS.maxParts) { exhausted = true; return; }
                leaves.push(value);
            } else if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); }
            else if (value && typeof value === "object") { for (const item of Object.values(value)) visit(item, depth + 1); }
        };
        let parsed: unknown;
        try { parsed = JSON.parse(output); } catch { /* Plain text is a supported input. */ }
        if (parsed !== undefined) visit(parsed);
        if (exhausted) return withheld();
        const matcher = new RegisteredSecretMatcher(knownSecrets);
        const decisions = [matcher.inspectRequest([output])];
        if (leaves.length) decisions.push(matcher.inspectRequest(leaves));
        if (decisions.some(decision => decision.status === "WITHHELD")) return withheld();
        if (decisions.some(decision => decision.status === "MATCHED")) {
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
        } catch { return withheld(); }
    }
}
