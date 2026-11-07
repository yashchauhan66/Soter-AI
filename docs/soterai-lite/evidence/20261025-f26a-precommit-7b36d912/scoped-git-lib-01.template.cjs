"use strict";
if ("__F26A_BYTE_PROOF_BOUND__" !== "F26A_CURRENT_BYTE_PROOF_FACTS_BOUND") throw Error("PREPARED_NOT_BOUND: no Git or scope finalization before reviewed current acceptance.");
// H25 latest05 barriers retained; F26a adds explicit deleted memberships.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process"), assert = require("node:assert/strict");
const repo = path.resolve(__dirname, "../../../.."), base = path.relative(repo, __dirname).replaceAll("\\", "/");
const PARENT = "1969c368d439237126a360af452c254a5826be88", GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const FIXED = ["-c", "core.autocrlf=false", "-c", "commit.gpgSign=false", "-c", "core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks"];
const sha = raw => crypto.createHash("sha256").update(raw).digest("hex");
function safe(file) { assert(typeof file === "string" && file && !/[\\:\x00-\x1f\x7f]/.test(file) && !file.startsWith("/") && !file.split("/").some(part => !part || part === "." || part === "..")); return file; }
function resolve(file) { safe(file); const value = path.resolve(repo, file); assert(value.startsWith(repo + path.sep)); return value; }
function bytes(file) { const value = resolve(file); for (let cursor = value; cursor !== repo; cursor = path.dirname(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink(), "Linked input refused.");
    const stat = fs.lstatSync(value); assert(stat.isFile() && stat.nlink === 1); assert.equal(fs.realpathSync(value).toLowerCase(), value.toLowerCase()); return fs.readFileSync(value); }
const read = file => JSON.parse(bytes(file).toString("utf8").replace(/^\uFEFF/, ""));
function fact(file) { const value = bytes(file); return { path: file, bytes: value.length, sha256: sha(value) }; }
function absent(file) { try { fs.lstatSync(resolve(file)); } catch (error) { if (error.code === "ENOENT") return; throw error; } throw Error("Deleted membership unexpectedly exists: " + file); }
function rawFact(row) { return row.deleted === true ? { path: row.path, deleted: true, before: { ...row.before } } : { path: row.path, bytes: row.bytes, sha256: row.sha256 }; }
function unique(rows) { assert.equal(new Set(rows.map(row => row.path.toLowerCase())).size, rows.length, "Duplicate/case-alias membership."); rows.forEach(row => safe(row.path)); }
function checkFacts(rows, label = "Frozen current bytes") { unique(rows); for (const row of rows) { if (row.deleted === true) absent(row.path); else assert.deepEqual(fact(row.path), rawFact(row), label + ": " + row.path); } }
function walk(directory) { const value = resolve(directory); assert(fs.lstatSync(value).isDirectory() && !fs.lstatSync(value).isSymbolicLink()); const rows = [];
    for (const entry of fs.readdirSync(value, { withFileTypes: true })) { assert(!entry.isSymbolicLink()); const file = directory + "/" + entry.name; if (entry.isDirectory()) rows.push(...walk(file)); else { fact(file); rows.push(file); } } return rows.sort(); }
function git(args, input) { assert(Array.isArray(args) && args.every(arg => typeof arg === "string" && !arg.includes("\0")));
    assert.equal(sha(fs.readFileSync(GIT)), "da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f", "Pinned Git changed.");
    const value = cp.spawnSync(GIT, [...FIXED, ...args], { cwd: repo, windowsHide: true, shell: false, input, maxBuffer: 96 * 1024 * 1024 });
    if (value.error || value.status !== 0) throw Error("Scoped Git failed; preserve root execution receipt; no object body emitted."); return value.stdout; }
const zeroList = raw => raw.toString("utf8").split("\0").filter(Boolean).sort();
const cached = () => zeroList(git(["diff", "--cached", "--name-only", "-z"]));
const head = () => git(["rev-parse", "HEAD"]).toString("ascii").trim();
function tracked(revision = "HEAD", directory = base) { assert(/^(HEAD|[a-f0-9]{40})$/.test(revision)); safe(directory); return zeroList(git(["ls-tree", "-r", "--name-only", "-z", revision, "--", directory])); }
function changed(revision) { assert(/^[a-f0-9]{40}$/.test(revision)); return zeroList(git(["diff-tree", "--no-commit-id", "--no-renames", "--name-only", "-z", "-r", revision])); }
function objectRows(specs) { assert(specs.length && specs.every(spec => !/[\r\n\0]/.test(spec))); const output = git(["cat-file", "--batch"], specs.join("\n") + "\n"); let cursor = 0; const rows = [];
    for (const spec of specs) { const end = output.indexOf(10, cursor), header = /^([a-f0-9]{40}) blob ([0-9]+)$/.exec(output.toString("ascii", cursor, end)); assert(header, "Missing/nonblob object.");
        const size = Number(header[2]), start = end + 1, next = start + size; assert(Number.isSafeInteger(size) && size >= 0 && next < output.length && output[next] === 10);
        const raw = Buffer.from(output.subarray(start, next)); assert.equal(crypto.createHash("sha1").update(Buffer.from("blob " + size + "\0")).update(raw).digest("hex"), header[1], "Actual blob framing/OID mismatch.");
        rows.push({ spec, oid: header[1], bytes: raw }); cursor = next + 1; } assert.equal(cursor, output.length); return rows; }
function absentObject(spec, file) { const prefix = spec.slice(0, -(file.length + 1)); if (prefix === "") assert.equal(git(["ls-files", "--stage", "-z", "--", file]).length, 0, "Deleted path remains in index.");
    else { assert(/^[a-f0-9]{40}$/.test(prefix)); assert.equal(git(["ls-tree", "-z", prefix, "--", file]).length, 0, "Deleted path remains in actual commit."); } }
function verify(specs, records) { assert.equal(specs.length, records.length); unique(records); const verified = [];
    for (let start = 0; start < records.length;) { const present = [], indexes = []; let total = 0;
        while (start < records.length && indexes.length < 64 && (indexes.length === 0 || total + (records[start].bytes ?? 0) <= 16 * 1024 * 1024)) {
            const row = records[start], index = start++; if (row.deleted === true) { absentObject(specs[index], row.path); verified.push({ ...rawFact(row), oid: null }); continue; }
            assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 64 * 1024 * 1024); total += row.bytes; present.push(specs[index]); indexes.push(index);
        }
        if (present.length) for (const [offset, value] of objectRows(present).entries()) { const row = records[indexes[offset]]; assert.equal(value.bytes.length, row.bytes, row.path); assert.equal(sha(value.bytes), row.sha256, row.path); verified.push({ ...rawFact(row), oid: value.oid }); }
    } return verified.sort((a, b) => a.path.localeCompare(b.path)); }
function writeNew(name, value) { const file = base + "/" + name; assert(!fs.existsSync(resolve(file))); fs.writeFileSync(resolve(file), Buffer.isBuffer(value) ? value : typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); return fact(file); }
function assertEvidenceMembership(records, additional = []) { const expected = [...new Set([...records.filter(row => !row.deleted && row.path.startsWith(base + "/")).map(row => row.path), ...additional])].sort(); assert.deepEqual(walk(base), expected, "New/omitted evidence after freeze."); }
function pathspec(name, records) { unique(records); return writeNew(name, Buffer.from(records.map(row => row.path).join("\0") + "\0")); }
function stageFrozen(records, spec) { assert.equal(cached().length, 0, "Unrelated staged paths."); checkFacts(records, "BEFORE git add, all memberships including deletions");
    git(["add", "-f", "--pathspec-from-file=" + spec.path, "--pathspec-file-nul"]); const staged = cached(); assert(staged.length && staged.every(file => records.some(row => row.path === file)), "Unknown staged path.");
    checkFacts(records, "AFTER explicit-path git add"); verify(records.map(row => ":" + row.path), records); return staged; }
function checkBoundConfig() { const bindingFact = fact(base + "/byte-proof-binding-current-01.json"); assert.equal(bindingFact.sha256, "__F26A_BYTE_BINDING_SHA256__", "Root-reviewed binding changed/unbound."); const binding = read(bindingFact.path);
    assert.equal(binding.status, "F26A_CURRENT_ACCEPTANCE_AND_EXPLICIT_SCOPE_BOUND"); assert.equal(binding.feature, "F26a"); assert.equal(binding.parent, PARENT);
    assert.equal(binding.artifactPath, "packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix"); assert.equal(binding.sourcePathsReviewedAgainstCurrentGitDiff, true);
    assert.equal(fact(binding.fullInputBinding.path).sha256, "5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322");
    assert.equal(binding.fullInputBinding.path, base + "/full-inputs-02.json"); const full = read(binding.fullInputBinding.path); assert.equal(full.fileCount, 989); assert.equal(full.files.length, 989); checkFacts(full.files, "Actual current989 inputs");
    assert.deepEqual(fact(binding.plannedSourceScope.path), rawFact(binding.plannedSourceScope)); const scope = read(binding.plannedSourceScope.path);
    assert.equal(scope.status, "FROZEN_REVIEWED_F26A_DELTA_FROM_PARENT_AFTER_ACCEPTANCE"); assert.equal(scope.parent, PARENT); assert.equal(scope.acceptanceSha256, binding.acceptanceSha256); unique(scope.records);
    assert.deepEqual([...binding.sourcePaths].sort(), scope.records.map(row => row.path).sort()); assert(binding.sourcePaths.includes("docs/soterai-lite/FEATURE-QUEUE.json") && binding.sourcePaths.includes("docs/soterai-lite/ledger.md"));
    for (const row of scope.records) { assert(!row.path.startsWith(base + "/"), "Evidence must be captured by exact recursive membership."); if (row.deleted) { assert(row.before && row.before.path === row.path); assert.match(row.before.oid, /^[a-f0-9]{40}$/); } }
    return binding; }
function checkPlannedDelta(binding) { assert.equal(head(), PARENT); const scope = read(binding.plannedSourceScope.path); checkFacts(scope.records, "Frozen reviewed source delta BEFORE membership");
    const preserved = scope.unrelatedPreserved ?? []; checkFacts(preserved, "Unrelated working bytes retained untouched");
    const actual = zeroList(git(["diff", "--no-renames", "--name-only", "-z", PARENT, "--"]));
    assert.deepEqual(actual, [...scope.trackedDelta, ...preserved.map(row => row.path)].sort(), "Tracked delta differs from exact reviewed feature/unrelated split.");
    const allParents = zeroList(git(["ls-tree", "-r", "--name-only", "-z", PARENT])); const existing = new Set(allParents);
    for (const row of read(binding.fullInputBinding.path).files) if (!existing.has(row.path)) assert(binding.sourcePaths.includes(row.path), "Full-tested new source would be omitted from commit: " + row.path);
    assert.equal(scope.parentRecords.length, scope.records.length); unique(scope.parentRecords);
    for (const parentRow of scope.parentRecords) { assert(binding.sourcePaths.includes(parentRow.path)); if (parentRow.absent === true) { assert(!existing.has(parentRow.path)); continue; }
        const checked = verify([PARENT + ":" + parentRow.path], [parentRow]); assert.equal(checked[0].oid, parentRow.oid); }
    for (const row of scope.records.filter(row => row.deleted)) { const before = scope.parentRecords.find(item => item.path === row.path); assert.deepEqual(before, row.before); }
    return scope; }
module.exports = { repo, base, sha, read, safe, resolve, bytes, fact, rawFact, checkFacts, walk, git, cached, head, tracked, changed, verify, writeNew, assertEvidenceMembership, pathspec, stageFrozen, checkBoundConfig, checkPlannedDelta, PARENT };
