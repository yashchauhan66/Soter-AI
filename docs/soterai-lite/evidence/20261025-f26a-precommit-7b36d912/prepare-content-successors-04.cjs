// Authoring only: copy sealed03 templates into new fail-closed04 templates.
// Does not bind facts, inspect/package an artifact or launch any native process.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const home = __dirname, repo = path.resolve(home, '../../../..');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const old = [
    ['inspect-vsix-03.template.ps1', '0ebf1aba3fdd3cbb75d05c309bc3d6b5ebe5b5b20c00e8dcdc7c5aded9f7c473'],
    ['artifact-binding-03.template.ps1', '46e7d3e498e46b62d490fb9c792d928e620f50dc4b3c6fa7190fdfd86f3147fc']
];
const source = old.map(([name, digest]) => { const raw = fs.readFileSync(path.join(home, name)); assert.equal(sha(raw), digest); return raw; });
const marker = "if('__F26A_TEMPLATE_BOUND__' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26A template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}";
let inspector = source[0].toString('utf8'), binding = source[1].toString('utf8');
assert.equal(inspector.split(marker).length, 2); assert.equal(binding.split(marker).length, 2);
const guard = String.raw`
# Explicit new product-fix artifact/full proof: all placeholders refuse execution.
if($ExpectedVsixSha256.ToLowerInvariant() -cne '__F26A_ATTEMPT02_VSIX_SHA256__' -or $ExpectedBundleSha256.ToLowerInvariant() -cne '__F26A_ATTEMPT02_FRONTEND_SHA256__'){throw 'Exact new attempt02 artifact/runtime facts required.'}
`;
inspector = inspector.replace(marker, () => marker + guard.replace(/\r?\n/g, '\r\n'));
const bindingAnchor = ' $taskBindingRepo=[IO.Path]::GetFullPath';
assert.equal(binding.split(bindingAnchor).length, 2);
binding = binding.replace(bindingAnchor, () => guard.replace(/\r?\n/g, '\r\n') + bindingAnchor);
inspector = inspector.replace("$InspectionName='01'", () => "$InspectionName='02'");
const sourceAnchor = "$taskCanonical=Read-F26AJson $taskCanonicalPath";
assert.equal(inspector.split(sourceAnchor).length, 2);
const proofGuard = String.raw`
$taskFullInputs04Path=Join-Path $PSScriptRoot 'full-inputs-04.json'
if('__F26A_FULL_INPUTS04_SHA256__' -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $taskFullInputs04Path -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F26A_FULL_INPUTS04_SHA256__'){throw 'Exact new990-file full source proof required.'}
$taskFullInputs04=Read-F26AJson $taskFullInputs04Path
if($taskFullInputs04.fileCount -ne 990 -or @($taskFullInputs04.files).Count -ne 990){throw 'Current990 source membership required.'}
foreach($taskCurrentInput in $taskFullInputs04.files){
 $taskCurrentRelative=$taskCurrentInput.path.Replace('\','/')
 if([IO.Path]::IsPathRooted($taskCurrentRelative) -or $taskCurrentRelative -match '(^|/)\.\.(/|$)'){throw 'Invalid current source path.'}
 $taskCurrentInputPath=[IO.Path]::GetFullPath((Join-Path $taskRepoRoot $taskCurrentRelative));Assert-F26AContained $taskRepoRoot $taskCurrentInputPath
 Assert-F26AFile $taskCurrentInputPath $taskCurrentInput.bytes $taskCurrentInput.sha256
}
`;
inspector = inspector.replace(sourceAnchor, () => sourceAnchor + proofGuard.replace(/\r?\n/g, '\r\n'));
const workerAnchor = '# The fourth runtime has its own exact parser/entry closure and no editor or Git factory.';
assert.equal(inspector.split(workerAnchor).length, 2);
const protocolGuard = String.raw`
# Bind the genuine process.env product correction to the newly packaged frontend.
if('__F26A_OWNER_ENV_PROTOCOL_SHA256__' -cnotmatch '^[a-f0-9]{64}$'){throw 'Current owner-environment source pin is unbound.'}
$taskOwnerEnvironmentInput=@($taskVerifiedInputs|Where-Object{$_.runtime -ceq 'extension.js' -and $_.path -ceq 'packages/vscode-extension/src/history-hooks/OwnerHookProtocol.ts'})
if($taskOwnerEnvironmentInput.Count -ne 1 -or $taskOwnerEnvironmentInput[0].sha256 -cne '__F26A_OWNER_ENV_PROTOCOL_SHA256__'){throw 'New owner-environment product correction is missing from packaged frontend.'}
`;
inspector = inspector.replace(workerAnchor, () => protocolGuard.replace(/\r?\n/g, '\r\n') + workerAnchor);
binding = binding.replace('Only the planned NEW F26A attempt01 artifact is admitted; no F24 substitution.', () => 'Only the bound NEW F26A attempt02 artifact is admitted.');
for (const item of ['pre-commit-client.js', 'entryCount=15', 'runtimeCount=4']) assert(inspector.includes(item));
for (const placeholder of ['__F26A_TEMPLATE_BOUND__', '__F26A_VSIX_BASENAME__', '__F26A_ATTEMPT02_VSIX_SHA256__', '__F26A_ATTEMPT02_FRONTEND_SHA256__']) {
    assert(inspector.includes(placeholder)); assert(binding.includes(placeholder));
}
const targets = ['inspect-vsix-04.template.ps1', 'artifact-binding-04.template.ps1', 'content-template-custody-04.json', 'content-template-ancestors-04'];
for (const name of targets) assert(!fs.existsSync(path.join(home, name)), 'Immutable template target exists: ' + name);
fs.mkdirSync(path.join(home, 'content-template-ancestors-04'));
old.forEach(([name], index) => fs.writeFileSync(path.join(home, 'content-template-ancestors-04', name), source[index], { flag: 'wx' }));
fs.writeFileSync(path.join(home, targets[0]), inspector, { flag: 'wx' }); fs.writeFileSync(path.join(home, targets[1]), binding, { flag: 'wx' });
const receipt = { status: 'PREPARED_UNBOUND_NOT_EXECUTED', time: new Date().toISOString(), author: fact(__filename),
    templates: targets.slice(0, 2).map(name => fact(path.join(home, name))), ancestors: old.map(([name]) => fact(path.join(home, name))),
    requiredBindings: ['__F26A_TEMPLATE_BOUND__ -> F26A_CURRENT_FACTS_BOUND', '__F26A_VSIX_BASENAME__ -> soterai-lite-0.7.0-f26a-20261026-attempt02.vsix',
        '__F26A_ATTEMPT02_VSIX_SHA256__', '__F26A_ATTEMPT02_FRONTEND_SHA256__', '__F26A_FULL_INPUTS04_SHA256__', '__F26A_OWNER_ENV_PROTOCOL_SHA256__'],
    unchanged: '15 exact entries; four runtime inventories;82 restricted-machine settings/default-false hook flag; source provenance; no Full/test/evidence/local-secret-path shipping; finite client child_process/vscode closure exclusions',
    limits: 'Actual compiler15/full03/current990 source proof,21-driver04 build and new attempt02 artifact facts must exist before binding. No old artifact/hash promotion; native06 requires separate user extra-round approval after concrete tested artifact. This authoring helper never materializes06 or runs content/native/build.' };
fs.writeFileSync(path.join(home, 'content-template-custody-04.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
