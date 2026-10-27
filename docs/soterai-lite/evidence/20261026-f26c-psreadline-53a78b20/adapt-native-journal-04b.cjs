const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),file=path.join(repo,'packages/vscode-extension/src/__tests__/host/litePSReadLineHistory.host.ts'),before=fs.readFileSync(file),text=before.toString();
assert(before.equals(fs.readFileSync(path.join(__dirname,'litePSReadLineHistory-host-before-journal04.ts.txt'))));
const titles=t=>[...t.matchAll(/await check\("([^"]+)"/g)].map(r=>r[1]);assert.equal(titles(text).length,28);
let next=text.replace('STATE = "soterai.lite.psReadLineHistory.receipt.v1"','JOURNAL = "psreadline-history-state-v1.json"');
next=next.replace('const nativeState = () => JSON.stringify(context.globalState.get(STATE));',`const journalFile = join(context.globalStorageUri.fsPath, JOURNAL);
    const ownedReceipt = (): any => {
        try { const stat = fs.lstatSync(journalFile); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 8192);
            return JSON.parse(nativeReadSync(journalFile, "utf8"));
        } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    };
    const nativeState = () => JSON.stringify(ownedReceipt());`);
// clean closes over the independent receipt reader, initialized before use.
next=next.replaceAll('context.globalState.get(STATE)','ownedReceipt()');
next=next.replace('await context.globalState.update(STATE, { ...(row as object), unexpected: true })','await fsp.writeFile(journalFile, JSON.stringify({ ...(row as object), unexpected: true }) + "\\n")');
next=next.replace('await context.globalState.update(STATE, row)','await fsp.writeFile(journalFile, JSON.stringify(row) + "\\n")');
next=next.replace(/    const update = context\.globalState\.update;\r?\n    patch\(context\.globalState, "update",[^\n]+\r?\n/,'');
assert(!/\bSTATE\b/.test(next));assert.deepEqual(titles(next),titles(text));assert(next.includes('const ownedReceipt ='));assert(next.includes('unexpected: true'));assert(!next.includes('globalState'));
fs.writeFileSync(file,next);fs.writeFileSync(path.join(__dirname,'native-journal-adaptation-04.json'),JSON.stringify({status:'BACKEND_ORACLE_ADAPTED_NOT_EXECUTED',observedAt:new Date().toISOString(),beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(next).digest('hex'),unchangedOracleTitles:28,unchangedPrimary:23,unchangedRestart:5,reason:'Observed APPLIED to PREPARED regression; private durable metadata journal replaces Memento authority. Original outcomes and payloads preserved.',nativeImprovementRound:3,native06:'USER_DEFERRED_NOT_RUN'},null,2)+'\n',{flag:'wx'});
console.log('Native private-journal receipt oracles adapted; original 28 titles unchanged, execution pending.');
