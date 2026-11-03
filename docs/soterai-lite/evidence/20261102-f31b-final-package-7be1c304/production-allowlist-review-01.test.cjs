'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),{fixture}=require(path.join(repo,'packages/soterai-lite/scripts/__tests__/release-package.test.cjs'));
test('F31b actual production files allowlist ships all18 final entries',async()=>{
 const f=await fixture(()=>{},true),actual=JSON.parse(await fs.readFile(path.join(repo,'packages/soterai-lite/package.json'),'utf8'));
 f.manifest.files=actual.files;const raw=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');
 await fs.writeFile(path.join(f.attempt,'package.json'),raw);f.receipt.manifestSha256=crypto.createHash('sha256').update(raw).digest('hex');await fs.writeFile(f.receiptPath,JSON.stringify(f.receipt,null,2)+'\n');
 const output=path.join(f.repo,'production-allowlist.vsix'),result=await require(path.join(repo,'packages/soterai-lite/scripts/package.cjs')).packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output});
 const audited=await require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs')).auditFinalRelease({repoRoot:f.repo,vsixPath:output,expectedSha256:result.sha256,buildReceiptPath:f.receiptPath,packageReceiptPath:path.join(f.attempt,'package-receipt.json')});
 assert.equal(audited.report.entries.length,18);assert.equal(audited.report.preRelease,true);
});
