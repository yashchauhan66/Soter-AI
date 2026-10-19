'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file=path.resolve(__dirname,'../../../../packages/vscode-extension/src/__tests__/codexHttpBridge.test.ts');
const before=fs.readFileSync(file,'utf8');const anchor='req.end(options.raw ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));';
assert.equal(before.split(anchor).length,2);fs.writeFileSync(path.join(__dirname,'codexHttpBridge-frozen-original-01.ts'),before,{flag:'wx'});
const after=before.replace(anchor,'req.end(options.http === "GET" ? undefined : options.raw ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));');
fs.writeFileSync(file,after);
fs.writeFileSync(path.join(__dirname,'fixture-review-01.json'),JSON.stringify({status:'FIXTURE_CORRECTION',reason:'The GET negative control accidentally wrote an unframed JSON body. Node parsed a second request and the client refused duplicate close responses. Use a standards-conforming no-body GET; auth/alias/origin/media/GET refusal assertions and no-reader control unchanged. Original frozen source and 27PASS1FAIL raw retained.',beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex')},null,2)+'\n',{flag:'wx'});
