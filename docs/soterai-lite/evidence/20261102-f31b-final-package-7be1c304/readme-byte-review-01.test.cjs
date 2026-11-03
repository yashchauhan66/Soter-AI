'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),{fixture}=require(path.join(repo,'packages/soterai-lite/scripts/__tests__/release-package.test.cjs'));
test('F31b preserves reviewed README relative-link bytes with GitHub repository metadata',async()=>{
 const f=await fixture(()=>{},true);f.manifest.repository={type:'git',url:'https://github.com/synthetic-owner/synthetic-fixture.git'};
 const raw=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');await fs.writeFile(path.join(f.attempt,'package.json'),raw);f.receipt.manifestSha256=crypto.createHash('sha256').update(raw).digest('hex');await fs.writeFile(f.receiptPath,JSON.stringify(f.receipt,null,2)+'\n');
 await fs.writeFile(path.join(f.root,'README.md'),'Reviewed synthetic docs: [Privacy](PRIVACY.md).\n');
 const output=path.join(f.repo,'reviewed-readme.vsix'),result=await require(path.join(repo,'packages/soterai-lite/scripts/package.cjs')).packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output});assert.equal(result.preRelease,true);
});
