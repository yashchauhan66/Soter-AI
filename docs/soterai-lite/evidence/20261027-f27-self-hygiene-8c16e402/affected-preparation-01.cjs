// Evidence preparation only. No child processes, package inspection, extraction,
// compilation, tests, native launch, or mutation of any existing file.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const own = name => path.join(__dirname, name);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
function sourceFile(relative) {
  assert(typeof relative === 'string' && !path.isAbsolute(relative));
  const file = path.resolve(repo, relative);
  assert(file.startsWith(repo + path.sep));
  assert(!path.relative(repo, file).split(path.sep).includes('..'));
  return file;
}
function fact(file) {
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular evidence file required.');
  const raw = fs.readFileSync(file);
  return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) };
}
const manifestFile = own('affected-preparation-source-provenance-01.json');
const manifest = read(manifestFile);
assert.equal(manifest.status, 'PREPARED_UNBOUND_NOT_EXECUTED');
assert.equal(manifest.native06, 'F26a_USER_DEFERRED_EXCLUDED_NOT_RUN');
assert.equal(manifest.families.length, 20);
assert.equal(manifest.families.reduce((total, row) => total + row.assertions, 0), 509);
assert.equal(manifest.families.reduce((total, row) => total + row.phases, 0), 37);
assert.equal(new Set(manifest.families.map(row => row.id)).size, 20);
assert(!manifest.families.some(row => /precommit|psreadline/i.test(row.id)), 'Only the accepted earlier 20 families.');
for (const row of manifest.sources) assert.deepEqual(fact(sourceFile(row.source.path)), row.source);

// Do all admission and rendering before the first write. A partial preparation is
// retained on I/O failure; reruns refuse every existing output and need new names.
const plans = [];
const rename = manifest.sources.filter(row => row.output).map(row => [path.basename(row.source.path), row.output]);
rename.push(['affected-native-binding-artifact-cleanup01.ps1', 'affected-preparation-binding-01.template.ps1']);
rename.push(['affected-native-binding-01.ps1', 'affected-preparation-binding-01.template.ps1']);
for (const row of manifest.sources.filter(row => row.output)) {
  assert(/^affected-preparation-[a-zA-Z0-9.-]+$/.test(row.output));
  assert(!/precommit/i.test(row.output));
  const original = fs.readFileSync(sourceFile(row.source.path));
  let raw = original;
  if (row.adapt === 'powershell-helper') {
    let text = original.toString('utf8');
    const gate = /if\('(?:__F26C_AFFECTED_BOUND__|F26A_CURRENT_FACTS_BOUND)' -cne 'F26A_CURRENT_FACTS_BOUND'\)\{throw '[^'\r\n]*'\}/g;
    const gates = [...text.matchAll(gate)];
    assert.equal(gates.length, 1, 'Exactly one accepted admission marker: ' + row.source.path);
    text = text.replace(gate, "if('__F27_AFFECTED_UNBOUND__' -cne 'F27_AFFECTED_CURRENT_FACTS_BOUND'){throw 'F27 affected helper is UNBOUND_NOT_EXECUTED; a new exact-object reviewed materialization is required.'}");
    for (const [from, to] of rename) text = text.replaceAll(from, to);
    // Names only: this is the new evidence extraction namespace, never an old
    // package path. No extraction is created by this utility.
    text = text.replaceAll('vsix-extracted-03', 'affected-preparation-vsix-extracted-01');
    text = text.replace("('vsix-extracted-'+$InspectionName+'/extension')", "('affected-preparation-vsix-extracted-'+$InspectionName+'/extension')");
    text = text.replace("[string]$InspectionName='03'", "[string]$InspectionName='01'");
    assert(text.includes("if('__F27_AFFECTED_UNBOUND__' -cne 'F27_AFFECTED_CURRENT_FACTS_BOUND')"));
    assert(!text.includes('affected-native-binding-01.ps1'));
    assert(!text.includes('affected-native-binding-artifact-cleanup01.ps1'));
    // Only the substitutions above are permitted. Record a new target hash and
    // keep the source hash so a later static diff can check the entire oracle.
    const timeouts = source => [...source.matchAll(/WaitForExit\([^)]*\)|(?:TotalSeconds|TotalMilliseconds)\s*-lt\s*\d+/g)].map(match => match[0]);
    assert.deepEqual(timeouts(text), timeouts(original.toString('utf8')));
    raw = Buffer.from(text, 'utf8');
  } else assert.equal(row.adapt, 'byte-copy');
  assert(!fs.existsSync(own(row.output)), 'Existing output refused: ' + row.output);
  plans.push({ row, raw });
}
const outputManifest = own('affected-preparation-materialization-01.json');
assert(!fs.existsSync(outputManifest), 'Existing materialization receipt refused.');
for (const plan of plans) fs.writeFileSync(own(plan.row.output), plan.raw, { flag: 'wx' });
fs.writeFileSync(outputManifest, JSON.stringify({
  status: 'PREPARED_UNBOUND_NOT_EXECUTED', observedAt: new Date().toISOString(),
  sourceManifest: fact(manifestFile), families: manifest.families,
  outputs: plans.map(plan => ({ source: plan.row.source, target: fact(own(plan.row.output)), adaptation: plan.row.adapt })),
  candidate: null, nativeResults: null, sourceAdmissionChange: 'NONE',
  native06: manifest.native06, signalsRequested: 0,
  scope: '20 accepted earlier families/509 assertions/37 phases plus functional10/security17; no prior native PASS transferred.'
}, null, 2) + '\n', { flag: 'wx' });
console.log('Prepared UNBOUND evidence templates only. No package, test, compilation, extraction, or native execution.');
