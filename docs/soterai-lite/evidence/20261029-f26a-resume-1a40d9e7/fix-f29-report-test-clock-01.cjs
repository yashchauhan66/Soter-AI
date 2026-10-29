const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
const file=path.join(repo,'packages/vscode-extension/src/__tests__/protectionCenter.model.test.ts'),source=fs.readFileSync(file,'utf8');
const marker='test("F29 matching report remains reported evidence with no live or independent claim",';const line=source.split('\n').find(l=>l.startsWith(marker));assert(line);
const before='m.protectionCenterRows(f).coverage',after='m.protectionCenterRows(f,Date.parse("2026-10-28T00:00:00Z")).coverage';assert.equal(line.split(before).length,2);
fs.writeFileSync(own('protectionCenter.model.pre-clock-09.test.ts'),source,{flag:'wx'});fs.writeFileSync(file,source.replace(line,line.replace(before,after)));
console.log('Only existing matching-report test now supplies the same explicit fixture clock used by adjacent stale/future cases; production and assertions unchanged.');
