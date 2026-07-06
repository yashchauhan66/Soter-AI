import { describe, it } from "node:test";
import assert from "node:assert";
import {
    generateCanary,
    matchCanaries,
    toCanaryMetadata,
    canaryPreview,
    CANARY_TOKEN_PREFIX,
} from "../Canary";
import { detectSecrets } from "../detectors/SecretDetector";

describe("Canary generation", () => {
    it("produces a unique, SecretDetector-visible token with hash-only metadata", async () => {
        const a = await generateCanary();
        const b = await generateCanary();
        assert.notStrictEqual(a.token, b.token, "tokens are unique");
        assert.ok(a.token.startsWith(CANARY_TOKEN_PREFIX));
        assert.ok(a.hash.length >= 8);

        // The existing SecretDetector should also flag a planted canary.
        const matches = detectSecrets(a.token).matches;
        assert.ok(matches.length > 0, "SecretDetector should catch the canary");

        // Persist-safe metadata must not carry the raw token.
        const meta = toCanaryMetadata(a);
        assert.ok(!JSON.stringify(meta).includes(a.token), "metadata must not contain the raw token");
        assert.strictEqual(meta.redactedPreview, canaryPreview(a.token));
    });
});

describe("matchCanaries", () => {
    it("detects a canary embedded in text and reports only redacted info", async () => {
        const canary = await generateCanary();
        const text = `Here is some code.\nconst key = "${canary.token}";\nUse it twice: ${canary.token}`;
        const hits = matchCanaries(text, [canary]);
        assert.strictEqual(hits.length, 1);
        assert.strictEqual(hits[0].count, 2);
        assert.strictEqual(hits[0].id, canary.id);
        assert.ok(!JSON.stringify(hits).includes(canary.token), "hit output must not contain the raw token");
    });

    it("returns no hits when the canary is absent", async () => {
        const canary = await generateCanary();
        assert.deepStrictEqual(matchCanaries("nothing to see here", [canary]), []);
    });
});
