"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const file = path.join(__dirname, "real-history-focused-01.txt"), before = fs.readFileSync(file);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
let count = 0;
const text = before.toString("utf8").replace(/  error: \|-\r?\n    Values have same structure but are not reference-equal:[\s\S]*?(?=  code: 'ERR_TEST_FAILURE')/g, () => {
    count++; return "  error: |-\n    PRIVACY_REDACTED: structural assertion compared Node process.env exotic object to a plain spread snapshot.\n    Its failure formatter emitted ambient environment. Values removed; original failure and counts preserved.\n";
});
if (count !== 14 || /AGENT_ROUTER_TOKEN:/.test(text)) throw Error("Unexpected redaction count or remaining environment diagnostic; no values printed");
const after = Buffer.from(text); fs.writeFileSync(file, after);
fs.writeFileSync(path.join(__dirname, "real-history-privacy-redaction-01.json"), JSON.stringify({ status: "PRIVACY_REDACTED_ORIGINAL_TEST_FAILURE_UNREGRADED", originalSha256: sha(before),
    originalBytes: before.length, redactedSha256: sha(after), redactedBytes: after.length, diagnosticBlocksRedacted: count,
    reason: "Node assertion formatter emitted ambient environment while comparing process.env exotic object to plain spread. No raw environment is retained after redaction.",
    receiptNote: "Original canonical result retains original output hash; this receipt explicitly records the privacy edit. No behavioral PASS or hidden failure.", observedAt: new Date().toISOString() }, null, 2) + "\n", { flag: "wx" });
before.fill(0);
process.stdout.write(JSON.stringify({ redactedBlocks: count, redactedSha256: sha(after) }) + "\n");
