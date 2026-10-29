'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const own = name => path.join(__dirname, name);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => {
  const bytes = fs.readFileSync(file);
  return {path: path.relative(repo, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes)};
};
const source = 'D:\\SoterAI-Lite-test-profiles\\f26b-vscode-update-recovery-20261029-01';
const destination = own('vscode-update-recovery-evidence-01');
fs.mkdirSync(destination);
const copied = [];
for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
  assert(entry.isFile() && !entry.isSymbolicLink() && /^[a-z0-9-]+\.json$/.test(entry.name));
  const from = path.join(source, entry.name);
  const to = path.join(destination, entry.name);
  fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  assert.equal(sha(fs.readFileSync(from)), sha(fs.readFileSync(to)));
  copied.push(fact(to));
}
const content = read(own('content-inspection-03.json'));
assert.deepEqual(content.full, {tests: 4750, pass: 4746, fail: 0, cancelled: 0, skipped: 4});
const outer = read(own('native-component-04-owned-close.json'));
assert(outer.actualClose && outer.stdoutEOF && outer.stderrEOF);
assert.equal(outer.exitCode, 1);
assert.equal(outer.signalsRequested, 0);
const primaryPath = own('f26b-prepush-native-20261029T131104Z-610a0d25/primary-owned-editor-close.json');
const primary = read(primaryPath);
assert(primary.observedExit && primary.stdoutEOF && primary.stderrEOF);
assert.equal(primary.exitCode, 1);
assert.equal(primary.signalsRequested, 0);
const stderrPath = own('f26b-prepush-native-20261029T131104Z-610a0d25/primary-stderr.txt');
assert(fs.readFileSync(stderrPath, 'utf8').includes('Code is currently being updated'));
const cleanup = [1, 2, 3].map(n => read(path.join(destination, `cache-cleanup-result-0${n}.json`)));
assert(cleanup.every(row => row.signalsRequested === 0));
const update = read(path.join(destination, 'installer-after-retry-04.json'));
assert.equal(update.productVersion, '1.143.1');
assert.equal(update.newCodeExists, true);
assert.equal(update.windows.length, 0);
const record = {
  status: 'F26B_NATIVE36_NOT_RUN_UPDATER_STARTUP_FAILURE_OFFICIAL_UPDATE_STAGED_NOT_APPLIED',
  observedAt: new Date().toISOString(),
  feature: 'F26b', featureState: 'ACTIVE_INCOMPLETE', releaseReady: false,
  previous: fact(own('progress-04.json')),
  sourceProof: fact(own('full-inputs-03.json')),
  full: content.full, vsix: content.vsix,
  nativeAttempt: {
    consumed: true, assertions: 36, pass: 0, fail: 0, notRun: 36,
    reason: 'Actual Code exited1 before extension activation: existing vscode-updating mutex held; installer disk-full dialog later observed.',
    primaryClose: fact(primaryPath), outerClose: fact(own('native-component-04-owned-close.json')),
    rawStderr: fact(stderrPath), primaryPid: primary.pid,
    actualCloseAndBothEOF: true, signalsRequested: 0,
    pidAbsentTwice: primary.pidAbsentTwice, streamsStable: primary.streamsStable,
    automaticNativeRetry: false
  },
  update: {
    request: 'tum hi update kro mujha mera vscode me update ka option show nhi ho rha hai',
    replyId: 'call_32cf7657e4a14763922686868049f4e0',
    scope: 'Official VS Code application update; existing installer only. No process killing, normal-profile extension installation/settings, unrelated OS changes, Git push or F26a native09 authorization.',
    installerSignature: 'Valid Microsoft Corporation; exact SHA retained in installer-retry-action receipts',
    newInstallerStarted: false, newDownload: false,
    oldInstalledVersion: update.productVersion, stagedTargetVersion: '1.144.0',
    lastObservation: fact(path.join(destination, 'installer-after-retry-04.json')),
    state: 'NEW_CODE_STAGED_INSTALLERS_STILL_PRESENT_NOT_APPLIED_NOT_ACCEPTED',
    cleanupDeletedFiles: cleanup.reduce((n, row) => n + row.deletedFiles, 0),
    cleanupDeclaredBytes: cleanup.reduce((n, row) => n + row.deletedDeclaredBytes, 0),
    lastObservedFreeBytes: update.freeBytes,
    preserved: 'Project/evidence, installed extensions, settings, named extension caches, current installer and vendor files',
    failedDiagnostic: 'Sandbox CIM denied; escalated query succeeded but C: evidence write failed disk-full. Existing empty vscode-update-diagnostic-01.json retained; not a valid JSON receipt.',
    evidence: copied
  },
  f26aNative09: 'USER_DEFERRED_NOT_RUN', configuredGitPush: 'NOT_AUTHORIZED_NOT_RUN',
  remaining: ['Finish and verify requested official Code update', 'Review installed vendor changes; fresh native binding before one bounded next attempt', 'Actual native36, affected509 +functional10/security17 and safe withdrawal', 'Concrete configured local synthetic push permission and execution', 'Scoped feature acceptance/commits and exact byte verification'],
  originalL6: 'HUMAN_ACTIONS_THEN_STOP', rating: 'NOT_ISSUED'
};
fs.writeFileSync(own('progress-05.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
const receipt = '\n\n## STEP RECEIPT F26b-UPDATER-STARTUP-FAILURE / native36 NOT_RUN; requested official update staged, not applied\n\n'
  + fact(own('progress-05.json')).path + ' sha' + fact(own('progress-05.json')).sha256
  + '. First native component04 consumed; actual Code7288 natural1/bothEOF and outer2552 natural1/bothEOF/zero signals/deadlines. Existing vscode-updating mutex held; extension never activated, all36NOT_RUN, not36FAIL. PIDabsence/stability checks not executed and remain false; no automatic native retry. Current full4750tests4746PASS0FAIL4SKIP/exactVSIX6c299712/content25drivers retain original scope. User call_32cf7657e4a14763922686868049f4e0 explicitly requested official VS Code update. Existing downloaded Microsoft-signed installer2c33b50b (target1.144.0) was stuck on actual disk-full copy error. Prior explicit disposable-cache cleanup authority applied: '
  + record.update.cleanupDeletedFiles + ' old/unlocked npm/Node/pip/browser HTTP/anonymous ZIP cache files, ' + record.update.cleanupDeclaredBytes
  + ' declared bytes removed; exact lists/hashes and locked skips retained D and copied byte-exact here. Project/evidence/installed extensions/settings/named extension caches/current installer preserved. No new download/installer, process kill or unrelated OS changes. Bounded exact Retry dispatches retained; documented task-dialog Retry04 progressed to staged new_Code.exe/no error dialog, but installed Code still1.143.1 and installers remain. Update NOT_COMPLETE, no new host admission or nativePASS. Original production/unrelated work preserved uncommitted. F26a09 USER_DEFERRED_NOT_RUN; local/network Git push NOT_AUTHORIZED_NOT_RUN; feature ACTIVE/INCOMPLETE and original native/affected/withdrawal/feature byte gates pending. No rating/publish/tag/realdata/normal-profile extension install/settings/signals; original L6 HUMAN-ACTIONS STOP and disk waiver persist.\n';
for (const relative of ['docs/soterai-lite/ledger.md', 'docs/soterai-lite/NEXT-CHAT-HANDOFF-20261029-F26B.md']) fs.appendFileSync(path.join(repo, relative), receipt);
console.log(JSON.stringify({status: record.status, progress: fact(own('progress-05.json')), copied: copied.length, deletedFiles: record.update.cleanupDeletedFiles, deletedDeclaredBytes: record.update.cleanupDeclaredBytes}));
