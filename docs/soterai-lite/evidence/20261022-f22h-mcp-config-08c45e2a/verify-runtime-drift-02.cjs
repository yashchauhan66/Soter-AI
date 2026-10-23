'use strict';
const e=require('./evidence-lib-01.cjs'),parser=require('@babel/parser');
const report=e.read(e.own('runtime-drift-diagnostics-01.json')),broker=report.runtimes.find(r=>r.name==='local-ai-broker.js'),rows=[];
for(const row of broker.inputChanges){
 const blob=e.git('show','0ef608959e35ec72d2d490322cbfeef8884c6069:'+row.path),current=e.bytes(e.path.join(e.repo,row.path));e.current(row.after);
 let previous=blob;if(e.sha(previous)!==row.before.sha256){previous=Buffer.from(blob.toString('utf8').replace(/\r?\n/g,'\r\n'));}
 e.assert.equal(e.sha(previous),row.before.sha256,row.path+' original frozen bytes');e.assert.equal(previous.length,row.before.bytes);
 const old=previous.toString('utf8').replace(/\r\n/g,'\n'),now=current.toString('utf8').replace(/\r\n/g,'\n');
 const changed=old!==now;let replacements=0;
 if(changed){e.assert.equal(row.path,'apps/local-ai-broker/src/auth.ts');const transformed=old.replace(/\b(1|0|512|0o077)n\b/g,(_,value)=>{replacements++;return 'BigInt('+value+')';});e.assert.equal(transformed,now,'Only exact integer BigInt literal-to-constructor changes admitted');e.assert.equal(replacements,6);}
 rows.push({path:row.path,before:row.before,after:row.after,status:changed?'EXACT_SIX_CONSTANT_CONSTRUCTOR_REPRESENTATIONS':'EOL_ONLY',replacements});
}
const asts=[],raw=[];
for(const version of ['previous','current']){
 const file=e.own('runtime-comparison-01/'+version+'-local-ai-broker.js.txt'),text=e.bytes(file).toString('utf8');e.assert.equal(e.hash(file),broker[version==='previous'?'beforeSha256':'afterSha256']);
 const counts={literals:0,constructors:0};
 function normalize(node){if(Array.isArray(node))return node.map(normalize);if(!node||typeof node!=='object')return node;if(node.type==='BigIntLiteral'){counts.literals++;return {type:'ExactBigIntConstant',decimal:BigInt(node.value).toString()};}if(node.type==='CallExpression'&&!node.optional&&node.callee?.type==='Identifier'&&node.callee.name==='BigInt'&&node.arguments.length===1&&node.arguments[0].type==='NumericLiteral'&&Number.isSafeInteger(node.arguments[0].value)&&node.arguments[0].value>=0){counts.constructors++;return {type:'ExactBigIntConstant',decimal:BigInt(node.arguments[0].value).toString()};}const out={};for(const key of Object.keys(node).sort())if(!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key))out[key]=normalize(node[key]);return out;}
 const normalized=JSON.stringify(normalize(parser.parse(text,{sourceType:'script'})));asts.push(normalized);raw.push({version,file:e.fact(file),normalizedSha256:e.sha(Buffer.from(normalized)),counts});
}
e.assert.equal(e.sha(Buffer.from(asts[0])),e.sha(Buffer.from(asts[1])),'Compiled AST must be identical after exact nonnegative safe integer BigInt constant normalization');
e.assert.equal(raw[1].counts.constructors-raw[0].counts.constructors,6);e.assert.equal(raw[0].counts.literals-raw[1].counts.literals,6);
const mcpPrevious=e.fact(e.own('runtime-comparison-01/previous-soterai-mcp-server.js.txt')),mcpCurrent=e.fact(e.own('runtime-comparison-01/current-soterai-mcp-server.js.txt'));e.assert.equal(mcpPrevious.sha256,mcpCurrent.sha256);
const reviewed={status:'PASS_REVIEWED_BROKER_CONSTANT_REPRESENTATION_DRIFT_SCOPED_REVERIFIED',inputs:rows,compiled:raw,mcp:{previous:mcpPrevious,current:mcpCurrent,byteIdentical:true},diagnosis:e.fact(e.own('runtime-drift-diagnostics-01.json')),backendTests:e.receipt('backend-tests-01.txt'),backendCompiler:e.receipt('backend-typecheck-01.txt'),actualRetained:e.receipt('retained-native-run-01.txt'),scope:'16 broker input differences are only line endings; auth.ts differs by exactly six safe integer BigInt literal-to-constructor forms introduced outside this feature, no other source difference. Compiled broker AST identical after exactly defined integer constant normalization, with both raw bundles retained and distinct hashes disclosed. Existing current backend144tests143PASS1SKIP plus actual exact-bundle F14/F15/F16/F17 retained106 passed. MCP transport runtime byte-identical. This is a scoped equivalence review, not byte identity, vendor rerun, independent certification or a new source/pin change. Original acceptance equality refusal retained FAIL.'};
e.write('runtime-drift-review-02.json',reviewed);console.log(JSON.stringify({status:reviewed.status,inputs:rows.length,eolOnly:rows.filter(r=>r.status==='EOL_ONLY').length,constantChanges:6,compiled:raw.map(r=>({version:r.version,sha256:r.normalizedSha256,counts:r.counts})),mcpByteIdentical:true}));
