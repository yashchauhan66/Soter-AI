"use strict";
if ("__F26A_BYTE_PROOF_BOUND__" !== "F26A_CURRENT_BYTE_PROOF_FACTS_BOUND") throw Error("PREPARED_NOT_BOUND: reviewed acceptance and exact scope must precede all Git/membership operations.");
// Successor to the retained draft01; follows H25 actual05. Never executed by its author.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process"), assert = require("node:assert/strict");
const repo = path.resolve(__dirname, "../../../.."), base = path.relative(repo, __dirname).replaceAll("\\", "/");
const PARENT = "1969c368d439237126a360af452c254a5826be88", GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const MUTABLE = ["docs/soterai-lite/FEATURE-QUEUE.json", "docs/soterai-lite/ledger.md"];
// Root's local evidence commits retain the established offline-hook boundary.
// These arguments must NEVER be reused for the native owner-commit fixtures.
const FIXED = ["--literal-pathspecs", "-c", "core.autocrlf=false", "-c", "commit.gpgSign=false", "-c", "core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks"];
const sha = raw => crypto.createHash("sha256").update(raw).digest("hex");
function safe(file) { assert(typeof file === "string" && file && !/[\\:\x00-\x1f\x7f]/.test(file) && !file.startsWith("/") && !file.split("/").some(part => !part || part === "." || part === "..")); return file; }
function resolve(file) { safe(file); const result = path.resolve(repo, file); assert(result.startsWith(repo + path.sep)); return result; }
function ancestors(absolute, missing = false) {
    assert(absolute.startsWith(repo + path.sep));
    for (let cursor = absolute;; cursor = path.dirname(cursor)) {
        try { assert(!fs.lstatSync(cursor).isSymbolicLink(), "Linked scoped ancestor refused."); }
        catch (error) { if (!(missing && error.code === "ENOENT")) throw error; }
        if (cursor === repo) break;
    }
}
function bytes(file) { const absolute = resolve(file); ancestors(absolute); const stat = fs.lstatSync(absolute); assert(stat.isFile() && stat.nlink === 1); assert.equal(fs.realpathSync(absolute).toLowerCase(), absolute.toLowerCase()); return fs.readFileSync(absolute); }
const read = file => JSON.parse(bytes(file).toString("utf8").replace(/^\uFEFF/, ""));
function fact(file) { const raw = bytes(file); return { path: file, bytes: raw.length, sha256: sha(raw) }; }
function absent(file) { const absolute = resolve(file); ancestors(absolute, true); try { fs.lstatSync(absolute); } catch (error) { if (error.code === "ENOENT") return; throw error; } throw Error("Deleted membership unexpectedly exists: " + file); }
function rawFact(row) { return row.deleted === true ? { path: row.path, deleted: true, before: { ...row.before } } : { path: row.path, bytes: row.bytes, sha256: row.sha256 }; }
function unique(rows) { assert(Array.isArray(rows)); assert.equal(new Set(rows.map(row => row.path.toLowerCase())).size, rows.length, "Duplicate/case-alias membership."); rows.forEach(row => safe(row.path)); }
const sorted = rows => [...rows].sort((a, b) => a.path.localeCompare(b.path));
function checkFacts(rows, label = "Frozen current bytes") { unique(rows); for (const row of rows) { if (row.deleted === true) { assert(row.before && row.before.path === row.path); absent(row.path); } else { assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256)); assert.deepEqual(fact(row.path), rawFact(row), label + ": " + row.path); } } }
function walk(directory) { const absolute = resolve(directory); ancestors(absolute); assert(fs.lstatSync(absolute).isDirectory()); assert.equal(fs.realpathSync(absolute).toLowerCase(), absolute.toLowerCase()); const rows = [];
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) { assert(!entry.isSymbolicLink()); const file = directory + "/" + entry.name; if (entry.isDirectory()) rows.push(...walk(file)); else { fact(file); rows.push(file); } } return rows.sort(); }
function git(args, input) {
    assert(Array.isArray(args) && args.every(arg => typeof arg === "string" && !arg.includes("\0")));
    const metadata = path.join(repo, ".git"); ancestors(metadata); assert(fs.lstatSync(metadata).isDirectory(), "Ordinary root Git directory required."); assert.equal(fs.realpathSync(metadata).toLowerCase(), metadata.toLowerCase(), "Aliased Git directory refused.");
    assert.equal(sha(fs.readFileSync(GIT)), "da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f", "Pinned Git changed.");
    const environment = { ...process.env };
    for (const key of Object.keys(environment)) if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|GRAFT_FILE|REPLACE_REF_BASE|CONFIG(?:_.*)?|CEILING_DIRECTORIES|DISCOVERY_ACROSS_FILESYSTEM)$/i.test(key)) delete environment[key];
    const result = cp.spawnSync(GIT, [...FIXED, ...args], { cwd: repo, env: environment, windowsHide: true, shell: false, input, maxBuffer: 96 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw Error("Scoped local Git failed; retain root execution receipt; no object bodies emitted."); return result.stdout;
}
const zeroList = raw => new TextDecoder("utf-8", { fatal: true }).decode(raw).split("\0").filter(Boolean).sort();
const cached = () => zeroList(git(["diff", "--cached", "--no-renames", "--name-only", "-z"]));
const head = () => git(["rev-parse", "HEAD"]).toString("ascii").trim();
function tracked(revision = "HEAD", directory = base) { assert(/^(HEAD|[a-f0-9]{40})$/.test(revision)); safe(directory); return zeroList(git(["ls-tree", "-r", "--name-only", "-z", revision, "--", directory])); }
function changed(revision) { assert(/^[a-f0-9]{40}$/.test(revision)); return zeroList(git(["diff-tree", "--no-commit-id", "--no-renames", "--name-only", "-z", "-r", revision])); }
function objectRows(specs) { assert(specs.length && specs.every(spec => typeof spec === "string" && !/[\r\n\0]/.test(spec))); const output = git(["cat-file", "--batch"], specs.join("\n") + "\n"), rows = []; let cursor = 0;
    for (const spec of specs) { const end = output.indexOf(10, cursor); assert(end >= cursor); const header = /^([a-f0-9]{40}) blob ([0-9]+)$/.exec(output.toString("ascii", cursor, end)); assert(header, "Missing/nonblob actual Git object.");
        const size = Number(header[2]), start = end + 1, next = start + size; assert(Number.isSafeInteger(size) && size >= 0 && next < output.length && output[next] === 10);
        const raw = Buffer.from(output.subarray(start, next)); assert.equal(crypto.createHash("sha1").update(Buffer.from("blob " + size + "\0")).update(raw).digest("hex"), header[1], "Actual blob framing/OID differs."); rows.push({ spec, oid: header[1], bytes: raw }); cursor = next + 1;
    } assert.equal(cursor, output.length); return rows;
}
function treeEntries(prefix) {
    const index = prefix === ""; assert(index || /^[a-f0-9]{40}$/.test(prefix)); const result = new Map();
    const output = git(index ? ["ls-files", "--stage", "-z"] : ["ls-tree", "-r", "-z", prefix]);
    for (const value of zeroList(output)) { const match = index ? /^([0-9]{6}) ([a-f0-9]{40}) ([0-3])\t([\s\S]+)$/.exec(value) : /^([0-9]{6}) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(value);
        // Submodules in unrelated existing trees are not scoped blob memberships.
        if (!match) { assert(!index && /^[0-9]{6} commit [a-f0-9]{40}\t/.test(value)); continue; }
        const file = match[index ? 4 : 3]; assert(!result.has(file), "Unmerged/duplicate index entry."); result.set(file, { mode: match[1], oid: match[2], stage: index ? match[3] : "0" });
    } return result;
}
function verify(specs, records) {
    assert.equal(specs.length, records.length); unique(records); if (!records.length) return [];
    const prefix = specs[0].slice(0, -(records[0].path.length + 1)); assert(prefix === "" || /^[a-f0-9]{40}$/.test(prefix));
    assert(specs.every((spec, i) => spec === prefix + ":" + records[i].path)); const tree = treeEntries(prefix), verified = [];
    for (const row of records) { const entry = tree.get(row.path); if (row.deleted === true) { assert.equal(entry, undefined, "Deleted member remains in actual index/commit."); verified.push({ ...rawFact(row), oid: null, mode: null }); }
        else { assert(entry && entry.stage === "0" && /^(100644|100755)$/.test(entry.mode), "Nonregular scoped index/commit entry."); if (row.mode !== undefined) assert.equal(entry.mode, row.mode, "Scoped Git mode drift."); } }
    const present = records.filter(row => row.deleted !== true); let start = 0;
    while (start < present.length) { let end = start, total = 0;
        while (end < present.length && end - start < 64 && (end === start || total + present[end].bytes <= 16 * 1024 * 1024)) { const row = present[end++]; assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 64 * 1024 * 1024); total += row.bytes; }
        for (const [offset, item] of objectRows(present.slice(start, end).map(row => prefix + ":" + row.path)).entries()) { const row = present[start + offset], entry = tree.get(row.path); assert.equal(item.bytes.length, row.bytes, row.path); assert.equal(sha(item.bytes), row.sha256, row.path); assert.equal(item.oid, entry.oid); if (row.oid !== undefined) assert.equal(item.oid, row.oid); verified.push({ ...rawFact(row), oid: item.oid, mode: entry.mode }); } start = end;
    } return sorted(verified);
}
function writeNew(name, value) { safe(name); assert(!name.includes("/")); const file = base + "/" + name; ancestors(resolve(file), true); assert(!fs.existsSync(resolve(file))); fs.writeFileSync(resolve(file), Buffer.isBuffer(value) ? value : typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); return fact(file); }
function assertEvidenceMembership(records, additional = []) { const expected = [...new Set([...records.filter(row => row.deleted !== true && row.path.startsWith(base + "/")).map(row => row.path), ...additional])].sort(); assert.deepEqual(walk(base), expected, "New/omitted evidence after freeze."); }
function pathspec(name, records) { unique(records); assert(records.length); return writeNew(name, Buffer.from(records.map(row => row.path).join("\0") + "\0")); }
function stageFrozen(records, spec) {
    assert.equal(cached().length, 0, "Nonempty index is preserved and refused; never reset/stash/unstage unrelated content."); checkFacts(records, "BEFORE git add ALL memberships including deletions"); assert.deepEqual(fact(spec.path), rawFact(spec));
    git(["add", "-f", "--pathspec-from-file=" + spec.path, "--pathspec-file-nul"]); const staged = cached(); assert(staged.length && staged.every(file => records.some(row => row.path === file)), "Unknown staged path.");
    checkFacts(records, "AFTER explicit-path git add"); return { staged, verified: verify(records.map(row => ":" + row.path), records) };
}
function assertOrdinaryCommitState() { for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) assert(!fs.existsSync(resolve(".git/" + name)), "Unrelated in-progress Git operation is preserved/refused."); }
function assertCommitParent(revision, parent) { assert.deepEqual(git(["rev-list", "--parents", "-n", "1", revision]).toString("ascii").trim().split(" "), [revision, parent], "Exactly one reviewed parent required; merge commits refused."); }
function checkBoundConfig() {
    const bindingFact = fact(base + "/byte-proof-binding-current-01.json"); assert.equal(bindingFact.sha256, "__F26A_BYTE_BINDING_SHA256__", "Root-reviewed binding changed/unbound."); const binding = read(bindingFact.path);
    assert.equal(binding.status, "F26A_CURRENT_ACCEPTANCE_AND_EXPLICIT_SCOPE_BOUND"); assert.equal(binding.feature, "F26a"); assert.equal(binding.parent, PARENT); assert.equal(binding.sourcePathsReviewedAgainstCurrentGitDiff, true);
    assert.equal(binding.artifactPath, "packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix"); assert.match(binding.acceptanceSha256, /^[a-f0-9]{64}$/);
    for (const field of ["plannedSourceScope", "fullInputBinding", "inputBinding", "nativeCurrentBinding", "nativeFixtureEquivalence"]) assert.deepEqual(fact(binding[field].path), rawFact(binding[field]));
    assert.equal(binding.fullInputBinding.path, base + "/full-inputs-02.json"); assert.equal(binding.fullInputBinding.sha256, "5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322");
    assert.equal(binding.inputBinding.path, base + "/native-source-inputs-03.json"); assert.equal(binding.inputBinding.sha256, "f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab");
    assert.equal(binding.nativeCurrentBinding.path, base + "/native-current-binding-03.json"); assert.equal(binding.nativeCurrentBinding.sha256, "df37214d1c6af39677175f4cd8245d6cfa314488aed520110e73fa2f582bb612");
    assert.equal(binding.nativeFixtureEquivalence.path, base + "/native-fixture-equivalence-03.json"); assert.equal(binding.nativeFixtureEquivalence.sha256, "837236c08710d3583eca0349dff7c93078ee3e2c1990b8233e06ea166dc0a20d");
    const current = read(binding.inputBinding.path); assert.equal(current.fileCount, 989); assert.equal(current.files.length, 989); checkFacts(current.files, "Actual current989 source/unit/native/build inputs");
    const scope = read(binding.plannedSourceScope.path); assert.equal(scope.status, "FROZEN_REVIEWED_F26A_DELTA_FROM_PARENT_AFTER_ACCEPTANCE"); assert.equal(scope.parent, PARENT); assert.equal(scope.acceptanceSha256, binding.acceptanceSha256); unique(scope.records); unique(scope.parentRecords); unique(scope.unrelatedPreserved);
    assert.deepEqual([...binding.sourcePaths].sort(), scope.records.map(row => row.path).sort()); assert.equal(new Set(binding.sourcePaths).size, binding.sourcePaths.length); assert(MUTABLE.every(file => binding.sourcePaths.includes(file)));
    assert(Array.isArray(scope.trackedDelta) && new Set(scope.trackedDelta).size === scope.trackedDelta.length); scope.trackedDelta.forEach(safe);
    for (const row of scope.records) { assert(!row.path.startsWith(base + "/"), "Evidence is captured by exact recursive membership."); if (row.deleted) { assert(row.deleted === true && row.before && row.before.path === row.path); assert.match(row.before.oid, /^[a-f0-9]{40}$/); } }
    return binding;
}
function checkPlannedDelta(binding) {
    assert.equal(head(), PARENT); assert.equal(cached().length, 0, "Existing staging preserved/refused."); const scope = read(binding.plannedSourceScope.path); checkFacts(scope.records, "Root-frozen reviewed source delta"); checkFacts(scope.unrelatedPreserved, "Root-frozen unrelated working bytes");
    assert.equal(new Set([...scope.records, ...scope.unrelatedPreserved].map(row => row.path.toLowerCase())).size, scope.records.length + scope.unrelatedPreserved.length);
    const actual = zeroList(git(["diff", "--no-renames", "--name-only", "-z", PARENT, "--"])); assert.deepEqual(actual, [...scope.trackedDelta, ...scope.unrelatedPreserved.map(row => row.path)].sort(), "Current tracked delta differs from reviewed split.");
    const existing = new Set(zeroList(git(["ls-tree", "-r", "--name-only", "-z", PARENT]))); assert.equal(scope.parentRecords.length, scope.records.length);
    assert.deepEqual(scope.parentRecords.map(row => row.path).sort(), scope.records.map(row => row.path).sort());
    for (const row of read(binding.inputBinding.path).files) if (!existing.has(row.path)) assert(binding.sourcePaths.includes(row.path), "Current tested new source omitted from explicit commit scope.");
    for (const row of scope.parentRecords) { if (row.absent === true) assert(!existing.has(row.path)); else { assert(existing.has(row.path)); assert.match(row.oid, /^[a-f0-9]{40}$/); assert.equal(verify([PARENT + ":" + row.path], [row])[0].oid, row.oid); } }
    for (const row of scope.records.filter(item => item.deleted)) assert.deepEqual(scope.parentRecords.find(item => item.path === row.path), row.before, "Deleted member must name exact actual parent Git bytes, never guessed working CRLF bytes.");
    assert(scope.trackedDelta.every(file => scope.records.some(row => row.path === file) && existing.has(file))); return scope;
}
function checkQueue(stage, source) {
    const queue = read(MUTABLE[0]); assert.equal(queue.activeFeature, "F26"); const parent = queue.features.find(row => row.id === "F26"); assert.equal(parent.status, "ACTIVE"); const card = parent.subcards.find(row => row.id === "F26a"); assert.equal(card.acceptanceEvidence, base + "/f26a-acceptance-01.json");
    assert.equal(parent.subcards.find(row => row.id === "F26c").status, "PLANNED");
    if (stage === "source") { assert.equal(card.status, "VERIFYING"); assert.equal(parent.subcards.find(row => row.id === "F26b").status, "PLANNED"); }
    else { assert.equal(stage, "transition"); assert.equal(card.status, "DONE"); assert.equal(card.result, "PASS_SCOPED"); assert.equal(card.sourceEvidenceCommit, source.revision); assert.equal(card.commitByteVerification, base + "/f26a-source-byte-verification-01.json"); assert.equal(card.transitionByteVerification, base + "/f26a-transition-byte-verification-01.json"); assert.equal(parent.subcards.find(row => row.id === "F26b").status, "ACTIVE"); }
}
module.exports = { repo, base, PARENT, MUTABLE, sha, read, safe, resolve, bytes, fact, absent, rawFact, unique, sorted, checkFacts, walk, git, cached, head, tracked, changed, verify, writeNew, assertEvidenceMembership, pathspec, stageFrozen, assertOrdinaryCommitState, assertCommitParent, checkBoundConfig, checkPlannedDelta, checkQueue };
