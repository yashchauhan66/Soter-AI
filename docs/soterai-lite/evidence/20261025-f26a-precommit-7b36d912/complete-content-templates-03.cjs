const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const home = __dirname, parent = 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const inspectorPath = path.join(home, 'inspect-vsix-02.template.ps1'), inspector = fs.readFileSync(inspectorPath);
const bindingPath = path.join(parent, 'artifact-binding-01.template.ps1'), original = fs.readFileSync(bindingPath);
let binding = original.toString('utf8').replaceAll('F25', 'F26A').replaceAll('f25-', 'f26a-')
 .replaceAll('soterai-lite-0.7.0-f26a-20261024-attempt01.vsix', '__F26A_VSIX_BASENAME__');
const before = "@('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js')";
if (binding.split(before).length !== 2) throw Error('Exact inherited runtime array unavailable.');
binding = binding.replace(before, () => "@('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js','dist/pre-commit-client.js')");
const text = inspector.toString('utf8');
for (const expected of ['entryCount=15','runtimeCount=4','82 machine settings',"'pre-commit-client.js'",'__F26A_TEMPLATE_BOUND__','__F26A_VSIX_BASENAME__']) if (!text.includes(expected)) throw Error('Inspector declaration incomplete.');
if (text.split('# Recheck all source inputs and artifact pointers after inventory collection.').length !== 2) throw Error('Duplicated inspector tail.');
const outputs = [];
for (const [name, raw] of [['inspect-vsix-03.template.ps1', inspector], ['artifact-binding-03.template.ps1', Buffer.from(binding)]]) {
 const file = path.join(home, name); fs.writeFileSync(file, raw, { flag: 'wx' }); outputs.push({ path: path.relative(process.cwd(), file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) });
}
fs.writeFileSync(path.join(home, 'content-template-custody-03.json'), JSON.stringify({ status: 'PREPARED_NOT_BOUND_NOT_EXECUTED_SYNTAX_PENDING', time: new Date().toISOString(),
 inputs: [{ path: path.relative(process.cwd(), inspectorPath).replace(/\\/g, '/'), sha256: sha(inspector) }, { path: bindingPath.replace(/\\/g, '/'), sha256: sha(original) }], outputs,
 correction: 'Helper02 broadly retargeted the inherited artifact source01 to nonexistent02, after producing literal-correct inspector02. Original failed/partial files retained. Syntax02 shell lacked Stop semantics and printed success despite missing artifact; that aggregate is INVALID and not accepted as PASS. This successor names the existing input explicitly; strict syntax03 requires both actual files before parsing.',
 requiredBindings: ['__F26A_TEMPLATE_BOUND__ -> F26A_CURRENT_FACTS_BOUND only in a new bound copy after current source/full/backend/build/artifact gates.', '__F26A_VSIX_BASENAME__ -> exact unique actual new F26a VSIX basename; actual VSIX+extension SHA passed explicitly.'],
 claim: 'Exact15-entry/four-runtime/82machine/defaultfalse hookflag templates only; no artifact or native result. H25 inputs unchanged.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PREPARED_NOT_BOUND_NOT_EXECUTED', outputs }));
