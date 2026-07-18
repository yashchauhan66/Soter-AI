import { describe, it } from "node:test";
import assert from "node:assert";
import {
    buildLedgerEntry,
    sanitizeLedgerEntry,
    serializeLedger,
    parseLedger,
    chainLedgerEntry,
    verifyLedgerChain,
    LEDGER_GENESIS_HASH,
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

describe("tamper-evident hash chain", () => {
    function entry(id: string): LedgerEntry {
        return buildLedgerEntry({
            eventId: id, workspacePseudoId: "ws", eventType: "context_built",
            action: "allow", severity: "info", riskScore: 0, policyVersion: "1",
        });
    }

    it("chains entries and verifies a clean chain", async () => {
        const a = await chainLedgerEntry(entry("a"), undefined);
        const b = await chainLedgerEntry(entry("b"), a.entryHash);
        const c = await chainLedgerEntry(entry("c"), b.entryHash);
        assert.strictEqual(a.prevHash, LEDGER_GENESIS_HASH);
        const result = await verifyLedgerChain([a, b, c]);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.checkedEntries, 3);
    });

    it("detects an edited entry", async () => {
        const a = await chainLedgerEntry(entry("a"), undefined);
        const b = await chainLedgerEntry(entry("b"), a.entryHash);
        const tampered = { ...b, riskScore: 99 };
        const result = await verifyLedgerChain([a, tampered]);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.firstInvalidIndex, 1);
        assert.match(result.reason ?? "", /entryHash mismatch/);
    });

    it("detects a deleted middle entry", async () => {
        const a = await chainLedgerEntry(entry("a"), undefined);
        const b = await chainLedgerEntry(entry("b"), a.entryHash);
        const c = await chainLedgerEntry(entry("c"), b.entryHash);
        const result = await verifyLedgerChain([a, c]);
        assert.strictEqual(result.valid, false);
        assert.match(result.reason ?? "", /prevHash mismatch/);
    });

    it("accepts a retention-trimmed head (first entry prevHash taken as-is)", async () => {
        const a = await chainLedgerEntry(entry("a"), undefined);
        const b = await chainLedgerEntry(entry("b"), a.entryHash);
        const c = await chainLedgerEntry(entry("c"), b.entryHash);
        // a was trimmed by retention; chain from b onward must still verify.
        const result = await verifyLedgerChain([b, c]);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.checkedEntries, 2);
    });

    it("tolerates legacy unchained entries before the chain starts", async () => {
        const legacy = entry("legacy");
        const a = await chainLedgerEntry(entry("a"), undefined);
        const result = await verifyLedgerChain([legacy, a]);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.unchainedEntries, 1);
        assert.strictEqual(result.checkedEntries, 1);
    });
});
