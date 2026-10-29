const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
const originalPath='packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts';
const original=fs.readFileSync(path.join(repo,originalPath),'utf8'),changes=[];
let source=original;
const replace=(before,after)=>{assert.equal(source.split(before).length,2,'Unique original diagnostic insertion required');source=source.replace(before,after);changes.push({before,after});};
replace('import * as vscode from "vscode";', 'import * as vscode from "vscode";\nimport { InstallDiagnostics07 } from "./install-diagnostics-07";\nconst diagnostics07 = new InstallDiagnostics07();');
replace('assert(!halted); const value = await vscode.commands.executeCommand("soterai." + name); safeMetadata(value); assert(value); return value;',
    'assert(!halted); diagnostics07.record("command-start", { command: name }); const value = await vscode.commands.executeCommand("soterai." + name); diagnostics07.record("command-return", { command: name, status: value?.status }); safeMetadata(value); assert(value); return value;');
replace('setupStage = "delegated-real-observers";',`setupStage = "delegated-real-observers";
    diagnostics07.record("storage-uri", {fileScheme:context.globalStorageUri.scheme === "file", authority:!!context.globalStorageUri.authority, query:!!context.globalStorageUri.query, fragment:!!context.globalStorageUri.fragment, withinWorkspace:within(root,context.globalStorageUri.fsPath)});
    for (const operation of ["mkdirSync", "lstatSync", "openSync"] as const) {
        const delegate = fs[operation] as (...args: any[]) => unknown;
        patch(fs, operation, function (this: unknown, ...args: any[]) {
            let target: "storage" | "storage-parent" | undefined;
            try { if (typeof args[0] === "string") { if (within(context.globalStorageUri.fsPath,args[0])) target="storage"; else if(samePath(dirname(context.globalStorageUri.fsPath),args[0])) target="storage-parent"; } } catch {}
            try { const value=Reflect.apply(delegate,this,args); if(target)diagnostics07.record("filesystem",{operation,outcome:"RETURNED",target}); return value; }
            catch(error) { if(target)diagnostics07.record("filesystem",{operation,outcome:"THREW",target,code:(error as NodeJS.ErrnoException).code}); throw error; }
        });
    }
    listeners.push(vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration("soterai"))diagnostics07.record("configuration-event");}));
    listeners.push(vscode.workspace.onDidChangeWorkspaceFolders(()=>diagnostics07.record("workspace-event")));`);
replace('return Reflect.apply(nativeCreateServer, http, args);',`const server = Reflect.apply(nativeCreateServer, http, args);
        if(options?.maxHeaderSize === 4096) {
            diagnostics07.record("listener-created");
            server.once("listening",()=>{const address=server.address();diagnostics07.record("listener-listening",{loopback:!!address&&typeof address!=="string"&&address.address==="127.0.0.1"});});
            server.once("close",()=>diagnostics07.record("listener-close"));
            server.once("error",error=>diagnostics07.record("listener-error",{code:(error as NodeJS.ErrnoException).code}));
        }
        return server;`);
replace('catch (error) { observations[index].status = "FAIL";', 'catch (error) { diagnostics07.frames(error); observations[index].status = "FAIL";');
replace('children, requests: wires, commitProofs, reviews, secretStores: stores, ownerServers,','children, requests: wires, commitProofs, reviews, secretStores: stores, ownerServers, diagnostics07: diagnostics07.snapshot(),');
let reversed=source;for(const row of [...changes].reverse()){assert.equal(reversed.split(row.after).length,2);reversed=reversed.replace(row.after,row.before);}assert.equal(reversed,original);
const ts=require('typescript');
const checks=text=>{const sf=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true);const found=[];const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add')found.push(node.getText(sf));ts.forEachChild(node,visit);};visit(sf);return found;};
assert.equal(checks(original).length,34);assert.deepEqual(checks(source),checks(original));
fs.writeFileSync(own('f26a-install-diagnostics-07.host.ts'),source,{flag:'wx'});
fs.writeFileSync(own('diagnostic-transform-07.json'),JSON.stringify({status:'DIAGNOSTIC_ONLY_SOURCE_UNEXECUTED',originalPath,originalSha256:crypto.createHash('sha256').update(original).digest('hex'),unchangedAddCallbacks:34,reversalByteExact:true,changes},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'DIAGNOSTIC_FIXTURE_PREPARED_NOT_RUN',unchangedCallbacks:34,reversalByteExact:true}));
