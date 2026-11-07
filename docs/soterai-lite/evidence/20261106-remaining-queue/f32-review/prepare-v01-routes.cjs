'use strict';
// Generates Cline/Claude/Gemini successors without launching any client or Code.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), vm = require('node:vm');
const { fact, pin } = require('./prepare-v01-affected.cjs');
const repo = path.resolve(__dirname, '../../../../..'), read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const routes = [
 { id: 'cline', directory: '20261018-f18-cline-46a8c902', wrapper: 'run-product-matrix-06.ps1', driver: 'product-matrix-05.cjs', guards: ['matrix-guards-01.cjs'], pinFile: 'installed-public-inputs-01.json', oldInspection: 'vsix-inspection-08.json', count: 20, prefix: 'F18', expectedStatus: 'PASS_SCOPED_PRODUCT_PROBE' },
 { id: 'claude', directory: '20261019-f19-claude-89c1e602', wrapper: 'run-product-matrix-05.ps1', driver: 'product-matrix-03.cjs', guards: ['matrix-guards-01.cjs'], pinFile: 'installed-public-inputs-01.json', oldInspection: 'vsix-inspection-04.json', count: 22, prefix: 'F19', expectedStatus: 'PASS_SCOPED_PRODUCT_CLI_MATRIX' },
 { id: 'gemini', directory: '20261020-f20c-gemini-cli-8a6d3e70', wrapper: 'run-gemini-product-matrix-03.ps1', driver: 'gemini-product-matrix-03.cjs', guards: ['gemini-product-parent-guards-01.cjs', 'gemini-product-child-guards-01.cjs'], pinFile: 'installed-public-inputs-02.json', oldInspection: 'vsix-inspection-03.json', count: 16, prefix: 'F20C', expectedStatus: 'PASS_SCOPED_PRODUCT_GEMINI_MATRIX' }
];
const retainedRoots = {
 cline: 'D:/SoterAI-Lite-test-profiles/f18-product-20261019T045611Z-9e21a4b9/extensions/saoudrizwan.claude-dev-4.1.25',
 claude: 'D:/SoterAI-Lite-test-profiles/f19-product-20261019T105923Z-cf56eaaa/extensions/anthropic.claude-code-2.1.301-win32-x64',
 picomatch: 'D:/SoterAI-Lite-test-profiles/f20c-product-20261020T142131Z-3dfc1593/public-vendor/npm/node_modules/picomatch'
};
function selectVendorInputs(route, original) {
 const selected = structuredClone(original), relocations = [];
 function exact(fileRows) { try { fileRows.forEach(pin); return true; } catch { return false; } }
 function relocate(rows, from, to) {
  const updated = rows.map(row => {
   const relative = row.relative || path.relative(path.resolve(from), path.resolve(row.path)).replaceAll('\\', '/');
   assert(relative && !relative.startsWith('../') && !path.isAbsolute(relative));
   const changed = { ...row, path: path.join(to, relative) }; pin(changed); return changed;
  });
  relocations.push({ originalRoot: from, selectedRoot: to, status: 'RETAINED_EXACT_PUBLIC_BYTES_NOT_CURRENT_INSTALLATION', bytesUnchanged: true }); return updated;
 }
 if (route.id !== 'gemini') {
  const key = selected.inputs ? 'inputs' : 'files', rootKey = selected.root ? 'root' : 'vendor';
  if (!exact(selected[key])) { selected[key] = relocate(selected[key], selected[rootKey], retainedRoots[route.id]); selected[rootKey] = retainedRoots[route.id]; }
 }
 for (const dependency of selected.dependencies || []) {
  if (!exact(dependency.files)) { assert.equal(dependency.name, 'picomatch'); dependency.files = relocate(dependency.files, dependency.root, retainedRoots.picomatch); dependency.root = retainedRoots.picomatch; }
 }
 const inputs = [...(selected.inputs || selected.files), ...(selected.dependencies || []).flatMap(row => row.files), ...(selected.node ? [selected.node] : [])]; inputs.forEach(pin);
 return { selected, inputs, relocations };
}
function once(source, before, after) { assert.equal(source.split(before).length, 2, 'Unique wrapper edit required: ' + before); return source.replace(before, after); }
function matrixIds(route, source) {
 // Cline/Claude declare several ID/scenario pairs in arrays before calling check(id).
 const pattern = route.id === 'cline' ? /['"](F18-P\d{2})['"]/g : route.id === 'claude' ? /['"](F19-N\d{2})['"]/g : /await check\(\s*['"]([^'"]+)['"]/g;
 const ids = [...new Set([...source.matchAll(pattern)].map(match => match[1]))]; assert.equal(ids.length, route.count); return ids;
}
function transformWrapper(source, route, admissionSha) {
 let current = source.replaceAll(route.oldInspection, 'route-inspection.json'); assert.notEqual(current, source);
 current = once(current, "@('extension.js','local-ai-broker.js','soterai-mcp-server.js')", "@('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')");
 if (route.id !== 'gemini') {
  const copyLoop = 'foreach($taskEntry in Get-ChildItem -LiteralPath $taskVendor -Force){';
  current = once(current, copyLoop, copyLoop + "\n if(@('.f18-original-package.json','f18-vendor-bootstrap.cjs','.f19-original-package.json','f19-vendor-bootstrap.cjs') -ccontains $taskEntry.Name){continue}");
 }
 const guard = "$taskV01Admission=Join-Path $PSScriptRoot 'route-admission.cjs'\nif((Get-FileHash -LiteralPath $taskV01Admission -Algorithm SHA256).Hash.ToLowerInvariant() -cne '" + admissionSha + "'){throw 'V01 exact route admission changed'}\n& 'C:\\Program Files\\nodejs\\node.exe' $taskV01Admission\nif($LASTEXITCODE -ne 0){throw 'V01 current candidate/vendor admission refused'}\n. (Join-Path $PSScriptRoot 'pipe-ownership.ps1')\n";
 current = once(current, "$ErrorActionPreference='Stop'", "$ErrorActionPreference='Stop'\n" + guard);
 const output = 'Write-' + route.prefix + 'New';
 const capture = "$taskTimedOut=-not $taskProcess.HasExited";
 const custody = capture + "\n $taskDrainWatch=[Diagnostics.Stopwatch]::StartNew()\n while(-not $taskTimedOut -and (-not $taskStdout.IsCompleted -or -not $taskStderr.IsCompleted) -and $taskDrainWatch.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}\n " + output + " (Join-Path $taskEvidence 'owned-editor-close.json') (@{observedExit=(-not $taskTimedOut);exitCode=$(if($taskTimedOut){$null}else{$taskProcess.ExitCode});stdoutEOF=($taskStdout.IsCompleted -and -not $taskStdout.IsFaulted);stderrEOF=($taskStderr.IsCompleted -and -not $taskStderr.IsFaulted);signalsRequested=0}|ConvertTo-Json)";
 current = once(current, capture, custody);
 current = once(current, "}finally{$taskProcess.Dispose()}", " if(-not $taskStdout.IsCompleted -or -not $taskStderr.IsCompleted -or $taskStdout.IsFaulted -or $taskStderr.IsFaulted -or $taskProcess.ExitCode -ne 0){throw 'V01 actual owned exit0 and both EOF required'}\n & 'C:\\Program Files\\nodejs\\node.exe' $taskV01Admission\n if($LASTEXITCODE -ne 0){throw 'V01 post-run exact input check failed'}\n}finally{Complete-F26AOwnedProcess -OwnedProcess $taskProcess -StdoutTask $taskStdout -StderrTask $taskStderr -RecordPath (Join-Path $taskEvidence 'helper-pipe-ownership')}");
 return current;
}
function publicGraph(root) {
 const result = []; let bytes = 0;
 function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  assert(!entry.isSymbolicLink(), 'Linked vendor public input refused'); const file = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(file); else { assert(entry.isFile()); const row = fact(file); bytes += row.bytes; assert(result.length < 12000 && bytes <= 2 * 1024 * 1024 * 1024, 'Vendor public graph budget exceeded'); result.push(row); }
 }}
 walk(path.resolve(root)); return result;
}
function installedPublicVersions(route) {
 if (route.id === 'gemini') { const file = 'C:/Users/USER/AppData/Roaming/npm/node_modules/@google/gemini-cli/package.json'; return [{ version: read(file).version, manifest: fact(file) }]; }
 const root = 'C:/Users/USER/.vscode/extensions', prefix = route.id === 'cline' ? 'saoudrizwan.claude-dev-' : 'anthropic.claude-code-';
 return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && entry.name.startsWith(prefix)).map(entry => { const file = path.join(root, entry.name, 'package.json'); return { version: read(file).version, manifest: fact(file) }; });
}
function prepare(config) {
 const affectedRoot = path.resolve(repo, config.affectedOutput || 'docs/soterai-lite/evidence/20261106-v01-current-01');
 const admission = fact(path.join(affectedRoot, 'v01-admission.cjs')), binding = fact(path.join(affectedRoot, 'binding.json'));
 const C = require(pin(admission)), b = C.binding(); assert.equal(b.vsix.sha256, config.currentVsix.sha256); assert.equal(b.sourceProof.sha256, config.sourceProof.sha256);
 const inspection = read(pin(b.inspection)), prepared = [], attempt = config.routeAttempt || '01', routeIds = config.routeIds || routes.map(row => row.id);
 assert.match(attempt, /^\d{2}$/); assert(Array.isArray(routeIds) && routeIds.length && new Set(routeIds).size === routeIds.length && routeIds.every(id => routes.some(row => row.id === id)));
 for (const route of routes.filter(row => routeIds.includes(row.id))) {
  const sourceDir = path.join(repo, 'docs/soterai-lite/evidence', route.directory), originalPin = fact(path.join(sourceDir, route.pinFile)), originalVendorPin = read(pin(originalPin));
  const selection = selectVendorInputs(route, originalVendorPin), vendorPin = selection.selected;
  const selectedRoot = vendorPin.root || vendorPin.vendor;
  const sourcePublicInputs = route.id === 'gemini' ? selection.inputs.map(row => fact(pin(row))) : publicGraph(selectedRoot).filter(row => !['.f18-original-package.json', 'f18-vendor-bootstrap.cjs', '.f19-original-package.json', 'f19-vendor-bootstrap.cjs'].includes(path.relative(path.resolve(selectedRoot), path.resolve(repo, row.path)).replaceAll('\\', '/')));
  const output = path.join(repo, 'docs/soterai-lite/evidence', '20261106-v01-' + route.id + '-' + attempt); assert(!fs.existsSync(output), 'Fresh route evidence directory required'); fs.mkdirSync(output);
  const own = name => path.join(output, name), put = (name, value) => fs.writeFileSync(own(name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const copied = [], publicInputs = sourcePublicInputs;
  const selectedInputs = [...(vendorPin.inputs || vendorPin.files), ...(vendorPin.dependencies || []).flatMap(dependency => dependency.files), ...(vendorPin.node ? [vendorPin.node] : [])]; selectedInputs.forEach(pin);
  const installedVersions = installedPublicVersions(route);
  put(route.pinFile, { ...vendorPin, preparation: { observedAt: new Date().toISOString(), originalPin, relocations: selection.relocations, selectedVersion: vendorPin.version, status: 'CURRENT_BYTE_CHECK_OF_PINNED_PUBLIC_INPUTS_NO_NATIVE_RESULT', currentInstalledPublicPackages: installedVersions, currentInstalledVersionCovered: installedVersions.some(row => row.version === vendorPin.version) } });
  for (const name of [route.driver, ...route.guards]) { const source = path.join(sourceDir, name); fs.copyFileSync(source, own(name), fs.constants.COPYFILE_EXCL); copied.push({ source: fact(source), target: fact(own(name)), byteExact: true }); }
  for (const name of ['route-admission.cjs', 'run-v01-route.cjs']) { const source = path.join(__dirname, name); new vm.Script(fs.readFileSync(source, 'utf8')); fs.copyFileSync(source, own(name), fs.constants.COPYFILE_EXCL); }
  const pipe = path.join(repo, 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/affected-preparation-pipe-ownership-01.ps1'); fs.copyFileSync(pipe, own('pipe-ownership.ps1'), fs.constants.COPYFILE_EXCL);
  const originalWrapper = fact(path.join(sourceDir, route.wrapper)); let changedWrapper = transformWrapper(fs.readFileSync(pin(originalWrapper), 'utf8'), route, fact(own('route-admission.cjs')).sha256);
  if (route.id === 'cline') changedWrapper = once(changedWrapper, "$taskVendor='C:\\Users\\USER\\.vscode\\extensions\\saoudrizwan.claude-dev-4.1.25'", "$taskVendor='" + vendorPin.root.replaceAll("'", "''") + "'");
  put('run-current-route.ps1', changedWrapper);
  put('route-inspection.json', { status: 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED', vsix: pin(b.vsix), sha256: b.vsix.sha256, extractedExtensionRoot: path.resolve(repo, b.extractedRoot), entries: inspection.entries, currentQualification: b.qualification, originalInspection: b.inspection, adapterPurpose: 'Schema adapter of the freshly qualified exact18-entry package; no route/host result inferred.' });
  let hook;
  if (route.id === 'cline') {
   const originalHook = fact(path.join(sourceDir, 'test-generated-hook-04.ts')); const raw = fs.readFileSync(pin(originalHook), 'utf8');
   const qualified = read(pin(b.qualification)), buildReceipt = fact(pin(qualified.buildReceipt)), build = read(pin(buildReceipt));
   const frontend = build.inventory.find(row => row.name === 'extension.js'); assert(frontend && frontend.sha256 === b.frontendSha256);
   const packagedSourceBindings = ['packages/vscode-extension/src/adapters/ClineAdapterPolicy.ts', 'packages/vscode-extension/src/agent/SealedBridgeTicket.ts', 'packages/vscode-extension/src/agent/SafeReadBridge.ts'].map(name => { const row = frontend.inputs.find(input => input.path === name); assert(row, name); pin(row); return row; });
   const changed = once(raw, 'vsix-inspection-08.json', 'route-inspection.json'); put('test-generated-hook-04.ts', changed); hook = { source: originalHook, driver: fact(own('test-generated-hook-04.ts')), expected: 4, buildReceipt, packagedSourceBindings, scope: 'Hook/bridge generator source is byte-bound to the exact packaged frontend build graph; exact packaged MCP and actual PS5.1 execute. Separate from vendor route20.' };
  }
  const ownedHelper = fact(path.join(repo, 'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'));
  assert.equal(ownedHelper.sha256, 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
  const expectedIds = matrixIds(route, fs.readFileSync(own(route.driver), 'utf8'));
  const routeBinding = { status: 'CURRENT_ROUTE_PREPARED_NOT_RUN', id: route.id, count: route.count, expectedIds, expectedStatus: route.expectedStatus, affectedAdmission: admission, affectedBinding: binding, sourceProof: b.sourceProof, vsix: b.vsix, frontendSha256: b.frontendSha256, code: b.code, hostVersion: b.hostVersion, originalPin, vendorUse: read(own(route.pinFile)).preparation, selectedInputs, publicInputs, sourcePublicInputs, originalWrapper, wrapper: fact(own('run-current-route.ps1')), driver: fact(own(route.driver)), guard: fact(own(route.guards[0])), copied, ownedHelper, hook, fixtureInputs: [...copied.map(row => row.target), ...['route-admission.cjs', 'run-v01-route.cjs', 'pipe-ownership.ps1', 'run-current-route.ps1', 'route-inspection.json', route.pinFile].map(name => fact(own(name))), ...(hook ? [hook.driver] : [])], assertions: 'Original matrix/guard bytes unchanged. Exact package schema, four-runtime inventory, selected byte-identical public vendor paths and actual Code closure custody added to wrapper. No old PASS transferred.', owner: b.owner, releaseReady: false };
  put('route-binding.json', routeBinding); put('syntax.ps1', "$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @('run-current-route.ps1','pipe-ownership.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw 'Route PowerShell syntax failed'}}\nWrite-Output 'PASS: route wrapper syntax; no execution'\n");
  require(own('route-admission.cjs')).validate(); selectedInputs.forEach(pin); publicInputs.forEach(pin);
  prepared.push({ id: route.id, output, routeBinding: fact(own('route-binding.json')), checks: route.count, hookChecks: hook?.expected || 0, status: 'PREPARED_NOT_RUN' });
 }
 C.binding(); return prepared;
}
module.exports = { routes, transformWrapper, matrixIds, selectVendorInputs, prepare };
if (require.main === module) { try {
 if (process.argv[2] === '--syntax-only') {
  const output = path.resolve(process.argv[3]); assert(output.startsWith(__dirname + path.sep)); fs.mkdirSync(output);
  for (const route of routes) { const raw = fs.readFileSync(path.join(repo, 'docs/soterai-lite/evidence', route.directory, route.wrapper), 'utf8'); fs.writeFileSync(path.join(output, route.id + '.ps1'), transformWrapper(raw, route, '0'.repeat(64)), { flag: 'wx' }); }
  fs.writeFileSync(path.join(output, 'parse.ps1'), "$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @('cline.ps1','claude.ps1','gemini.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw ($taskErrors|Out-String)}}\nWrite-Output 'PASS: three transformed wrapper syntax previews; no launch'\n", { flag: 'wx' });
  console.log('SYNTAX_PREVIEWS_ONLY_NO_VALID_ADMISSION_NO_EXECUTION');
 } else console.log(JSON.stringify(prepare(read(path.resolve(process.argv[2]))), null, 2));
 } catch (error) { console.error(error); process.exitCode = 1; } }
