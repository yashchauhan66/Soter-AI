'use strict';
// Inert evidence-only successor authoring, no native/API/CLI/network action.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function file(n){return path.join(__dirname,n)}
function replace(text,before,after){assert.equal(text.split(before).length-1,1,before);return text.replace(before,()=>after)}
const diagnostics=String.raw`let observedStage = 'PRELUDE';
function safeDiagnostic(error) {
  const result = { stage: observedStage };
  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack.slice(0,8192) : '';
  const match = stack.match(/(?:observer\.cjs|installed-(?:upgrade-old-)?observer-proposed-0[1-9]\.cjs):([0-9]{1,6}):([0-9]{1,5})/);
  if (match) { result.sourceLine = Number(match[1]); result.sourceColumn = Number(match[2]); }
  return result;
}
async function awaitReviewedTrust(b) {
  observedStage = 'NATIVE_TRUST_HANDSHAKE';
  const expected = b.trustChoice !== "No, I don't trust the authors";
  if (b.trustChoice) {
    const target = path.join(b.gate,b.phase+'-trust-choice.json');
    const actual = await until(()=>fs.existsSync(target)&&read(target),90000,'Real native trust keyboard receipt missing');
    assert.equal(actual.status,'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE');
    assert.equal(actual.choice,b.trustChoice); assert.equal(actual.workspaceName,path.basename(b.workspace));
    assert.equal(actual.signalsRequested,0);
  }
  await until(()=>vscode.workspace.isTrusted===expected,90000,'Native workspace trust state has not settled');
}
`;
let current=fs.readFileSync(file('installed-observer-proposed-03.cjs'),'utf8');
current=replace(current,"const FIXED = {",diagnostics+'const FIXED = {');
current=replace(current,"errorName: error instanceof Error ? error.name : 'UnknownFailure',","errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error),");
current=replace(current,"    await body(); rows.push({ id, title, status: 'PASS' });","    observedStage=id; await body(); rows.push({ id, title, status: 'PASS' });");
current=replace(current,"  const product = getProduct();","  const product = getProduct();\n  if (b.phase !== 'disabled' && b.phase !== 'uninstalled') await awaitReviewedTrust(b);");
fs.writeFileSync(file('installed-observer-proposed-04.cjs'),current,{flag:'wx'});
let old=fs.readFileSync(file('installed-upgrade-old-observer-proposed-02.cjs'),'utf8');
old=replace(old,'exports.activate = context => {',diagnostics+'exports.activate = context => {');
old=replace(old,"errorName: error instanceof Error ? error.name : 'UnknownFailure', signalsRequested: 0,","errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error), signalsRequested: 0,");
old=replace(old,"assert.equal(vscode.env.remoteName, undefined); assert.equal(vscode.workspace.isTrusted, true);","assert.equal(vscode.env.remoteName, undefined); await awaitReviewedTrust(b); assert.equal(vscode.workspace.isTrusted, true);");
old=replace(old,"const check = async (id, title, action) => { await action(); observations.push({ id, title, status: 'PASS' }); };","const check = async (id, title, action) => { observedStage=id; await action(); observations.push({ id, title, status: 'PASS' }); };");
fs.writeFileSync(file('installed-upgrade-old-observer-proposed-03.cjs'),old,{flag:'wx'});
let renderer=fs.readFileSync(file('installed-renderer-proposed-02.cjs'),'utf8');
renderer=replace(renderer,"      observations.push({ kind: 'native-initial-trust', choice: b.trustChoice });","      observations.push({ kind: 'native-initial-trust', choice: b.trustChoice });\n      write(path.join(b.gate,b.phase+'-trust-choice.json'), {status:'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE',choice:b.trustChoice,workspaceName:path.basename(b.workspace),signalsRequested:0});");
fs.writeFileSync(file('installed-renderer-proposed-03.cjs'),renderer,{flag:'wx'});
