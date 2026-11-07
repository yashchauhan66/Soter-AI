'use strict';
// Hash-checked evidence mapping. Candidate linkage never confers applicability.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..'), ts = require(path.join(root, 'node_modules/typescript'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fact = p => { const b = fs.readFileSync(p); return { path: path.relative(root, p).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; };
const pin = f => { const p = path.resolve(root, f.path), a = fact(p); assert.equal(a.bytes, f.bytes); assert.equal(a.sha256, f.sha256); return p; };
assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--binding'); const bf = path.resolve(process.argv[3]); assert.equal(fact(bf).sha256, process.argv[4]);
const binding = json(bf), qualifier = json(pin(binding.qualification)), proof = json(pin(binding.sourceProof)), full = json(pin(binding.fullAcceptance));
assert.equal(qualifier.sourceProofSha256, binding.sourceProof.sha256); assert.equal(full.sourceProofSha256, binding.sourceProof.sha256); assert.equal(qualifier.fullAcceptanceSha256, binding.fullAcceptance.sha256); pin(qualifier.vsix);
const passed = [], shardFacts = [];
for (const shard of full.shards) {
  const rawPath = path.join(path.dirname(binding.fullAcceptance.path), shard.name + '-stdout.bin'), close = json(path.join(path.dirname(rawPath), shard.name + '-owned-close.json')), f = fact(rawPath), stream = close.streams.find(s => s.name === 'stdout');
  assert(close.actualClose && close.stdoutEOF && close.stderrEOF); assert.equal(close.exitCode, 0); assert.equal(stream.bytes, f.bytes); assert.equal(stream.sha256, f.sha256); shardFacts.push(f);
  for (const match of fs.readFileSync(rawPath, 'utf8').matchAll(/^[ \t]*ok \d+ - (.+)\r?$/gm)) if (!/\s#\s*(?:SKIP|TODO)\b/i.test(match[1])) passed.push({ title: match[1].trim(), shard: shardFacts.length - 1 });
}
const passedTitles = new Map(passed.map((p, i) => [p.title, i])), sourceTests = [];
for (const f of proof.files.filter(f => /packages\/vscode-extension\/src\/__tests__\/.*\.test\.ts$/.test(f.path))) {
  const p = pin(f), text = fs.readFileSync(p, 'utf8'), ast = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true), titles = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length && (ts.isStringLiteralLike(node.arguments[0]))) {
      const name = node.expression.getText(ast), title = node.arguments[0].text;
      if (/^(?:test|it)(?:\.(?:only|skip|todo))?$/.test(name) && passedTitles.has(title)) {
        const calls = []; function assertions(n) { if (ts.isCallExpression(n) && /^assert(?:\.|$)/.test(n.expression.getText(ast))) calls.push(n.expression.getText(ast)); ts.forEachChild(n, assertions); } assertions(node);
        titles.push({ title, passedRef: passedTitles.get(title), line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, assertionCount: calls.length });
      }
    } ts.forEachChild(node, visit);
  } visit(ast); if (titles.length) sourceTests.push({ source: f, titles });
}
const historicPath = path.join(root, 'docs/soterai-lite/evidence/20261104-final-gate-readiness/affected-acceptance-current-01.json'), historic = json(historicPath); pin(historic.vsix);
const astByPass = new Map();
sourceTests.forEach((source, sourceRef) => source.titles.forEach((t, titleRef) => { const rows = astByPass.get(t.passedRef) || []; rows.push({ sourceRef, titleRef }); astByPass.set(t.passedRef, rows); }));
const nativeCandidates = [], historicalRaw = [];
for (const family of historic.families) for (const phase of family.phases) {
  const raw = json(pin(phase.result)); assert.equal(raw.failed, 0); assert.equal(raw.notRun, 0); assert.equal(raw.passed, phase.checks); assert.equal(raw.extensionBundleSha256, historic.frontendSha256); historicalRaw.push(phase.result);
  for (const o of raw.observations) { assert.equal(o.status, 'PASS'); nativeCandidates.push({ id: o.id, scope: o.scope, family: family.id, phase: phase.phase, raw: historicalRaw.length - 1 }); }
}
assert.equal(nativeCandidates.length, 509);
const terms = [
 'restriction|persist|saved|queued|serializ', 'glob|folder|descendant|pattern', 'consent|sensitive|dotenv|mask', 'consent|replay|expir|recipient|one.time', 'vendor|cline|claude|codex|gemini|attachment|context', 'region|digest|selection|bounds', 'canonical|alias|hardlink|junction|symlink|root|traversal', 'snapshot|publication|export|artifact',
 'checked|powershell|cmd|bash|cop(?:y|ies)|read', 'environment|dump|enumerat', 'inherit|environment|launch|child', 'interpreter|chain|parse|grammar|unsupported', 'stream|split|ansi|chunk|output', 'base64|hex|encod|representation', 'vault|inject|selected.app', 'profile|coexisten|rollback|restore|lifecycle',
 'json|message|request|split', 'gzip|brotli|deflate|decoder', 'chunk|ndjson|sse|fram', 'multipart|binary|blob|base64', 'entropy|detector|provider|pattern|registered', 'fail.closed|budget|limit|outage|refus', 'identity|header|url|window|owner', 'self.check|verify|route|canary',
 'git|diff|show|log|history', 'history|historical|scan', 'pre.?commit|pre.?push|hook|staged', 'psreadline|command.history|history.profile', 'custom.document|text.document|original.document|private.editor', 'reveal|recover|undo|save|vault', 'sharing|clipboard|selection|region', 'accessib|consent|dashboard|protection.center|truthful',
 'source|hardcod|scanner|credential', 'docker|container|kubernetes', 'terraform|tfvars', 'registry|npmrc|pypirc', 'service.account|private.key|credential|pem', 'ci|workflow|launch|tasks|settings|mcp.config', 'artifact|source.map|build|copy', 'version|team.policy|drift|downgrade|migration',
 'debug|structured|output|owned.log', 'log|test.output|exposure|scan', 'diagnostic|telemetry|hygiene|broker|mcp', 'package|sbom|lifecycle|restore|onboarding|readiness'
]; assert.equal(terms.length, 44);
const catalogPath = path.join(root, 'docs/soterai-lite/LITE-CATALOG.json'), catalog = json(catalogPath);
const mutationFact = fact(path.join(__dirname, 'component-mutation-witness-01.json')), witness = json(pin(mutationFact)); assert.equal(witness.artifact.sha256, qualifier.vsix.sha256);
const vendorPinFact = fact(path.join(__dirname, '../f32-review/vendor-pins-observation-02.json')), vendors = json(vendorPinFact.path);
const inventoryRoute = { clineIde: 'cline', claudeIde: 'claude', claudeCli: 'claude', geminiCli: 'gemini' };
const exact = (title, id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])').test(title);
const classify = title => ({ publicControlCandidate: /public|useful|safe|clean|success|allow|persist|surviv/i.test(title), negativeControlCandidate: /den(?:y|ied)|withh|reject|refus|cancel|fail|drift|secret|sensitive|mask|redact|restrict/i.test(title), withdrawalCandidate: /withdraw|disabl|flag.off|flag.*false|revoke/i.test(title) });
const rows = catalog.checks.map((check, i) => {
  const topic = new RegExp(terms[i], 'i'), family = new RegExp('(?:^|[^A-Za-z0-9])(?:' + check.featureCards.join('|') + ')(?:[A-Zabc]?[-:]|\\b)', 'i');
  const ids = [check.automatedTestId, ...(check.linkedTestIds || [])];
  const explicit = passed.map((p, index) => ({ p, index })).filter(x => ids.some(id => exact(x.p.title, id))).map(x => x.index);
  const candidates = passed.map((p, index) => ({ p, index, ast: astByPass.get(index) || [] })).filter(x => family.test(x.p.title) && (topic.test(x.p.title) || x.ast.some(a => topic.test(sourceTests[a.sourceRef].source.path)))).map(x => ({ passedRef: x.index, staticAst: x.ast, ...classify(x.p.title) }));
  const native = nativeCandidates.map((p, index) => ({ p, index })).filter(x => family.test(x.p.id || '') && topic.test(x.p.scope || '')).map(x => ({ historicalRef: x.index, ...classify(x.p.scope || '') }));
  return { id: check.id, title: check.title, scenario: check.scenario, assumedAIBehavior: check.assumedAIBehavior, featureCards: check.featureCards,
    acceptanceTestId: check.automatedTestId, expectedControls: check.controlExpectations, exactDeclaredTestLinks: explicit,
    missingDeclaredTestIds: ids.filter(id => !passed.some(p => exact(p.title, id))),
    candidateSelection: { featurePrefixRequired: true, topicPattern: terms[i], topicMayMatch: 'PASSED_TITLE_OR_ITS_EXACT_STATIC_AST_SOURCE_PATH', interpretation: 'Lexical discovery candidates, not semantic verification. Inspect AST source assertions and exact raw receipt scope before accepting each control. Zero discovered candidates does not prove a component was untested.' },
    currentComponentCandidates: candidates, historicalNativeCandidates: native,
    controls: { positive: 'UNVERIFIED_PER_ROW_AND_TOOL', negative: 'UNVERIFIED_PER_ROW_AND_TOOL', leakOracle: ['LS-13', 'LS-14', 'LS-17'].includes(check.id) ? { witness: mutationFact, status: 'COMPONENT_SUBCLAIM_ORACLE_SENSITIVE_TEST_ONLY_MUTANT', fullRowCoverage: false } : { status: 'UNVERIFIED_ROW_SPECIFIC' } },
    mutation: { actualFeatureFlag: 'UNVERIFIED_PER_ROW', defaultClassification: 'AVAILABILITY_ONLY_UNLESS_PREVENTION_SENSITIVITY_PROVEN', prescribedExpectation: check.controlExpectations.mutation, testOnlyWitness: ['LS-13', 'LS-14', 'LS-17'].includes(check.id) ? mutationFact : null, strongEligible: false },
    tools: catalog.tools.map(tool => { const observation = vendors.results.find(r => r.route === inventoryRoute[tool.id]); return { toolId: tool.id, candidateVersion: tool.pinnedVersion || tool.version || null, applicability: check.applicability[tool.id], status: 'UNVERIFIED', currentActualRoute: null, currentPublicControl: null, currentNegativeControl: null, currentMutation: null, retainedVendorBytes: observation ? { evidence: vendorPinFact, selectedVersion: observation.version, status: observation.status, versionMatchesCatalog: observation.version === (tool.pinnedVersion || tool.version), meansCurrentRoute: false } : null }; }),
    evidenceLevel: 'MAPPING_EXECUTED_NO_CATALOG_ACCEPTANCE', remaining: ['Semantically assess each positive/negative assertion against the full row scenario', 'Execute exact actual tool route and supported version with canary oracle', 'Determine applicability with evidence, never inventory alone', 'Classify actual feature withdrawal versus prevention-sensitive dependency', 'Preserve platform/symlink/human limitations'] };
});
assert.equal(rows.length, 44); assert.equal(rows.flatMap(r => r.tools).length, 264); for (const row of rows) for (const t of row.tools) assert.equal(t.status, 'UNVERIFIED');
const result = { status: 'PASS_ALL44_CONTROL_APPLICABILITY_MUTATION_MAPPING_NO_PAIR_PROMOTION', observedAt: new Date().toISOString(), qualification: binding.qualification, sourceProof: binding.sourceProof, fullAcceptance: binding.fullAcceptance, fullSuiteExecution: qualifier.fullSuiteExecution, artifact: qualifier.vsix, catalog: fact(catalogPath), script: fact(__filename), rows,
  currentComponentCorpus: { shardFacts, passed, sourceTests, staticTitlesResolved: sourceTests.reduce((n, f) => n + f.titles.length, 0), limitation: 'Static literal test names only; dynamic parameterized names remain in raw TAP corpus without guessed AST source identity.' },
  historicalNativeCorpus: { acceptance: fact(historicPath), artifact: historic.vsix, currentArtifactAcceptance: false, raw: historicalRaw, checks: nativeCandidates, closureMeaning: 'Historical acceptance and result bytes rehashed; this mapping did not execute native checks or create new closure evidence.' },
  executedMutationWitness: mutationFact, vendorInventory: vendorPinFact,
  counts: { rows: 44, pairs: 264, rowsWithCurrentComponentCandidates: rows.filter(r => r.currentComponentCandidates.length).length, rowsWithHistoricalNativeCandidates: rows.filter(r => r.historicalNativeCandidates.length).length, explicitCatalogTitleRows: rows.filter(r => r.exactDeclaredTestLinks.length).length, preventionOracleComponentSubclaims: 3, promotedPairs: 0 },
  releaseReady: false, finalRating: null, independence: 'LOW_BUILDER', nativeLaunches: 0, modelCalls: 0, networkRequests: 0 };
const out = path.join(__dirname, 'catalog-controls-current-02.json'); fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, result: fact(out), counts: result.counts, staticTitlesResolved: result.currentComponentCorpus.staticTitlesResolved, historicalAssertionsRehashed: nativeCandidates.length }));
