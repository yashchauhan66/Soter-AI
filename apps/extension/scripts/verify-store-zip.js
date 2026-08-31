/** Read a store zip's central directory the way the store's unpacker does, and FAIL if it is invalid.
 *
 *  This runs as the last step of `npm run package`, so a bad archive cannot reach an upload form. It
 *  exits non-zero on any of: a backslash path separator, a missing `manifest.json` at the archive root,
 *  a file that must not ship (source maps, TypeScript, `manifest.dev.json`, dotfiles, node_modules), or
 *  an entry count that does not match the build output.
 *
 *  Why it reads the bytes itself: `scripts/package.js` used to shell out to PowerShell
 *  `Compress-Archive`, which writes BACKSLASH separators for nested entries. Measured on v0.2.2, 16 of
 *  18 entries were affected, including every file the manifest points at. The ZIP spec (APPNOTE
 *  4.4.17.1) requires forward slashes, and a backslash archive either gets rejected on upload or, worse,
 *  extracts on Linux as flat files literally named "background\service-worker.js" while the manifest
 *  asks for "background/service-worker.js" — an accepted submission that cannot load. So entry names
 *  are read verbatim out of the central directory rather than through any library that might normalise
 *  them on the way past. Node's own tooling is not trusted here for the same reason.
 *
 *  With no arguments it checks every zip the packager produces for the current version. Pass paths to
 *  check specific files.
 */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { version } = require("../package.json");

const BACKSLASH = String.fromCharCode(92);
const DIST_DIR = path.join(__dirname, "..", "dist", "extension");
const OUTPUT_DIR = path.join(__dirname, "..", "dist");

/** How many files the build actually produced, so a truncated archive is caught rather than described. */
function countBuildFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countBuildFiles(path.join(dir, entry.name));
    else if (entry.isFile()) n++;
  }
  return n;
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : [`soter-extension-edge-v${version}.zip`, `soter-extension-chrome-v${version}.zip`].map((f) => path.join(OUTPUT_DIR, f));

const expectedEntries = fs.existsSync(DIST_DIR) ? countBuildFiles(DIST_DIR) : null;
let failed = false;
const fail = (message) => { failed = true; console.error(`ERROR: ${message}`); };

for (const file of files) {
  if (!fs.existsSync(file)) { fail(`${file} does not exist`); continue; }
  const buf = fs.readFileSync(file);
  const names = [];
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) !== 0x02014b50) continue; // central directory file header
    const nameLength = buf.readUInt16LE(i + 28);
    names.push(buf.slice(i + 46, i + 46 + nameLength).toString("utf8"));
  }
  const bad = names.filter((n) => n.includes(BACKSLASH));
  const nested = names.filter((n) => n.includes("/"));
  const leaks = names.filter((n) => /manifest\.dev\.json$|\.map$|\.ts$|\.tsx$|^\.|node_modules/.test(n));

  console.log(`\n=== ${path.basename(file)} ===`);
  console.log(`size:            ${(fs.statSync(file).size / 1048576).toFixed(3)} MB`);
  console.log(`sha256:          ${createHash("sha256").update(buf).digest("hex")}`);
  console.log(`entries:         ${names.length}${expectedEntries === null ? "" : ` (build output has ${expectedEntries} files)`}`);
  console.log(`forward-slash nested entries: ${nested.length}`);
  console.log(`BACKSLASH entries:           ${bad.length}${bad.length ? "  <-- INVALID FOR A STORE ZIP" : "  (spec-conformant)"}`);
  console.log(`manifest.json at archive root: ${names.includes("manifest.json")}`);
  console.log(`files that must not ship:      ${leaks.length ? leaks.join(", ") : "none"}`);

  if (bad.length) fail(`${path.basename(file)}: ${bad.length} entries use backslash separators, which the ZIP spec forbids: ${bad.slice(0, 8).join(", ")}`);
  if (!names.includes("manifest.json")) fail(`${path.basename(file)}: manifest.json is not at the archive root — the browser will not load this`);
  if (leaks.length) fail(`${path.basename(file)}: files that must not ship are present: ${leaks.join(", ")}`);
  if (expectedEntries !== null && names.length !== expectedEntries) {
    fail(`${path.basename(file)}: ${names.length} entries but the build output has ${expectedEntries} files — the archive is incomplete`);
  }
}

if (failed) {
  console.error("\nFAIL: the store archive is not fit to upload.");
  process.exit(1);
}
console.log("\nPASS: store archives are spec-conformant and complete.");
