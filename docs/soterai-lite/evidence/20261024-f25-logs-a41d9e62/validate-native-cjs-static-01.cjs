'use strict';
// Parse text only; no Script.run*, require(template), child/build/network/editor.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const names=['prepare-native-templates-01.cjs','prepare-native-inspector-correction-02.cjs','build-native-hosts-01.template.cjs','materialize-native-01.template.cjs'];
const rows=names.map(name=>{const raw=fs.readFileSync(path.join(__dirname,name));assert(!raw.includes(0),name);new vm.Script(raw.toString('utf8'),{filename:name});return {path:name,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')};});
const report={status:'PASS_CJS_SYNTAX_ONLY_NOT_BOUND_NOT_EXECUTED',files:rows,parsed:rows.length,generatedCodeExecuted:false,compilerBuildPackageEditorNative:'NOT_RUN',scope:'V8 Script constructor parses CJS source text; no code evaluation or generated helper execution.'};
fs.writeFileSync(path.join(__dirname,'native-preparation-cjs-static-01.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,parsed:rows.length,execution:'NOT_RUN'}));
