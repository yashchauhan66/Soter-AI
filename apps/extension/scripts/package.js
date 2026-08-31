const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { version } = require("../package.json");

const DIST_DIR = path.join(__dirname, "..", "dist", "extension");
const OUTPUT_DIR = path.join(__dirname, "..", "dist");
const PACKAGES = [
  `soter-extension-edge-v${version}.zip`,
  `soter-extension-chrome-v${version}.zip`,
];

/**
 * Write the store archive ourselves, in Node, with no platform branch.
 *
 * This used to call PowerShell `Compress-Archive` on Windows. That writes BACKSLASH path separators
 * for nested entries — measured on v0.2.2: 16 of 18 entries, including every file the manifest points
 * at (`background/service-worker.js`, `content/index.js`, `popup/index.html`, the icons). The ZIP spec
 * requires forward slashes (APPNOTE 4.4.17.1), so that archive is either rejected on upload or, worse,
 * accepted and extracted as flat files literally named "background\service-worker.js" while the
 * manifest asks for "background/service-worker.js" — a published extension that cannot load.
 *
 * Names are forward-slash by construction here, entries are sorted and timestamps are fixed, so two
 * builds of the same output produce byte-identical archives (the signed-release workflow's
 * reproducibility check depends on that). Verify the result by EXTRACTING it, never by listing names:
 * `node scripts/verify-store-zip.js dist/<zip>` reads the central directory verbatim.
 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

/** Every file under `dir`, as POSIX-relative paths, sorted for a deterministic archive. */
function collect(dir, prefix = "") {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...collect(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function createZip(outputPath) {
  // A fixed DOS date/time (2026-01-01 00:00) keeps the archive reproducible; store submissions do not
  // read entry timestamps, and mtimes would make two builds of identical output differ.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const files = collect(DIST_DIR);
  if (files.length === 0) throw new Error("build output is empty");

  const local = [];
  const central = [];
  let offset = 0;

  for (const name of files) {
    const nameBuf = Buffer.from(name, "utf8");
    if (nameBuf.includes(0x5c)) throw new Error(`refusing to write a backslash entry name: ${name}`);
    const content = fs.readFileSync(path.join(DIST_DIR, ...name.split("/")));
    const deflated = zlib.deflateRawSync(content, { level: 9 });
    // Only claim compression when it actually helped; otherwise store, which is smaller and simpler.
    const useDeflate = deflated.length < content.length;
    const data = useDeflate ? deflated : content;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(content);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);            // version needed
    header.writeUInt16LE(0, 6);             // flags — no data descriptor, sizes are known up front
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);            // no extra field
    local.push(header, nameBuf, data);

    const dirEntry = Buffer.alloc(46);
    dirEntry.writeUInt32LE(0x02014b50, 0);
    dirEntry.writeUInt16LE(20, 4);          // version made by
    dirEntry.writeUInt16LE(20, 6);          // version needed
    dirEntry.writeUInt16LE(0, 8);
    dirEntry.writeUInt16LE(method, 10);
    dirEntry.writeUInt16LE(dosTime, 12);
    dirEntry.writeUInt16LE(dosDate, 14);
    dirEntry.writeUInt32LE(crc, 16);
    dirEntry.writeUInt32LE(data.length, 20);
    dirEntry.writeUInt32LE(content.length, 24);
    dirEntry.writeUInt16LE(nameBuf.length, 28);
    dirEntry.writeUInt16LE(0, 30);          // no extra field
    dirEntry.writeUInt16LE(0, 32);          // no comment
    dirEntry.writeUInt16LE(0, 34);          // disk number
    dirEntry.writeUInt16LE(0, 36);          // internal attributes
    dirEntry.writeUInt32LE(0, 38);          // external attributes
    dirEntry.writeUInt32LE(offset, 42);
    central.push(dirEntry, nameBuf);

    offset += header.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(outputPath, Buffer.concat([...local, centralBuf, end]));
}

console.log("Packaging Soter Extension store artifacts...");

if (!fs.existsSync(DIST_DIR)) {
  console.error("Build output not found. Run `npm run build` first.");
  process.exit(1);
}

const manifestPath = path.join(DIST_DIR, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json not found in build output.");
  process.exit(1);
}

try {
  for (const zipName of PACKAGES) {
    const outputPath = path.join(OUTPUT_DIR, zipName);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    createZip(outputPath);
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Created ${zipName} (${sizeMB} MB)`);
  }
  console.log("Ready for Chrome Web Store and Microsoft Edge Add-ons submission.");
} catch (error) {
  console.error("Packaging failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
