import { SecretClassifier } from "./SecretClassifier";
import { SecretReferenceManager } from "./SecretReferenceManager";
import { SensitiveContextPolicyEngine } from "./SensitiveContextPolicy";
import { type BrokerOperation, type RedactionResult, type RedactedSecret, type SecretFinding } from "./types";

export class SensitiveContextRedactor {
    constructor(
        private readonly refs: SecretReferenceManager,
        private readonly policy: SensitiveContextPolicyEngine,
        private readonly classifier = new SecretClassifier(),
    ) {}

    async redact(input: string, workspace: string, source = "selection"): Promise<RedactionResult> {
        const findings = this.classifier.classify(input, source);
        const redacted: RedactedSecret[] = [];
        const blocked: RedactedSecret[] = [];
        let cursor = 0;
        let output = "";

        for (const finding of findings) {
            if (finding.start < cursor) continue;
            output += input.slice(cursor, finding.start);
            const action = this.policy.actionFor(finding.type);
            const pii = this.piiPlaceholder(finding);
            if (action === "block" || action === "enterprise_locked") {
                const placeholder = pii ?? `[BLOCKED_${finding.type.toUpperCase()}]`;
                const item = this.withoutValue(finding, placeholder);
                blocked.push(item);
                redacted.push(item);
                output += placeholder;
            } else if (action === "redact" || finding.allowedOperations.length === 0 || pii) {
                const placeholder = pii ?? `[REDACTED_${finding.type.toUpperCase()}]`;
                redacted.push(this.withoutValue(finding, placeholder));
                output += placeholder;
            } else {
                const metadata = await this.refs.create({
                    finding,
                    workspace,
                    ttlMs: this.policy.ttlMs(),
                    userApprovalState: "required",
                });
                const placeholder = `[SECRET_REF:${finding.type}:${metadata.id}]`;
                redacted.push(this.withoutValue(finding, placeholder, metadata.ref, metadata));
                output += placeholder;
            }
            cursor = finding.end;
        }
        output += input.slice(cursor);

        const allowedOperations = [...new Set(redacted.flatMap((item) => item.metadata?.allowedOperations ?? []))] as BrokerOperation[];
        return { text: output, secrets: redacted, blocked, allowedOperations };
    }

    private piiPlaceholder(finding: SecretFinding): string | undefined {
        if (finding.type === "aadhaar") return "[REDACTED_AADHAAR]";
        if (finding.type === "pan") return "[REDACTED_PAN]";
        if (finding.type === "phone") return "[REDACTED_PHONE]";
        if (finding.type === "email") return "[REDACTED_EMAIL]";
        return undefined;
    }

    private withoutValue(finding: SecretFinding, placeholder: string, ref?: string, metadata?: RedactedSecret["metadata"]): RedactedSecret {
        const { value: _value, ...safeFinding } = finding;
        return { finding: safeFinding, placeholder, ref, metadata };
    }
}
