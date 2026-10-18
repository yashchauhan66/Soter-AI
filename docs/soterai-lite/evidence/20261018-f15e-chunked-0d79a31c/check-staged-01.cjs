"use strict";
// Read-only precommit: exact staged paths and bytes, with no config mutation.
const h = require("./f15e-evidence-lib.cjs"), { assert, repo, base, bytes, hash, sha, read, inside, own, git, lines } = h;
const indexPath = base + "/f15e-evidence-index-01.json", index = read(own("f15e-evidence-index-01.json"));
assert.equal(lines(git("rev-parse", "HEAD"))[0], index.parent);
const actual = lines(git("diff", "--cached", "--name-only")).sort(), expected = [...index.expectedCommitPaths].sort(); assert.deepEqual(actual, expected);
assert.equal(sha(git("show", ":" + indexPath)), hash(inside(repo, indexPath)));
git.preload("", index.entries.map(entry => entry.path));
const entries = new Map(index.entries.map(entry => [entry.path, entry]));
for (const name of actual) { if (name === indexPath) continue; const entry = entries.get(name); assert.ok(entry, "Unindexed staged file."); const staged = git("show", ":" + name); assert.equal(staged.length, entry.bytes); assert.equal(sha(staged), entry.sha256); }
for (const entry of index.entries) { const current = bytes(inside(repo, entry.path)); assert.equal(current.length, entry.bytes); assert.equal(sha(current), entry.sha256); }
console.log(JSON.stringify({ status: "PASS_SCOPED_STAGED_BYTES", stagedPaths: actual.length, indexedEntries: index.entries.length }));
