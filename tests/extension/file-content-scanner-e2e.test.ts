import test from "node:test";
import assert from "node:assert/strict";
import { extractTextFromFile, extensionForFile, isSupportedFile, isMetadataOnlyFile } from "../../apps/extension/src/lib/file-extractors";
import { applyFilePolicy } from "../../apps/extension/src/lib/file-scan-policy";
import type { ScanResult } from "../../apps/extension/src/lib/types";

function file(name: string, content: string | Uint8Array, type = "text/plain"): File {
  return new File([content], name, { type });
}

function result(types: string[], action: ScanResult["action"] = "allow"): ScanResult {
  return {
    hasFindings: types.length > 0, riskScore: types.length ? 80 : 0, detectedDataTypes: types, findings: [], action,
    policy: { action, severity: "low", matchedRules: [], userMessage: "", adminMessage: "", redactedText: "", rewrittenSafeText: "", auditMetadata: {} },
    redactedText: "", rewrittenSafeText: "", scannedAt: new Date(0).toISOString(),
  };
}

/**
 * Builds a valid ZIP archive with STORED (uncompressed) entries so the
 * extension's dependency-free unzip() can read it without needing deflate.
 * Includes a real central directory + EOCD record so unzip() terminates
 * cleanly on the trailing-signature check.
 */
function makeZip(entries: Array<{ name: string; text: string }>): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const dataBytes = enc.encode(entry.text);
    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0, true);          // flags (no data descriptor)
    lv.setUint16(8, 0, true);          // method 0 = stored
    lv.setUint32(14, 0, true);         // crc32 (unchecked by unzip)
    lv.setUint32(18, dataBytes.length, true); // compressed size
    lv.setUint32(22, dataBytes.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // filename length
    lv.setUint16(28, 0, true);         // extra length
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    offsets.push(offset);
    localParts.push(local);
    offset += local.length;
  }

  let centralSize = 0;
  entries.forEach((entry, i) => {
    const nameBytes = enc.encode(entry.name);
    const dataLen = enc.encode(entry.text).length;
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); // central dir signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, 20, true);         // version needed
    cv.setUint16(10, 0, true);         // method stored
    cv.setUint32(20, dataLen, true);   // compressed size
    cv.setUint32(24, dataLen, true);   // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // name length
    cv.setUint32(42, offsets[i], true);       // local header offset
    cd.set(nameBytes, 46);
    central.push(cd);
    centralSize += cd.length;
  });

  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);           // EOCD signature
  ev.setUint16(8, entries.length, true);       // entries on this disk
  ev.setUint16(10, entries.length, true);      // total entries
  ev.setUint32(12, centralSize, true);         // central dir size
  ev.setUint32(16, centralOffset, true);       // central dir offset

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...localParts, ...central, eocd]) { out.set(part, p); p += part.length; }
  return out;
}

test("supported text/code extensions are recognised", () => {
  for (const ext of [".env", ".csv", ".sql", ".log", ".js", ".ts", ".py", ".sh"]) {
    assert.equal(isSupportedFile(file(`x${ext}`, "content")), true, ext);
  }
});

test("office document formats are supported (real local extraction, not metadata-only)", () => {
  for (const ext of [".pdf", ".docx", ".xlsx", ".pptx"]) {
    assert.equal(isSupportedFile(file(`x${ext}`, "binary")), true, ext);
    // Nothing is metadata-only anymore — all four have local extractors.
    assert.equal(isMetadataOnlyFile(file(`x${ext}`, "binary")), false, ext);
  }
});

test(".env file content is read locally", async () => {
  const extracted = await extractTextFromFile(file(".env", "API_KEY=sk-test-1234567890abcdef\nDB_URL=postgres://u:p@h/db"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /API_KEY/);
});

test("DOCX body text is extracted from word/document.xml", async () => {
  const zip = makeZip([{
    name: "word/document.xml",
    text: `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Employee PAN is ABCDE1234F</w:t></w:r></w:p></w:body></w:document>`,
  }]);
  const extracted = await extractTextFromFile(file("hr.docx", zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /Employee PAN is ABCDE1234F/);
});

test("XLSX shared strings AND numeric cell values are extracted", async () => {
  // Aadhaar-like number lives as a numeric <v> cell, name lives in sharedStrings.
  const zip = makeZip([
    { name: "xl/sharedStrings.xml", text: `<sst><si><t>Ravi Kumar</t></si></sst>` },
    { name: "xl/worksheets/sheet1.xml", text: `<worksheet><sheetData><row><c t="s"><v>0</v></c><c><v>234512345678</v></c></row></sheetData></worksheet>` },
  ]);
  const extracted = await extractTextFromFile(file("payroll.xlsx", zip, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /Ravi Kumar/);          // shared string
  assert.match(extracted.text, /234512345678/);        // numeric cell (was previously missed)
});

test("XLSX inline strings are extracted from the sheet", async () => {
  const zip = makeZip([
    { name: "xl/worksheets/sheet1.xml", text: `<worksheet><sheetData><row><c t="inlineStr"><is><t>Confidential salary band</t></is></c></row></sheetData></worksheet>` },
  ]);
  const extracted = await extractTextFromFile(file("bands.xlsx", zip));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /Confidential salary band/);
});

test("PPTX slide text is extracted", async () => {
  const zip = makeZip([
    { name: "ppt/slides/slide1.xml", text: `<p:sld><p:cSld><p:spTree><a:t>Q3 revenue is confidential</a:t></p:spTree></p:cSld></p:sld>` },
    { name: "ppt/slides/slide2.xml", text: `<p:sld><a:t>Customer list attached</a:t></p:sld>` },
  ]);
  const extracted = await extractTextFromFile(file("deck.pptx", zip, "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /Q3 revenue is confidential/);
  assert.match(extracted.text, /Customer list attached/);
});

test("OOXML XML entities are decoded, not left encoded", async () => {
  const zip = makeZip([{
    name: "word/document.xml",
    text: `<w:document><w:body><w:p><w:r><w:t>Tom &amp; Jerry &lt;secret&gt;</w:t></w:r></w:p></w:body></w:document>`,
  }]);
  const extracted = await extractTextFromFile(file("x.docx", zip));
  assert.match(extracted.text, /Tom & Jerry <secret>/);
});

test("uncompressed PDF text operators are extracted", async () => {
  const pdf = `%PDF-1.4\n1 0 obj<<>>\nstream\nBT /F1 12 Tf (AWS key AKIAIOSFODNN7EXAMPLE) Tj ET\nendstream\nendobj\n%%EOF`;
  const extracted = await extractTextFromFile(file("leak.pdf", pdf, "application/pdf"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /AKIAIOSFODNN7EXAMPLE/);
});

test("binary content in a text extension is flagged, not decoded as text", async () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x03]);
  const extracted = await extractTextFromFile(file("evil.txt", bytes));
  assert.equal(extracted.encryptedOrBinary, true);
  assert.equal(extracted.supported, false);
});

test("large file truncates safely to the scan cap", async () => {
  const big = "a".repeat(2 * 1024 * 1024); // 2MB
  const extracted = await extractTextFromFile(file("big.txt", big), 1024 * 1024);
  assert.ok(extracted.scannedBytes <= 1024 * 1024);
  assert.ok(extracted.text.length <= 1024 * 1024);
});

test("policy: .env is always blocked regardless of detected types", () => {
  assert.equal(applyFilePolicy(result([]), ".env", false), "block");
});

test("policy: secrets in supported code file are blocked", () => {
  assert.equal(applyFilePolicy(result(["api_key"]), ".js", false), "block");
  assert.equal(applyFilePolicy(result(["private_key"]), ".txt", false), "block");
  assert.equal(applyFilePolicy(result(["database_url"]), ".sql", false), "block");
});

test("policy: customer data export requires approval", () => {
  assert.equal(applyFilePolicy(result(["customer_data"]), ".csv", false), "require_approval");
});

test("policy: clean supported text file is allowed", () => {
  assert.equal(applyFilePolicy(result([]), ".txt", false), "allow");
});

test("policy: unsupported/binary file with no stronger policy warns", () => {
  assert.equal(applyFilePolicy(result([]), ".bin", true), "warn");
});

test("extensionForfile lowercases and extracts the final extension", () => {
  assert.equal(extensionForFile(file("Report.FINAL.CSV", "x")), ".csv");
});
