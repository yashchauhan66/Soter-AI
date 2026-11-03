'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const repo=path.resolve(__dirname,'../../../..'),{fixture}=require(path.join(repo,'packages/soterai-lite/scripts/__tests__/release-package.test.cjs'));
const {auditFinalRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));
for(const [id,mutate]of [
 ['unclosed tail',s=>s+'<unclosed'],
 ['second document root',s=>s+'<Second/>'],
 ['undeclared entity',s=>s.replace('</Metadata>','<DisplayName>&unknown;</DisplayName></Metadata>')]
])test('F31b XML rejects '+id,async()=>{
 const f=await fixture(x=>x.entries.set('extension.vsixmanifest',Buffer.from(mutate(x.entries.get('extension.vsixmanifest').toString()))));
 await assert.rejects(auditFinalRelease(f.options),/XML|xml|malformed/i);
});
