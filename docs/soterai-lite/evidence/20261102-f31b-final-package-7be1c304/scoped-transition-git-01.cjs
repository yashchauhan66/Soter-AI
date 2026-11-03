'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const relative = file => path.relative(repo, file).replaceAll('\\', '/');
const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const hooks = own('empty-f31b-transition-hooks-01');
const parent = '730b01d95ee89b62c58ef0a5ace3991b549107e3';
const manifestName = 'f31b-transition-manifest-01.json';
const proofName = 'f31b-transition-byte-proof-01.json';
const bodyName = 'f31b-transition-body-01.txt';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const oid = raw => crypto.createHash('sha1').update(Buffer.from('blob ' + raw.length + '\0')).update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });
function run(args, input) {
  return cp.execFileSync(git, ['--git-dir=' + path.join(repo, '.git'), '--work-tree=' + repo,
    '-c', 'core.hooksPath=' + hooks, '-c', 'core.fsmonitor=false', '-c', 'commit.gpgSign=false',
    '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args],
  { cwd: repo, env, input, shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}
const text = args => run(args).toString('utf8').trim();
const names = args => run(args).toString('utf8').split('\0').filter(Boolean);
function file(name) {
  assert(typeof name === 'string' && !path.isAbsolute(name) && !name.includes('\\') && !name.split('/').includes('..') && !/[\r\n\0"]/.test(name));
  const target = path.resolve(repo, name); assert(target.startsWith(repo + path.sep));
  for (let current = target;; current = path.dirname(current)) { assert(!fs.lstatSync(current).isSymbolicLink()); if (current === repo) break; }
  const stat = fs.lstatSync(target); assert(stat.isFile() && stat.nlink === 1); return target;
}
function fact(name) { const raw = fs.readFileSync(file(name)); return { path: name, bytes: raw.length, sha256: sha(raw), oid: oid(raw), mode: '100644' }; }
function same(row) { assert.deepEqual(fact(row.path), row); }
function walk(directory) {
  assert(!fs.lstatSync(directory).isSymbolicLink());
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink()); const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target); assert(entry.isFile()); return [relative(target)];
  });
}
function canonical(name) {
  const raw = fs.readFileSync(own(name + '.txt')), receipt = read(own(name + '.txt.result.json'));
  assert.equal(receipt.exitCode, 0, name); assert.equal(sha(raw), receipt.sha256.toLowerCase());
}
function preflight() {
  assert.equal(sha(fs.readFileSync(git)), 'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');
  assert.equal(text(['rev-parse', '--show-object-format']), 'sha1'); assert.equal(text(['rev-parse', 'HEAD']), parent);
  assert.equal(names(['diff', '--cached', '--name-only', '-z']).length, 0, 'Preserve unknown staged changes.');
  const recorded = read(own('feature-acceptance-01.json'));
  assert.equal(sha(fs.readFileSync(own('feature-acceptance-01.json'))), '9ce861b797fd6ed8697e0f5fe045960b79467942f5619ace5bdbaaf1de9cc161');
  const actual = require('./finalize-feature-acceptance-03.cjs').verify();
  assert.deepEqual({ ...actual, observedAt: recorded.observedAt }, recorded);
  canonical('feature-acceptance-02'); canonical('prepare-done-transition-01');
  const queue = read(path.join(repo, 'docs/soterai-lite/FEATURE-QUEUE.json'));
  assert.equal(queue.activeFeature, 'F32'); assert.equal(queue.implementationConcurrency, 1);
  assert.equal(queue.features.find(row => row.id === 'F31').subcards.find(row => row.id === 'F31b').status, 'DONE');
  const f32 = queue.features.find(row => row.id === 'F32'); assert.equal(f32.status, 'ACTIVE'); assert.equal(f32.result, 'NOT-RUN');
  assert.deepEqual(f32.originalRequiresPreserved, ['F31']); assert.deepEqual(f32.executionDependenciesCurrent, ['F31a', 'F31b']);
  assert.notEqual(queue.features.find(row => row.id === 'F26').status, 'DONE');
  assert(queue.finalGates.every(row => row.status === 'PLANNED'));
  return recorded;
}
const metadata = ['docs/soterai-lite/README-CLAIMS.md', 'docs/soterai-lite/FEATURE-QUEUE.json',
  'docs/soterai-lite/IMPLEMENTATION-PLAN.md', 'docs/soterai-lite/ledger.md',
  'docs/soterai-lite/NEXT-CHAT-HANDOFF-20261102-F31B.md', 'docs/soterai-lite/NEXT-CHAT-HANDOFF-20261103-F32.md',
  'docs/soterai-lite/evidence/20261102-release-gate-readiness/F31B-README-CLAIMS-CANDIDATE-02.txt',
  'docs/soterai-lite/evidence/20261102-release-gate-readiness/F32-REMOVAL-COORDINATOR-PROPOSED-TESTS-01.ts.txt'];
function scope() {
  const excluded = [manifestName, proofName, 'transition-prepare-01.txt', 'transition-prepare-01.txt.result.json',
    'transition-commit-01.txt', 'transition-commit-01.txt.result.json'];
  return [...new Set([...walk(__dirname).filter(name => !excluded.includes(path.basename(name))), ...metadata])].sort();
}
(async () => {
  const [mode, expectedHash] = process.argv.slice(2); assert(['--prepare', '--commit'].includes(mode)); preflight();
  if (mode === '--prepare') {
    assert(!expectedHash && !fs.existsSync(own(manifestName)) && !fs.existsSync(own(bodyName)));
    const body = 'docs(lite): close scoped final package and select lifecycle work\n\n'
      + 'Record verified F31b package/audit-work completion and source832 byte proof. Preserve42 known builder findings/remediationOPEN/no risk acceptance, F26a skipped incomplete, post-test Edge drift, historical closure gaps and all unrelated work. F32 starts only after transition bytes; no release-ready/rating/publication claim.\n';
    fs.writeFileSync(own(bodyName), body, { flag: 'wx' });
    const frozen = scope().map(fact); await new Promise(resolve => setTimeout(resolve, 1000));
    assert.deepEqual(scope().map(fact), frozen, 'Transition files changed while freezing.');
    const tree = new Map(names(['ls-tree', '-r', '-z', 'HEAD']).map(line => {
      const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line); assert(match); return [match[3], { mode: match[1], oid: match[2] }];
    }));
    const files = frozen.filter(row => tree.get(row.path)?.oid !== row.oid || tree.get(row.path)?.mode !== row.mode);
    assert(files.every(row => row.path.startsWith(relative(__dirname) + '/') || metadata.includes(row.path)));
    const record = { status: 'PREPARED_F31B_SCOPED_DONE_F32_TRANSITION_NOT_COMMITTED', parent,
      branch: text(['symbolic-ref', '--short', 'HEAD']), observedAt: new Date().toISOString(), files,
      body: bodyName, acceptanceSha256: '9ce861b797fd6ed8697e0f5fe045960b79467942f5619ace5bdbaaf1de9cc161',
      frozenEvidenceScope: frozen, releaseReady: false, f26a: 'USER_SKIPPED_INCOMPLETE_NO_NATIVE_RETRY',
      scope: 'Only F31b residual evidence/externalclaims/ledger/queue/plan/handoffs and exactly two readiness preparations. All unrelated/F26a3 source excluded. Scoped audit-work complete with42 known build findings/remediationOPEN/no risk acceptance. F32 starts only after raw byte proof.' };
    fs.writeFileSync(own(manifestName), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: record.status, files: files.length + 1, manifestSha256: sha(fs.readFileSync(own(manifestName))) }));
  } else {
    assert.match(expectedHash, /^[a-f0-9]{64}$/); assert.equal(sha(fs.readFileSync(own(manifestName))), expectedHash);
    assert(!fs.existsSync(own(proofName))); const manifest = read(own(manifestName));
    assert.equal(manifest.parent, parent); assert.equal(text(['symbolic-ref', '--short', 'HEAD']), manifest.branch);
    manifest.frozenEvidenceScope.forEach(same); const files = [...manifest.files, fact(relative(own(manifestName)))]; files.forEach(same);
    assert.equal(new Set(files.map(row => row.path)).size, files.length);
    if (!fs.existsSync(hooks)) fs.mkdirSync(hooks); assert(!fs.lstatSync(hooks).isSymbolicLink()); assert.deepEqual(fs.readdirSync(hooks), []);
    const written = run(['hash-object', '-w', '--no-filters', '--stdin-paths'], Buffer.from(files.map(row => JSON.stringify(row.path)).join('\n') + '\n')).toString().trim().split('\n');
    assert.deepEqual(written, files.map(row => row.oid));
    run(['update-index', '-z', '--index-info'], Buffer.from(files.map(row => row.mode + ' ' + row.oid + '\t' + row.path + '\0').join('')));
    const expected = files.map(row => row.path).sort(); assert.deepEqual(names(['diff', '--cached', '--name-only', '-z']).sort(), expected);
    files.forEach(same); assert.equal(text(['rev-parse', 'HEAD']), parent); run(['commit', '--file', own(bodyName)]);
    const commit = text(['rev-parse', 'HEAD']); assert.equal(text(['rev-parse', commit + '^']), parent);
    assert.deepEqual(names(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commit]).sort(), expected);
    for (const row of files) { const raw = run(['cat-file', 'blob', commit + ':' + row.path]); assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256); assert.equal(oid(raw), row.oid); same(row); }
    assert.equal(names(['diff', '--cached', '--name-only', '-z']).length, 0);
    const proof = { status: 'PASS_EXACT_LOCAL_F31B_SCOPED_DONE_F32_TRANSITION_BYTES', observedAt: new Date().toISOString(),
      commit, parent, fileCount: files.length, mismatches: 0, unexpectedPaths: 0, indexEmpty: true,
      featureState: 'F31B_SCOPED_DONE_F32_SELECTED', releaseReady: false, audit: 'COMPLETE_WITH_KNOWN_BUILD_FINDINGS_REMEDIATION_OPEN_NO_RISK_ACCEPTANCE',
      f26a: manifest.f26a, files, scope: manifest.scope };
    fs.writeFileSync(own(proofName), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: proof.status, commit, files: files.length, mismatches: 0, proofSha256: sha(fs.readFileSync(own(proofName))) }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
