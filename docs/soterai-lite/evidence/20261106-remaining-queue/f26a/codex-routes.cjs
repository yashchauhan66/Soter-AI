'use strict';
// Evidence-only current candidate binding for the original Codex CLI/IDE matrices.
// Import and --prepare/--validate are inert. Native execution requires --run.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const prior = path.join(repo, 'docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70');
const commonFile = path.join(repo, 'docs/soterai-lite/evidence/20261106-v01-current-01/v01-admission.cjs');
const commonBindingFile = path.join(path.dirname(commonFile), 'binding.json');
const ownerFile = path.join(repo, 'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const ownerSha = 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f';
const rootPrefix = 'D:\\SoterAI-Lite-test-profiles';
const defs = {
 codexcli: { feature: 'F20A', stem: 'f20a-product-', count: 20, version: '0.160.1', result: 'PASS_SCOPED_PRODUCT_CLI_MATRIX',
  pin: 'installed-cli-public-inputs-01.json', wrapper: 'run-affected-cli-04.ps1',
  files: ['responses-matrix-01.cjs', 'matrix-guards-01.cjs'], copy: 'public-vendor/npm/node_modules/@openai/codex' },
 codexide: { feature: 'F20B', stem: 'f20b-product-', count: 21, version: '26.51007.21434', result: 'PASS_SCOPED_PRODUCT_IDE_MATRIX',
  pin: 'installed-ide-public-inputs-01.json', wrapper: 'run-ide-product-matrix-05.ps1',
  files: ['ide-product-matrix-04.cjs', 'ide-product-guards-01.cjs', 'ide-native-client-02.cjs'], copy: 'extensions/openai.chatgpt-26.51007.21434-win32-x64',
  retainedVendor: 'D:/SoterAI-Lite-test-profiles/f20b-product-20261020T143621Z-adac67b8/extensions/openai.chatgpt-26.51007.21434-win32-x64' }
};
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function fact(file) {
 file = path.resolve(file); const before = fs.lstatSync(file); assert(before.isFile() && !before.isSymbolicLink());
 const fd = fs.openSync(file, 'r'), block = Buffer.alloc(65536), digest = crypto.createHash('sha256'); let bytes = 0;
 try { for (;;) { const n = fs.readSync(fd, block, 0, block.length, null); if (!n) break; bytes += n; digest.update(block.subarray(0, n)); }
  const after = fs.fstatSync(fd); assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs); assert.equal(after.size, before.size);
 } finally { fs.closeSync(fd); }
 assert.equal(bytes, before.size); return { path: file, bytes, sha256: digest.digest('hex') };
}
function pin(row) { const observed = fact(path.resolve(repo, row.path)); assert.equal(observed.bytes, row.bytes, row.path); assert.equal(observed.sha256, row.sha256, row.path); return observed.path; }
function put(file, value) { fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return fact(file); }
function inside(base, target) { const relative = path.relative(path.resolve(base), path.resolve(target)); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); }
const ps = value => "'" + value.replaceAll("'", "''") + "'";
function replaceOne(body, from, to) { assert.equal(body.split(from).length, 2, from); return body.replace(from, to); }
function graph(root) {
 const pending = [root], files = []; let bytes = 0;
 while (pending.length) for (const entry of fs.readdirSync(pending.pop(), { withFileTypes: true })) {
  const parent = entry.parentPath || entry.path;
  assert(parent, 'Node directory parent required'); const file = path.join(parent, entry.name); assert(!entry.isSymbolicLink());
  if (entry.isDirectory()) pending.push(file);
  else { assert(entry.isFile()); assert(!/(^|[.])(env|log|db|sqlite|pem|key)$/i.test(entry.name), 'Unexpected private-state-shaped public vendor entry');
   const row = fact(file); files.push({ ...row, relative: path.relative(root, file).replaceAll('\\', '/') }); bytes += row.bytes;
   assert(files.length <= 4096 && bytes <= 1073741824, 'Bounded public vendor tree required'); }
 }
 files.sort((a, b) => a.relative.localeCompare(b.relative)); return { root, bytes, files };
}
function common(admission) {
 if (admission) { pin(admission.common); pin(admission.commonBinding); }
 const b = require(commonFile).binding();
 assert.equal(b.hostVersion, '1.145.1'); pin(b.code);
 return b;
}
function verifyResult(result, admission) {
 const d = defs[admission.route]; assert.equal(result.status, d.result); assert.equal(result.runtimeSha256, admission.frontendSha256);
 assert.deepEqual(result.checks.map(r => r.id).sort(), Array.from({ length: d.count }, (_, i) => d.feature + '-N' + String(i + 1).padStart(2, '0')).sort());
 assert(result.checks.every(row => row.status === 'PASS'));
 assert.equal(result.mediatedContextControl.status, 'BLOCKED_SCOPED'); assert.equal(result.unmediatedContextControl.status, 'LEAK_CONFIRMED'); assert.equal(result.unmediatedContextControl.covered, false);
 for (const key of ['driverFailure', 'brokerShutdown', 'childShutdown', 'nativeRetained', 'providerFailure', 'unexpectedPrivateLeak']) assert(!result[key], key);
 assert(result.native.length > 0 && result.children.length > 0);
 for (const row of [...result.native, ...result.children]) { assert(row.closed && row.stdoutEOF && row.stderrEOF); assert(!row.privateOutputSeen && !row.outputOverflow && !row.retainedWithoutSignal); }
 for (const row of result.native) assert.equal(row.signal, null);
 for (const key of ['deniedSignals', 'deniedExternal', 'deniedChildLaunches', 'deniedDirectSpawns', 'deniedWorkerLaunches', 'deniedFileAccess']) assert.equal(result[key].length, 0, key);
 if (admission.route === 'codexide') { assert.equal(result.actualVendorApiObserved, true); assert.equal(result.actualVendorControllerFound, true); assert(result.ideProcesses.length > 0); for (const row of result.ideProcesses) assert(row.closed && row.stdoutEOF && row.stderrEOF && row.signal === null); }
 return { assertions: d.count, nativeClients: result.native.length, directChildren: result.children.length, overrideControl: 'LEAK_CONFIRMED_UNCOVERED', independence: 'LOW_SCRIPTED_NATIVE_APIS', physicalWebview: 'UNVERIFIED' };
}
function verifyClose(close) { for (const [k, expected] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(close[k], expected, k); }
function admit(file, expected) {
 file = path.resolve(file); assert(inside(__dirname, file)); assert.equal(fact(file).sha256, expected);
 const a = read(file); assert(defs[a.route]); assert.equal(a.status, 'CURRENT_CANDIDATE_ORIGINAL_CODEX_ROUTE_PREPARED_NOT_RUN');
 assert.equal(a.common.path, commonFile); assert.equal(a.commonBinding.path, commonBindingFile); assert.equal(a.owner.sha256, ownerSha);
 for (const row of [a.owner, a.runner, a.wrapper, a.originalWrapper, a.inspection, a.vendorPin, a.originalVendorPin, ...a.drivers, ...a.drivers.map(row => row.original), ...a.vendorGraph.files]) pin(row);
 assert.equal(a.runner.path, __filename);
 const b = common(a); assert.equal(a.vsixSha256, b.vsix.sha256); assert.equal(a.sourceProofSha256, b.sourceProof.sha256); assert.equal(a.frontendSha256, b.frontendSha256);
 assert.equal(path.dirname(a.runRoot), rootPrefix); assert(new RegExp('^' + defs[a.route].stem + '[0-9TZ]+-[a-f0-9]{8}$').test(path.basename(a.runRoot)));
 assert.equal(path.dirname(a.receipts), path.dirname(file)); assert.equal(path.basename(a.receipts), 'run');
 return { a, b };
}
async function prepare(route) {
 const d = defs[route]; assert(d); const b = common();
 const out = path.join(__dirname, route + '-candidate-01'); assert(!fs.existsSync(out));
 const originalVendorPin = fact(path.join(prior, d.pin)), oldPin = read(originalVendorPin.path);
 let selectedRoot = oldPin.vendor, sourceKind = 'CURRENT_INSTALLED_PINNED_PUBLIC_VENDOR';
 if (!fs.existsSync(selectedRoot)) { assert(d.retainedVendor); selectedRoot = path.resolve(d.retainedVendor); sourceKind = 'RETAINED_EXACT_PUBLIC_VENDOR_COPY_CURRENT_INSTALLED_VERSION_DIFFERS'; }
 const vendorGraph = graph(selectedRoot);
 for (const row of oldPin.files) { const observed = vendorGraph.files.find(r => r.relative === row.relative); assert(observed); assert.equal(observed.sha256, row.sha256, row.relative); assert.equal(observed.bytes, row.bytes); }
 fs.mkdirSync(out); const own = name => path.join(out, name);
 const drivers = d.files.map(name => { const source = path.join(prior, name); fs.copyFileSync(source, own(name), fs.constants.COPYFILE_EXCL); return { ...fact(own(name)), original: fact(source) }; });
 const vendorPin = put(own(d.pin), { ...oldPin, vendor: selectedRoot, sourceKind, files: oldPin.files.map(row => ({ ...row, path: path.join(selectedRoot, row.relative) })) });
 const inspectionSource = read(pin(b.inspection));
 const inspection = put(own('current-inspection.json'), { ...inspectionSource, status: 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED', vsix: path.resolve(repo, b.vsix.path), sha256: b.vsix.sha256, extractedExtensionRoot: path.resolve(repo, b.extractedRoot) });
 const runName = d.stem + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(4).toString('hex');
 const runRoot = path.join(rootPrefix, runName), receipts = own('run');
 let wrapper = fs.readFileSync(path.join(prior, d.wrapper), 'utf8').replaceAll('\r\n', '\n');
 wrapper = replaceOne(wrapper, "$ErrorActionPreference='Stop'", "param([Parameter(Mandatory=$true)][string]$AdmissionPath,[Parameter(Mandatory=$true)][string]$AdmissionSha256)\n$ErrorActionPreference='Stop'\nif((Get-FileHash -LiteralPath $AdmissionPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $AdmissionSha256){throw 'Current route admission digest differs'}\n$taskRouteAdmission=Get-Content -LiteralPath $AdmissionPath -Raw|ConvertFrom-Json");
 wrapper = replaceOne(wrapper, "$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))", '$taskRepo=' + ps(repo));
 wrapper = replaceOne(wrapper, "Join-Path $PSScriptRoot 'vsix-inspection-03.json'", "Join-Path $PSScriptRoot 'current-inspection.json'");
 wrapper = replaceOne(wrapper, "$taskName='" + d.stem + "'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)", '$taskName=[IO.Path]::GetFileName($taskRouteAdmission.runRoot)');
 wrapper = replaceOne(wrapper, '$taskEvidence=Join-Path $PSScriptRoot $taskName', '$taskEvidence=$taskRouteAdmission.receipts');
 wrapper = replaceOne(wrapper, "@('extension.js','local-ai-broker.js','soterai-mcp-server.js')", "@('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')");
 // Keep original driver assertions and guards intact. The bootstrap owns every
 // direct child before those guards wrap spawn, and closes Code only after the
 // actual direct children have naturally closed with both streams at EOF.
 const bootstrapStart = wrapper.indexOf(" @'\n") + 4;
 assert(bootstrapStart >= 4); const bootstrapEnd = wrapper.indexOf("\n'@", bootstrapStart); assert(bootstrapEnd > bootstrapStart);
 let bootstrap = wrapper.slice(bootstrapStart, bootstrapEnd);
 const closeCall = "await vscode.commands.executeCommand('workbench.action.closeWindow');";
 assert(bootstrap.includes(closeCall)); bootstrap = bootstrap.replaceAll(closeCall, 'await closeOwnedWindow();');
 bootstrap = `const cp=require('node:child_process'),ownedChildren=[],ownedSpawn=cp.spawn;
cp.spawn=function(...args){const child=Reflect.apply(ownedSpawn,this,args),row={closed:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};ownedChildren.push(row);child.once('close',()=>row.closed=true);child.stdout?.once('end',()=>row.stdoutEOF=true);child.stderr?.once('end',()=>row.stderrEOF=true);return child;};
async function closeOwnedWindow(){const pending=ownedChildren.filter(row=>!row.closed||!row.stdoutEOF||!row.stderrEOF);if(pending.length){fs.writeFileSync(process.env.SOTERAI_${d.feature}_PRODUCT_RESULT+'.stop-unconfirmed.json',JSON.stringify({status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEXT_PHASE',pendingChildren:pending.length,signalsRequested:0})+'\\n',{flag:'wx'});return;}await vscode.commands.executeCommand('workbench.action.closeWindow');}
` + bootstrap;
 new (require('node:vm').Script)(bootstrap, { filename: route + '-bootstrap.cjs' });
 wrapper = wrapper.slice(0, bootstrapStart) + bootstrap + wrapper.slice(bootstrapEnd);
 const cut = wrapper.indexOf('$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo'); assert(cut > 0);
 wrapper = wrapper.slice(0, cut) + `
$taskEnv=@{}
foreach($taskEnvKey in $taskInfo.EnvironmentVariables.Keys){$taskEnv[$taskEnvKey]=[string]$taskInfo.EnvironmentVariables[$taskEnvKey]}
$taskLaunch=Join-Path $taskEvidence 'code-launch.json'
Write-${d.feature}New $taskLaunch (@{admissionPath=$AdmissionPath;admissionSha256=$AdmissionSha256;executable=$taskCode;args=$taskArgs;cwd=$taskWorkspace;env=$taskEnv;run=$taskEvidence;profile=$taskProfile;deadlineMs=300000}|ConvertTo-Json -Depth 15)
& 'C:\\Program Files\\nodejs\\node.exe' ${ps(__filename)} --code $taskLaunch
if($LASTEXITCODE -ne 0){throw 'Actual owned Code close/result incomplete; no retry or signals'}
Assert-${d.feature}ProductBytes
if((Get-${d.feature}Hash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
if(-not(Test-Path -LiteralPath $taskResult)){throw 'Actual native result missing'}
$taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json
if($taskObserved.status -cne ${ps(d.result)}){throw 'Original native matrix did not pass'}
`;
 const wrapperFact = put(own('run-current.ps1'), wrapper);
 const admission = { status: 'CURRENT_CANDIDATE_ORIGINAL_CODEX_ROUTE_PREPARED_NOT_RUN', observedAt: new Date().toISOString(), route, version: d.version, originalChecks: d.count,
  common: fact(commonFile), commonBinding: fact(commonBindingFile), owner: fact(ownerFile), runner: fact(__filename), wrapper: wrapperFact,
  vsixSha256: b.vsix.sha256, sourceProofSha256: b.sourceProof.sha256, frontendSha256: b.frontendSha256, drivers, originalWrapper: fact(path.join(prior, d.wrapper)),
  inspection, vendorPin, originalVendorPin, vendorGraph, vendorSourceKind: sourceKind, runRoot, receipts,
  taskAuthorization: '6 November remaining-work request, local synthetic tests and isolated Code checks explicitly approved; root coordinates native start.',
  limitations: 'Original scripted native API matrix; LOW independence; explicit override leak remains uncovered; no physical webview/human/authenticated-provider acceptance.' };
 assert.equal(admission.owner.sha256, ownerSha);
 const admissionFact = put(own('admission.json'), admission);
 put(own('preparation.json'), { status: 'PREPARED_NOT_NATIVE_RUN', admission: admissionFact, originalChecks: d.count, vendorSourceKind: sourceKind, originalDriverBytesPreserved: true, nativeLaunches: 0 });
 console.log(JSON.stringify({ status: 'PREPARED_NOT_NATIVE_RUN', route, admission: admissionFact, runRoot, nativeLaunches: 0 }));
}
async function code(launchFile) {
 const launch = read(launchFile), { a, b } = admit(launch.admissionPath, launch.admissionSha256), d = defs[a.route];
 assert.equal(path.dirname(path.resolve(launchFile)), a.receipts); assert.equal(launch.executable, path.resolve(repo, b.code.path));
 assert.equal(launch.cwd, path.join(a.runRoot, 'workspace')); assert.equal(launch.profile, path.join(a.runRoot, 'profile')); assert.equal(launch.run, a.receipts); assert.equal(launch.deadlineMs, 300000);
 const expectedArgs = ['--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust','--user-data-dir='+launch.profile,'--extensions-dir='+path.join(a.runRoot,'extensions'),'--extensionDevelopmentPath='+path.join(a.runRoot,'extension'),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',launch.cwd];
 assert.deepEqual(launch.args, expectedArgs);
 assert.equal(launch.env.USERPROFILE, launch.profile); assert.equal(launch.env.HOME, launch.profile);
 assert.equal(launch.env['SOTERAI_' + d.feature + '_PRODUCT_ROOT'], a.runRoot); assert.equal(launch.env['SOTERAI_' + d.feature + '_PRODUCT_RESULT'], path.join(a.runRoot, 'product-result.json'));
 const allowed = ['SystemRoot','WINDIR','COMSPEC','USERPROFILE','HOME','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH','GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_TERMINAL_PROMPT','GCM_INTERACTIVE','SOTERAI_'+d.feature+'_PRODUCT_ROOT','SOTERAI_'+d.feature+'_PRODUCT_RESULT', ...(a.route==='codexide'?['CODEX_HOME']:[])];
 assert(Object.keys(launch.env).every(k => allowed.includes(k)));
 for (const key of ['APPDATA','LOCALAPPDATA','TEMP','TMP','GIT_CONFIG_GLOBAL', ...(a.route==='codexide'?['CODEX_HOME']:[])]) assert(inside(a.runRoot, launch.env[key]));
 for (const row of a.vendorGraph.files) pin({ ...row, path: path.join(a.runRoot, d.copy, row.relative) });
 for (const row of b.runtimes) pin({ ...row, path: path.join(a.runRoot, 'extension/dist', path.basename(row.path)) });
 const observed = await require(pin(a.owner)).phase({ ...launch, name: 'code' }); verifyClose(observed.close);
 for (const name of ['product-result.json','product-result.json.driver-error.json','product-result.json.stop-unconfirmed.json']) {
  const source=path.join(a.runRoot,name); if(fs.existsSync(source))fs.copyFileSync(source,path.join(a.receipts,name),fs.constants.COPYFILE_EXCL);
 }
 const result = read(path.join(a.runRoot, 'product-result.json')); verifyResult(result, a);
}
async function run(file, expected) {
 const { a, b } = admit(file, expected); assert(!fs.existsSync(a.runRoot)); assert(!fs.existsSync(a.receipts));
 fs.mkdirSync(a.receipts); put(path.join(a.receipts, 'consumed.json'), { status: 'ONE_CURRENT_ROUTE_ATTEMPT_CONSUMED', at: new Date().toISOString(), admission: fact(file), signalsRequested: 0 });
 const env = { SystemRoot:'C:\\Windows', WINDIR:'C:\\Windows', COMSPEC:'C:\\Windows\\System32\\cmd.exe', PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs', USERPROFILE:path.join(a.runRoot,'profile'), HOME:path.join(a.runRoot,'profile'), TEMP:path.join(a.runRoot,'profile/Temp'), TMP:path.join(a.runRoot,'profile/Temp') };
 const observed = await require(pin(a.owner)).phase({ executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',a.wrapper.path,'-AdmissionPath',path.resolve(file),'-AdmissionSha256',expected], cwd:repo, env, run:a.receipts, name:'wrapper', profile:path.join(a.runRoot,'profile'), deadlineMs:420000 });
 verifyClose(observed.close); const resultFile = path.join(a.runRoot,'product-result.json'), result = read(resultFile); const acceptance = verifyResult(result, a);
 verifyClose(read(path.join(a.receipts,'code-owned-close.json'))); common(a);
 put(path.join(a.receipts,'acceptance.json'), { status:'PASS_CURRENT_CANDIDATE_ORIGINAL_MATRIX', route:a.route, ...acceptance, result:fact(resultFile), vsix:b.vsix, vendorSourceKind:a.vendorSourceKind, releaseReady:false, signalsRequested:0 });
 console.log(JSON.stringify({ status:'PASS_CURRENT_CANDIDATE_ORIGINAL_MATRIX', route:a.route, ...acceptance }));
}
module.exports = { prepare, admit, verifyResult, fact, pin };
if (require.main === module) {
 const [action, value, expected] = process.argv.slice(2);
 Promise.resolve().then(() => action === '--prepare' ? prepare(value) : action === '--validate' ? (admit(value, expected), console.log('PASS_READ_ONLY_CODEX_ADMISSION')) : action === '--run' ? run(value, expected) : action === '--code' ? code(value) : assert.fail('Use --prepare route, --validate admission hash, --run admission hash, or --code launch.'))
  .catch(error => { console.error(JSON.stringify({ status:'FAILED_OR_INCOMPLETE', errorName:error.name, message:error.message, signalsRequested:0 })); process.exitCode=1; });
}
