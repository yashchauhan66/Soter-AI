'use strict';
// Evidence-only authoring: no checkpoint/Git/admission/native/network execution.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const own = name => path.join(__dirname, name), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const previous = own('scoped-f31b-source-checkpoint-02.cjs');
assert.equal(sha(fs.readFileSync(previous)), '4631289401c064c006f6b21a002f31c05c196cc40d0e00371c5a417a0429170c');
let source = fs.readFileSync(previous, 'utf8');
function change(before, after) { assert.equal(source.split(before).length, 2, before); source = source.replace(before, () => after); }
change("const prefix = 'scoped-f31b-source-checkpoint-02';", "const prefix = 'scoped-f31b-source-checkpoint-03';");
change("const hooks = own('empty-f31b-source-checkpoint-hooks-01');", "const hooks = own('empty-f31b-source-checkpoint-hooks-03');");
const moduleName = 'scoped-f31b-source-checkpoint-03-admission.cjs', moduleRaw = fs.readFileSync(own(moduleName)), moduleSha = sha(moduleRaw);
new vm.Script(moduleRaw.toString('utf8'), { filename: moduleName });
change("const C = require('./current-native-admission-06.cjs'), binding = C.binding();",
    "const C = require('./current-native-admission-06.cjs');\n    assert.equal(sha(fs.readFileSync(own('" + moduleName + "'))), '" + moduleSha + "');\n    const binding = require('./" + moduleName + "').recordedBinding();");
change("return { sourceScope: s, binding, acceptance, content,", "return { sourceScope: s, binding, acceptance, content,\n        vendorDrift: { observation: fact(relative(own('vendor-drift-observation-01.json'))),\n            testedBindingImmutable: true, postTestEdgeChanged: true, currentEdgeTestClaim: false,\n            futureNativeAdmission: 'CLOSED_PENDING_SEPARATE_REVIEW_NO_RUN_AUTHORITY',\n            checkpointOnly: 'Preserves previously accepted evidence; does not test or re-admit changed vendor bytes.' },");
change("'affected-chain-result-03.json', 'post-owner-absence-01.json'].map(name => fact(relative(own(name)))) };",
    "'affected-chain-result-03.json', 'post-owner-absence-01.json', 'vendor-drift-observation-01.json',\n            'vendor-drift-observation-01.txt', 'vendor-drift-observation-01.txt.result.json',\n            '" + moduleName + "'].map(name => fact(relative(own(name)))) };");
change("+ 'F31b remains INCOMPLETE pending advisory and human/final gates; no DONE or nextF32 transition. '",
    "+ 'Accepted native receipts bind the recorded tested vendor files. Edge changed after those tests; current Edge is NOT tested and future current-host admission stays closed pending separate review. No vendor pin refresh or new launch. '\n    + 'F31b remains INCOMPLETE pending advisory and human/final gates; no DONE or nextF32 transition. '");
change("vsix: state.binding.vsix, gates: state.gates, body: bodyName, files,",
    "vsix: state.binding.vsix, gates: state.gates, vendorDrift: state.vendorDrift, body: bodyName, files,");
change("assert.deepEqual(m.gates, state.gates); pin(m.sourceScope); m.frozenEvidenceScope.forEach(same);",
    "assert.deepEqual(m.gates, state.gates); assert.deepEqual(m.vendorDrift, state.vendorDrift); pin(m.sourceScope); m.frozenEvidenceScope.forEach(same);");
change("historicalOuter84707: m.historicalOuter84707, retainedF26aSourceExcluded: m.retainedF26aSourceExcluded,",
    "historicalOuter84707: m.historicalOuter84707, vendorDrift: m.vendorDrift, retainedF26aSourceExcluded: m.retainedF26aSourceExcluded,");
change("// AUTHORING ONLY: neither mode was executed when this helper was prepared.",
    "// AUTHORING ONLY: neither mode was executed when this helper was prepared.\n// Successor03 preserves source/evidence/Git guards; records post-test vendor drift without future-native admission.");
assert(!source.includes('C.binding()'));
assert.equal(source.split("const prefix = 'scoped-f31b-source-checkpoint-03';").length, 2);
new vm.Script(source, { filename: 'scoped-f31b-source-checkpoint-03.cjs' });
const target = own('scoped-f31b-source-checkpoint-03.cjs'); fs.writeFileSync(target, source, { flag: 'wx' });
const report = { status: 'AUTHORED_CHECKPOINT03_NO_PREPARE_COMMIT_GIT_NATIVE_EXECUTION', observedAt: new Date().toISOString(),
    previous: { name: path.basename(previous), sha256: sha(fs.readFileSync(previous)) },
    helper: { name: path.basename(target), bytes: Buffer.byteLength(source), sha256: sha(Buffer.from(source)) },
    admission: { name: moduleName, bytes: moduleRaw.length, sha256: moduleSha },
    syntaxOnly: 'Two vm.Script parses; neither helper nor admission function executed.',
    parent: '0affcdd0a46ff0e5d6921b69356303b7dd6d22b4', sourceCount: 18, featureComplete: false, nextFeatureSelected: false,
    nativeAdmission: 'CLOSED_FOR_CHANGED_EDGE_VENDOR_BYTES', freezeCondition: 'Root waits until all detail/evidence writers close; helper then requires stable snapshots and accepted closure evidence.',
    rationale: 'Retaining already accepted evidence in a local INCOMPLETE checkpoint does not launch or test the updated vendor. Historical tested binding and drift remain separate immutable facts.' };
fs.writeFileSync(own('scoped-f31b-source-checkpoint-03-authoring.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
