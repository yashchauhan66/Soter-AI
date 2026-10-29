const fs=require('node:fs'),crypto=require('node:crypto');
const source='packages/vscode-extension/src/__tests__/checkedHookFile.test.ts',target='packages/vscode-extension/src/__tests__/checkedPrePushHookFile.test.ts';
const before=fs.readFileSync(source,'utf8');
let text=before.replaceAll('CheckedHookFile','CheckedPrePushHookFile').replaceAll('pre-commit','pre-push').replaceAll('F26a','F26b').replaceAll('f26a','f26b');
text+=`
test("F26b pre-push capability and snapshot cannot adopt the separate pre-commit leaf", options, async () => {
    const api=await implementation(),f=await fixture(".git/hooks",ORIGINAL),push=prepare(api,f);
    const commitAPI=await import("../history-hooks/CheckedHookFile");
    const commit=commitAPI.prepareCheckedHookFile(f.root,f.hooksRelative,()=>true); assert(commit);
    assert.equal(api.isCheckedPrePushHookFile(commit),false); assert.equal(commitAPI.isCheckedHookFile(push),false);
    assert.equal(push.file,join(f.directory,"pre-push")); assert.equal(commit.file,join(f.directory,"pre-commit"));
    const originalPush=snapshot(push),absentCommit=commit.read(); assert(absentCommit);
    assert.equal(push.write(absentCommit,GENERATED,f.mode),false);
    assert.equal(commit.write(originalPush,GENERATED,f.mode),false);
    assert((await readFile(push.file)).equals(ORIGINAL));
    assert.equal(commit.read()?.bytes,undefined);
});
`;
fs.writeFileSync(target,text,{flag:'wx'});
fs.writeFileSync(__dirname+'/hook-file-test-derivation-02.json',JSON.stringify({source,target,sourceSha256:crypto.createHash('sha256').update(before).digest('hex'),changes:'Separate genuine pre-push fixed-leaf capability; inherited real filesystem/FD/CAS/mode/link/drift oracles and added cross-leaf membership/snapshot denial.'},null,2)+'\n',{flag:'wx'});
