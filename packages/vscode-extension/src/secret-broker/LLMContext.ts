import { type BrokerOperation, type RedactionResult } from "./types";

export interface SafeLLMContext {
    systemContract: string;
    task: string;
    redactedText: string;
    secretMetadata: Array<Record<string, unknown>>;
    allowedOperations: BrokerOperation[];
    forbiddenOperations: string[];
    expectedOutputFormat: string;
}

export const SECRET_REF_CONTRACT =
    "You may see SECRET_REF placeholders. These are not secrets. You must not ask the user to reveal them. You may request only allowed broker operations. Never output, reconstruct, infer, or request raw secret values.";

export function buildSafeLLMContext(task: string, redactionResult: RedactionResult, allowedOperations: BrokerOperation[]): SafeLLMContext {
    return {
        systemContract: SECRET_REF_CONTRACT,
        task,
        redactedText: redactionResult.text,
        secretMetadata: redactionResult.secrets.map((secret) => ({
            type: secret.finding.type,
            source: secret.finding.source,
            sensitivity: secret.finding.sensitivity,
            ref: secret.ref,
            allowedOperations: secret.metadata?.allowedOperations ?? [],
        })),
        allowedOperations,
        forbiddenOperations: ["reveal_secret", "send_secret_to_llm", "print_secret", "run_arbitrary_shell", "exfiltrate_secret"],
        expectedOutputFormat: "Use redacted context and request broker operations when needed. Do not request raw sensitive values.",
    };
}
