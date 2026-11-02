'use strict';
// Read-only shared invariants. No child, build, typecheck, listener or Git action.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const own = name => path.join(__dirname, name);
const old = 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/';
const current = 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const file = relative => path.resolve(repo, relative);
function fact(filename) {
  const raw = fs.readFileSync(filename);
  return { path: path.relative(repo, filename).split(path.sep).join('/'), bytes: raw.length, sha256: sha(raw) };
}
function exact(row) {
  const target = file(row.path), stat = fs.lstatSync(target);
  assert(target.startsWith(repo + path.sep)); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
  for (let cursor = path.dirname(target); cursor !== repo; cursor = path.dirname(cursor)) {
    assert(cursor.startsWith(repo + path.sep)); assert(!fs.lstatSync(cursor).isSymbolicLink());
  }
  assert.deepEqual(fact(target), row); return target;
}
function addExpressions(source) {
  const ts = require('typescript'), parsed = ts.createSourceFile('frozen-fixture.ts', source, ts.ScriptTarget.Latest, true), result = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'add') result.push(node.getText(parsed));
    ts.forEachChild(node, visit);
  }
  visit(parsed); return result;
}
function retained() {
  const snapshot = read(own('readiness-snapshot-01.json'));
  assert.equal(fact(own('readiness-snapshot-01.json')).sha256, 'a93ee9d816762b533f31136f7b362d1aacb9d0b646b7429d8a611533e9e47c55');
  const proof = read(exact(snapshot.currentInputs.proof));
  assert.equal(proof.fileCount, 1076); assert.equal(proof.files.length, 1076);
  snapshot.custody.protectedSources.forEach(exact);
  for (const row of snapshot.custody.protectedSources) assert.deepEqual(proof.files.find(r => r.path === row.path), row);
  const contract = snapshot.originalContract;
  for (const row of [contract.freeze, contract.originalSource, contract.diagnosticSource, contract.diagnosticHelper, contract.transform, contract.retainedDriver]) exact(row);
  const original = fs.readFileSync(file(contract.originalSource.path), 'utf8');
  const diagnostic = fs.readFileSync(file(contract.diagnosticSource.path), 'utf8');
  let reversed = diagnostic;
  for (const row of [...read(file(contract.transform.path)).changes].reverse()) {
    assert.equal(reversed.split(row.after).length, 2); reversed = reversed.replace(row.after, row.before);
  }
  assert.equal(reversed, original);
  const originalCalls = addExpressions(original);
  assert.equal(originalCalls.length, 34); assert.deepEqual(addExpressions(diagnostic), originalCalls);
  for (const row of [snapshot.oldPacket.candidate, snapshot.oldPacket.helper, snapshot.oldPacket.defer]) exact(row);
  assert.equal(read(file(snapshot.oldPacket.defer.path)).exactAnswer, 'Abhi native09 mat chalao');
  return snapshot;
}
function deadlines(text) { return [...text.matchAll(/(?:TotalSeconds|ElapsedMilliseconds)\s*-lt\s*\d+/g)].map(row => row[0]); }
function bootstrap(text) {
  const start = text.indexOf("$taskBootstrap=@'"); assert(start >= 0);
  const end = text.indexOf("'@", start); assert(end > start); return text.slice(start, end + 2);
}
module.exports = { fs, path, assert, repo, own, old, current, read, sha, file, fact, exact, retained, deadlines, bootstrap };
