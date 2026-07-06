import { describe, it } from "node:test";
import assert from "node:assert";
import {
    buildLedgerEntry,
    sanitizeLedgerEntry,
    serializeLedger,
    parseLedger,
    type LedgerEntry,
} from "../Ledger";

const RAW_SECRET = "sk-test-soter-canary-123456789012345678";

describe("buildLedgerEntry", () => {
    it("produces a complete entry with defaults", () => {
        const entry = buildLedgerEntry({
            eventId: "e1",
            workspacePseudoId: "ws1",
            eventType: "context_built",
            action: "redact",
            severity: "medium",
            riskScore: 40,
            categories: ["secret"],
            policyVersion: "1",
        });
        assert.strictEqual(entry.eventId, "e1");
        assert.strictEqual(entry.decision, "redact"); // defaults to action
        assert.ok(entry.timestamp);
        assert.deepStrictEqual(entry.contentHashes, []);
    });
});

describe("sanitizeLedgerEntry", () => {
    it("scrubs a raw secret that leaked into a preview field", () => {
        const leaky: LedgerEntry = {
            eventId: "e2",
            timestamp: "now",
            workspacePseudoId: "ws1",
            eventType: "output_scanned",
            action: "block",
            decision: "block",
            severity: "critical",
            riskScore: 100,
            categories: ["secret"],
            filePaths: ["src/app.ts"],
            contentHashes: ["abc123"],
            redactedEvidencePreview: `leaked ${RAW_SECRET}`,
            policyVersion: "1",
            detectorVersions: {},
        };
        const clean = sanitizeLedgerEntry(leaky);
        assert.ok(!JSON.stringify(clean).includes(RAW_SECRET), "no raw secret may survive sanitization");
        assert.strictEqual(clean.redactedEvidencePreview, "[REDACTED]");
    });
});

describe("serialize/parse ledger", () => {
    it("round-trips entries as JSONL and drops raw secrets on write", () => {
        const entries: LedgerEntry[] = [
            buildLedgerEntry({
                eventId: "a", workspacePseudoId: "ws", eventType: "context_built",
                action: "allow", severity: "info", riskScore: 0, policyVersion: "1",
                redactedEvidencePreview: `evil ${RAW_SECRET}`,
            }),
        ];
        const jsonl = serializeLedger(entries);
        assert.ok(!jsonl.includes(RAW_SECRET));
        const parsed = parseLedger(jsonl);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].eventId, "a");
    });

    it("skips corrupt lines without throwing", () => {
        const parsed = parseLedger('{"eventId":"ok"}\nnot json\n\n');
        assert.strictEqual(parsed.length, 1);
    });
});
