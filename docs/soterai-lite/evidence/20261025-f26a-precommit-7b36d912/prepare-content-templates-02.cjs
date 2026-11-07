const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const parent = 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62', home = __dirname;
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const inputs = [], outputs = [];
function source(name) { const file = path.join(parent, name), raw = fs.readFileSync(file); inputs.push({ path: file.replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }); return raw.toString('utf8'); }
function once(text, before, after) { if (text.split(before).length !== 2) throw Error('Expected one exact content-template edit: ' + before); return text.replace(before, () => after); }
function retain(name, text) { const file = path.join(home, name); fs.writeFileSync(file, text, { flag: 'wx' }); outputs.push({ path: path.relative(process.cwd(), file).replace(/\\/g, '/'), bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) }); }
let inspect = source('inspect-vsix-02.template.ps1').replaceAll('F25', 'F26A').replaceAll('f25-', 'f26a-');
inspect = inspect.replaceAll('soterai-lite-0.7.0-f26a-20261024-attempt01.vsix', '__F26A_VSIX_BASENAME__');
inspect = once(inspect, "$taskFlag=$taskProperties.'soterai.lite.logProtection'", "$taskFlag=$taskProperties.'soterai.lite.historyHooks.preCommit'");
inspect = once(inspect, "$taskMachine.Count -ne 81 -or $taskFlag.type -cne 'boolean' -or $taskFlag.default -ne $true", "$taskMachine.Count -ne 82 -or $taskFlag.type -cne 'boolean' -or $taskFlag.default -ne $false");
inspect = inspect.replace('81 machine settings and its default-true machine flag', '82 machine settings and its default-false opt-in machine flag');
inspect = once(inspect, "Where-Object{$_ -ceq 'soterai.lite.logProtection'}).Count -ne 1", "Where-Object{$_ -ceq 'soterai.lite.historyHooks.preCommit'}).Count -ne 1");
const logCheck = "$taskLogFlag=$taskProperties.'soterai.lite.logProtection'\n if($taskLogFlag.type -cne 'boolean' -or $taskLogFlag.default -ne $true -or $taskLogFlag.scope -cne 'machine' -or @($Manifest.capabilities.untrustedWorkspaces.restrictedConfigurations|Where-Object{$_ -ceq 'soterai.lite.logProtection'}).Count -ne 1){throw 'Existing restricted machine log setting must remain present.'}\n ";
inspect = once(inspect, "$taskArtifactFlag=$taskProperties.'soterai.lite.artifactScanner'", logCheck + "$taskArtifactFlag=$taskProperties.'soterai.lite.artifactScanner'");
inspect = inspect.replaceAll("@('soterai.reviewLogs'", "@('soterai.installPreCommitGuard','soterai.resumePreCommitGuard','soterai.restorePreCommitGuard','soterai.preCommitGuardStatus','soterai.reviewLogs'");
inspect = once(inspect, '$taskProvenance.runtimeCount -ne 3 -or @($taskProvenance.inventory).Count -ne 3', '$taskProvenance.runtimeCount -ne 4 -or @($taskProvenance.inventory).Count -ne 4');
inspect = once(inspect, "'extension/dist/extension.js','extension/dist/local-ai-broker.js','extension/dist/soterai-mcp-server.js'", "'extension/dist/extension.js','extension/dist/local-ai-broker.js','extension/dist/soterai-mcp-server.js','extension/dist/pre-commit-client.js'");
inspect = once(inspect, '$taskEntries.Count -ne 14', '$taskEntries.Count -ne 15').replace('Exact 14-entry Lite inventory required.', 'Exact 15-entry Lite inventory required.');
inspect = once(inspect, "$taskRuntimeNames=@('extension.js','local-ai-broker.js','soterai-mcp-server.js')", "$taskRuntimeNames=@('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')");
inspect = once(inspect, '$taskSeenRuntimes.Count -ne 3', '$taskSeenRuntimes.Count -ne 4');
inspect = once(inspect, 'entryCount=14;entries=', 'entryCount=15;entries=');
inspect = once(inspect, 'runtimeCount=3;forbiddenRuntimeInputs=0', 'runtimeCount=4;forbiddenRuntimeInputs=0');
inspect = once(inspect, "runtimeFlag='soterai.lite.logProtection'", "runtimeFlag='soterai.lite.historyHooks.preCommit'");
const workerChecks = `
# The fourth runtime has its own exact parser/entry closure and no editor or Git factory.
$taskWorker=@($taskProvenance.inventory|Where-Object{$_.name -ceq 'pre-commit-client.js'})
if($taskWorker.Count -ne 1 -or @($taskWorker[0].inputs|Where-Object{$_.path -ceq 'packages/vscode-extension/src/history-hooks/preCommitClientMain.ts'}).Count -ne 1 -or @($taskWorker[0].inputs|Where-Object{$_.path -ceq 'packages/vscode-extension/src/history-hooks/HookIndexSnapshot.ts'}).Count -ne 1 -or @($taskWorker[0].inputs|Where-Object{$_.path -ceq 'packages/vscode-extension/src/history-hooks/PreCommitProtocol.ts'}).Count -ne 1){throw 'Minimal worker entry/index/protocol provenance missing.'}
if(@($taskWorker[0].inputs|Where-Object{$_.path -match '/(?:SafeGit|CheckedGitMetadata|CheckedHookIndex|PreCommitController|PreCommitOwnerService)[.]ts$'}).Count -ne 0){throw 'Owner/editor/Git factory input leaked into finite client.'}
$taskWorkerMetafilePath=Join-Path $taskAttempt 'pre-commit-client.js.metafile.json'
$taskWorkerMetafile=Read-F26AJson $taskWorkerMetafilePath
foreach($taskMetaOutput in $taskWorkerMetafile.outputs.PSObject.Properties){foreach($taskImport in $taskMetaOutput.Value.imports){if($taskImport.path -match '^(?:node:)?child_process$|^vscode$'){throw 'Forbidden child/editor import in finite client output.'}}}
$taskLegacyText=[Text.UTF8Encoding]::new($false,$true).GetString($taskContents['extension/dist/extension.js'])
if($taskLegacyText.Contains('DIFF=$(git diff --cached')){throw 'Retired fallback hook generator still shipped in active extension bundle.'}
`;
inspect = once(inspect, '# Recheck all source inputs and artifact pointers after inventory collection.', workerChecks + '\n# Recheck all source inputs and artifact pointers after inventory collection.');
retain('inspect-vsix-02.template.ps1', inspect);
let binding = source('artifact-binding-02.template.ps1').replaceAll('F25', 'F26A').replaceAll('f25-', 'f26a-').replaceAll('soterai-lite-0.7.0-f26a-20261024-attempt01.vsix', '__F26A_VSIX_BASENAME__');
binding = once(binding, "@('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js')", "@('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js','dist/pre-commit-client.js')");
retain('artifact-binding-02.template.ps1', binding);
for (const item of outputs) { const text = fs.readFileSync(item.path, 'utf8'); if (!text.includes('__F26A_TEMPLATE_BOUND__') || !text.includes('__F26A_VSIX_BASENAME__')) throw Error('Unbound refusal missing.'); }
fs.writeFileSync(path.join(home, 'content-template-custody-02.json'), JSON.stringify({ status: 'PREPARED_NOT_BOUND_NOT_EXECUTED', time: new Date().toISOString(), inputs, outputs,
 recovery: 'Test-author usage limit before helper output; root read both whole sealed predecessors and authored new successors. No predecessor changed.',
 requiredBindings: ['Replace __F26A_TEMPLATE_BOUND__ with F26A_CURRENT_FACTS_BOUND only after current source/full/backend/build/newVSIX gates exist.', 'Replace __F26A_VSIX_BASENAME__ with actual unique F26a artifact name; bind CLI exactVSIX+extensionhash; preserve immutable output checks.'],
 scope: 'Exact15 entries/four runtimes/82machine settings/defaultfalse hookflag; earlier restricted flags, canonical metadata, assets/license/full-test-evidence-source exclusions retained. New worker closure checks are STATIC_ONLY until actual artifact inspection. Syntax validation pending.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PREPARED_NOT_BOUND_NOT_EXECUTED', outputs }));
