import { test } from "node:test";
import assert from "node:assert/strict";
const providers = ["openai", "anthropic", "google", "aws", "github", "stripe", "unknown"] as const;
test("F21 provider checklists stay manual/unverified and contain only fixed official links", async () => {
    const { hygieneRotationChecklist } = await import("../hygiene/HygieneRotation");
    const domains: Record<string, string> = { openai: "developers.openai.com", anthropic: "platform.claude.com", google: "ai.google.dev", aws: "docs.aws.amazon.com", github: "docs.github.com", stripe: "docs.stripe.com" };
    for (const provider of providers) { const result = hygieneRotationChecklist(provider, "routine"); assert.equal(result.status, "NOT_PERFORMED"); assert.equal(result.validity, "UNVERIFIED"); assert.equal(result.provider, provider); assert(result.steps.length >= 3);
        if (provider !== "unknown") assert(result.sources.some(source => new URL(source).hostname === domains[provider])); else assert.equal(result.sources.length, 0);
    }
});
test("F21 suspected-exposure checklist distinguishes urgent provider action from routine replacement", async () => {
    const { hygieneRotationChecklist } = await import("../hygiene/HygieneRotation"); const urgent = hygieneRotationChecklist("openai", "suspected-exposure"), routine = hygieneRotationChecklist("openai", "routine");
    assert.notDeepEqual(urgent.steps, routine.steps); assert.match(urgent.steps[0], /revok|disable|exposure/i); assert.match(JSON.stringify(routine.steps), /verif/i);
});
test("F21 checklist rejects untrusted labels/modes and accepts no credential or authority carrier", async () => {
    const { hygieneRotationChecklist } = await import("../hygiene/HygieneRotation");
    for (const provider of ["https://foreign.invalid", "OPENAI", "PRIVATE_KEY_VALUE", { approved: true }]) assert.throws(() => hygieneRotationChecklist(provider as never, "routine"));
    for (const mode of ["rotate-now", { apiKey: "PRIVATE_VALUE" }]) assert.throws(() => hygieneRotationChecklist("openai", mode as never));
});
