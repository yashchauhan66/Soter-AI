import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_CORPUS } from "../../benchmarks/security-corpus";

const extensionRoot = join(__dirname, "..", "..");
const reportPath = join(extensionRoot, "benchmark-results", "security-evaluation.json");

describe("extension security benchmark evidence", () => {
    it("uses a balanced, unique, multi-surface corpus", () => {
        assert.ok(SECURITY_CORPUS.length >= 40);
        assert.equal(new Set(SECURITY_CORPUS.map((item) => item.id)).size, SECURITY_CORPUS.length);
        const risky = SECURITY_CORPUS.filter((item) => item.risky).length;
        const benign = SECURITY_CORPUS.length - risky;
        assert.ok(risky >= 20 && benign >= 20, `unbalanced corpus: ${risky} risky / ${benign} benign`);
        assert.ok(new Set(SECURITY_CORPUS.map((item) => item.context)).size >= 4);
        assert.ok(new Set(SECURITY_CORPUS.filter((item) => item.risky).map((item) => item.category)).size >= 8);
    });

    it("contains only explicit synthetic fixtures and no private-key body", () => {
        const corpus = JSON.stringify(SECURITY_CORPUS);
        assert.doesNotMatch(corpus, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
        assert.doesNotMatch(corpus, /hooks\.slack\.com\/services\//);
        assert.ok(corpus.includes("attacker.invalid"), "attack destinations must use the reserved .invalid TLD");
    });

    it("publishes machine-readable results with honest scope", () => {
        assert.ok(existsSync(reportPath), "run npm run benchmark:security to generate evidence");
        const report = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(report.corpus.total, SECURITY_CORPUS.length);
        assert.match(report.independence, /NOT INDEPENDENT/);
        assert.ok(report.limitations.some((item: string) => /not universal interception/i.test(item)));
        assert.ok(report.limitations.some((item: string) => /No competitor/i.test(item)));
        assert.equal(report.confusionMatrix.falseNegatives, 0);
        assert.equal(report.confusionMatrix.falsePositives, 0);
        assert.equal(report.metrics.recall, 1);
        assert.equal(report.metrics.falsePositiveRate, 0);
        assert.deepEqual(report.failures, []);
    });
});