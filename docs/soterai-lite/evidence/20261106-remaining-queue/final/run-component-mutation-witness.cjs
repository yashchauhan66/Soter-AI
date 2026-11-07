'use strict';
// Execute only five frozen pure sources in memory. Mutants never touch product files.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..'), ts = require(path.join(root, 'node_modules/typescript'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fact = p => { const b = fs.readFileSync(p); return { path: path.relative(root, p).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; };
const pin = f => { const p = path.resolve(root, f.path), a = fact(p); assert.equal(a.bytes, f.bytes); assert.equal(a.sha256, f.sha256); return p; };
assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--binding');
const bindingPath = path.resolve(process.argv[3]); assert.equal(fact(bindingPath).sha256, process.argv[4]);
const binding = json(bindingPath), qualification = json(pin(binding.qualification)), proof = json(pin(binding.sourceProof));
assert.equal(qualification.sourceProofSha256, binding.sourceProof.sha256); pin(qualification.vsix);
const names = ['packages/core/src/RegisteredSecretMatcher.ts', 'packages/core/src/StreamingOutputRedactor.ts', 'packages/core/src/StreamingOutputNormalizer.ts', 'packages/guard-core/src/detectors/SecretDetector.ts', 'packages/guard-core/src/detectors/utils.ts'];
const originals = new Map(names.map(name => { const record = proof.files.find(f => f.path === name); assert(record); return [path.resolve(root, name), { record, content: fs.readFileSync(pin(record), 'utf8') }]; }));
const needle = 'return decision(matches.length ? "MATCHED" : "CLEAN", matches);', replacement = 'return decision("CLEAN", []);';
const matcherPath = path.resolve(root, names[0]), originalMatcher = originals.get(matcherPath).content;
assert.equal(originalMatcher.split(needle).length, 2);
const mutantMatcher = originalMatcher.replace(needle, replacement);
function component(mutated) {
  const cache = new Map();
  function load(p) {
    assert(originals.has(p)); if (cache.has(p)) return cache.get(p).exports;
    const source = mutated && p === matcherPath ? mutantMatcher : originals.get(p).content;
    const compiled = ts.transpileModule(source, { fileName: p, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
    assert(!compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error));
    const module = { exports: {} }; cache.set(p, module);
    const localRequire = id => { if (id === 'node:util') return require('node:util'); assert(id.startsWith('.')); return load(path.resolve(path.dirname(p), id + '.ts')); };
    const wrapper = new vm.Script('(function(exports,require,module){' + compiled.outputText + '\n})', { filename: p }); wrapper.runInThisContext({ timeout: 5000 })(module.exports, localRequire, module); return module.exports;
  }
  return { Matcher: load(matcherPath).RegisteredSecretMatcher, Redactor: load(path.resolve(root, names[1])).StreamingOutputRedactor };
}
const original = component(false), mutant = component(true), secret = 'SOTERAI_SYNTHETIC_ONLY_q7/é?z2';
const variants = [['raw', secret], ['base64', Buffer.from(secret).toString('base64')], ['base64url', Buffer.from(secret).toString('base64url')], ['hex', Buffer.from(secret).toString('hex')], ['url', encodeURIComponent(secret)], ['json', JSON.stringify(secret)]];
const publicText = 'Useful public result: two orders.';
const rows = [];
function output(api, input, split, enabled = () => true) { const r = new api.Redactor([secret], { enabled }); const bytes = Buffer.from(input); r.push('stdout', bytes.subarray(0, split)); r.push('stdout', bytes.subarray(split)); return r.finish(0); }
function noOutput(result) { assert.equal(result.status, 'WITHHELD'); assert.equal(result.stdout, ''); assert.equal(result.stderr, ''); }
for (const api of [original, mutant]) { assert.equal(new api.Matcher([secret]).inspectRequest([publicText]).status, 'CLEAN'); assert.equal(output(api, publicText, 7).stdout, publicText); }
for (const [representation, value] of variants) {
  const input = 'value=' + value + '\n', split = Math.floor(Buffer.byteLength(input) / 2);
  const protectedOutput = output(original, input, split), mutatedOutput = output(mutant, input, split);
  assert.equal(protectedOutput.status, 'COMPLETE'); assert.equal(protectedOutput.redacted, true); assert(!protectedOutput.stdout.includes(value));
  assert.equal(mutatedOutput.status, 'COMPLETE'); assert.equal(mutatedOutput.redacted, false); assert(mutatedOutput.stdout.includes(value));
  const parts = [value.slice(0, 6), value.slice(6, 15), value.slice(15)];
  const protectedRequest = new original.Matcher([secret]).inspectRequest(parts), mutatedRequest = new mutant.Matcher([secret]).inspectRequest(parts);
  assert.equal(protectedRequest.status, 'MATCHED'); assert.equal(mutatedRequest.status, 'CLEAN');
  rows.push({ id: 'V02-MUTANT-' + representation.toUpperCase(), representation, catalogScope: ['LS-13', 'LS-14', 'LS-17'], publicUsefulInOriginalAndMutant: true,
    sourceOriginal: { requestStatus: protectedRequest.status, output: protectedOutput, canaryPresent: false },
    testOnlyMutant: { requestStatus: mutatedRequest.status, output: mutatedOutput, syntheticCanaryDetected: true },
    testOutcome: 'DECISION_MUTANT_KILLED_BY_CONFIDENTIALITY_ORACLE', featureFlagMutation: false, claim: 'COMPONENT_SUBCLAIM_ONLY_NOT_FULL_ROW_OR_TOOL_ACCEPTANCE' });
}
let splitChecks = 0; const bytes = Buffer.from(secret);
for (let split = 0; split <= bytes.length; split++) { const a = output(original, secret, split), b = output(mutant, secret, split); assert.equal(a.redacted, true); assert(!a.stdout.includes(secret)); assert(b.stdout.includes(secret)); splitChecks++; }
const ansi = secret.slice(0, 10) + '\u001b[31m' + secret.slice(10) + '\u001b[0m';
const ansiOriginal = output(original, ansi, 13), ansiMutant = output(mutant, ansi, 13); assert.equal(ansiOriginal.redacted, true); assert(ansiMutant.stdout.includes(secret));
let enabled = true; const withdrawing = new original.Redactor([secret], { enabled: () => enabled }); withdrawing.push('stdout', Buffer.from(secret)); enabled = false; noOutput(withdrawing.finish(0));
for (const api of [original, mutant]) noOutput(output(api, ' '.repeat(131073), 65536));
for (const { record } of originals.values()) pin(record);
const result = { status: 'PASS_COMPONENT_MUTANT_ORACLE_AND_FAIL_CLOSED_WITHDRAWAL_NOT_CATALOG_ACCEPTANCE', observedAt: new Date().toISOString(), qualification: binding.qualification, sourceProof: binding.sourceProof, artifact: qualification.vsix,
  execution: 'TYPESCRIPT_TRANSPILE_IN_MEMORY_NO_PRODUCT_FILE_CHANGE', tool: fact(__filename), compiler: { version: ts.version, entry: fact(require.resolve('typescript')), package: fact(require.resolve('typescript/package.json')) },
  frozenSources: [...originals.values()].map(x => x.record), mutant: { file: names[0], originalSha256: sha(originalMatcher), mutatedInMemorySha256: sha(mutantMatcher), matchCount: 1, replace: needle, with: replacement, actualProductFlag: false },
  controls: { originalAndMutantPublicUseful: true, resourceOverflowWithheldInBoth: true, splitPositions: splitChecks, ansiNormalizationConfidentialityWitness: true }, rows,
  realFeatureWithdrawal: { status: 'WITHHELD', canaryAbsent: true, classification: 'AVAILABILITY_ONLY' },
  testOnlyPreventionMutation: { killed: 6, survived: 0, qualification: 'An in-memory decision-branch mutant demonstrates oracle sensitivity for these component subclaims. It is not the prescribed per-tool feature-flag mutation and cannot promote any catalog pair.' },
  remaining: ['Actual tool routing/configuration and positive/negative controls', 'Full per-row scenario coverage', 'Feature-flag dependency versus prevention sensitivity', 'Native and human gates'], catalogPairsPromoted: 0, productWrites: 0, modelCalls: 0, nativeLaunches: 0, networkRequests: 0 };
const file = path.join(__dirname, 'component-mutation-witness-01.json'); fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: result.status, result: fact(file), mutationsKilled: 6, splitPositions: splitChecks, catalogPairsPromoted: 0 }));
