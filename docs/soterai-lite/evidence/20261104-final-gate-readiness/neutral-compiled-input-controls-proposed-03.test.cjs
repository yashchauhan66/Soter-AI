'use strict';
// Pure actual firstparty compiled-file admission; no kit/product/native action.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const helper=require('./build-neutral-review-kit-proposed-03.cjs'),repo=path.resolve(__dirname,'../../../..');
const fact=p=>{const raw=fs.readFileSync(path.join(repo,p));return{path:p,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')}};
test('real current compiled Ledger build input must be included as its exact JavaScript bytes',()=>{
  const p='packages/guard-core/dist/Ledger.js',row={...fact(p),role:'PRODUCT_SOURCE'};assert.equal(helper.allowed(row).rel,p);
});
