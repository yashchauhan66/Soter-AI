import { describe, it } from "node:test";
import assert from "node:assert";
import { DecisionEngine } from "../DecisionEngine";
import { HashCache, sanitizeDecisionForCache } from "../HashCache";
import { redactText, redactForSharing, findSurvivingSecrets, containsRawSecret } from "../Redactor";
import { minimizeEvidence } from "../EvidenceMinimizer";
import { detectSecrets } from "../detectors/SecretDetector";

// ─────────────────────────────────────────────────────────────────────────────
// Canary secrets. If any of these RAW values survive into redactedText, the
// clipboard, the cache, telemetry, or a report, that is a P0 release blocker.
// ─────────────────────────────────────────────────────────────────────────────
const CANARIES = {
    openai: "sk-test-soter-canary-123456789012345678",
    aws: "AKIAIOSFODNN7EXAMPLE",
    dbUrl: "postgresql://user:password@localhost:5432/prod",
    jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canary.signature",
    github: "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
    bearer: "Bearer abcdef1234567890ABCDEF.token_value",
    privateKey:
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA_canary_material_xxxxxxxxxxxxxxxxxx\n-----END RSA PRIVATE KEY-----",
    stripe: "sk_test_canarySoterFake1234567890",
    razorpay: "rzp_live_1234567890abcd",
};

const CANARY_BLOCK = [
    `OPENAI_KEY=${CANARIES.openai}`,
    `AWS_KEY=${CANARIES.aws}`,
    `DATABASE_URL=${CANARIES.dbUrl}`,
    `JWT=${CANARIES.jwt}`,
    `GITHUB_TOKEN=${CANARIES.github}`,
    `AUTH=${CANARIES.bearer}`,
    `STRIPE=${CANARIES.stripe}`,
    `RAZORPAY=${CANARIES.razorpay}`,
    CANARIES.privateKey,
].join("\n");

function assertNoRawCanaries(output: string, label: string): void {
    for (const [name, raw] of Object.entries(CANARIES)) {
        assert.ok(
            !output.includes(raw),
            `${label} must not contain raw ${name} canary. Output was:\n${output}`
        );
    }
}

describe("Redaction safety-net (canary regression)", () => {
    it("redactText masks every canary secret even with no findings supplied", () => {
        const out = redactText(CANARY_BLOCK);
        assertNoRawCanaries(out, "redactText");
        assert.strictEqual(findSurvivingSecrets(out).length, 0, "no high-risk secret may survive");
    });

    it("safety-net runs even when detector findings ARE supplied (merge, not replace)", () => {
        // Simulate a detector that only found the AWS key, missing everything else.
        const partialFindings = detectSecrets(`AWS=${CANARIES.aws}`).matches;
        const out = redactText(CANARY_BLOCK, partialFindings);
        assertNoRawCanaries(out, "redactText+partialFindings");
    });

    it("redactForSharing fails closed — surviving secret lines are scrubbed", () => {
        // A contrived secret the pattern net could miss still cannot leak a line.
        const weird = "TOKEN=" + "A".repeat(400);
        const out = redactForSharing(`${CANARY_BLOCK}\n${weird}`);
        assertNoRawCanaries(out, "redactForSharing");
        assert.strictEqual(containsRawSecret(out), false);
    });

    it("produces masked placeholders (not raw values) for the acceptance sample", () => {
        const out = redactText(
            [
                `OPENAI_KEY=${CANARIES.openai}`,
                `AWS_KEY=${CANARIES.aws}`,
                `DATABASE_URL=${CANARIES.dbUrl}`,
                `JWT=${CANARIES.jwt}`,
            ].join("\n")
        );
        assert.match(out, /OPENAI_KEY=\[REDACTED_API_KEY\]/);
        assert.match(out, /AWS_KEY=\[REDACTED_AWS_ACCESS_KEY\]/);
        assert.match(out, /DATABASE_URL=\[REDACTED_DATABASE_URL\]/);
        assert.match(out, /JWT=\[REDACTED_JWT\]/);
    });

    it("individual canary classes each redact", () => {
        assert.ok(!redactText(CANARIES.openai).includes(CANARIES.openai), "openai");
        assert.ok(!redactText(CANARIES.aws).includes(CANARIES.aws), "aws");
        assert.ok(!redactText(CANARIES.dbUrl).includes(CANARIES.dbUrl), "dbUrl");
        assert.ok(!redactText(CANARIES.jwt).includes(CANARIES.jwt), "jwt");
        assert.ok(!redactText(CANARIES.github).includes(CANARIES.github), "github");
        assert.ok(!redactText(CANARIES.bearer).includes(CANARIES.bearer), "bearer");
        assert.ok(!redactText(CANARIES.stripe).includes(CANARIES.stripe), "stripe");
        assert.ok(!redactText(CANARIES.razorpay).includes(CANARIES.razorpay), "razorpay");
        assert.ok(!redactText(CANARIES.privateKey).includes("canary_material"), "privateKey");
    });
});

describe("DecisionEngine never emits raw secrets", () => {
    it("redactedText contains zero raw canaries", async () => {
        const engine = new DecisionEngine();
        const decision = await engine.scan(CANARY_BLOCK, { context: "selection", skipCache: true });
        assert.ok(decision.redactedText, "should produce redacted output for a secret-laden block");
        assertNoRawCanaries(decision.redactedText!, "decision.redactedText");
        assert.strictEqual(findSurvivingSecrets(decision.redactedText!).length, 0);
    });

    it("evidencePreview and findings evidence contain zero raw canaries", async () => {
        const engine = new DecisionEngine();
        const decision = await engine.scan(CANARY_BLOCK, { context: "selection", skipCache: true });
        assertNoRawCanaries(decision.evidencePreview ?? "", "evidencePreview");
        for (const f of decision.findings) {
            assertNoRawCanaries(f.redactedEvidence, `finding ${f.id}`);
        }
    });
});

describe("HashCache never stores raw secrets", () => {
    it("cached decision has no raw canaries", async () => {
        const engine = new DecisionEngine();
        const decision = await engine.scan(CANARY_BLOCK, { context: "selection" });
        const cached = engine.getCache().get(decision.inputHash);
        assert.ok(cached, "decision should be cached");
        const serialized = JSON.stringify(cached);
        assertNoRawCanaries(serialized, "serialized cached decision");
    });

    it("sanitizeDecisionForCache scrubs a leaked field defensively", () => {
        const leaky: any = {
            decision: "allow",
            riskScore: 0,
            severity: "info",
            categories: [],
            findings: [
                { id: "x", category: "c", severity: "low", title: "t", reason: "r", redactedEvidence: CANARIES.aws, confidence: 1 },
            ],
            redactedText: `leak ${CANARIES.openai}`,
            evidencePreview: `leak ${CANARIES.jwt}`,
            inputHash: "h",
            detectorVersions: {},
            localOnly: true,
            createdAt: "now",
        };
        const clean = sanitizeDecisionForCache(leaky);
        assertNoRawCanaries(JSON.stringify(clean), "sanitized decision");
    });

    it("HashCache.set stores a sanitized copy", () => {
        const cache = new HashCache();
        const leaky: any = {
            decision: "allow", riskScore: 0, severity: "info", categories: [], findings: [],
            redactedText: `x ${CANARIES.openai}`, evidencePreview: undefined,
            inputHash: "h", detectorVersions: {}, localOnly: true, createdAt: "now",
        };
        cache.set("k", leaky);
        assertNoRawCanaries(JSON.stringify(cache.get("k")), "cache.get");
    });
});

describe("EvidenceMinimizer never exposes raw secrets", () => {
    it("minimized findings carry only masked evidence", () => {
        const matches = detectSecrets(CANARY_BLOCK).matches;
        assert.ok(matches.length > 0, "detector should find canaries");
        const findings = minimizeEvidence(matches, "SecretDetector");
        for (const f of findings) {
            assertNoRawCanaries(f.redactedEvidence, `finding ${f.id}`);
        }
    });
});
