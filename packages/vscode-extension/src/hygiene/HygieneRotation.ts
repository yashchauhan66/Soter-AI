import { HYGIENE_PROVIDERS, hygieneUnavailable, type HygieneProvider } from "./HygieneAnalysis";
export type HygieneRotationMode = "routine" | "suspected-exposure";
const guidance: Record<HygieneProvider, { sources: readonly string[]; routine: readonly string[]; urgent: string }> = {
    openai: {
        sources: ["https://developers.openai.com/api/docs/guides/production-best-practices", "https://developers.openai.com/api/docs/guides/safety-best-practices"],
        routine: ["Create a replacement key with only the permissions the application needs.", "Update the application's private credential store and verify the replacement works.", "Revoke the previous key after verification; review usage and set a rotation schedule."],
        urgent: "Promptly revoke the suspected exposed OpenAI key in the provider account; plan for application interruption."
    },
    anthropic: {
        sources: ["https://platform.claude.com/docs/en/manage-claude/authentication"],
        routine: ["Create a replacement key in the intended Claude Console workspace with appropriate access.", "Update the application's private credential store and verify its requests use the replacement.", "Disable or delete the old key; review account usage and schedule regular rotation."],
        urgent: "Disable or delete the suspected exposed Anthropic key through Claude Console; review unexpected usage."
    },
    google: {
        sources: ["https://ai.google.dev/gemini-api/docs/api-key"],
        routine: ["Create a replacement key in the intended AI Studio or Google Cloud project and review restrictions.", "Deploy the replacement through a private credential store and verify application requests.", "Disable or delete the old key after verification and review project usage."],
        urgent: "Disable or delete the suspected exposed Google key in its owning project; assess application interruption and usage."
    },
    aws: {
        sources: ["https://docs.aws.amazon.com/IAM/latest/UserGuide/id-credentials-access-keys-update.html"],
        routine: ["Prefer temporary role credentials where possible; otherwise create a replacement access key for the intended IAM identity.", "Update the application's private credential store and verify all consumers use the replacement.", "Deactivate the old access key, check for failures and usage, then delete it when appropriate."],
        urgent: "Deactivate the suspected exposed AWS access key in its owning IAM account; review activity and dependent applications."
    },
    github: {
        sources: ["https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"],
        routine: ["Create a replacement token with appropriate expiration, selected repositories and minimum required permissions.", "Update the application's private credential store and verify repository operations with the replacement.", "Delete the old token in GitHub settings and review account or organization activity."],
        urgent: "Revoke or delete the suspected exposed GitHub token in the owning account; review account and repository activity."
    },
    stripe: {
        sources: ["https://docs.stripe.com/keys"],
        routine: ["Identify the correct Stripe account, test or live mode, and secret or restricted key; publishable keys are public identifiers.", "Use the Dashboard key-roll workflow, update the private credential store and verify application requests before the old key expires.", "Confirm the old key has expired or been revoked and review API logs and permissions."],
        urgent: "Use Stripe Dashboard to roll or revoke the suspected exposed secret or restricted key with an appropriate immediate expiration."
    },
    unknown: {
        sources: [],
        routine: ["Identify the credential owner and provider through trusted account records; do not paste the value into search or chat.", "Consult the provider's official replacement and revocation instructions and verify application dependencies.", "Replace credentials through a private store, revoke superseded credentials and review usage with the owner."],
        urgent: "Treat suspected exposure as an owner incident; identify the provider and use its official revocation process promptly."
    }
};
/** Static owner guidance only. No credential input, account access, network call or rotation is performed. */
export function hygieneRotationChecklist(provider: HygieneProvider, mode: HygieneRotationMode) {
    if (typeof provider !== "string" || !HYGIENE_PROVIDERS.includes(provider) || mode !== "routine" && mode !== "suspected-exposure") return hygieneUnavailable();
    const selected = guidance[provider];
    return Object.freeze({ provider, mode, status: "NOT_PERFORMED" as const, validity: "UNVERIFIED" as const,
        steps: Object.freeze(mode === "routine" ? [...selected.routine] : [selected.urgent, ...selected.routine]),
        sources: Object.freeze([...selected.sources]), scope: "Manual owner checklist. Candidate provider labels are heuristic; key validity, AI access and rotation are unverified." });
}
