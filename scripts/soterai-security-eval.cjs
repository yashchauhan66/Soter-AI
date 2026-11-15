'use strict';

// Run current source, never stale package/dist output. All transport is in memory.
require('./soterai-source-contract-loader.cjs');
require('tsx/cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { gzipSync } = require('node:zlib');
const { isDeepStrictEqual } = require('node:util');
const { SecretContentScanner } = require('../packages/guard-core/src/SecretScanPolicy.ts');
const { BrokerServer } = require('../apps/local-ai-broker/src/BrokerServer.ts');
const { ProjectFileAccess } = require('../packages/vscode-extension/src/project-privacy/ProjectFileAccess.ts');
const { verifyClineArtifact } = require('../packages/vscode-extension/src/adapters/ClineAdapterPolicy.ts');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(__dirname, 'fixtures/soterai-security-eval.json');
const TOKEN = 'synthetic-evaluation-client-auth-only-739216';
const PROVIDER_TOKEN = 'synthetic-evaluation-provider-auth-only-627194';
const ROUTE = '/v1/ai/openai-compatible/chat/completions';
const PUBLIC_REPLY = 'PUBLIC_WORKFLOW_OK';
const sha = value => createHash('sha256').update(value).digest('hex');
const rounded = value => Math.round(value * 1000) / 1000;

function materialize(corpus) {
  if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.cases)) throw Error('CORPUS_INVALID');
  const ids = new Set();
  return corpus.cases.map(entry => {
    if (!/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id) || !/^[a-z0-9-]+$/.test(entry.class)
      || !['scanner', 'gateway', 'safe-reader', 'vendor'].includes(entry.surface)
      || !['sensitive', 'benign'].includes(entry.label)
      || !['supported', 'outside-contract', 'unsupported-input'].includes(entry.scope ?? 'supported')) throw Error('CORPUS_INVALID');
    ids.add(entry.id);
    let input = (entry.input ?? '').replaceAll('${registered}', corpus.registeredValue).replaceAll('${opaque}', corpus.opaqueValue);
    if (entry.repeat !== undefined) {
      if (!Number.isSafeInteger(entry.repeat) || entry.repeat < 1 || entry.repeat > 131073) throw Error('CORPUS_INVALID');
      input = input.repeat(entry.repeat);
    }
    switch (entry.encoding ?? 'raw') {
      case 'raw': break;
      case 'base64': input = Buffer.from(input).toString('base64'); break;
      case 'base64-twice': input = Buffer.from(Buffer.from(input).toString('base64')).toString('base64'); break;
      case 'hex': input = Buffer.from(input).toString('hex'); break;
      case 'url': input = [...Buffer.from(input)].map(byte => '%' + byte.toString(16).padStart(2, '0')).join(''); break;
      case 'unicode': input = [...input].map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join(''); break;
      case 'zero-width': input = [...input].join('\u200b'); break;
      default: throw Error('CORPUS_INVALID');
    }
    const values = entry.registration === 'normal' ? [corpus.registeredValue] : entry.registration === 'short' ? [corpus.shortValue] : [];
    const sensitiveValue = entry.sensitiveValue ?? (entry.registration === 'normal' ? corpus.registeredValue
      : entry.class === 'unknown-opaque' ? corpus.opaqueValue : undefined);
    return { ...entry, scope: entry.scope ?? 'supported', input, values,
      // An oracle declared by fixtures, independent of the implementation's detectors.
      protectedNeedles: entry.label === 'sensitive' && sensitiveValue ? [...new Set([sensitiveValue, input])] : [] };
  });
}

class InMemoryResponse extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  headers = new Map();
  body = '';
  setHeader(name, value) { this.headers.set(name.toLowerCase(), value); }
  getHeader(name) { return this.headers.get(name.toLowerCase()); }
  end(value = '') { this.headersSent = true; this.writableEnded = true; this.body += String(value); }
}

// Deliberately instrument the existing private handler. No server.start(),
// socket, listener, provider SDK or network request is used by this harness.
async function dispatch(broker, body, compression) {
  const plain = Buffer.from(JSON.stringify(body));
  const wire = compression === 'gzip' ? gzipSync(plain) : plain;
  const headers = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json', 'content-length': String(wire.length),
    ...(compression === 'gzip' ? { 'content-encoding': 'gzip' } : {}) };
  const req = new Readable({ autoDestroy: false, read() { this.push(wire); this.push(null); } });
  Object.assign(req, { method: 'POST', url: ROUTE, headers, rawHeaders: Object.entries(headers).flat(),
    rawTrailers: [], trailers: {}, complete: true, aborted: false, socket: { remoteAddress: '127.0.0.1' } });
  const res = new InMemoryResponse();
  await broker.handle(req, res);
  req.destroy();
  return res;
}

function bodiesFor(fixture) {
  const base = content => ({ model: 'synthetic-public-model', messages: [{ role: 'user', content }] });
  const middle = Math.floor(fixture.input.length / 2);
  switch (fixture.layout ?? 'plain') {
    case 'plain': return [base(fixture.input)];
    case 'split-messages': return [{ model: 'synthetic-public-model', messages: [
      { role: 'user', content: fixture.input.slice(0, middle) }, { role: 'assistant', content: fixture.input.slice(middle) }] }];
    case 'separate-requests': return [base(fixture.input.slice(0, middle)), base(fixture.input.slice(middle))];
    case 'tool-output': return [{ model: 'synthetic-public-model', messages: [{ role: 'tool', tool_call_id: 'public_read', content: fixture.input }] }];
    case 'metadata': return [{ ...base('Summarize the public API.'), metadata: { note: fixture.input } }];
    case 'arguments': return [{ model: 'synthetic-public-model', messages: [{ role: 'assistant', content: null,
      tool_calls: [{ id: 'public_query', type: 'function', function: { name: 'query', arguments: fixture.input } }] }] }];
    case 'image': return [base([{ type: 'image_url', image_url: { url: 'data:image/png;base64,U1lOVEhFVElD' } }])];
    case 'unknown-field': return [{ ...base(fixture.input), unreviewed_vendor_revision: 2 }];
    default: throw Error('CORPUS_INVALID');
  }
}

function payloadContainsFixture(sent, needles) {
  const leaves = [];
  const visit = value => {
    if (typeof value === 'string') leaves.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  sent.forEach(visit);
  return needles.some(needle => leaves.some(value => value.includes(needle)));
}

async function gateway(fixture) {
  const sent = [], responses = [], bodies = bodiesFor(fixture);
  const broker = new BrokerServer({ token: TOKEN, providerApiKey: PROVIDER_TOKEN,
    openAIProviderUrl: 'https://provider.invalid/v1/chat/completions', registeredValues: fixture.values,
    fetchImpl: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return Response.json({ choices: [{ message: { role: 'assistant', content: PUBLIC_REPLY } }] });
    } });
  try {
    for (const body of bodies) responses.push(await dispatch(broker, body, fixture.compression));
    const failed = responses.find(response => response.statusCode !== 200);
    let code = failed ? JSON.parse(failed.body).error?.code : undefined;
    // Whitelist generated diagnostic codes; no response content enters the report.
    if (code && !/^[a-z][a-z0-9_]{0,63}$/.test(code)) code = 'unclassified_error';
    const providerCalls = sent.length;
    if (failed) {
      const outcome = code === 'gateway_sensitive' ? 'detected'
        : code === 'gateway_schema_unsupported' || code?.endsWith('_unsupported') ? 'unsupported'
        : code === 'gateway_limit' || ['body_too_large', 'json_complexity', 'gateway_approval_required', 'gateway_unavailable'].includes(code) ? 'withheld'
        : 'error';
      return { outcome, code, providerCalls, publicPreserved: false };
    }
    const unchanged = isDeepStrictEqual(sent, bodies);
    const replyPreserved = responses.every(response => JSON.parse(response.body).choices?.[0]?.message?.content === PUBLIC_REPLY);
    const survivor = payloadContainsFixture(sent, fixture.protectedNeedles);
    // A rewrite alone cannot establish prevention: the independent fixture
    // oracle must also show that its known value and carrier were removed.
    return { outcome: unchanged || survivor ? 'clean' : 'detected', code: unchanged ? 'forwarded_unchanged'
      : survivor ? 'forwarded_sensitive_survivor' : 'forwarded_rewritten', providerCalls,
      publicPreserved: unchanged && replyPreserved };
  } finally { await broker.stop(); }
}

async function safeReader(fixture) {
  let now = 0, recipient = 'Synthetic managed reader';
  let file = { workspace: 'synthetic-workspace', relativePath: 'public.ts', policyRevision: 'public-policy-v1',
    fileIdentity: 'public-file-v1', content: fixture.input, regionView: fixture.input, sensitive: false };
  const access = new ProjectFileAccess({ enabled: () => true, now: () => now, recipient: () => recipient,
    capture: async () => ({ ...file }), confirm: async () => {
      switch (fixture.mutation) {
        case 'unchanged': break;
        case 'content': file = { ...file, content: file.content + '\n// Concurrent write.', regionView: file.regionView + '\n// Concurrent write.' }; break;
        case 'policy': file = { ...file, policyRevision: 'public-policy-v2' }; break;
        case 'recipient': recipient = 'Changed managed recipient'; break;
        case 'expiry': now = 60001; break;
        case 'revoke': access.revoke(); break;
        default: throw Error('CORPUS_INVALID');
      }
      return true;
    } });
  try {
    const result = await access.request('public.ts', 'integration-command');
    return { outcome: result.status === 'ALLOWED_ONCE' ? 'clean' : ['EXPIRED', 'CHANGED'].includes(result.status) ? 'detected' : 'withheld',
      code: result.status, publicPreserved: result.status === 'ALLOWED_ONCE' && result.text === fixture.input };
  } finally { access.dispose(); }
}

function vendor(fixture) {
  let manifest = Buffer.from(JSON.stringify({ publisher: 'synthetic-vendor', name: 'synthetic-client', version: '1.0.0', main: './dist/extension.js' }));
  let runtime = Buffer.from('// Public synthetic vendor fixture.');
  const pin = { publisher: 'synthetic-vendor', name: 'synthetic-client', version: '1.0.0', manifestSha256: sha(manifest), runtimeSha256: sha(runtime) };
  if (fixture.mutation === 'manifest') manifest = Buffer.from(manifest.toString().replace('1.0.0', '1.0.1'));
  else if (fixture.mutation === 'runtime') runtime = Buffer.concat([runtime, Buffer.from('\n// Substituted module.')]);
  else if (!['unchanged', 'default-pins'].includes(fixture.mutation)) throw Error('CORPUS_INVALID');
  const accepted = verifyClineArtifact(manifest, runtime, fixture.mutation === 'default-pins' ? undefined : pin);
  return { outcome: accepted ? 'clean' : 'detected', code: accepted ? 'artifact_accepted' : 'artifact_refused' };
}

async function evaluateCase(fixture) {
  const start = performance.now();
  let observation;
  try {
    if (fixture.surface === 'scanner') {
      const result = new SecretContentScanner(fixture.values).scan(fixture.input);
      observation = { outcome: !result.complete ? 'withheld' : result.findings.length ? 'detected' : 'clean',
        code: !result.complete ? 'inspection_incomplete' : result.findings.length ? 'finding_present' : 'no_finding' };
    } else if (fixture.surface === 'gateway') observation = await gateway(fixture);
    else if (fixture.surface === 'safe-reader') observation = await safeReader(fixture);
    else if (fixture.surface === 'vendor') observation = vendor(fixture);
    else throw Error('CORPUS_INVALID');
  } catch { observation = { outcome: 'error', code: 'harness_or_component_error' }; }
  return { id: fixture.id, surface: fixture.surface, class: fixture.class, label: fixture.label, scope: fixture.scope,
    utility: fixture.utility === true, ...observation, latencyMs: rounded(performance.now() - start) };
}

function metrics(rows) {
  const count = predicate => rows.filter(predicate).length;
  const conclusive = row => ['detected', 'clean'].includes(row.outcome);
  const tp = count(row => row.label === 'sensitive' && row.outcome === 'detected');
  const fn = count(row => row.label === 'sensitive' && row.outcome === 'clean');
  const fp = count(row => row.label === 'benign' && row.outcome === 'detected');
  const tn = count(row => row.label === 'benign' && row.outcome === 'clean');
  return { cases: rows.length, conclusive: count(conclusive), truePositives: tp, falseNegatives: fn, falsePositives: fp, trueNegatives: tn,
    unsupported: count(row => row.outcome === 'unsupported'), withheld: count(row => row.outcome === 'withheld'), errors: count(row => row.outcome === 'error'),
    falseNegativeRate: tp + fn ? fn / (tp + fn) : null, falsePositiveRate: tn + fp ? fp / (tn + fp) : null,
    conclusiveCoverage: rows.length ? count(conclusive) / rows.length : null };
}
function latency(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const percentile = fraction => ordered.length ? ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] : null;
  return { samples: ordered.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: percentile(1) };
}
function summarize(outcomes) {
  const supported = outcomes.filter(row => row.scope === 'supported');
  const utility = outcomes.filter(row => row.utility && row.scope === 'supported' && row.label === 'benign');
  const perClass = {};
  for (const key of [...new Set(outcomes.map(row => row.surface + '/' + row.class))].sort()) {
    const rows = outcomes.filter(row => row.surface + '/' + row.class === key);
    perClass[key] = { supported: metrics(rows.filter(row => row.scope === 'supported')),
      outsideContract: metrics(rows.filter(row => row.scope === 'outside-contract')),
      unsupportedInputs: metrics(rows.filter(row => row.scope === 'unsupported-input')) };
  }
  const complete = utility.filter(row => row.publicPreserved === true).length;
  return { supported: metrics(supported), outsideContract: metrics(outcomes.filter(row => row.scope === 'outside-contract')),
    unsupportedInputs: metrics(outcomes.filter(row => row.scope === 'unsupported-input')), perClass,
    publicWorkflowUtility: { scope: 'Exact public request/result preservation through in-process gateway or safe reader; no model task quality or human usability measurement',
      cases: utility.length, completed: complete, incomplete: utility.length - complete, completionRate: utility.length ? complete / utility.length : null } };
}

async function sourceBindings() {
  const files = [...new Set([__filename, ...Object.keys(require.cache)])].filter(file => file.startsWith(ROOT + path.sep)
    && !file.includes(path.sep + 'node_modules' + path.sep) && /\.(?:ts|cjs|mjs)$/.test(file)).sort();
  const bindings = {};
  for (const file of files) bindings[path.relative(ROOT, file).split(path.sep).join('/')] = sha(await fs.readFile(file));
  return bindings;
}

async function runEvaluation({ iterations = 3 } = {}) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 20) throw Error('ITERATIONS_INVALID');
  const bytes = await fs.readFile(CORPUS), corpus = JSON.parse(bytes), fixtures = materialize(corpus);
  const before = await sourceBindings();
  // Warm only a public fixture; every measured iteration still includes scanner/broker construction.
  await evaluateCase(fixtures.find(fixture => fixture.id === 'gateway-registered-public'));
  const outcomes = [], timing = {}, unstableCases = [];
  for (const fixture of fixtures) {
    const runs = [];
    for (let iteration = 0; iteration < iterations; iteration++) runs.push(await evaluateCase(fixture));
    const stable = runs.every(row => row.outcome === runs[0].outcome && row.code === runs[0].code
      && row.providerCalls === runs[0].providerCalls && row.publicPreserved === runs[0].publicPreserved);
    if (!stable) unstableCases.push(fixture.id);
    outcomes.push({ ...runs[0], stable, latency: latency(runs.map(row => row.latencyMs)) });
    (timing[fixture.surface] ??= []).push(...runs.map(row => row.latencyMs));
  }
  const after = await sourceBindings();
  const sourceChangedDuringRun = !isDeepStrictEqual(before, after);
  return { schemaVersion: 1, generatedAt: new Date().toISOString(),
    scope: 'Current first-party source; synthetic scanner, in-process broker, safe-reader state, and vendor artifact checks',
    independence: 'NOT INDEPENDENT: implementation and public synthetic corpus are maintained in this repository; no holdout claim',
    limitations: [
      'Small fixed corpus is not representative and does not establish real-world detection percentages or a market ranking.',
      'Injected provider response and in-memory HTTP streams exercise BrokerServer.handle, GatewayPolicy, parsing, matching and redaction without any network or native IDE.',
      'Concurrent writes, expiry and recipient changes are deterministic capture/approval seams, not filesystem race or native user trials.',
      'Vendor controls use synthetic bytes and an explicit fixture pin, plus rejection by production default pins; no installed vendor bundle or update is exercised.',
      'Vault-registered values are injected into production registration APIs; vault migration, SecretStorage and custody are not measured.',
      'Unsupported, withheld and error cases never count as true positives, including fail-closed size limits; outside-contract gaps remain listed separately.',
      'Latency includes construction and in-process handling, excludes module loading, network, model generation and native UI.',
      'No released artifact binding, independent review, containment guarantee, or release readiness is claimed.'
    ],
    corpus: { path: 'scripts/fixtures/soterai-security-eval.json', fileSha256: sha(bytes), materializedSha256: sha(JSON.stringify(fixtures)), cases: fixtures.length },
    execution: { iterations, node: process.version, platform: os.platform(), architecture: os.arch(), logicalCpuCount: os.cpus().length,
      networkUsed: false, nativeIdeUsed: false, provider: 'injected-public-response', sourceChangedDuringRun, unstableCases },
    sourceBindings: before, sourceBindingsSha256: sha(JSON.stringify(before)),
    ...summarize(outcomes), latencyBySurface: Object.fromEntries(Object.entries(timing).map(([surface, values]) => [surface, latency(values)])),
    outcomes, releaseReady: false };
}

function markdown(report) {
  const rows = Object.entries(report.perClass).map(([name, group]) => {
    const metric = group.supported;
    return `| ${name} | ${metric.cases} | ${metric.falseNegatives} | ${metric.falsePositives} | ${metric.withheld} | ${metric.unsupported} | ${metric.errors} |`;
  });
  return ['# SoterAI synthetic security evaluation', '', report.independence, '',
    `Corpus SHA-256: \`${report.corpus.fileSha256}\``, '',
    `Supported cases: ${report.supported.cases}; FN: ${report.supported.falseNegatives}; FP: ${report.supported.falsePositives}; withheld: ${report.supported.withheld}; unsupported: ${report.supported.unsupported}; errors: ${report.supported.errors}.`, '',
    `Outside-contract cases: ${report.outsideContract.cases}; observed misses: ${report.outsideContract.falseNegatives}. Unsupported-input cases: ${report.unsupportedInputs.cases}; withheld: ${report.unsupportedInputs.withheld}; unsupported: ${report.unsupportedInputs.unsupported}.`, '',
    `Public workflow preservation: ${report.publicWorkflowUtility.completed}/${report.publicWorkflowUtility.cases}. ${report.publicWorkflowUtility.scope}.`, '',
    '| Surface/class (supported cases only) | Cases | FN | FP | Withheld | Unsupported | Errors |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |', ...rows, '',
    '| Surface | Samples | p50 ms | p95 ms | Maximum ms |', '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.latencyBySurface).map(([surface, value]) => `| ${surface} | ${value.samples} | ${value.p50Ms} | ${value.p95Ms} | ${value.maxMs} |`), '',
    '## Observed misses, interventions on benign cases, and incomplete cases', '',
    ...report.outcomes.filter(row => row.label === 'sensitive' && row.outcome === 'clean' || row.label === 'benign' && row.outcome !== 'clean' || ['error', 'unsupported', 'withheld'].includes(row.outcome))
      .map(row => `- \`${row.id}\`: ${row.scope}; ${row.outcome}; ${row.code}.`), '',
    '## Limits', '', ...report.limitations.map(item => '- ' + item), '',
    `Source changed during execution: ${report.execution.sourceChangedDuringRun}. Unstable cases: ${report.execution.unstableCases.length}.`, ''].join('\n');
}

async function main(args) {
  let output, iterations = 3;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--out') output = args[++index];
    else if (args[index] === '--iterations') iterations = Number(args[++index]);
    else throw Error('ARGUMENT_INVALID');
  }
  if (!output) throw Error('OUTPUT_REQUIRED');
  const target = path.resolve(ROOT, output), relative = path.relative(ROOT, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('OUTPUT_OUTSIDE_WORKSPACE');
  // Refuse existing directories so prior evidence is never overwritten.
  await fs.mkdir(target);
  const report = await runEvaluation({ iterations });
  await fs.writeFile(path.join(target, 'security-evaluation.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(target, 'security-evaluation.md'), markdown(report), { flag: 'wx' });
  console.log(JSON.stringify({ corpusSha256: report.corpus.fileSha256, supported: report.supported, outsideContract: report.outsideContract,
    unsupportedInputs: report.unsupportedInputs, publicWorkflowUtility: report.publicWorkflowUtility, sourceChangedDuringRun: report.execution.sourceChangedDuringRun }));
  // Measurements are retained even when expected scope gaps occur. Unexpected
  // supported failures, unstable execution and harness errors fail automation.
  if (report.supported.falseNegatives || report.supported.falsePositives || report.supported.withheld || report.supported.unsupported
    || report.outcomes.some(row => row.outcome === 'error') || report.execution.sourceChangedDuringRun || report.execution.unstableCases.length) process.exitCode = 1;
}

module.exports = { materialize, evaluateCase, payloadContainsFixture, metrics, summarize, runEvaluation, markdown };
if (require.main === module) main(process.argv.slice(2)).catch(() => { console.error('Synthetic security evaluation unavailable; no exception content emitted.'); process.exitCode = 2; });
