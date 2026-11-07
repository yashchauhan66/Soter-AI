'use strict';
// Preparation only. No native launch, product import, PID query or process signal.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const BASE = path.resolve(__dirname, '../../20261103-f32-lifecycle-2e95d6a4');
const own = name => path.join(BASE, name);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const source = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.resolve(file), bytes: raw.length, sha256: sha(raw) }; };
function one(text, before, after) {
  assert(text.includes(before) && text.indexOf(before) === text.lastIndexOf(before), 'Expected one exact source anchor: ' + before.slice(0, 90));
  return text.replace(before, after);
}
const previous08 = `
function verifyPreviousExtra08(a) {
  const p = a.previousExtra08; assert(p);
  assert.equal(p.admission.path, path.join(__dirname, 'installed-extra08-admission.json'));
  assert.equal(p.consumed.path, path.join(__dirname, 'installed-extra08-consumed.json'));
  for (const row of Object.values(p)) pin(row);
  const old = pinnedJson(p.admission), used = pinnedJson(p.consumed), failure = pinnedJson(p.failure);
  assert.equal(old.status, 'ROOT_REVIEWED_F32_INSTALLED_EXTRA08_FINAL_INPUTS');
  assert.equal(used.status, 'CONSUMED_ONE_EXPLICIT_EXTRA08_NO_RETRY');
  assert.deepEqual(used.admission, p.admission); assert.equal(used.runRoot, old.runRoot);
  assert.notEqual(a.runRoot.toLowerCase(), old.runRoot.toLowerCase());
  assert.deepEqual(old.currentVsix, a.currentVsix); assert.deepEqual(old.sourceProof, a.sourceProof);
  assert.equal(failure.status, 'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');
  verifyClose(p.codeClose);
  const helper = pinnedJson(p.listenerClose);
  for (const [key, expected] of Object.entries({actualClose:true,exitCode:1,signal:null,stdoutEOF:true,stderrEOF:true,signalsRequested:0,overflow:false,streamError:false,deadlineExceeded:false})) assert.equal(helper[key], expected);
  for (const stream of helper.streams) {
    assert.equal(stream.bytes, stream.observedBytes);
    pin({path:p.listenerClose.path.replace(/owned-close\\.json$/,stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256});
  }
  assert.equal(pinnedJson(p.trustBefore).isTrusted, false);
  const grant = pinnedJson(p.trustGrant);
  assert.equal(grant.isTrusted,true);assert.equal(grant.keyboardIntentPresent,false);assert.equal(grant.keyboardReceiptPresent,false);
  assert.equal(pinnedJson(p.observerFailure).stage, 'NATIVE_TRUST_HANDSHAKE');
}
`;
function buildSources() {
  const old = source(own('run-installed-lifecycle-proposed-08.cjs'));
  let runner = old;
  for (const [a,b] of [['extra08','extra09'],['EXTRA08','EXTRA09'],['PROPOSAL09','PROPOSAL10'],
    ['run-installed-lifecycle-proposed-08.cjs','run-installed-lifecycle-proposed-09.cjs'],
    ['native-owned-gui-phase-proposed-08.cjs','native-owned-gui-phase-proposed-09.cjs'],
    ['installed-owner-custody-proposed-06.ps1','installed-owner-custody-proposed-07.ps1'],
    ['installed-observer-proposed-07.cjs','installed-observer-proposed-08.cjs'],
    ['installed-upgrade-old-observer-proposed-06.cjs','installed-upgrade-old-observer-proposed-07.cjs'],
    ['installed-renderer-proposed-07.cjs','installed-renderer-proposed-08.cjs']]) runner = runner.replaceAll(a,b);
  runner = one(runner, 'function reviewedAdmission(admissionFile, expectedSha) {', previous08 + '\nfunction reviewedAdmission(admissionFile, expectedSha) {');
  assert.equal(runner.split('verifyPreviousExtra07(a);').length - 1, 2);
  runner = runner.replaceAll('verifyPreviousExtra07(a);', 'verifyPreviousExtra07(a); verifyPreviousExtra08(a);');
  runner = one(runner, '  async function native(b, install, trustChoice, upgrade) {', source(path.join(__dirname,'early-listener-runner-fragment.cjs.txt')) + '\n  async function native(b, install, trustChoice, upgrade) {');
  runner = one(runner, "    b.prelaunchOwnerAbsence = await initialAbsence(b, b.phase + '-prelaunch-absence');\n    stable();", "    b.prelaunchOwnerAbsence = await initialAbsence(b, b.phase + '-prelaunch-absence');\n    const prewarmed = await prewarmListener(b);\n    stable();");
  const begin = runner.indexOf("    const listener = await powershell(b, b.phase + '-listener-custody'");
  const end = runner.indexOf("    const brokerMonitor = b.phase === 'restart'", begin);
  assert(begin > 0 && end > begin);
  const fragment = '    const phaseBinding = write(b.listenerPhaseBindingPath, b);\n' + source(path.join(__dirname,'early-listener-native-fragment.cjs.txt'));
  runner = runner.slice(0,begin) + fragment + runner.slice(end);
  runner = one(runner, 'const pending = [accept(rendererPromise, rendererName, b), accept(codePromise, codeName, b)];', 'const pending = [accept(rendererPromise, rendererName, b), accept(codePromise, codeName, b), fullCustodyPromise];');
  runner = one(runner, '    b.ownerClose = settled[1].value.close;', '    const listener = settled[2].value; const custodyValue = pinnedJson(listener.output);\n    b.listenerCustody = listener.output;\n    b.ownerClose = settled[1].value.close;');
  runner = one(runner, '      brokerLifetime = settled[2].value.output;', '      brokerLifetime = settled[3].value.output;');
  runner = one(runner, 'observer: resultFact, renderer: renderedFact, codeClose: b.ownerClose, listenerCustody: listener.output,', 'observer: resultFact, renderer: renderedFact, codeClose: b.ownerClose, listenerCustody: listener.output,\n      earlyListenerCustody: early.fact, fullCustodyAcknowledgment: listener.acknowledgment,');
  runner = one(runner, 'module.exports = { verifySource,', 'module.exports = { verifyPreviousExtra08, verifySource,');
  const phases = text => text.slice(text.indexOf('    const primary = binding'), text.indexOf('    stable();\n    // No new human/admin gate.'));
  assert.equal(phases(runner), phases(old), 'All eight phases /44 unique/59 observations must remain verbatim');
  const ack = source(path.join(__dirname,'full-custody-observer-fragment.cjs.txt'));
  const addAck = file => one(source(own(file)), '  assert.deepEqual(receipt.observerResult, observerResult);', '  assert.deepEqual(receipt.observerResult, observerResult);\n' + ack);
  let renderer = source(own('installed-renderer-proposed-07.cjs'));
  renderer = one(renderer, "  assert.equal(custody.rootCodePid, b.codePid); assert.equal(custody.localAddress, '127.0.0.1');", "  assert.equal(custody.status, 'CURRENT_OWNED_EXACT_ROOT_LOOPBACK_LISTENER');\n  assert.equal(custody.owningProcess, b.codePid); assert.deepEqual(custody.codeProcessTreePids, [b.codePid]);\n  assert.equal(custody.exactCapturedArgumentsVerified, true); assert.equal(custody.executableHashesHeldReadOnly, true);\n  assert.equal(custody.rootCodePid, b.codePid); assert.equal(custody.localAddress, '127.0.0.1');");
  const start = renderer.indexOf('    const candidates = [];'), finish = renderer.indexOf("    const dialog = page.locator", start);
  assert(start > 0 && finish > start);
  renderer = renderer.slice(0,start) + `    const page = await until(async () => {
      const candidates = [];
      for (const candidate of browser.contexts().flatMap(context => context.pages())) {
        if (/^vscode-file:\\/\\/vscode-app\\//.test(candidate.url()) && (await candidate.title()).includes(path.basename(b.workspace))) candidates.push(candidate);
      }
      assert(candidates.length <= 1, 'Ambiguous owned workbench renderers');
      return candidates[0];
    }, 15000, 'Exact owned workbench renderer did not become ready');
    page.setDefaultTimeout(8000); await page.bringToFront();
` + renderer.slice(finish);
  let custody = source(own('installed-owner-custody-proposed-06.ps1'));
  const readerStart = custody.indexOf('function Read-F32CustodyBinding {'), readerEnd = custody.indexOf('\nfunction Get-F32CreationUtc',readerStart);
  assert(readerStart > 0 && readerEnd > readerStart);
  let reader = custody.slice(readerStart,readerEnd).replace('function Read-F32CustodyBinding {','function Read-F32EarlyCustodyBinding {');
  reader = one(reader, 'param([Parameter(Mandatory=$true)][string]$BindingPath)', 'param([Parameter(Mandatory=$true)][string]$BindingPath,$LockedInitial,$ExecutableLocks)');
  reader = one(reader, '    $taskMeasured=Get-F32ReadOnlyFact -LiteralPath $taskExe.path\n    if($taskMeasured.bytes -ne $taskExe.bytes -or $taskMeasured.sha256 -cne $taskExe.sha256){throw \'F32 admitted Code executable changed.\'}', `    if($null -eq $LockedInitial -or @($ExecutableLocks).Count -ne 2){throw 'F32 held prelaunch hash custody required.'}
    if($taskBinding.vendorReceipt.path -cne $LockedInitial.binding.vendorReceipt.path -or $taskBinding.vendorReceipt.sha256 -cne $LockedInitial.binding.vendorReceipt.sha256 -or $taskBinding.vendorReceipt.bytes -ne $LockedInitial.binding.vendorReceipt.bytes){throw 'F32 locked vendor observation mismatch.'}
    if($ExecutableLocks[0] -isnot [IO.FileStream] -or -not $ExecutableLocks[0].CanRead -or $ExecutableLocks[0].Length -ne $taskExe.bytes -or -not $ExecutableLocks[0].Name.Equals($taskExe.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 Code hash lock no longer held.'}`);
  reader = one(reader, "    $taskMeasuredPowerShell=Get-F32ReadOnlyFact -LiteralPath $taskPowerShell.path\n    if($taskMeasuredPowerShell.bytes -ne $taskPowerShell.bytes -or $taskMeasuredPowerShell.sha256 -cne $taskPowerShell.sha256){throw 'F32 admitted system PowerShell changed.'}", "    if($ExecutableLocks[1] -isnot [IO.FileStream] -or -not $ExecutableLocks[1].CanRead -or $ExecutableLocks[1].Length -ne $taskPowerShell.bytes -or -not $ExecutableLocks[1].Name.Equals($taskPowerShell.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 PowerShell hash lock no longer held.'}");
  custody += '\n' + reader + '\n' + source(path.join(__dirname,'early-listener-additions.ps1'));
  const gui = source(own('native-owned-gui-phase-proposed-08.cjs')).replaceAll('EXTRA08','EXTRA09').replaceAll('PROPOSAL09','PROPOSAL10');
  const result = {
    'run-installed-lifecycle-proposed-09.cjs':runner,
    'native-owned-gui-phase-proposed-09.cjs':gui,
    'installed-owner-custody-proposed-07.ps1':custody,
    'installed-observer-proposed-08.cjs':addAck('installed-observer-proposed-07.cjs'),
    'installed-upgrade-old-observer-proposed-07.cjs':addAck('installed-upgrade-old-observer-proposed-06.cjs'),
    'installed-renderer-proposed-08.cjs':renderer,
  };
  for (const [name,text] of Object.entries(result)) if(name.endsWith('.cjs')) new vm.Script(text,{filename:name});
  return result;
}
function prepare() {
  const old = read(own('installed-extra08-admission.json'));
  // The old admission is consumed: its fresh-root admission check must not be
  // replayed against its preserved run. Validate its fixed inputs directly.
  for(const row of [old.sourceProof,old.fullAcceptance,old.currentVsix,old.vendorReceipt,...Object.values(old.fixtures)])assert.deepEqual(fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});
  const previousRunner=require(old.fixtures.runner.path);
  previousRunner.verifySource(read(old.sourceProof.path),old.sourceParent);previousRunner.verifyExtraApproval(old);
  const generated = new Map(Object.entries(buildSources()).map(([name,text])=>[name,Buffer.from(text)]));
  const add = (name,value) => { assert(!generated.has(name)); generated.set(name,Buffer.from(JSON.stringify(value,null,2)+'\n')); return future(name); };
  const future = name => { const raw=generated.get(name);assert(raw);return{path:own(name),bytes:raw.length,sha256:sha(raw)}; };
  const a=structuredClone(old);
  a.status='ROOT_REVIEWED_F32_INSTALLED_EXTRA09_FINAL_INPUTS';a.extraAttempt='PROPOSAL10';
  a.runRoot='D:\\SoterAI-Lite-test-profiles\\f32-installed-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'-'+crypto.randomBytes(4).toString('hex');
  assert(!fs.existsSync(a.runRoot));a.debugPorts=[54831,54832,54833,54834,54835,54836,54837,54838];a.configuredBrokerPort=54839;
  for(const [key,name]of Object.entries({runner:'run-installed-lifecycle-proposed-09.cjs',guiHelper:'native-owned-gui-phase-proposed-09.cjs',custody:'installed-owner-custody-proposed-07.ps1',observer:'installed-observer-proposed-08.cjs',oldObserver:'installed-upgrade-old-observer-proposed-07.cjs',renderer:'installed-renderer-proposed-08.cjs'}))a.fixtures[key]=future(name);
  const gate=path.join(old.runRoot,'profile-primary','F32Gate','primary');
  a.previousExtra08=Object.fromEntries(Object.entries({admission:own('installed-extra08-admission.json'),consumed:own('installed-extra08-consumed.json'),failure:path.join(old.runRoot,'receipts','installed-extra08-failure.json'),codeClose:path.join(gate,'primary-code-owned-close.json'),listenerClose:path.join(gate,'primary-listener-custody-owned-close.json'),trustBefore:path.join(gate,'primary-trust-before.json'),trustGrant:path.join(gate,'primary-trust-grant-observation.json'),observerFailure:path.join(gate,'primary-observer-failure.json')}).map(([key,file])=>[key,fact(file)]));
  const proposal='CURRENT-CANDIDATE-VERIFICATION-PROPOSAL10.md';
  generated.set(proposal,Buffer.from('# F32 early attach successor\n\nThe established fix is earlier owned renderer observation, not a claim about the unknown trust trigger. A prewarmed owned helper locks and hashes executables before launch, verifies the actual root PID/creation/executable/exact args/numeric loopback listener before attach, then completes the original full-tree custody. Success waits for that helper\'s exit0/both EOF acknowledgment. The original44 unique/59 observations/eight phases and real trust keyboard assertions remain required. Failed extra08 facts are pinned unchanged. Standing user approval covers local isolated checks; preparation launches nothing.\n'));
  a.extraApproval=add('installed-extra09-user-approval.json',{feature:'F32',status:'USER_APPROVED_REMAINING_WORK_AND_ISOLATED_LOCAL_TESTS',extraAttempt:'PROPOSAL10',approved:true,maxAttempts:1,syntheticOnly:true,signalsRequested:0,runRoot:a.runRoot,userAnswer:'continue complete remaninig work very fast | Haan, local tests aur isolated VS Code checks approve hain',authorityScope:'Standing explicit local test authorization; no additional approval requested.',proposal:future(proposal),runner:a.fixtures.runner,sourceProof:a.sourceProof,currentVsix:a.currentVsix});
  const admission=add('installed-extra09-admission.json',a);
  for(const name of generated.keys())assert(!fs.existsSync(own(name)),'Never overwrite prior evidence: '+name);
  for(const [name,raw]of generated)fs.writeFileSync(own(name),raw,{flag:'wx'});
  const runner=require(a.fixtures.runner.path);runner.reviewedAdmission(admission.path,admission.sha256);runner.verifyExtraApproval(a);
  const result={status:'PASS_STATIC_EARLY_ATTACH_ADMISSION_NATIVE_NOT_RUN',admission,runRoot:a.runRoot,currentVsix:a.currentVsix,generated:[...generated.keys()].map(name=>fact(own(name))),nativeLaunches:0,signalsRequested:0};
  fs.writeFileSync(path.join(__dirname,'early-attach-preparation-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
if(require.main===module)process.stdout.write(JSON.stringify(prepare(),null,2)+'\n');
module.exports={buildSources,prepare,one};
