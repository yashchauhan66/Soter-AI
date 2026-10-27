const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let text=fs.readFileSync(own('proposal05-component.test.ts'),'utf8'),at=text.indexOf('test("F26c proposal05 own synthetic recovery');assert(at>=0);const prefix=text.slice(0,at);let tail=text.slice(at);
tail=tail.replace('F26c proposal05 own synthetic recovery key return permits exact restore in component adapter','F26c repeat install journal corruption and returned synthetic key preserve exact recovery');
const anchor='const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED");';assert(tail.includes(anchor));tail=tail.replace(anchor,anchor+`
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await f.controller.install()).status, "APPLIED");
    const journal = join(f.context.globalStorageUri.fsPath, "psreadline-history-state-v1.json"), savedJournal = await readFile(journal);
    await writeFile(journal, JSON.stringify({ ...JSON.parse(savedJournal.toString()), unexpected: true }) + "\\n");
    assert.equal(f.controller.status().status, "UNAVAILABLE"); assert.equal((await f.controller.install()).status, "UNAVAILABLE");
    await writeFile(journal, savedJournal);`);
fs.writeFileSync(own('repeat-recovery.component.test.ts'),prefix+tail,{flag:'wx'});
