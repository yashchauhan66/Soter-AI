'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),target=path.join(repo,'packages/core/src/StreamingOutputRedactor.ts');
const before=fs.readFileSync(path.join(__dirname,'StreamingOutputRedactor-before-normalizer-extract-01.ts'));
assert(before.equals(fs.readFileSync(target)));assert(!fs.existsSync(path.join(repo,'packages/core/src/StreamingOutputNormalizer.ts')));
let text=fs.readFileSync(path.join(__dirname,'extract-output-normalizer-01.cjs'),'utf8');
// First attempt refused before source writes because original core lines use
// CRLF. Preserve exact archived input; normalize the in-memory edit only.
text=text.replace("let source=fs.readFileSync(file,'utf8');","let original=fs.readFileSync(file,'utf8');let source=original.replaceAll('\\r\\n','\\n');")
 .replace("'StreamingOutputRedactor-before-normalizer-extract-01.ts'),source","'StreamingOutputRedactor-before-normalizer-extract-02.ts'),original")
 .replace("'ManagedLogCollector-before-normalizer-extract-01.ts'","'ManagedLogCollector-before-normalizer-extract-02.ts'")
 .replace("let text=fs.readFileSync(collector,'utf8');","let text=fs.readFileSync(collector,'utf8').replaceAll('\\r\\n','\\n');");
assert(text.includes("let original="));fs.writeFileSync(path.join(__dirname,'extract-output-normalizer-02.cjs'),text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_SECOND_EXACT_EXTRACTION',firstProductionUnchanged:true}));
