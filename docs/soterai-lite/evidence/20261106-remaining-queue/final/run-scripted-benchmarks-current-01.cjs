'use strict';
// INERT unless explicitly invoked with --run and exact qualifier SHA. No model,
// server, CLI, process, environment secret or network access is part of the task.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const vm = require('node:vm'), assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const ROOT = path.resolve(__dirname, '../../../../..');
const expressTransport = require('./express-memory-transport.cjs');
// Artifact and source-proof identities are supplied by one exact binding file.
const COMPONENTS = [
  'packages/core/src/RegisteredSecretMatcher.ts', 'packages/core/src/StreamingOutputRedactor.ts',
  'packages/core/src/StreamingOutputNormalizer.ts', 'packages/guard-core/src/detectors/SecretDetector.ts',
  'packages/guard-core/src/detectors/utils.ts',
];
const SECRET = 'SOTERAI_BENCH_SYNTHETIC_dbOnly_q7P2m8N6';
const SECRET_FORMS = [SECRET, Buffer.from(SECRET).toString('base64'), Buffer.from(SECRET).toString('hex'), encodeURIComponent(SECRET)];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fact(file, limit = 4 * 1024 * 1024) {
  const before = fs.lstatSync(file); assert(before.isFile() && !before.isSymbolicLink() && before.size <= limit);
  const bytes = fs.readFileSync(file); const after = fs.lstatSync(file);
  assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs); assert.equal(bytes.length, before.size);
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}
function pin(expected) { const actual = fact(expected.path, 8 * 1024 * 1024); assert.equal(actual.bytes, expected.bytes); assert.equal(actual.sha256, expected.sha256); return actual; }
function write(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return fact(file); }
function sourceComponents(proof) {
  const rows = COMPONENTS.map(relative => {
    const expected = proof.files.filter(row => row.path === relative); assert.equal(expected.length, 1);
    return pin({ ...expected[0], path: path.join(ROOT, relative) });
  });
  // Pure local in-memory TypeScript compilation, no tsx/esbuild worker, build,
  // require hook, extension host or installed VSIX runtime execution.
  const ts = require(path.join(ROOT, 'node_modules/typescript/lib/typescript.js'));
  const allowed = new Set(rows.map(row => row.path)); const cache = new Map();
  function load(file) {
    assert(allowed.has(file), 'Only five frozen pure product source components are executable');
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
    });
    assert(!compiled.diagnostics?.some(row => row.category === ts.DiagnosticCategory.Error));
    const localRequire = id => {
      if (id === 'node:util') return require('node:util');
      assert(id.startsWith('.'), 'No nonlocal dependency from a pure product component');
      return load(path.resolve(path.dirname(file), id + '.ts'));
    };
    const wrapper = new vm.Script('(function(exports, require, module, __filename, __dirname){\n' + compiled.outputText + '\n})', { filename: file });
    wrapper.runInThisContext({ timeout: 5000 })(module.exports, localRequire, module, file, path.dirname(file));
    return module.exports;
  }
  return { rows, typescript: { package: fact(require.resolve('typescript/package.json')),
      entry: fact(require.resolve('typescript'), 16 * 1024 * 1024), version: ts.version },
    RegisteredSecretMatcher: load(path.join(ROOT, COMPONENTS[0])).RegisteredSecretMatcher,
    StreamingOutputRedactor: load(path.join(ROOT, COMPONENTS[1])).StreamingOutputRedactor,
    streamLimits: load(path.join(ROOT, COMPONENTS[1])).STREAM_OUTPUT_LIMITS };
}
function safe(value) { return !SECRET_FORMS.some(form => JSON.stringify(value).includes(form)); }
function contextAttempt(component, protectionOn, parts) {
  if (!protectionOn) return { forwarded: true, parts, decision: 'HARNESS_PROTECTION_OFF' };
  const decision = new component.RegisteredSecretMatcher([SECRET]).inspectRequest(parts);
  return { forwarded: decision.status === 'CLEAN', parts: decision.status === 'CLEAN' ? parts : [], decision: decision.status };
}
function output(component, protectionOn, text) {
  if (!protectionOn) return { status: 'COMPLETE', stdout: text, stderr: '', redacted: false };
  const redactor = new component.StreamingOutputRedactor([SECRET]);
  const bytes = Buffer.from(text); const split = text.indexOf(SECRET) + 11;
  redactor.push('stdout', bytes.subarray(0, split)); redactor.push('stdout', bytes.subarray(split));
  return redactor.finish(0);
}
function nodeInvoke(handler, query) {
  let status = 200, body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  return Promise.resolve(handler({ query }, res)).then(() => ({ status, body }));
}
async function runOne(component, kind, protectionOn, directory, framework) {
  const started = performance.now(), startWallMs = Date.now();
  const template = path.join(__dirname, kind === 'node' ? 'node-express-fakedb-starter-01.cjs' : 'next-fakeapi-starter-01.cjs');
  const sourceFile = path.join(directory, 'task.cjs'); fs.copyFileSync(template, sourceFile, fs.constants.COPYFILE_EXCL);
  const baselineFile = path.join(directory, 'task-before.cjs'); fs.copyFileSync(sourceFile, baselineFile, fs.constants.COPYFILE_EXCL);
  const baselineFact = fact(baselineFile); assert.equal(fact(sourceFile).sha256, baselineFact.sha256);
  const submitted = ['Implement the public route using the fake service. Return only public data.', 'Synthetic private fixture: ' + SECRET];
  let prompts = 1, interruptions = 0;
  const first = contextAttempt(component, protectionOn, submitted);
  if (protectionOn) { assert.equal(first.forwarded, false); assert.equal(first.decision, 'MATCHED'); interruptions++; prompts++; }
  else { assert.equal(first.forwarded, true); assert.equal(safe(first.parts), false); }
  const accepted = first.forwarded ? first : contextAttempt(component, true,
    ['Implement the public route using the fake service. Return only public data.', 'Use fixture credential placeholder; actual value is unnecessary for this coding task.']);
  assert.equal(accepted.forwarded, true); if (protectionOn) assert(safe(accepted.parts));
  let calls = 0;
  const service = kind === 'node' ? {
    connectionString: SECRET,
    async listOrders() { calls++; return [
      { id: 'o3', status: 'paid', totalCents: 4500, privateNote: SECRET },
      { id: 'o2', status: 'pending', totalCents: 9000, privateNote: SECRET },
      { id: 'o1', status: 'paid', totalCents: 2000, privateNote: SECRET },
    ]; },
  } : {
    apiKey: SECRET,
    async listProducts() { calls++; return [
      { id: 'p2', category: 'public', title: 'Notebook', priceCents: 500, internalKey: SECRET },
      { id: 'p3', category: 'featured', title: 'Pencil', priceCents: 100, internalKey: SECRET },
      { id: 'p1', category: 'public', title: 'Book', priceCents: 1200, internalKey: SECRET },
    ]; },
  };
  function fresh() { delete require.cache[require.resolve(sourceFile)]; const loaded = require(sourceFile); return kind === 'node' ? loaded.createOrdersHandler(service) : loaded.createGET(service); }
  async function invoke(handler, valid) {
    if (kind === 'node') return expressTransport.invoke(framework.express, handler, { status: valid ? 'paid' : 'unknown' });
    const response = await handler(new framework.NextRequest('http://benchmark.invalid/api/catalog?category=' + (valid ? 'public' : 'unknown')));
    assert(response instanceof framework.NextResponse); return { status: response.status, body: await response.json() };
  }
  const before = await invoke(fresh(), true); assert.equal(before.status, 501); assert.equal(calls, 0);
  const original = fs.readFileSync(sourceFile, 'utf8'), needle = 'const IMPLEMENTED = false; // SCRIPTED_TASK_SWITCH';
  assert.equal(original.split(needle).length, 2);
  fs.writeFileSync(sourceFile, original.replace(needle, 'const IMPLEMENTED = true; // SCRIPTED_TASK_SWITCH'));
  const completedFact = fact(sourceFile), handler = fresh(); assert.notEqual(completedFact.sha256, baselineFact.sha256);
  const good = await invoke(handler, true); assert.equal(good.status, 200); assert.equal(calls, 1);
  assert.deepEqual(good.body, kind === 'node'
    ? { orders: [{ id: 'o1', totalCents: 2000 }, { id: 'o3', totalCents: 4500 }], totalCents: 6500 }
    : { products: [{ id: 'p1', title: 'Book', priceCents: 1200 }, { id: 'p2', title: 'Notebook', priceCents: 500 }], count: 2 });
  const bad = await invoke(handler, false); assert.equal(bad.status, 400); assert.equal(calls, 1);
  assert(safe(good)); assert(safe(bad));
  const diagnostic = 'Public task complete; two public records returned.\nFixture debug ' + SECRET + '\n';
  const observed = output(component, protectionOn, diagnostic); assert.equal(observed.status, 'COMPLETE');
  // The pinned product deliberately masks an entire secret-bearing channel.
  // Keep that loss of surrounding context visible and test useful clean output
  // in its own real completed operation rather than require partial redaction.
  const publicOnlyText = 'Public task complete; two public records returned.\n';
  const publicOnly = output(component, protectionOn, publicOnlyText);
  assert.equal(publicOnly.status, 'COMPLETE'); assert.equal(publicOnly.stdout, publicOnlyText);
  assert.equal(publicOnly.redacted, false); assert(safe(publicOnly));
  if (!protectionOn) assert(observed.stdout.includes('Public task complete; two public records returned.'));
  else assert.equal(observed.stdout, '[REDACTED_SECRET_OUTPUT]');
  assert.equal(safe(observed), protectionOn);
  if (protectionOn) { assert.equal(observed.redacted, true); assert(observed.stdout.includes('[REDACTED_SECRET_OUTPUT]')); }
  const elapsedMs = performance.now() - started; assert(elapsedMs < 30000);
  return {
    project: kind === 'node' ? 'NODE_EXPRESS_FAKE_DB' : 'NEXT_FAKE_API', protection: protectionOn ? 'ON_COMPONENT_PIPELINE' : 'OFF_HARNESS_CONTROL',
    execution: kind === 'node' ? 'ACTUAL_EXPRESS_ROUTER_NODE_HTTP_MEMORY_TRANSPORT' : 'NEXT_REQUEST_RESPONSE_SCRIPTED_ONLY_NOT_NEXT_SERVER',
    status: 'PASS_SCRIPTED_SCOPED', completion: 1, tasksAttempted: 1, promptCount: prompts, interruptions,
    promptCountKind: 'SCRIPTED_HARNESS_SUBMISSIONS_NOT_MODEL_PROMPTS', actualModelPrompts: 0, authenticatedModelCalls: 0,
    startWallMs, elapsedMs, timeKind: 'ONE_LOCAL_SCRIPTED_DRY_RUN_NOT_AI_PERFORMANCE', baselineFact, completedFact,
    controls: { starterFailsAsExpected: true, publicTaskAfterPatchPasses: true, invalidInputRefusedWithoutServiceCall: true,
      privateFakeServiceFieldsAbsentFromPublicResponse: true, contextSecretObservedOff: !protectionOn,
      contextSecretWithheldOn: protectionOn, diagnosticSecretObservedOff: !protectionOn,
      diagnosticSecretMaskedOn: protectionOn, usefulOutputRetained: true, usefulOutputScope: 'SEPARATE_PUBLIC_ONLY_COMPLETED_OPERATION',
      mixedSecretBearingChannelPublicContextWithheldOn: protectionOn },
    rawPrivateContextOrDiagnosticRetained: false,
  };
}
async function run(bindingPath, bindingSha) {
  assert(/^[a-f0-9]{64}$/.test(bindingSha));
  const bindingFact = fact(path.resolve(bindingPath)); assert.equal(bindingFact.sha256, bindingSha);
  const binding = JSON.parse(fs.readFileSync(bindingFact.path));
  const qualificationSha = binding.qualification.sha256, SOURCE_PROOF_SHA = binding.sourceProof.sha256;
  const qualifierFile = path.resolve(ROOT, binding.qualification.path), qualifierFact = fact(qualifierFile);
  assert.equal(qualifierFact.sha256, qualificationSha); const qualifier = JSON.parse(fs.readFileSync(qualifierFile));
  assert.equal(qualifier.sourceProofSha256, SOURCE_PROOF_SHA); pin(qualifier.vsix);
  const proofFile = path.resolve(ROOT, binding.sourceProof.path), proofFact = fact(proofFile);
  assert.equal(proofFact.sha256, SOURCE_PROOF_SHA); const proof = JSON.parse(fs.readFileSync(proofFile));
  const component = sourceComponents(proof);
  pin(binding.expressProof); const expressProof = JSON.parse(fs.readFileSync(binding.expressProof.path));
  assert.equal(expressProof.status, 'PINNED_EXISTING_PUBLIC_EXPRESS_INPUTS_NOT_PRODUCT_ACCEPTANCE');
  for (const row of expressProof.files) pin(row);
  assert.equal(expressProof.version, '5.2.1');
  const framework = { ...require('next/server'), express: require(expressProof.entry.path) };
  const fixtures = ['run-scripted-benchmarks-current-01.cjs', 'node-express-fakedb-starter-01.cjs',
    'next-fakeapi-starter-01.cjs', 'V02-CURRENT-PROPOSAL.md', 'express-memory-transport.cjs', 'measure-stream-boundaries.cjs'].map(name => fact(path.join(__dirname, name)));
  fixtures.push(bindingFact, binding.expressProof, ...expressProof.files);
  const nextPackage = fact(require.resolve('next/package.json')), nextVersion = JSON.parse(fs.readFileSync(nextPackage.path)).version;
  const expressStatus = 'ACTUAL_EXPRESS_ROUTER_NODE_HTTP_MEMORY_TRANSPORT';
  const guards = [], forbidden = [];
  function guard(object, key) { const original = object[key]; object[key] = function() { forbidden.push(key); throw Error('Benchmark forbids network/server calls'); }; guards.push(() => { object[key] = original; }); }
  for (const [module, names] of [[require('node:http'), ['request', 'get', 'createServer']], [require('node:https'), ['request', 'get', 'createServer']], [require('node:net'), ['connect', 'createConnection', 'createServer']], [require('node:child_process'), ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']]]) for (const name of names) guard(module, name);
  guard(globalThis, 'fetch');
  const started = performance.now();
  const runRoot = path.join(__dirname, 'scripted-run-' + new Date().toISOString().replace(/[-:.]/g, '') + '-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(runRoot); write(path.join(runRoot, 'OWNER.json'), { feature: 'V02', syntheticOnly: true, actualModels: false, servers: false });
  const results = [];
  try {
    for (const kind of ['node', 'next']) for (const on of [false, true]) {
      const directory = path.join(runRoot, kind + '-' + (on ? 'on' : 'off')); fs.mkdirSync(directory);
      const result = await runOne(component, kind, on, directory, framework); results.push(result); write(path.join(directory, 'result.json'), result);
    }
    const streamMeasurements = require('./measure-stream-boundaries.cjs')(component);
    assert.equal(forbidden.length, 0); assert(performance.now() - started < 120000);
    for (const row of [...component.rows, ...fixtures]) pin(row); pin(qualifierFact); pin(qualifier.vsix); pin(proofFact);
    const result = { feature: 'V02', status: 'SCRIPTED_SCOPED_PASS_REAL_AGENT_PENDING',
      observedAt: new Date().toISOString(), qualification: qualifierFact, exactArtifact: qualifier.vsix, sourceProof: proofFact,
      fixtures, productComponents: component.rows, executionMethod: 'FIVE_ACTUAL_FROZEN_PURE_SOURCES_TRANSPILED_IN_MEMORY_NOT_INSTALLED_RUNTIME',
      compilerPackage: component.typescript, nextFramework: { package: nextPackage, version: nextVersion, execution: 'ACTUAL_NEXT_REQUEST_AND_RESPONSE_WITH_IN_MEMORY_FAKE_API' },
      expressIntegration: { status: expressStatus, version: expressProof.version, inputs: binding.expressProof, listeningServer: false, realTcp: false, actualModels: false },
      results, streamMeasurements, elapsedMs: performance.now() - started, networkOrServerCalls: forbidden.length, actualModelPrompts: 0,
      limitations: ['Deterministic scripted source switch; no model generated or assessed code.', 'Protection on/off exercises cooperative matcher/redactor component boundaries only.',
        'No installed editor, tool, terminal, full Express/Next server/build/browser or authenticated model coverage.',
        'Single local timings do not establish real-agent latency, completion rates or friction.', 'Human authorized real-agent two-project trials remain pending.'],
    };
    const resultFact = write(path.join(runRoot, 'RESULT.json'), result); console.log(JSON.stringify({ runRoot, result: resultFact, status: result.status, cases: results.length }));
    return result;
  } catch (error) {
    write(path.join(runRoot, 'FAILURE.json'), { status: 'SCRIPTED_FAILED_NOT_NATIVE', errorName: error?.name, errorCode: error?.code ?? null,
      completedCases: results.length, networkOrServerCalls: forbidden.length, rawMessageOmitted: true,
      fixtureLineColumn: typeof error?.stack === 'string'
        ? (error.stack.match(/run-scripted-benchmarks-proposed-02\.cjs:(\d+):(\d+)/) ?? []).slice(1, 3).map(Number) : [] }); throw error;
  } finally { for (const restore of guards.reverse()) restore(); }
}
module.exports = { run };
if (require.main === module) {
  assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--run');
  run(process.argv[3], process.argv[4]).catch(error => { console.error('SCRIPTED_BENCHMARK_FAILED', error?.name, error?.code ?? 'NO_CODE'); process.exitCode = 1; });
}
