'use strict';
// Text-only preparation correction; retain all original unexecuted templates.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const report=JSON.parse(fs.readFileSync(path.join(__dirname,'native-template-inputs-01.json'),'utf8'));
assert.equal(report.status,'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND');
const expected=report.templates.find(row=>row.template==='inspect-vsix-01.template.ps1');assert(expected);
const original=fs.readFileSync(path.join(__dirname,expected.template));assert.equal(sha(original),expected.sha256);assert.equal(original.length,expected.bytes);assert(!original.includes(0));
const before='Where-Object{$_.path -ceq $taskRequiredF25Input}',after="Where-Object{$_.path -ceq $taskRequiredF25Input -and $_.runtime -ceq 'extension.js'}";
const text=original.toString('utf8');assert.equal(text.split(before).length-1,1);const corrected=text.replace(before,after);assert(corrected.includes('__F25_TEMPLATE_BOUND__'));
const name='inspect-vsix-02.template.ps1';
const next={...report,preparationRevision:2,supersedes:'native-template-inputs-01.json',preparationCorrection:{scope:'Unexecuted inspector provenance assertion only',before:before+' aggregate count exactly1',after:after+' extension.js count exactly1',reason:'Internal StreamingOutputNormalizer can be inlined in more than one runtime; the inspector must prove presence in the current extension runtime while permitting its legitimate other-runtime copies. No product/test/host code or payload changed; no execution failure, result or regrade.'},templates:report.templates.map(row=>row===expected?{...row,template:name,bytes:Buffer.byteLength(corrected),sha256:sha(corrected),source:expected.template+' (preserved unexecuted original)'}:row)};
for(const output of [name,'native-template-inputs-02.json'])assert(!fs.existsSync(path.join(__dirname,output)));
fs.writeFileSync(path.join(__dirname,name),corrected,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'native-template-inputs-02.json'),JSON.stringify(next,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_BOUND_NOT_EXECUTED',currentTemplateManifest:'native-template-inputs-02.json',currentInspector:name,retainedOriginal:expected.template,execution:'NOT_RUN'}));
