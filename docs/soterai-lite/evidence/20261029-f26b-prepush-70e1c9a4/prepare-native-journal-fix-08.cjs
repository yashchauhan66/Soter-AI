'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>JSON.parse(fs.readFileSync(own(n),'utf8').replace(/^\uFEFF/,'')),save=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const old=fs.readFileSync(own('native-prepush-07.host.ts.txt'),'utf8');assert.equal(sha(old),'93d06b1775555534911e387616364425f8a4b7b20b87a0b3c74533ccb9032eca');
const journal=`const JOURNAL_LIMIT = 1048576;
let journalHealthy = true, journalBytes = 0, journalRecords = 0, journalCreated = false;
function journal(event: "run-enter" | "case-start" | "case-pass" | "case-fail" | "child-start" | "child-close", row?: ChildReceipt, childPid?: number): void {
    if (!journalHealthy) return; let fd: number | undefined;
    try {
        assert(["run-enter", "case-start", "case-pass", "case-fail", "child-start", "child-close"].includes(event));
        assert(phase === "primary" || phase === "restart"); const selectedCase = row?.caseId ?? caseId;
        assert(/^(?:SETUP|F26B-H[PR][0-9]{2})$/.test(selectedCase));
        assert(childPid === undefined || (Number.isSafeInteger(childPid) && childPid > 0));
        if (row) { assert(["projection", "scan", "client", "hook-component"].includes(row.kind));
            assert(["version", "config", "commits", "tree", "batch", "DIRECT_EXACT_FOURTH_RUNTIME_PRE_PUSH", "DIRECT_INSTALLED_HOOK_NOT_GIT_PUSH"].includes(row.operation)); }
        const child = row ? children.indexOf(row) + 1 : null; assert(child === null || (child > 0 && child <= 8192));
        if (event === "child-close") assert(row && row.closed && row.stdoutEOF && row.stderrEOF && !row.busy);
        const payload = { schemaVersion: 1, record: journalRecords + 1, timestamp: new Date().toISOString(), event, phase, caseId: selectedCase,
            hostPid: process.pid, child, pid: childPid ?? null, kind: row?.kind ?? null, operation: row?.operation ?? null,
            closed: row?.closed ?? null, stdoutEOF: row?.stdoutEOF ?? null, stderrEOF: row?.stderrEOF ?? null, busy: row?.busy ?? null,
            code: row?.code ?? null, signalPresent: row ? row.signal !== null : null, timedOut: row?.timedOut ?? null,
            signalsRequested: row?.signalsRequested ?? 0 };
        const raw = Buffer.from(JSON.stringify(payload) + "\\n");
        assert(raw.length <= 2048 && journalBytes + raw.length <= JOURNAL_LIMIT && journalRecords < 8192);
        const file = output + ".progress.jsonl"; assert(output && within(parent, file) && !within(root, file));
        if (journalCreated) { ordinary(file); const stat = fs.lstatSync(file); assert(stat.isFile() && stat.nlink === 1 && stat.size === journalBytes); }
        fd = fs.openSync(file, journalCreated ? "a" : "wx", 0o600);
        let offset = 0; while (offset < raw.length) { const count = fs.writeSync(fd, raw, offset, raw.length - offset); assert(count > 0); offset += count; }
        fs.closeSync(fd); fd = undefined; journalCreated = true; journalBytes += raw.length; journalRecords++;
    } catch { journalHealthy = false; }
    finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch { journalHealthy = false; } } }
}
`;
const substitutions=[
 ['const sha = (bytes: Uint8Array | string)',journal+'const sha = (bytes: Uint8Array | string)'],
 ['        finish({ receipt: row, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });','        journal("child-close", row, child.pid);\n        finish({ receipt: row, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });'],
 ['    return Promise.race([actual, new Promise<never>((_done, reject) => {','    journal("child-start", row, child.pid);\n    return Promise.race([actual, new Promise<never>((_done, reject) => {'],
 ['export async function run(context: vscode.ExtensionContext): Promise<void> {','export async function run(context: vscode.ExtensionContext): Promise<void> {\n    journal("run-enter"); assert(journalHealthy, "Bounded metadata journal unavailable.");'],
 ['setupStage = caseId; try { assert(!halted); await checks[index].work(); observations[index].status = "PASS"; }','setupStage = caseId; try { journal("case-start"); assert(journalHealthy, "Bounded metadata journal unavailable."); assert(!halted); await checks[index].work(); observations[index].status = "PASS"; journal("case-pass"); assert(journalHealthy, "Bounded metadata journal unavailable."); }'],
 ['catch (error) { observations[index].status = "FAIL"; observations[index].errorName','catch (error) { journal("case-fail"); observations[index].status = "FAIL"; observations[index].errorName'],
 ['busyChildren: children.filter(row => row.busy).length, timedOutChildren: children.filter(row => row.timedOut).length, scope:', 'busyChildren: children.filter(row => row.busy).length, timedOutChildren: children.filter(row => row.timedOut).length, journalHealthy, journalBytes, journalRecords, scope:'],
 ['            readyForInterphase: phase === "primary"','            diagnosticJournal: { healthy: journalHealthy, bytes: journalBytes, records: journalRecords, limit: JOURNAL_LIMIT },\n            readyForInterphase: phase === "primary"']
];let current=old;for(const[from,to]of substitutions){assert.equal(current.split(from).length,2,from);current=current.replace(from,to);}let reverse=current;for(const[from,to]of [...substitutions].reverse())reverse=reverse.replace(to,from);assert.equal(reverse,old);
const input='native-prepush-08.host.ts.txt';fs.writeFileSync(own(input),current,{flag:'wx'});
const virtual=path.join(repo,'packages/vscode-extension/src/__tests__/__f26b_native_journal08.ts'),parsed=ts.readConfigFile(path.join(repo,'packages/vscode-extension/tsconfig.json'),ts.sys.readFile);assert(!parsed.error);const config=ts.parseJsonConfigFileContent(parsed.config,ts.sys,path.join(repo,'packages/vscode-extension')),options={...config.options,noEmit:true},host=ts.createCompilerHost(options),originalSource=host.getSourceFile.bind(host),originalRead=host.readFile.bind(host),originalExists=host.fileExists.bind(host),same=file=>path.resolve(file).toLowerCase()===virtual.toLowerCase();host.getSourceFile=(file,language,...rest)=>same(file)?ts.createSourceFile(file,current,language,true,ts.ScriptKind.TS):originalSource(file,language,...rest);host.readFile=file=>same(file)?current:originalRead(file);host.fileExists=file=>same(file)||originalExists(file);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host)).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
const parse=text=>{const tree=ts.createSourceFile(virtual,text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS),callbacks=[];function visit(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add'&&ts.isStringLiteral(node.arguments[0]))callbacks.push({scope:node.arguments[0].text,body:node.arguments[1].getText(tree)});ts.forEachChild(node,visit);}visit(tree);return{tree,callbacks};};const before=parse(old),after=parse(current);assert.deepEqual(after.callbacks,before.callbacks);assert.equal(after.callbacks.length,36);const cases=after.callbacks.map((row,index)=>({phase:index<30?'primary':'restart',scope:row.scope}));assert.deepEqual(cases,read('native-fixture-static-result-07.json').cases);const parseErrors=after.tree.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));save('native-fixture-static-result-08.json',{status:diagnostics.length||parseErrors.length?'FAIL_SOURCE_ONLY':'PASS_SOURCE_ONLY_NOT_EXECUTED_NO_DRIVER_EMIT',input,bytes:Buffer.byteLength(current),sha256:sha(current),parseErrors,diagnostics,cases});assert.equal(diagnostics.length,0);assert.equal(parseErrors.length,0);
save('native-journal-review-08.json',{status:'BOUNDED_METADATA_DIAGNOSTICS_ONLY_UNKNOWN_NATIVE10_TERMINATION_NOT_FIXED_OR_RETRIED',observedAt:new Date().toISOString(),substitutions,reversalByteExact:true,all36ScopesAndCallbackBodiesByteExact:true,allExistingBudgetAndOwnershipLogicRetained:true,additionalJournalHealthAssertionsFailClosed:true,childStartLoggingAfterAllOwnerReadersRegistered:true,childCloseLoggingOnlyAfterActualCloseAndBothEOF:true,loggingFailureNeverThrowsFromOwnerObserver:true,newTimers:0,rawArgumentsEnvironmentBodiesKeysOrFindingsLogged:false,bytesPerPhase:1048576,sourceBefore:{input:'native-prepush-07.host.ts.txt',bytes:Buffer.byteLength(old),sha256:sha(old)},sourceAfter:{input,bytes:Buffer.byteLength(current),sha256:sha(current)},productionChanged:false,source1070AndVsixUnchanged:true,native11:'NOT_AUTHORIZED_NOT_MATERIALIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',configuredPush:'NOT_AUTHORIZED_NOT_RUN'});console.log(JSON.stringify({status:'JOURNAL_DIAGNOSTICS_STRICT_TYPECHECK_36_CALLBACKS_BYTE_EXACT_NOT_NATIVE',input,bytes:Buffer.byteLength(current),sha256:sha(current)}));
