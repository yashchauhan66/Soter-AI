'use strict';
// AUTHORING ONLY: neither mode was executed when this helper was prepared.
// --prepare freezes ONLY after accepted current native closures and withdrawal.
// --commit <manifest SHA256> performs one local, explicitly scoped raw-byte commit.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const relative = file => path.relative(repo, file).replaceAll('\\', '/');
const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const hooks = own('empty-f31b-source-checkpoint-hooks-01');
const prefix = 'scoped-f31b-source-checkpoint-01';
const manifestName = prefix + '-manifest.json', proofName = prefix + '-byte-proof.json';
const bodyName = prefix + '-body.txt', scopeName = 'feature-source-scope01.json';
const parentExpected = '0affcdd0a46ff0e5d6921b69356303b7dd6d22b4';
const sourceSha256 = '221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99';
const vsixSha256 = '6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c';
const buildIds = ['2026-11-02T16-35-20-330Z-0df4c4c8', '2026-11-02T16-39-27-974Z-4f755a9b', '2026-11-02T16-43-45-355Z-3d422280'];
const artifactNames = [1, 2, 3].map(n => 'packages/soterai-lite/soterai-lite-0.7.0-f31b-20261102-attempt0' + n + '.vsix');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const oid = bytes => crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0' });
function run(args, input) {
    return cp.execFileSync(git, ['--git-dir=' + path.join(repo, '.git'), '--work-tree=' + repo,
        '-c', 'core.hooksPath=' + hooks, '-c', 'core.fsmonitor=false', '-c', 'commit.gpgSign=false',
        '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args],
    { cwd: repo, env, input, shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}
const text = args => run(args).toString('utf8').trim();
const names = args => run(args).toString('utf8').split('\0').filter(Boolean);
function ordinary(name) {
    assert(typeof name === 'string' && !path.isAbsolute(name) && !name.includes('\\')
        && !name.split('/').includes('..') && !/[\r\n\0"]/.test(name));
    const file = path.resolve(repo, name); assert(file.startsWith(repo + path.sep));
    for (let current = file;; current = path.dirname(current)) {
        const stat = fs.lstatSync(current); assert(!stat.isSymbolicLink()); if (current === repo) break;
    }
    const stat = fs.lstatSync(file); assert(stat.isFile() && stat.nlink === 1); return file;
}
function fact(name) {
    const bytes = fs.readFileSync(ordinary(name));
    return { path: name, bytes: bytes.length, sha256: sha(bytes), oid: oid(bytes), mode: '100644' };
}
function pin(row) {
    const actual = fact(row.path); assert.equal(actual.bytes, row.bytes, row.path);
    assert.equal(actual.sha256, row.sha256, row.path); return actual;
}
function same(row) { assert.deepEqual(fact(row.path), row); }
function walk(dir) {
    const stat = fs.lstatSync(dir); assert(stat.isDirectory() && !stat.isSymbolicLink());
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        assert(!entry.isSymbolicLink()); const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(file); assert(entry.isFile()); return [relative(file)];
    });
}
function canonical(name, expected = 0) {
    const file = own(name + '.txt'), receipt = read(file + '.result.json');
    assert.equal(receipt.exitCode, expected, name); assert.equal(sha(fs.readFileSync(file)), receipt.sha256.toLowerCase());
}
function closedPhase(name) {
    const row = read(own(name + '-owned-close.json'));
    for (const [key, value] of Object.entries({ actualClose: true, exitCode: 0, signal: null,
        stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false,
        deadlineExceeded: false, signalsRequested: 0 })) assert.equal(row[key], value, name + ':' + key);
    assert.deepEqual(row.streams.map(stream => stream.name).sort(), ['stderr', 'stdout']);
    for (const stream of row.streams) {
        const bytes = fs.readFileSync(own(name + '-' + stream.name + '.bin'));
        assert.equal(bytes.length, stream.bytes); assert.equal(bytes.length, stream.observedBytes);
        assert.equal(sha(bytes), stream.sha256);
    }
    return row;
}
function scope() {
    assert.equal(sha(fs.readFileSync(own(scopeName))), '7fcf4bd4332f0bb489194bd50c7ac0c6b417b112b136d12f4bbc96eee7ce142f');
    const s = read(own(scopeName));
    assert.equal(s.parent, parentExpected); assert.equal(s.feature, 'F31b'); assert.equal(s.sourceCount, 18);
    assert.equal(s.trackedModifiedCount, 13); assert.equal(s.newCount, 5);
    assert.equal(s.files.length, 18); assert.equal(new Set(s.files.map(row => row.path)).size, 18);
    assert.equal(s.featureComplete, false); assert.equal(s.nextFeatureSelected, false); assert.equal(s.releaseReady, false);
    pin(s.sourceProof); assert.equal(s.sourceProof.sha256, sourceSha256);
    const frozen = read(path.resolve(repo, s.sourceProof.path)); assert.equal(frozen.files.length, 1098);
    for (const row of s.files) {
        pin(row); const input = frozen.files.filter(input => input.path === row.path); assert.equal(input.length, 1);
        assert.equal(input[0].bytes, row.bytes); assert.equal(input[0].sha256, row.sha256);
    }
    assert.equal(s.retainedF26aExcluded.length, 3);
    for (const row of s.retainedF26aExcluded) {
        pin(row); assert(!s.files.some(input => input.path === row.path));
        assert.equal(row.includedInCurrentArtifact, true); assert.equal(row.includedInThisSourceCommit, false);
    }
    return s;
}
function evidencePin(row) {
    assert(typeof row.path === 'string' && !path.isAbsolute(row.path) && !row.path.startsWith('../'));
    return pin(row);
}
async function preflight() {
    assert.equal(sha(fs.readFileSync(git)), 'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');
    assert.equal(text(['rev-parse', '--show-object-format']), 'sha1');
    const s = scope();
    assert.equal(sha(fs.readFileSync(own('current-native-admission-06.cjs'))), 'dd000bc5a9098193a8b3b493d44c9ea8d9446ccd0ce793888d8ec77966f2fb4a');
    const C = require('./current-native-admission-06.cjs'), binding = C.binding();
    assert.equal(binding.sourceProof.sha256, sourceSha256); assert.equal(binding.vsix.sha256, vsixSha256);
    assert.equal(binding.vsix.bytes, 1735938); assert.equal(binding.precommitExcluded, true);
    assert.equal(binding.f26a, 'USER_SKIPPED_INCOMPLETE_NO_MORE_HOST_NATIVE_RUNS');
    assert.equal(sha(fs.readFileSync(own('native-binding-01.json'))), 'c653a5714a58a6c633dc0bee58984e8e08da2b59737bd58fa5c39a3a8668bfbe');
    const backend = read(own('backend-byte-reuse-01.json'));
    assert.equal(sha(fs.readFileSync(own('backend-byte-reuse-01.json'))), 'b3121ea5c36e722c42bdd3c3b439e4d0c2f9ab14e8a110555b6044212505929c');
    assert.equal(backend.status, 'PASS_EXACT_UNCHANGED_BACKEND_WORKER_INPUT_GRAPH_AND_ACTUAL_PRIOR_CLOSURES_REUSED');
    assert.equal(backend.sourceProof.sha256, sourceSha256); assert.equal(backend.backendCompilerTestSourceRows.length, 350);
    assert.deepEqual(backend.counts, { tests: 144, pass: 143, fail: 0, cancelled: 0, skipped: 1, todo: 0 });
    assert.equal(backend.workers.length, 3); backend.evidence.forEach(evidencePin);
    backend.backendCompilerTestSourceRows.forEach(C.pin);
    for (const worker of backend.workers) worker.inputs.forEach(C.pin);
    evidencePin(backend.currentBuildReceipt); evidencePin(backend.priorBuildReceipt);
    assert.equal(backend.typecheck, 'PASS_REUSED_BY_EXACT_INPUT_GRAPH_NOT_FRESH_EXECUTION');
    const acceptance = read(own('affected-acceptance-01.json'));
    assert.equal(acceptance.status, 'PASS_CURRENT_F31B_AFFECTED4_175_8_FUNCTIONAL10_SECURITY17_BASELINE');
    assert.equal(acceptance.sourceProof.sha256, sourceSha256); assert.equal(acceptance.vsix.sha256, vsixSha256);
    for (const [key, value] of Object.entries({ familyCount: 4, nativeChecks: 175, phases: 8,
        functionalChecks: 10, securityBaselineCases: 17, totalAssertions: 202, totalPhases: 10,
        securityChanged: 0, releaseReady: false, signalsRequested: 0 })) assert.equal(acceptance[key], value, key);
    assert.deepEqual(acceptance.residuals, { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 });
    assert.deepEqual(acceptance.families.map(row => row.id), ['ps51', 'editor', 'mcp', 'retained']);
    assert.equal(acceptance.families.reduce((sum, row) => sum + row.checks, 0), 175);
    assert.equal(acceptance.f26a, 'USER_SKIPPED_INCOMPLETE_NO_NATIVE_RETRY');
    assert(Array.isArray(acceptance.evidence) && acceptance.evidence.length > 25); acceptance.evidence.forEach(evidencePin);
    const wrapperRows = acceptance.evidence.filter(row => /-owned-close\.json$/.test(row.path));
    assert(wrapperRows.length >= 5);
    for (const row of wrapperRows) {
        const value = read(path.resolve(repo, row.path));
        if (Object.hasOwn(value, 'actualClose')) {
            for (const [key, expected] of Object.entries({ actualClose: true, exitCode: 0, signal: null,
                stdoutEOF: true, stderrEOF: true, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(value[key], expected, row.path + ':' + key);
        }
    }
    // Require successful final root sequence: never freeze while round03 is active.
    const chain = read(own('affected-chain-result-03.json'));
    assert.equal(chain.status, 'F31B_REMAINING_FUNCTIONAL_SECURITY_MCP_RETAINED_ROUND03_CLOSED_ROOT_AGGREGATION_PENDING');
    assert.deepEqual(chain.results.map(row => row.name), ['affected-functional-security-f31b-03', 'affected-mcp-f31b-03', 'affected-retained-f31b-03']);
    for (const row of chain.results) {
        assert.equal(row.status, 'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING'); closedPhase(row.name); canonical(row.name);
    }
    for (const name of ['affected-ps51-f31b-01', 'affected-editor-f31b-01']) { closedPhase(name); canonical(name); }
    const post = read(own('post-owner-absence-01.json'));
    assert.equal(post.status, 'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS'); assert.equal(post.signalsRequested, 0);
    assert.equal(post.observations.length, 2);
    for (const row of post.observations) { assert.equal(row.markedCount, 0); assert.equal(row.owners.length, 0); assert(Number.isFinite(Date.parse(row.observedAt))); }
    assert(Date.parse(post.observations[1].observedAt) >= Date.parse(post.observations[0].observedAt) + 500);
    assert(Date.parse(post.observations[0].observedAt) >= Date.parse(chain.observedAt), 'Post-owner observation must follow final native chain result.');
    const full = read(own('full-suite-acceptance-04.json'));
    assert.equal(sha(fs.readFileSync(own('full-suite-acceptance-04.json'))), '24726fdaab8099259ea2005d2d88bafce50f8c7bc581f9120cb9ff6c998b56a3');
    assert.deepEqual(full.counts, { tests: 4783, pass: 4779, fail: 0, cancelled: 0, skipped: 4, todo: 0 });
    const content = read(own('content-inspection-02.json'));
    assert.equal(sha(fs.readFileSync(own('content-inspection-02.json'))), 'bf93f31670e979414c464be5caea8ad48bc58cc200c4b477af60b52d69cd4b0d');
    assert.equal(content.vsix.sha256, vsixSha256); assert.equal(content.entryCount, 18); assert.equal(content.runtimeCount, 4);
    const historical = read(own('interrupted-full-owner-observation-01.json'));
    assert.equal(historical.status, 'NO_KNOWN_SURVIVING_OWNED_SUBTREE_TWICE_STREAMS_STABLE_CLOSE_EOF_UNCONFIRMED');
    const q = read(path.join(repo, 'docs/soterai-lite/FEATURE-QUEUE.json'));
    assert.equal(q.activeSubcard, 'F31b'); assert.notEqual(q.features.find(row => row.id === 'F31').status, 'DONE');
    const parent26 = q.features.find(row => row.id === 'F26'); assert.notEqual(parent26.status, 'DONE');
    assert.notEqual(parent26.subcards.find(row => row.id === 'F26a').status, 'DONE');
    return { sourceScope: s, binding, acceptance, content,
        gates: ['full-inputs-04.json', 'full-suite-acceptance-04.json', 'backend-byte-reuse-01.json',
            'content-inspection-02.json', 'native-binding-01.json', 'affected-acceptance-01.json',
            'affected-chain-result-03.json', 'post-owner-absence-01.json'].map(name => fact(relative(own(name)))) };
}
function checkpointFile(name) {
    const base = path.basename(name);
    // The active outer wrapper's logs and post-commit proof cannot attest their own closure.
    return ![manifestName, proofName, prefix + '-prepare.txt', prefix + '-prepare.txt.result.json',
        prefix + '-commit.txt', prefix + '-commit.txt.result.json'].includes(base);
}
function candidateScope(state) {
    const scope = [...state.sourceScope.files.map(row => row.path), ...walk(__dirname).filter(checkpointFile),
        'docs/soterai-lite/ledger.md', 'docs/soterai-lite/NEXT-CHAT-HANDOFF-20261102-F31B.md', ...artifactNames];
    for (const id of buildIds) {
        const root = path.join(repo, 'packages/soterai-lite/builds', id), receipt = read(path.join(root, 'build-provenance.json'));
        assert.equal(receipt.runId, id); assert.equal(receipt.runtimeCount, 4); assert.equal(receipt.identity, 'soterai.soterai-ide-guard');
        const candidate = fs.readFileSync(path.join(root, 'package-candidate.vsix'));
        const artifact = fs.readFileSync(path.resolve(repo, artifactNames[buildIds.indexOf(id)]));
        assert.equal(sha(candidate), sha(artifact)); assert.equal(candidate.length, artifact.length);
        scope.push(...walk(root));
    }
    assert.equal(fact(artifactNames[2]).sha256, vsixSha256);
    const result = [...new Set(scope)].sort();
    assert(!state.sourceScope.retainedF26aExcluded.some(row => result.includes(row.path)));
    assert(result.every(name => state.sourceScope.files.some(row => row.path === name)
        || name.startsWith(relative(__dirname) + '/') || artifactNames.includes(name)
        || buildIds.some(id => name.startsWith('packages/soterai-lite/builds/' + id + '/'))
        || ['docs/soterai-lite/ledger.md', 'docs/soterai-lite/NEXT-CHAT-HANDOFF-20261102-F31B.md'].includes(name)));
    return result;
}
function tree() {
    return new Map(names(['ls-tree', '-r', '-z', 'HEAD']).map(line => {
        const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line); assert(match);
        return [match[3], { mode: match[1], oid: match[2] }];
    }));
}
const body = 'feat(lite): checkpoint reviewed final-package implementation\n\n'
    + 'Explicit18 F31b source/test/document paths plus stable feature evidence and exactly three locally created build/VSIX attempts. '
    + 'Current1098 graph/full4783 zero failures/backend graph reuse/content18/current affected175/8+functional10/security17 baseline8blocked9leaks and declared current-owner withdrawal are checked. '
    + 'Earlier failures and historical outer84707/Node21856 close/EOF remain unconfirmed where originally missing. '
    + 'F31b remains INCOMPLETE pending advisory and human/final gates; no DONE or nextF32 transition. '
    + 'F26a is user-skipped/incomplete, retained3 source changes and all unrelated work excluded; tested artifact includes retained inputs, scoped HEAD alone is not whole-artifact reproduction. '
    + 'No push/publish/tag/rating or originalL6 HUMAN-ACTIONS STOP bypass.\n';
(async () => {
    const [mode, expectedHash] = process.argv.slice(2); assert(['--prepare', '--commit'].includes(mode));
    const state = await preflight(); assert.equal(names(['diff', '--cached', '--name-only', '-z']).length, 0, 'Unknown staged changes must remain untouched.');
    if (mode === '--prepare') {
        assert(!expectedHash && !fs.existsSync(own(manifestName)) && !fs.existsSync(own(bodyName)));
        assert.equal(text(['rev-parse', 'HEAD']), parentExpected);
        const before = candidateScope(state).map(fact);
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.deepEqual(candidateScope(await preflight()).map(fact), before, 'Evidence changed while freezing; no manifest emitted.');
        const parentTree = tree();
        for (const row of state.sourceScope.files) {
            const old = parentTree.get(row.path);
            assert.equal(!!old, row.parentState === 'TRACKED_MODIFIED', row.path + ':parent-state');
            assert.notEqual(old?.oid, fact(row.path).oid, row.path + ':source must be a new scoped change');
        }
        fs.writeFileSync(own(bodyName), body, { flag: 'wx' });
        const eligible = [...before, fact(relative(own(bodyName)))].sort((a, b) => a.path.localeCompare(b.path));
        const files = eligible.filter(row => parentTree.get(row.path)?.oid !== row.oid || parentTree.get(row.path)?.mode !== row.mode);
        assert(state.sourceScope.files.every(source => files.some(row => row.path === source.path)));
        const record = { status: 'PREPARED_EXPLICIT_F31B_SOURCE18_CHECKPOINT_INCOMPLETE_NOT_COMMITTED', feature: 'F31b',
            parent: parentExpected, branch: text(['symbolic-ref', '--short', 'HEAD']), observedAt: new Date().toISOString(),
            sourceScope: fact(relative(own(scopeName))), sourceCount: 18, sourceProof: state.binding.sourceProof,
            vsix: state.binding.vsix, gates: state.gates, body: bodyName, files,
            frozenEvidenceScope: eligible, historicalOuter84707: 'CLOSE_EOF_UNCONFIRMED_NODE21856_ABSENT_TWICE_DOES_NOT_PROVE_EXIT',
            featureState: 'F31B_INCOMPLETE_ADVISORY_HUMAN_FINAL_GATES_PENDING_NO_NEXT_TRANSITION',
            featureComplete: false, nextFeatureSelected: false, releaseReady: false,
            retainedF26aSourceExcluded: state.sourceScope.retainedF26aExcluded,
            scope: 'Explicit18 source paths, stable P evidence, ledger/current F31b handoff and exactly3 locally created builds/VSIXs. All other dirty files remain untouched. Current artifact includes retained F26a3; scoped HEAD alone is not whole-artifact reproduction. No DONE/nextF32/push/publish/tag/rating/originalL6 bypass.' };
        fs.writeFileSync(own(manifestName), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ status: record.status, files: files.length + 1, sourceCount: 18,
            manifestSha256: sha(fs.readFileSync(own(manifestName))), featureComplete: false, releaseReady: false }));
    } else {
        assert.match(expectedHash, /^[a-f0-9]{64}$/); assert.equal(sha(fs.readFileSync(own(manifestName))), expectedHash);
        assert(!fs.existsSync(own(proofName))); const m = read(own(manifestName));
        assert.equal(m.parent, parentExpected); assert.equal(text(['rev-parse', 'HEAD']), m.parent);
        assert.equal(text(['symbolic-ref', '--short', 'HEAD']), m.branch); assert.equal(m.body, bodyName);
        assert.equal(m.featureComplete, false); assert.equal(m.nextFeatureSelected, false); assert.equal(m.releaseReady, false);
        assert.deepEqual(m.gates, state.gates); pin(m.sourceScope); m.frozenEvidenceScope.forEach(same);
        const files = [...m.files, fact(relative(own(manifestName)))];
        assert.equal(new Set(files.map(row => row.path)).size, files.length); files.forEach(same);
        if (!fs.existsSync(hooks)) fs.mkdirSync(hooks);
        assert(fs.lstatSync(hooks).isDirectory() && !fs.lstatSync(hooks).isSymbolicLink()); assert.deepEqual(fs.readdirSync(hooks), []);
        const written = run(['hash-object', '-w', '--no-filters', '--stdin-paths'],
            Buffer.from(files.map(row => JSON.stringify(row.path)).join('\n') + '\n')).toString('utf8').trim().split('\n');
        assert.deepEqual(written, files.map(row => row.oid));
        run(['update-index', '-z', '--index-info'], Buffer.from(files.map(row => row.mode + ' ' + row.oid + '\t' + row.path + '\0').join('')));
        const expected = files.map(row => row.path).sort();
        assert.deepEqual(names(['diff', '--cached', '--name-only', '-z']).sort(), expected);
        files.forEach(same); await preflight(); assert.equal(text(['rev-parse', 'HEAD']), m.parent);
        run(['commit', '--file', own(m.body)]);
        const commit = text(['rev-parse', 'HEAD']); assert.equal(text(['rev-parse', commit + '^']), m.parent);
        assert.deepEqual(names(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commit]).sort(), expected);
        // Per-blob cat-file avoids concatenating all retained build/native evidence into memory.
        for (const row of files) {
            const raw = run(['cat-file', 'blob', commit + ':' + row.path]);
            assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256); assert.equal(oid(raw), row.oid); same(row);
        }
        assert.equal(names(['diff', '--cached', '--name-only', '-z']).length, 0);
        const result = { status: 'PASS_EXACT_LOCAL_F31B_SOURCE18_CHECKPOINT_BYTES_FEATURE_INCOMPLETE',
            observedAt: new Date().toISOString(), feature: 'F31b', commit, parent: m.parent, fileCount: files.length,
            sourceCount: 18, mismatches: 0, unexpectedPaths: 0, indexEmpty: true, featureComplete: false,
            nextFeatureSelected: false, releaseReady: false, featureState: m.featureState,
            historicalOuter84707: m.historicalOuter84707, retainedF26aSourceExcluded: m.retainedF26aSourceExcluded,
            configuredGitPush: 'NO_REMAINING_AUTHORITY_NOT_RUN', files, scope: m.scope };
        fs.writeFileSync(own(proofName), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ status: result.status, commit, paths: files.length, sourceCount: 18,
            mismatches: 0, indexEmpty: true, featureComplete: false, proofSha256: sha(fs.readFileSync(own(proofName))) }));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
