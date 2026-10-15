import { SecretClassifier } from "./SecretClassifier";
import { RegisteredSecretMatcher, SECRET_MATCH_LIMITS } from "../../../core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor, STREAM_OUTPUT_LIMITS, type OutputChannel, type OutputResult } from "../../../core/src/StreamingOutputRedactor";

export interface OutputFilterResult {
    allowed: boolean;
    text: string;
    reason?: string;
}

const REQUESTS_SECRET = /\b(?:paste|send|provide|share|reveal|print|show)\b.{0,80}\b(?:api key|token|secret|password|private key|database url|credential)\b/i;
const UNSAFE_COMMAND = /\b(?:curl\s+[^|]+?\|\s*(?:sh|bash)|rm\s+-rf|chmod\s+777|Invoke-WebRequest\b.{0,80}iex)\b/i;

export class OutputFilter {
    constructor(private readonly classifier = new SecretClassifier(), private readonly options: { matchingEnabled?: () => boolean; outputRedactorEnabled?: () => boolean } = {}) {}

    filterChunks(chunks: readonly { channel: OutputChannel; bytes: Uint8Array }[], knownSecrets: readonly string[] = [], exitCode = 0): OutputResult {
        const stream = new StreamingOutputRedactor(knownSecrets, { enabled: () => (!this.options.matchingEnabled || this.options.matchingEnabled() === true)
            && (!this.options.outputRedactorEnabled || this.options.outputRedactorEnabled() === true) });
        try {
            if (!Array.isArray(chunks) || chunks.length > STREAM_OUTPUT_LIMITS.maxChunks) throw new Error();
            for (const chunk of chunks) if (stream.push(chunk.channel, chunk.bytes).status === "WITHHELD") break;
            return stream.finish(exitCode);
        } catch { stream.cancel(); return stream.finish(exitCode); }
    }

    filter(output: string, knownSecrets: readonly string[] = []): OutputFilterResult {
        const withheld = (): OutputFilterResult => ({ allowed: false, text: "SoterAI withheld this response because complete secret matching is unavailable.", reason: "secret_matching_unavailable" });
        try {
        if (typeof output !== "string" || output.length > STREAM_OUTPUT_LIMITS.maxInputBytes || Buffer.from(output, "utf8").toString("utf8") !== output) return withheld();
        if (this.options.matchingEnabled && this.options.matchingEnabled() !== true) return withheld();
        if (Buffer.byteLength(output, "utf8") > 128 * 1024) {
            return { allowed: false, text: "SoterAI withheld a response exceeding the local output limit.", reason: "output_limit" };
        }
        const stream = this.filterChunks([{ channel: "stdout", bytes: Buffer.from(output, "utf8") }], knownSecrets);
        if (stream.status === "WITHHELD") return withheld();
        output = stream.stdout;
        if (stream.redacted) return { allowed: true, text: output, reason: "secret_like_output_redacted" };
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
            if (!matcher.isSafeReplacement("[REDACTED_SECRET_OUTPUT]")) return withheld();
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
            const replacement = `[REDACTED_${finding.type.toUpperCase()}]`;
            if (!matcher.isSafeReplacement(replacement)) return withheld();
            text = `${text.slice(0, finding.start)}${replacement}${text.slice(finding.end)}`;
        }
        if (matcher.inspectRequest([text]).status !== "CLEAN") return withheld();
        return { allowed: true, text, reason: "secret_like_output_redacted" };
        } catch { return withheld(); }
    }
}
