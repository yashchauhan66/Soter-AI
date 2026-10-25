'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function read(file){return JSON.parse(fs.readFileSync(path.join(repo,file),'utf8').replace(/^\uFEFF/,''));}
function fact(file){const bytes=fs.readFileSync(path.join(repo,file));return {path:file,bytes:bytes.length,sha256:sha(bytes)};}
const base=path.relative(repo,__dirname).replaceAll('\\','/'),full=read(base+'/full-inputs-02.json'),native=read(base+'/native-source-inputs-01.json');
const differences=[];for(const row of native.records){const actual=fact(row.path);if(actual.bytes!==row.bytes||actual.sha256!==row.sha256)differences.push({before:row,after:actual});}
assert.deepEqual(differences.map(row=>row.after.path).sort(),['package-lock.json','package.json']);
const content=read(base+'/vsix-inspection-01.json'),runtimeInputs=[];
for(const runtime of content.sourceProvenance.inventory)for(const row of runtime.inputs){assert.deepEqual(fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});runtimeInputs.push(row.path);}
assert(!runtimeInputs.some(file=>/^(?:package(?:-lock)?\.json|app\/|next\.config\.mjs)$/.test(file)));
const value={status:'ONLY_TWO_ROOT_APP_DEPENDENCY_METADATA_INPUTS_CHANGED_LITE_AND_BUNDLED_INPUTS_EXACT',oldFeatureParent:'10d3916f1fa0000300813b8696b068a6c880b6d9',observedHead:'17b5995c90403530f5258a87601b1719e10de12b',externalCommits:['52e67229651d91466ea6e9bbe01712494d12acf8','17b5995c90403530f5258a87601b1719e10de12b'],differences,fullInputs:full.records.length,nativeInputs:native.records.length,uniqueBundledInputsRechecked:new Set(runtimeInputs).size,scope:'External app analytics/CSP/Next updates are preserved. Every other frozen native/product/unit/build input and every actual packaged runtime source input is byte-identical. Current dependency-metadata full/compiler/rebuild-equivalence checks still pending; no historical claim is relabeled as current metadata.',observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'external-app-reconciliation-01.json'),JSON.stringify(value,null,2),{flag:'wx'});console.log(JSON.stringify({status:value.status,differences:differences.map(row=>row.after.path),bundledInputs:value.uniqueBundledInputsRechecked}));
