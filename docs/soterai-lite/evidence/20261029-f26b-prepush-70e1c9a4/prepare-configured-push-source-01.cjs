'use strict';
// Source preparation only. No native host, subprocess, socket, D-profile write or Git push.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>JSON.parse(fs.readFileSync(own(n),'utf8').replace(/^\uFEFF/,'')),save=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const baseline=fs.readFileSync(own('local-push-admission-before-01.txt'),'utf8'),fixed=fs.readFileSync(own('local-push-admission-after-01.txt'),'utf8');assert(/^# tests 12$/m.test(baseline)&&/^# fail 12$/m.test(baseline));assert(/^# tests 12$/m.test(fixed)&&/^# pass 12$/m.test(fixed)&&/^# fail 0$/m.test(fixed));assert.equal(read('local-push-admission-after-01.txt.result.json').exitCode,0);
const before=fs.readFileSync(own('native-prepush-09.host.ts.txt'),'utf8');assert.equal(sha(before),read('native-fixture-static-result-09.json').sha256);const runStart=before.indexOf('export async function run(context: vscode.ExtensionContext): Promise<void> {');assert(runStart>0);let source=before.slice(0,runStart);
const replacements=[['import * as vscode from "vscode";','import * as vscode from "vscode";\nconst { authorizeLocalPush, localRemoteSection, localPushArgs, collectorProbeArgs } = require("./local-push-admission-01.cjs");'],['type ChildKind = "projection" | "scan" | "client" | "hook-component";','type ChildKind = "projection" | "scan" | "client" | "hook-component" | "configured-push" | "collector-read";'],['(?:SETUP|F26B-H[PR][0-9]{2})','(?:SETUP|F26B-GP[0-9]{2})'],['["projection", "scan", "client", "hook-component"].includes(row.kind)','["projection", "scan", "client", "hook-component", "configured-push", "collector-read"].includes(row.kind)'],['"DIRECT_INSTALLED_HOOK_NOT_GIT_PUSH"].includes(row.operation)','"DIRECT_INSTALLED_HOOK_NOT_GIT_PUSH", "ACTUAL_GIT_PUSH_LOCAL_PUBLIC", "ACTUAL_GIT_PUSH_LOCAL_BLOCKED_SECRET", "LOCAL_COLLECTOR_OBJECT_PROBE"].includes(row.operation)'],['ownerEnvironment = minimalEnvironment();','await admitConfiguredPush(); ownerEnvironment = minimalEnvironment();'],['if (phase === "primary") await manualHistory(); else { tips = JSON.parse(await nativeRead(tipsFile(), "utf8")); assert(Object.values(tips).every(value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value))); }','assert.equal(phase, "primary"); await manualHistory(); await prepareLocalCollector();'],['F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH','F26B_CONFIGURED_LOCAL_FILE_PUSH_TWO_INVOCATIONS_ONLY']];
for(const[from,to]of replacements){assert(source.includes(from),from);source=source.replaceAll(from,to);}
source+=String.raw`
let collector = "", pushInvocations = 0, expectedLocalConfig = Buffer.alloc(0), authorityFile = "", authoritySha256 = "";
async function admitConfiguredPush(): Promise<void> {
    collector = join(parent, "collector.git"); authorityFile = process.env[PREFIX + "PUSH_AUTHORIZATION"] ?? "";
    authoritySha256 = process.env[PREFIX + "PUSH_AUTHORIZATION_SHA256"] ?? "";
    assert.equal(authorityFile, join(parent, "local-push-authorization.json")); assert.match(authoritySha256, /^[a-f0-9]{64}$/);
    ordinary(authorityFile); const raw = await nativeRead(authorityFile); assert(raw.length <= 16384); assert.equal(sha(raw), authoritySha256);
    authorizeLocalPush(JSON.parse(raw.toString("utf8")), root, collector, process.env[PREFIX + "PUSH_BINDING_SHA256"]);
}
async function prepareLocalCollector(): Promise<void> {
    await assert.rejects(fsp.lstat(collector), { code: "ENOENT" });
    for (const part of ["objects/info", "objects/pack", "refs/heads", "hooks", "info"]) await fsp.mkdir(join(collector, ...part.split("/")), { recursive: true });
    await fsp.writeFile(join(collector, "HEAD"), "ref: refs/heads/public\n", { flag: "wx" });
    await fsp.writeFile(join(collector, "config"), "[core]\n repositoryformatversion = 0\n bare = true\n", { flag: "wx" });
    assert.equal((await nativeRead(configFile(), "utf8")), BASE_CONFIG);
    expectedLocalConfig = Buffer.from(BASE_CONFIG + localRemoteSection(root, collector));
    await fsp.writeFile(configFile(), expectedLocalConfig);
}
async function fixtureGit(args: string[], kind: "configured-push" | "collector-read", operation: string): Promise<Completion> {
    assert(!halted); await admitConfiguredPush(); ordinary(collector); assert((await nativeRead(configFile())).equals(expectedLocalConfig)); fileHash(GIT, GIT_SHA256);
    const child = nativeSpawn(GIT, args, { cwd: root, env: { ...ownerEnvironment, GIT_ALLOW_PROTOCOL: "file" }, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const pending = observe(child, kind, operation); assert(child.stdin); child.stdin.once("error", () => {}); child.stdin.end();
    const done = await pending; closed(done.receipt);
    for (const bytes of [done.stdout, done.stderr]) { assert(!bytes.includes(Buffer.from(PRIVATE)) && !bytes.includes(Buffer.from(SECRET))); }
    assert((await nativeRead(configFile())).equals(expectedLocalConfig)); return done;
}
async function actualLocalPush(tip: string, target: string, decision: "ALLOW" | "BLOCK"): Promise<void> {
    const index = pushInvocations; const args = localPushArgs(root, collector, tip, target, index); assert.equal(index, decision === "ALLOW" ? 0 : 1);
    const beforeWires = wires.length, beforeMarker = await markerCount(), beforeHook = await fact(hook());
    pushInvocations++; const done = await fixtureGit(args, "configured-push", index === 0 ? "ACTUAL_GIT_PUSH_LOCAL_PUBLIC" : "ACTUAL_GIT_PUSH_LOCAL_BLOCKED_SECRET");
    assert.equal(done.receipt.code, decision === "ALLOW" ? 0 : 1); assert.equal(wires.length, beforeWires + 1);
    const wire = wires.at(-1)!; await until(() => wire.requestClosed && wire.responseFinished && wire.responseClosed, "Actual configured push owner exchange did not close.");
    assert(wire.requestValid && wire.signatureValid && wire.transcriptMatched); assert.equal(wire.status, decision);
    assert.equal(await markerCount(), beforeMarker + (decision === "ALLOW" ? 1 : 0)); assert.deepEqual(await fact(hook()), beforeHook);
    done.stdout.fill(0); done.stderr.fill(0);
}
async function collectorProbe(oid: string, exists: boolean): Promise<void> {
    const done = await fixtureGit(collectorProbeArgs(root, collector, oid), "collector-read", "LOCAL_COLLECTOR_OBJECT_PROBE");
    if (exists) assert.equal(done.receipt.code, 0); else assert.notEqual(done.receipt.code, 0);
    assert.equal(done.stdout.length, 0); done.stdout.fill(0); done.stderr.fill(0);
}
export async function run(context: vscode.ExtensionContext): Promise<void> {
    journal("run-enter"); assert(journalHealthy); assert.equal(context, contextRef); await admitConfiguredPush();
    const configuration = vscode.workspace.getConfiguration("soterai"), initialFlag = configuration.inspect<boolean>(FLAG)?.globalValue;
    const runtimes = await runtimeFacts(), initialPolicy = await policyFacts(), executionManifest = await fact(join(context.extensionUri.fsPath, "package.json"));
    const observations: Observation[] = [], checks: Array<{ scope: string; work(): Promise<void> }> = [];
    let driverFailure: string | null = null, originalBody: Buffer | undefined, originalFact: Fact | undefined;
    const add = (scope: string, work: () => Promise<void>) => checks.push({ scope, work });
    const setFlag = async (value: boolean | undefined) => { await configuration.update(FLAG, value, vscode.ConfigurationTarget.Global); await idle(); };
    add("Exact accepted runtimes and default-false machine route; fresh local collector and explicit two-push authority", async () => {
        assert(initialFlag === undefined || initialFlag === false); assert.equal(configuration.inspect<boolean>(FLAG)?.defaultValue, false);
        assert.equal(pushInvocations, 0); assert(!(await fact(hook())).present); assert.deepEqual(await fsp.readdir(join(collector, "refs", "heads")), []);
        assert.equal((await nativeRead(join(collector, "config"), "utf8")), "[core]\n repositoryformatversion = 0\n bare = true\n"); await status("UNAVAILABLE");
    });
    add("Supported synthetic original is preserved while disabled and cancelled install has no owner or recovery effects", async () => {
        const quoted = markerFile().replace(/\\/g, "/").split("'").join("'\"'\"'");
        originalBody = Buffer.from("#!/bin/sh\ncommand printf '%s\\n' once >> '" + quoted + "'\nexit 0\n"); originalBodies.set(0, originalBody);
        await fsp.writeFile(hook(), originalBody, { flag: "wx", mode: 0o700 }); await fsp.chmod(hook(), 0o700); originalFact = await fact(hook());
        const before = JSON.stringify({ stores, ownerServers }); assert.equal((await call("installPrePushGuard")).status, "UNAVAILABLE");
        await setFlag(true); approve = false; try { assert.equal((await call("installPrePushGuard")).status, "CANCELLED"); } finally { approve = true; }
        assert.equal(JSON.stringify({ stores, ownerServers }), before); assert.deepEqual(await fact(hook()), originalFact); await status("OWNER_REVIEW_REQUIRED");
    });
    add("Reviewed configured-hook installation creates signed live owner and encrypted original recovery", async () => {
        await install(); const current = await saved(); assert.equal(current.value.receipt.originalPresent, true); assert.equal(stores.signing, 1); assert.equal(stores.backupKey, 1); assert.equal(await markerCount(), 0);
    });
    add("Actual configured Git push transfers only the public tip to the local bare collector and runs original once", async () => {
        await actualLocalPush(tips.public, "refs/heads/public", "ALLOW");
        assert.equal((await nativeRead(join(collector, "refs", "heads", "public"), "utf8")), tips.public + "\n"); await collectorProbe(tips.public, true);
    });
    add("Actual configured Git push with removed historical synthetic secret is withheld before collector ref or object transfer", async () => {
        await actualLocalPush(tips.removed, "refs/heads/blocked-secret", "BLOCK");
        assert(!(await fact(join(collector, "refs", "heads", "blocked-secret"))).present); assert.deepEqual(await fsp.readdir(join(collector, "refs", "heads")), ["public"]);
        const secretOid = createHash("sha1").update(Buffer.from("blob " + Buffer.byteLength(SECRET) + "\0" + SECRET)).digest("hex");
        await collectorProbe(secretOid, false); await collectorProbe(tips.public, true); assert.equal(await markerCount(), 1);
    });
    add("Cancelled configured-hook restore preserves exact hook encrypted recovery and live owner", async () => {
        const before = await fact(hook()), recovery = await backupFacts(), current = await saved(); approve = false;
        try { assert.equal((await call("restorePrePushGuard")).status, "CANCELLED"); } finally { approve = true; }
        assert.deepEqual(await fact(hook()), before); assert.deepEqual(await backupFacts(), recovery); assert.equal((await saved()).raw, current.raw); await status("LIVE");
    });
    add("Reviewed restore returns exact synthetic original bytes/mode and original flag and observes owner withdrawal", async () => {
        assert.equal((await call("restorePrePushGuard")).status, "RESTORED"); assert(originalBody && originalFact); assert((await nativeRead(hook())).equals(originalBody)); assert.deepEqual(await fact(hook()), originalFact);
        await setFlag(initialFlag); await ownerClosed(); assert.deepEqual(await policyFacts(), initialPolicy); assert.equal(configuration.inspect<boolean>(FLAG)?.globalValue, initialFlag);
    });
    add("Both approved local push invocations and all declared direct Git owners close EOF with unchanged runtime and no raw metadata leak", async () => {
        assert.equal(pushInvocations, 2); await Promise.all(pendingChildren); children.forEach(closed); assert.equal(children.filter(row => row.kind === "configured-push").length, 2);
        assert.equal(sourceDocuments, 0); assert.equal(sourceDocumentEvents, 0); assert.equal(directWorktreeReads, 0); assert.equal(directObjectReads, 0); assert(!metadataLeak); assert.equal(environmentDigest(), parentEnvironment);
        assert.deepEqual(await runtimeFacts(), runtimes); assert.deepEqual(await policyFacts(), initialPolicy); assert.equal(await markerCount(), 1); await ownerClosed();
    });
    assert.equal(checks.length, 8); checks.forEach((row, index) => observations.push({ id: "F26B-GP" + String(index + 1).padStart(2, "0"), scope: row.scope, status: "NOT_RUN" }));
    try { for (let index = 0; index < checks.length; index++) { caseId = observations[index].id; setupStage = caseId;
        try { journal("case-start"); assert(journalHealthy && !halted); await checks[index].work(); observations[index].status = "PASS"; journal("case-pass"); assert(journalHealthy); }
        catch (error) { journal("case-fail"); observations[index].status = "FAIL"; observations[index].errorName = error instanceof Error ? error.name : "UnknownFailure"; driverFailure = halted ? "STOP_UNCONFIRMED" : "ConfiguredLocalPushFixtureFailure"; break; }
    } } finally {
        const busy = children.some(row => row.busy); if (!busy) { listeners.forEach(listener => listener.dispose()); for (const restore of restorers.reverse()) restore(); }
        const summary = { schemaVersion: 1, phase, syntheticOnly: true, scope: "F26B_CONFIGURED_LOCAL_FILE_PUSH_TWO_INVOCATIONS_ONLY", hostVersion: vscode.version,
            extensionBundleSha256: runtimes[0].sha256, workerSha256: runtimes[3].sha256, runtimeBindings: runtimes, currentRuntimeBindings: await runtimeFacts(), executionManifest, currentExecutionManifest: await fact(join(context.extensionUri.fsPath, "package.json")), hostProbeSha256: sha(await nativeRead(__filename)), codeSha256,
            observations, expectedChecks: 8, passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length, notRun: observations.filter(row => row.status === "NOT_RUN").length, driverFailure,
            pushInvocations, children, requests: wires, reviews, secretStores: stores, ownerServers, ownerListeners, sourceDocuments, sourceDocumentEvents, directWorktreeReads, directObjectReads, metadataLeak,
            parentEnvironmentUnchanged: environmentDigest() === parentEnvironment, busyChildren: children.filter(row => row.busy).length, timedOutChildren: children.filter(row => row.timedOut).length, diagnosticJournal: { healthy: journalHealthy, bytes: journalBytes, records: journalRecords, limit: JOURNAL_LIMIT },
            safeWithdrawal: !driverFailure && !busy ? "EXACT_ORIGINAL_HOOK_MODE_AND_FLAG_RESTORED_OWNER_CLOSED" : "NOT_RUN_OR_INCOMPLETE", localOnlyAuthoritySha256: authoritySha256,
            signalsRequested: children.reduce((sum, row) => sum + row.signalsRequested, 0), independence: "LOW", review: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", nestedGitTransportAndHookClientEOF: "NOT_INFERRED_FROM_OUTER_GIT_CLOSE", externalNetwork: "NOT_AUTHORIZED_NOT_RUN", notTested: ["Real secrets or external remotes", "Hostile same-user process boundary", "Human agent smoke or usability", "Other platforms/remote workspaces"] };
        safeMetadata(summary); await fsp.writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" }); if (busy) throw Error("STOP_UNCONFIRMED");
    }
    if (driverFailure || observations.some(row => row.status !== "PASS")) throw Error("Configured local push fixture incomplete.");
}
`;
const input='native-configured-push-01.host.ts.txt';fs.writeFileSync(own(input),source,{flag:'wx'});
const virtual=path.join(repo,'packages/vscode-extension/src/__tests__/__f26b_configured_push01.ts'),parsed=ts.readConfigFile(path.join(repo,'packages/vscode-extension/tsconfig.json'),ts.sys.readFile);assert(!parsed.error);const config=ts.parseJsonConfigFileContent(parsed.config,ts.sys,path.join(repo,'packages/vscode-extension')),options={...config.options,noEmit:true},host=ts.createCompilerHost(options),originalSource=host.getSourceFile.bind(host),originalRead=host.readFile.bind(host),originalExists=host.fileExists.bind(host),same=file=>path.resolve(file).toLowerCase()===virtual.toLowerCase();host.getSourceFile=(file,language,...rest)=>same(file)?ts.createSourceFile(file,source,language,true,ts.ScriptKind.TS):originalSource(file,language,...rest);host.readFile=file=>same(file)?source:originalRead(file);host.fileExists=file=>same(file)||originalExists(file);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host)).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),tree=ts.createSourceFile(virtual,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS),cases=[];function visit(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add'&&ts.isStringLiteral(node.arguments[0]))cases.push({id:'F26B-GP'+String(cases.length+1).padStart(2,'0'),scope:node.arguments[0].text});ts.forEachChild(node,visit);}visit(tree);
save('configured-push-static-result-01.json',{status:diagnostics.length||tree.parseDiagnostics.length?'FAIL_SOURCE_ONLY':'PASS_SOURCE_ONLY_NOT_AUTHORIZED_NOT_EXECUTED_NO_DRIVER_EMIT',input,bytes:Buffer.byteLength(source),sha256:sha(source),diagnostics,parseErrors:tree.parseDiagnostics.map(d=>d.code),cases,sourceParent:{input:'native-prepush-09.host.ts.txt',sha256:sha(before)},originalNative36SourceUnchanged:sha(fs.readFileSync(own('native-prepush-09.host.ts.txt')))===sha(before),configuredPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN'});assert.equal(cases.length,8);assert.equal(diagnostics.length,0);assert.equal(tree.parseDiagnostics.length,0);console.log(JSON.stringify({status:'PREPARED_LOCAL_CONFIGURED_PUSH8_STRICT_SOURCE_ONLY_NOT_AUTHORIZED_OR_EXECUTED',input,sha256:sha(source),cases:8}));
