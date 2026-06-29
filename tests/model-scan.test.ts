import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { scanModelArtifact } from "../lib/model-scan";
import { scanPickle } from "../lib/model-scan/pickle";
import { classifyImport } from "../lib/model-scan/classify";
import { verifyProvenance } from "../lib/model-scan/provenance";

/* ── Pickle byte builders ─────────────────────────────────────────────────
 * Hand-craft real pickle opcode streams so the scanner is tested against the
 * actual wire format, not mocks.
 */

// proto-2 pickle: GLOBAL os system ; (S 'cmd' tuple) ; REDUCE ; STOP
function maliciousOsSystemPickle(cmd = "echo pwned"): Buffer {
  const parts: number[] = [];
  parts.push(0x80, 0x02); // PROTO 2
  // GLOBAL 'c' "os\n" "system\n"
  parts.push(0x63, ...Buffer.from("os\n", "latin1"), ...Buffer.from("system\n", "latin1"));
  // SHORT_BINSTRING 'U' len cmd
  const c = Buffer.from(cmd, "latin1");
  parts.push(0x55, c.length, ...c);
  parts.push(0x85); // TUPLE1
  parts.push(0x52); // REDUCE
  parts.push(0x2e); // STOP
  return Buffer.from(parts);
}

// proto-4 STACK_GLOBAL variant: builtins.eval
function maliciousStackGlobalEval(): Buffer {
  const parts: number[] = [];
  parts.push(0x80, 0x04); // PROTO 4
  const push = (s: string) => { const b = Buffer.from(s, "utf8"); parts.push(0x8c, b.length, ...b); }; // SHORT_BINUNICODE
  push("builtins");
  push("eval");
  parts.push(0x93); // STACK_GLOBAL
  push("__import__('os').system('id')");
  parts.push(0x85, 0x52, 0x2e); // TUPLE1 REDUCE STOP
  return Buffer.from(parts);
}

// benign proto-2 pickle: numpy reconstruction (GLOBAL numpy.core.multiarray _reconstruct + REDUCE)
function benignNumpyPickle(): Buffer {
  const parts: number[] = [];
  parts.push(0x80, 0x02);
  parts.push(0x63, ...Buffer.from("numpy.core.multiarray\n", "latin1"), ...Buffer.from("_reconstruct\n", "latin1"));
  parts.push(0x4b, 0x01); // BININT1 1
  parts.push(0x52); // REDUCE
  parts.push(0x2e);
  return Buffer.from(parts);
}

// build a minimal ZIP (one stored entry "archive/data.pkl") around a pickle
function pytorchZip(entryName: string, pickle: Buffer, compress = false): Buffer {
  const nameBuf = Buffer.from(entryName, "utf8");
  const data = compress ? deflateRawSync(pickle) : pickle;
  const crc = 0; // not validated by our parser
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);   // version
  local.writeUInt16LE(0, 6);    // flags (no streaming)
  local.writeUInt16LE(compress ? 8 : 0, 8); // method
  local.writeUInt16LE(0, 10);   // time
  local.writeUInt16LE(0, 12);   // date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);   // compressed size
  local.writeUInt32LE(pickle.length, 22); // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  return Buffer.concat([local, nameBuf, data]);
}

function safetensorsBuf(): Buffer {
  const header = Buffer.from(JSON.stringify({ "weight": { dtype: "F32", shape: [2, 2], data_offsets: [0, 16] } }), "utf8");
  const len = Buffer.alloc(8);
  len.writeBigUInt64LE(BigInt(header.length), 0);
  return Buffer.concat([len, header, Buffer.alloc(16)]);
}

/* ── Pickle opcode walker ─────────────────────────────────────────────── */

test("scanPickle captures os.system import and REDUCE", () => {
  const r = scanPickle(maliciousOsSystemPickle());
  assert.equal(r.isPickle, true);
  assert.equal(r.parsedFully, true);
  assert.ok(r.imports.some((i) => i.module === "os" && i.name === "system"));
  assert.equal(r.ops.reduce, true);
});

test("scanPickle resolves STACK_GLOBAL from preceding strings", () => {
  const r = scanPickle(maliciousStackGlobalEval());
  assert.ok(r.imports.some((i) => i.module === "builtins" && i.name === "eval"));
  assert.equal(r.ops.stackGlobal, true);
});

/* ── Classification ───────────────────────────────────────────────────── */

test("classifyImport flags os.system CRITICAL and getattr HIGH", () => {
  assert.equal(classifyImport({ module: "os", name: "system" })?.severity, "CRITICAL");
  assert.equal(classifyImport({ module: "builtins", name: "eval" })?.severity, "CRITICAL");
  assert.equal(classifyImport({ module: "builtins", name: "getattr" })?.severity, "HIGH");
  assert.equal(classifyImport({ module: "socket", name: "socket" })?.severity, "HIGH");
  assert.equal(classifyImport({ module: "numpy.core.multiarray", name: "_reconstruct" }), null);
});

/* ── End-to-end scans ─────────────────────────────────────────────────── */

test("scan flags a raw malicious pickle as MALICIOUS", () => {
  const report = scanModelArtifact(maliciousOsSystemPickle(), { filename: "evil.pkl" });
  assert.equal(report.verdict, "MALICIOUS");
  assert.equal(report.highestSeverity, "CRITICAL");
  assert.ok(report.riskScore >= 90);
  assert.ok(report.findings.some((f) => f.category === "MALICIOUS_CODE" && /os\.system/.test(f.title)));
  assert.match(report.sha256, /^[a-f0-9]{64}$/);
});

test("scan unwraps a PyTorch zip (stored) and finds the embedded exploit", () => {
  const zip = pytorchZip("archive/data.pkl", maliciousOsSystemPickle(), false);
  const report = scanModelArtifact(zip, { filename: "pytorch_model.bin" });
  assert.equal(report.format, "pytorch-zip");
  assert.ok(report.scannedEntries.includes("archive/data.pkl"));
  assert.equal(report.verdict, "MALICIOUS");
});

test("scan unwraps a PyTorch zip (deflate) and finds the embedded exploit", () => {
  const zip = pytorchZip("archive/data.pkl", maliciousStackGlobalEval(), true);
  const report = scanModelArtifact(zip, { filename: "model.pt" });
  assert.equal(report.format, "pytorch-zip");
  assert.equal(report.verdict, "MALICIOUS");
  assert.ok(report.imports.some((i) => i.name === "eval"));
});

test("benign numpy weights are NOT flagged malicious", () => {
  const report = scanModelArtifact(benignNumpyPickle(), { filename: "weights.pkl" });
  assert.notEqual(report.verdict, "MALICIOUS");
  assert.ok(!report.findings.some((f) => f.category === "MALICIOUS_CODE"));
});

test("safetensors is recognized as the safest format", () => {
  const report = scanModelArtifact(safetensorsBuf(), { filename: "model.safetensors" });
  assert.equal(report.format, "safetensors");
  assert.equal(report.verdict, "SAFE");
  assert.equal(report.highestSeverity, "LOW");
});

test("malformed safetensors header is HIGH risk", () => {
  const bad = Buffer.alloc(40);
  bad.writeBigUInt64LE(BigInt(10_000_000), 0); // header longer than file
  const report = scanModelArtifact(bad, { filename: "fake.safetensors" });
  assert.ok(report.findings.some((f) => f.category === "UNSAFE_FORMAT" && /Malformed/.test(f.title)));
});

/* ── Integrity ────────────────────────────────────────────────────────── */

test("sha-256 mismatch is CRITICAL / MALICIOUS (tamper)", () => {
  const buf = safetensorsBuf();
  const report = scanModelArtifact(buf, { filename: "m.safetensors", expectedSha256: "0".repeat(64) });
  assert.equal(report.integrity.matchesExpected, false);
  assert.equal(report.verdict, "MALICIOUS");
});

test("known-good hash forces SAFE verdict and low score", () => {
  const buf = benignNumpyPickle();
  const digest = createHash("sha256").update(buf).digest("hex");
  const report = scanModelArtifact(buf, { filename: "weights.pkl", knownGoodHashes: [digest] });
  assert.equal(report.integrity.knownGood, true);
  assert.equal(report.verdict, "SAFE");
  assert.ok(report.riskScore <= 5);
});

/* ── Provenance ───────────────────────────────────────────────────────── */

test("provenance binding check detects digest that does not cover the artifact", () => {
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ name: "other.bin", digest: { sha256: "deadbeef" } }],
    predicate: { builder: { id: "https://github.com/acme/builder" } },
  };
  const envelope = {
    payloadType: "application/vnd.in-toto+json",
    payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
    signatures: [{ sig: "abc" }],
  };
  const report = scanModelArtifact(safetensorsBuf(), { filename: "m.safetensors", attestation: envelope });
  assert.equal(report.provenance?.subjectDigestBinds, false);
  assert.ok(report.findings.some((f) => f.category === "PROVENANCE"));
  assert.equal(report.verdict, "SUSPICIOUS");
});

test("provenance that binds the real digest verifies clean", () => {
  const buf = safetensorsBuf();
  const digest = createHash("sha256").update(buf).digest("hex");
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ name: "m.safetensors", digest: { sha256: digest } }],
    predicate: { builder: { id: "https://github.com/acme/builder" } },
  };
  const prov = verifyProvenance(
    { payloadType: "application/vnd.in-toto+json", payload: Buffer.from(JSON.stringify(statement)).toString("base64"), signatures: [{ sig: "x" }] },
    digest,
  );
  assert.equal(prov.subjectDigestBinds, true);
  assert.equal(prov.signaturePresent, true);
  assert.equal(prov.builderId, "https://github.com/acme/builder");
  assert.equal(prov.severity, "LOW");
});

test("missing provenance is reported but not fatal", () => {
  const report = scanModelArtifact(safetensorsBuf(), { filename: "m.safetensors", attestation: null });
  assert.equal(report.provenance?.present, false);
  assert.ok(report.findings.some((f) => f.category === "PROVENANCE"));
});
