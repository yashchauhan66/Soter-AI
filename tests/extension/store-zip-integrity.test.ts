/**
 * The store archive must be a valid ZIP, and the thing that made it must stay honest.
 *
 * v0.2.2 was packaged by PowerShell `Compress-Archive` on Windows, which writes BACKSLASH path
 * separators for nested entries. Measured on the produced archive: 16 of 18 entries, including every
 * single file the manifest points at — `background/service-worker.js`, `content/index.js`,
 * `popup/index.html`, all six icons. The ZIP spec (APPNOTE 4.4.17.1) requires forward slashes, so that
 * archive is either rejected on upload or, worse, accepted and extracted as flat files literally named
 * "background\service-worker.js" while the manifest asks for "background/service-worker.js": a
 * published extension that cannot load. Nothing in the repo could see it, because the build was green,
 * the runtime suites all load `dist/extension` (the directory, never the archive), and the size looked
 * right.
 *
 * So these tests read the packager's own output byte by byte, out of the central directory, rather than
 * through any library that might normalise names on the way past — the same reason
 * `scripts/verify-store-zip.js` exists. They run the real packager against a real fixture tree; they do
 * not re-implement it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const PACKAGER = join(REPO, "apps", "extension", "scripts", "package.js");
const BACKSLASH = String.fromCharCode(92);

/**
 * CRC-32 (IEEE), computed here rather than imported from the packager on purpose: a checksum verified
 * with the same code that produced it proves nothing. Bit-reflected table-free form, so it shares no
 * structure with the packager's table-driven one either.
 */
function crc32(buf: Buffer) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (~c) >>> 0;
}

/** Read entry names and their compression method straight out of the central directory. */
function centralDirectory(zipPath: string) {
  const buf = readFileSync(zipPath);
  const entries: { name: string; method: number; crc: number; uncompressed: number }[] = [];
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) !== 0x02014b50) continue; // central directory file header
    const nameLength = buf.readUInt16LE(i + 28);
    entries.push({
      name: buf.subarray(i + 46, i + 46 + nameLength).toString("utf8"),
      method: buf.readUInt16LE(i + 10),
      crc: buf.readUInt32LE(i + 16),
      uncompressed: buf.readUInt32LE(i + 24),
    });
  }
  return { buf, entries };
}

/**
 * Run the real packager over a fixture tree that has the same shape as the build output — nested
 * directories, a root manifest, one incompressible file — by pointing a copy of the script at it. The
 * script resolves its paths from its own location, so the copy goes next to a fixture `dist/`.
 */
function packFixture(): { zip: string; cleanup: () => void; names: string[] } {
  const root = mkdtempSync(join(tmpdir(), "soter-zip-"));
  const scripts = join(root, "scripts");
  const dist = join(root, "dist", "extension");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(join(dist, "background"), { recursive: true });
  mkdirSync(join(dist, "assets"), { recursive: true });
  mkdirSync(join(dist, "popup"), { recursive: true });

  writeFileSync(join(dist, "manifest.json"), JSON.stringify({ manifest_version: 3, version: "9.9.9" }));
  // Highly compressible, so deflate must win and the method must be 8.
  writeFileSync(join(dist, "background", "service-worker.js"), "x".repeat(4096));
  // Incompressible, so the packager must fall back to stored. Hash-chained rather than random, so the
  // bytes are identical on every run and ZIP-904 can still compare two packages for equality. An
  // arithmetic sequence will NOT do here — `(i * 137 + 29) % 251` looks like noise but has a period of
  // 251 that deflate finds immediately, which is what made the first version of this fixture assert the
  // wrong thing about a correct packager.
  const chunks: Buffer[] = [];
  let seed = createHash("sha256").update("soter-zip-fixture").digest();
  for (let i = 0; i < 16; i++) { chunks.push(seed); seed = createHash("sha256").update(seed).digest(); }
  writeFileSync(join(dist, "assets", "icon-16.png"), Buffer.concat(chunks));
  writeFileSync(join(dist, "popup", "index.html"), "<!doctype html><title>t</title>");

  cpSync(PACKAGER, join(scripts, "package.js"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "9.9.9" }));

  execFileSync(process.execPath, [join(scripts, "package.js")], { cwd: root, stdio: "pipe" });
  const zip = join(root, "dist", "soter-extension-edge-v9.9.9.zip");
  return {
    zip,
    names: centralDirectory(zip).entries.map((e) => e.name),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("ZIP-900: the packager writes no backslash path separators, on any platform", () => {
  const { zip, names, cleanup } = packFixture();
  try {
    assert.ok(existsSync(zip), "the packager produced no archive");
    const bad = names.filter((n) => n.includes(BACKSLASH));
    assert.deepEqual(bad, [], `entries use backslash separators, which the ZIP spec forbids: ${bad.join(", ")}`);
  } finally {
    cleanup();
  }
});

test("ZIP-901: nested files keep their directory path, so the manifest's references resolve", () => {
  const { names, cleanup } = packFixture();
  try {
    // Not just "contains a slash": the exact paths the manifest names must be the exact entry names.
    for (const expected of ["background/service-worker.js", "assets/icon-16.png", "popup/index.html"]) {
      assert.ok(names.includes(expected), `${expected} is missing from the archive; entries are: ${names.join(", ")}`);
    }
    assert.ok(names.includes("manifest.json"), "manifest.json must sit at the archive root, not inside a wrapper directory");
  } finally {
    cleanup();
  }
});

test("ZIP-902: a real unpacker reproduces the build tree byte for byte", () => {
  const { zip, cleanup } = packFixture();
  try {
    const { entries } = centralDirectory(zip);
    const source = join(zip, "..", "extension");

    /* First, a POSIX unpacker, simulated from the archive's own bytes.
     *
     * This half has to be here because the Python half below is NOT decisive on Windows: CPython's
     * zipfile splits member names on `os.sep` AND `os.altsep`, so on Windows it silently repairs a
     * backslash archive into the right directories and reports success. Mutation-tested — with the
     * separator defect reintroduced, ZIP-900 and ZIP-901 went red and the Python comparison alone
     * stayed green. On Linux (the store's own unpackers, and `zipfile` there) the same archive
     * extracts as flat files literally named "background\service-worker.js". So the rule is applied
     * the way a POSIX unpacker applies it: '/' is the only separator, everything else is a filename
     * character. */
    for (const entry of entries) {
      const segments = entry.name.split("/");
      assert.ok(
        segments.every((s) => s.length > 0 && !s.includes(BACKSLASH)),
        `a POSIX unpacker would create a file named "${entry.name}" rather than the nested path the manifest asks for`,
      );
      const onDisk = join(source, ...segments);
      assert.ok(existsSync(onDisk), `${entry.name} does not correspond to a file in the build output`);
      const bytes = readFileSync(onDisk);
      assert.equal(entry.uncompressed, bytes.length, `${entry.name}: the header's size does not describe the file`);
      assert.equal(entry.crc, crc32(bytes), `${entry.name}: the header's CRC does not describe the file — it would extract corrupt`);
    }

    // Then the real thing, where it is available, so the archive is proved against an unpacker nobody
    // in this repo wrote.
    const python = ["python", "python3"].find((bin) => {
      try { execFileSync(bin, ["-c", "0"], { stdio: "pipe" }); return true; } catch { return false; }
    });
    if (!python) { console.log("      (no python on PATH; the POSIX-semantics half above still ran)"); return; }
    const out = mkdtempSync(join(tmpdir(), "soter-unzip-"));
    const script = [
      "import zipfile,os,hashlib,json",
      `z=zipfile.ZipFile(r"${zip}")`,
      "assert z.testzip() is None, 'corrupt archive'",
      `z.extractall(r"${out}")`,
      "m={}",
      `for root,_,files in os.walk(r"${out}"):`,
      "    for f in files:",
      "        p=os.path.join(root,f)",
      `        m[os.path.relpath(p,r"${out}").replace(os.sep,'/')]=hashlib.sha256(open(p,'rb').read()).hexdigest()`,
      "print(json.dumps(m,sort_keys=True))",
    ].join("\n");
    const extracted = JSON.parse(execFileSync(python, ["-c", script], { encoding: "utf8" }));
    const expected: Record<string, string> = {};
    for (const entry of entries) {
      expected[entry.name] = createHash("sha256").update(readFileSync(join(source, ...entry.name.split("/")))).digest("hex");
    }
    assert.deepEqual(extracted, expected, "the extracted tree does not match the build output");
    rmSync(out, { recursive: true, force: true });
  } finally {
    cleanup();
  }
});

test("ZIP-903: entries are stored when deflate would not help, and deflated when it would", () => {
  const { zip, cleanup } = packFixture();
  try {
    const { entries } = centralDirectory(zip);
    const sw = entries.find((e) => e.name === "background/service-worker.js")!;
    const icon = entries.find((e) => e.name === "assets/icon-16.png")!;
    assert.equal(sw.method, 8, "4 KB of one repeated character must be deflated");
    assert.equal(icon.method, 0, "incompressible bytes must be stored, not stored larger under method 8");
    // A wrong CRC or size is the failure mode that produces an archive which opens but whose contents
    // a browser refuses, so assert the header actually describes the file.
    assert.equal(sw.uncompressed, 4096);
    assert.notEqual(sw.crc, 0);
  } finally {
    cleanup();
  }
});

test("ZIP-904: the same build output packages byte-identically, so a release is reproducible", () => {
  const a = packFixture();
  const b = packFixture();
  try {
    assert.deepEqual(
      readFileSync(a.zip).toString("base64"),
      readFileSync(b.zip).toString("base64"),
      "two packages of identical input differ — a timestamp or ordering leaked into the archive",
    );
  } finally {
    a.cleanup();
    b.cleanup();
  }
});

test("ZIP-905: the packager cannot be reintroduced as a shell-out to Compress-Archive or zip", () => {
  const source = readFileSync(PACKAGER, "utf8");
  // Match the call forms, not the prose: the comment above createZip explains the defect by name, and a
  // test that bans a string will otherwise fail on the documentation of why it is banned.
  assert.equal(/require\(["']child_process["']\)/.test(source), false, "the packager must not shell out; it writes the archive in Node");
  assert.equal(/spawnSync\(|execFileSync\(|execSync\(/.test(source), false, "the packager must not shell out to a zip tool");
  assert.equal(/process\.platform/.test(source), false, "the archive must not depend on the platform it was built on");
});
