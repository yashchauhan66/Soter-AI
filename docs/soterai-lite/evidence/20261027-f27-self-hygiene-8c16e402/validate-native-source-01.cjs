// Parser check only: no extension host, filesystem fixture or product is run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),ts=require(path.join(repo,'node_modules/typescript'));
const target=path.join(__dirname,'f27-native01.host.ts'),raw=fs.readFileSync(target),text=raw.toString('utf8');
const result=ts.transpileModule(text,{fileName:'f27-native01.host.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
const errors=(result.diagnostics??[]).filter(row=>row.category===ts.DiagnosticCategory.Error);
assert.equal(errors.length,0,errors.map(row=>row.code).join(','));
const imports=[...text.matchAll(/^import .*? from ["']([^"']+)["']/gm)].map(row=>row[1]);
assert(imports.every(name=>name==='vscode'||name.startsWith('node:')),'Native host must enter actual registered runtime without importing duplicate product classes.');
assert.equal((text.match(/^    ".*",$/gm)??[]).length>=22,true);
console.log(JSON.stringify({status:'PARSER_ONLY_PASS_NOT_TYPECHECK_OR_NATIVE_EXECUTION',source:'f27-native01.host.ts',bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex'),syntaxErrors:errors.length,productImports:0,native:'NOT_RUN'}));
