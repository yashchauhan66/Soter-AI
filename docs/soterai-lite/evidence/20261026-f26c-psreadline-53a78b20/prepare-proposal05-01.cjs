// Prepare only: keep the canonical1005 full-tested inputs and VSIX untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),emit=(n,t)=>fs.writeFileSync(own(n),t,{flag:'wx'}),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}};
const source='packages/vscode-extension/src/__tests__/host/litePSReadLineHistory.host.ts',before=fs.readFileSync(path.join(repo,source),'utf8');let candidate=before;
candidate=candidate.replace('    const custody = join(dirname(root), "f26c-history-restart.json");',`    const recoveryDiagnostics: Array<object> = [];
    const recoverySnapshot = async (point: string, expectedKey: string | undefined) => {
        try {
            const liveKey = await context.secrets.get(KEY), row = ownedReceipt(), profile = await current();
            let backupBytes: number | undefined;
            if (typeof row?.backupHandle === "string" && /^[a-f0-9]{32}$/.test(row.backupHandle)) {
                const stat = await fsp.lstat(join(context.globalStorageUri.fsPath, "config-backups", row.backupHandle + ".enc"));
                if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 131072) backupBytes = stat.size;
            }
            recoveryDiagnostics.push({ point, ownKeyPresent: typeof liveKey === "string" && liveKey.length > 0,
                ownKeyMatchesSaved: typeof expectedKey === "string" && liveKey === expectedKey,
                receiptPhase: ["PREPARED", "APPLIED", "RESTORING"].includes(row?.phase) ? row.phase : "UNKNOWN",
                profileMatchesBefore: typeof row?.beforeDigest === "string" && sha(profile) === row.beforeDigest,
                profileMatchesAfter: typeof row?.afterDigest === "string" && sha(profile) === row.afterDigest,
                backupBytes, observedAt: new Date().toISOString() });
        } catch { recoveryDiagnostics.push({ point, status: "SNAPSHOT_UNAVAILABLE" }); }
    };
    const custody = join(dirname(root), "f26c-history-restart.json");`);
const restored='finally { await context.secrets.store(KEY, saved); }';assert.equal(candidate.split(restored).length,2);candidate=candidate.replace(restored,'finally { await context.secrets.store(KEY, saved); await recoverySnapshot("after-own-key-return", saved); }');
const catchLine='try { await work(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; }';assert(candidate.includes(catchLine));candidate=candidate.replace(catchLine,catchLine+'\n        if (row.id === "F26c-N19" || row.id === "F26c-N20") await recoverySnapshot("after-" + row.id, originalKey);');
assert(candidate.includes('counts: { picks, modals'));candidate=candidate.replace('counts: { picks, modals','recoveryDiagnostics, counts: { picks, modals');
const titles=t=>[...t.matchAll(/await check\("([^"]+)"/g)].map(r=>r[1]);assert.equal(titles(before).length,28);assert.deepEqual(titles(candidate),titles(before));assert(!candidate.includes('inspector'));emit('litePSReadLineHistory.proposal05.host.ts',candidate);
// Additional component evidence uses only synthetic fixture/profile/key state.
let unit=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/psReadLineHistoryController.test.ts'),'utf8');
unit=unit.replaceAll('./phase2/','../../../../packages/vscode-extension/src/__tests__/phase2/').replaceAll('../history-hooks/','../../../../packages/vscode-extension/src/history-hooks/');
unit+=`\n\ntest("F26c proposal05 own synthetic recovery key return permits exact restore in component adapter", async () => {
    const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED");
    const saved = await f.context.secrets.get("soterai.configBackupKey"); assert(saved); const installed = await readFile(f.target);
    await f.context.secrets.delete("soterai.configBackupKey"); assert.equal((await f.controller.restore()).status, "INCOMPLETE");
    assert((await readFile(f.target)).equals(installed)); assert.equal(await f.context.secrets.get("soterai.configBackupKey"), undefined);
    await f.context.secrets.store("soterai.configBackupKey", saved); assert.equal(await f.context.secrets.get("soterai.configBackupKey"), saved);
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await readFile(f.target)).toString(), privateText);
    assert.equal(f.context._inspect.secretStore.size, 1); f.controller.dispose();
});\n`;
emit('proposal05-component.test.ts',unit);
emit('tsconfig-proposal05.json',JSON.stringify({extends:'../../../../packages/vscode-extension/tsconfig.json',compilerOptions:{rootDir:'../../../..',noEmit:true},include:['litePSReadLineHistory.proposal05.host.ts']},null,2)+'\n');
let builder=fs.readFileSync(own('build-native-hosts-03.cjs'),'utf8').replaceAll('compiler-08','compiler-proposal05').replaceAll('prebuilt-native-hosts-03','prebuilt-native-hosts-proposal05').replaceAll('native-driver-provenance-03','native-driver-provenance-proposal05');
builder=builder.replace("path.join(repo,'packages/vscode-extension/src/__tests__/host/litePSReadLineHistory.host.ts')","path.join(__dirname,'litePSReadLineHistory.proposal05.host.ts')");assert(builder.includes("path.join(__dirname,'litePSReadLineHistory.proposal05.host.ts')"));
builder=builder.replace("status:'BUILT_NOT_RUN_ESM_PARSER_INLINED',observedAt:","status:'BUILT_NOT_RUN_ESM_PARSER_INLINED',candidateFixture:{path:path.relative(repo,path.join(__dirname,'litePSReadLineHistory.proposal05.host.ts')).replace(/\\\\/g,'/'),bytes:fs.statSync(path.join(__dirname,'litePSReadLineHistory.proposal05.host.ts')).size,sha256:sha(fs.readFileSync(path.join(__dirname,'litePSReadLineHistory.proposal05.host.ts')))},observedAt:");emit('build-native-hosts-proposal05.cjs',builder);
const proof=read(own('full-inputs-03.json'));for(const pin of proof.files)assert.deepEqual(fact(path.join(repo,pin.path)),pin);
emit('proposal05-preparation-01.json',JSON.stringify({status:'PREPARED_NOT_APPROVED_NOT_EXECUTED',observedAt:new Date().toISOString(),candidate:fact(own('litePSReadLineHistory.proposal05.host.ts')),component:fact(own('proposal05-component.test.ts')),tsconfig:fact(own('tsconfig-proposal05.json')),source:fact(path.join(repo,source)),current1005AllExact:true,unchangedOracleTitles:28,primary:23,restart:5,scope:'One additional normal undebugged isolated F26c run; metadata-only own synthetic key readback + phase/profile-match/backup-size snapshots. Same vendor pins/runtime/oracles/payloads/deadlines; no sleeps, writes, repair, retry, inspector or process signals. Current canonical host and VSIX unchanged.',cause:'N19 post-key-return restore INCOMPLETE; root cause not established. Component and typecheck/build/static review still pending before asking approval.',native06:'SEPARATE_F26a_USER_DEFERRED_EXCLUDED_NOT_RUN'},null,2)+'\n');console.log('Prepared Proposal05 candidate and synthetic component fixture only; no native execution or approval.');
