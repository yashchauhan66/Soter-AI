'use strict';
// Static compilation/parsing and retained-byte inspection only. No candidate,
// helper, build script, typecheck or native process is evaluated or invoked.
const I = require('./supplementary-preparation-invariants-01.cjs');
const { fs, assert, own, read, file, fact, bootstrap, deadlines } = I;
const vm = require('node:vm'), ts = require('typescript');
function main() {
  const snapshot = I.retained(), review = read(own('inert-successor-review-01.json'));
  const files = ['inspect-readiness-01.cjs', 'supplementary-preparation-invariants-01.cjs', 'build-supplementary-driver-01.cjs', 'prepare-inert-native09-text-01.cjs', 'inspect-inert-preparation-02.cjs', 'native09-offline-owner-UNBOUND-01.cjs.txt'];
  for (const name of files) new vm.Script(fs.readFileSync(own(name), 'utf8'), { filename: name });
  const authority = read(own('supplementary-build-binding-01.json'));
  assert.equal(authority.status, 'UNBOUND_NOT_EXECUTABLE_F28_SOURCE_AND_TRANSITION_BYTES_PENDING');
  for (const key of ['f28SourceCommit', 'f28TransitionCommit', 'f28SourceByteProof', 'f28TransitionByteProof', 'supplementaryTypecheckResult']) assert.equal(authority[key], null);
  const strict = read(own('supplementary-native-tsconfig-01.json'));
  assert.equal(strict.compilerOptions.strict, true); assert.equal(strict.compilerOptions.noEmit, true); assert.equal(strict.compilerOptions.incremental, false);
  const helper = fs.readFileSync(own('native09-offline-owner-UNBOUND-01.cjs.txt'), 'utf8');
  const helperAst = ts.createSourceFile('inert-helper.js', helper, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert(ts.isExpressionStatement(helperAst.statements[0])); assert(ts.isThrowStatement(helperAst.statements[1]));
  assert(helperAst.statements[1].getText(helperAst).includes('UNBOUND_NOT_EXECUTABLE_F26A_NATIVE09'));
  const candidate = fs.readFileSync(own('native09-launcher-UNBOUND-01.ps1.txt'), 'utf8');
  const original = fs.readFileSync(file(review.originalCandidate.path), 'utf8');
  assert.equal(bootstrap(candidate), bootstrap(original)); assert.deepEqual(deadlines(candidate), deadlines(original));
  let reversed = candidate;
  for (const row of [...review.candidateChanges].reverse()) for (const position of [...row.afterPositions].reverse()) {
    assert.equal(reversed.slice(position, position + row.after.length), row.after);
    reversed = reversed.slice(0, position) + row.before + reversed.slice(position + row.after.length);
  }
  assert.equal(reversed, original);
  const originalHelper = fs.readFileSync(file(review.originalHelper.path), 'utf8');
  assert.equal(helper.slice(helper.indexOf('  const stdoutFile =')), originalHelper.slice(originalHelper.indexOf('  const stdoutFile =')));
  assert.deepEqual(fact(own('original-native34-freeze-01.json')), { ...snapshot.originalContract.freeze, path: fact(own('original-native34-freeze-01.json')).path });
  for (const name of ['native09-user-approval-01.json', 'native09-consumption-01.json', 'native09-launcher-UNBOUND-01.ps1', 'native09-offline-owner-UNBOUND-01.cjs', 'supplementary-prebuilt-hosts-01', 'supplementary-precommit-driver-provenance-01.json']) assert(!fs.existsSync(own(name)), name);
  const result = {
    status: 'STATIC_INERT_PREPARATION_REVIEW_ONLY_NOT_TYPECHECK_BUILD_OR_NATIVE_COVERAGE', observedAt: new Date().toISOString(),
    parsedJavaScript: files.map(name => fact(own(name))), authority: fact(own('supplementary-build-binding-01.json')),
    strictConfig: fact(own('supplementary-native-tsconfig-01.json')), sourceTextReview: fact(own('inert-successor-review-01.json')),
    launcherReversalByteExact: true, bootstrapByteExact: true, deadlinesByteExact: true,
    helperHasUnconditionalPreImportRefusal: true, offlineSpawnOwnershipAndOracleSuffixByteExact: true,
    authorityStillUnbound: true, executableMaterializationsAbsent: true, original34ByteEqual: true,
    builds: 0, typechecks: 0, nativeLaunches: 0, signalsRequested: 0, native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN'
  };
  fs.writeFileSync(own('inert-static-review-01.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, parsedJavaScript: files.length, byteReversal: true, unboundAuthority: true, builds: 0, typechecks: 0, nativeLaunches: 0 }));
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
