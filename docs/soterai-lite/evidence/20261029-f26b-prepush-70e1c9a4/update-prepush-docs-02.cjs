const fs=require('node:fs'),assert=require('node:assert/strict');
const h=__dirname;
const section=`### Optional owning-editor pre-push guard

The separate machine setting \`soterai.lite.historyHooks.prePush\` defaults off. Use **Review and Install Pre-Push Guard**, **Resume Pre-Push Owner**, **Pre-Push Owner Status** and **Restore Original Pre-Push Hook** in the advanced palette. Installation requires one trusted local Windows workspace, native owner review, a supported in-root hooks directory and an explicit or disabled system Git configuration source. Ambiguous config/include layouts, unknown implicit system sources, linked files and unsupported originals are withheld. The selected original hook or its absence and mode are retained in encrypted recovery. A supported UTF-8/LF shell body receives its original arguments, environment and exact admitted stdin after an ALLOW decision; its exit status remains effective.

The live owner checks the full regular-blob history reachable from proposed branch tips, including removed/renamed files and merge parents. It does not trust a claimed remote exclusion or substitute the current index/worktree. Limits are32 updates/32KiB stdin,32 commits,128 blobs,64KiB per blob,1MiB admitted content,4096 tree entries and60seconds. Missing, binary, linked, capped or malformed data withholds the whole request. Commit/tag messages, tags, arbitrary encodings and registered values without a recognized candidate shape remain outside this heuristic blob analysis.

The pinned fourth runtime and signed local decision bind the exact transcript and physical workspace. Owner absence, flag/key/artifact/config drift or incomplete child ownership withholds pushes. Editor restart needs explicit reviewed resume with the retained key. Restore stays available while disabled and changes only exact owned hook bytes; later owner edits remain incomplete recovery. Deliberate hook bypass, same-user processes and the final check-to-push race remain outside these cooperative controls. Installing or enabling the setting does not establish a verified configured-push route; that native acceptance remains NOT_TESTED until its exact current artifact has actually passed.

`;
for(const file of ['packages/vscode-extension/README.md','packages/soterai-lite/README.md']){
 const before=fs.readFileSync(file,'utf8');assert(!before.includes('### Optional owning-editor pre-push guard'));
 const marker='### Optional PowerShell history exclusion';assert.equal(before.split(marker).length,2);
 fs.writeFileSync(h+'/'+file.split('/')[1]+'.README.before-prepush-02.md.txt',before,{flag:'wx'});
 fs.writeFileSync(file,before.replace(marker,section+marker));
}
