'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),adapters=path.join(repo,'packages/vscode-extension/src/adapters'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rename=s=>s.replaceAll('CodexCli','CodexIde').replaceAll('codexCli','codexIde').replaceAll('CODEX_CLI','CODEX_IDE').replaceAll('codex-cli-','codex-ide-').replaceAll('Codex CLI','Codex IDE').replaceAll('CLI0.160.1','IDE26.51007.21434').replaceAll('0.160.1','26.51007.21434');
const read=file=>fs.readFileSync(file,'utf8');function replace(s,a,b){assert(s.includes(a),a);return s.replace(a,b);}
let policy=rename(read(path.join(adapters,'CodexCliAdapterPolicy.ts')));
const start=policy.indexOf('export const CODEX_IDE_PIN'),end=policy.indexOf('const sha =');assert(start>=0&&end>start);
policy=policy.slice(0,start)+`export const CODEX_IDE_PIN = Object.freeze({id:'openai.chatgpt',version:'26.51007.21434',runtimeVersion:'0.162.0-alpha.17.2',nativeBytes:334120912,javascriptBytes:2539539,
 manifestSha256:'10044df52cde43b8e7a98fd6f9c8b159db2283b3bee3a1f12ed7caf44b8d498c',javascriptSha256:'a8069de80c8f8141481d033f94c3a95e1b59f399143cb2554d3f68469dfbe5b8',
 runtimePackageSha256:'f2fd3028e915fc8f9e7b4ca20ef7a32898270f4c2585d98b3a8d5ba6a93bae93',nativeSha256:'f5521b058ca08e249afd3b25b4681e81100181d92e73aa6b94bb8e75c2aa487b'});
`+policy.slice(end);
const vstart=policy.indexOf('export function verifyCodexIdeArtifact'),vend=policy.indexOf('export function renderCodexIdeProfile');assert(vstart>0&&vend>vstart);
policy=policy.slice(0,vstart)+`export function verifyCodexIdeArtifact(manifest:Uint8Array,javascriptDigest:string,runtimePackage:Uint8Array,nativeDigest:string):boolean {
 try {const value=JSON.parse(Buffer.from(manifest).toString('utf8')),runtime=JSON.parse(Buffer.from(runtimePackage).toString('utf8'));
 return manifest.byteLength<=65536&&runtimePackage.byteLength<=65536&&sha(manifest)===CODEX_IDE_PIN.manifestSha256
 &&sha(runtimePackage)===CODEX_IDE_PIN.runtimePackageSha256&&javascriptDigest===CODEX_IDE_PIN.javascriptSha256&&nativeDigest===CODEX_IDE_PIN.nativeSha256
 &&value.publisher+'.'+value.name===CODEX_IDE_PIN.id&&value.version===CODEX_IDE_PIN.version&&value.main==='./out/extension.js'
 &&runtime.version===CODEX_IDE_PIN.runtimeVersion&&runtime.target==='x86_64-pc-windows-msvc';}catch{return false;}
}
`+policy.slice(vend);
policy=replace(policy,'if (!connection ||','if (!gateway) return fail();\n        if (!connection ||');
policy=replace(policy,'Native command/image/web/app/plugin tools disabled; only allowlisted SoterAI MCP safe-read transport approved.','Native tool-disable preferences requested; IDE code-mode override is not command confinement. Only allowlisted F04 MCP transport approved.');
policy=policy.replace('Dedicated text Responses plus safe-read route only; buffered output, owner/session/policy checks.','Dedicated IDE text Responses plus safe-read route only; buffered output, owner/session/policy checks. Native code-mode preferences are not confinement.');
fs.writeFileSync(path.join(adapters,'CodexIdeAdapterPolicy.ts'),policy,{flag:'wx'});
let owner=rename(read(path.join(adapters,'CodexCliAdapter.ts')));
owner=owner.replace('private readonly manager?: BrokerManager','private readonly manager: BrokerManager');
owner=replace(owner,'return !this.#disposed && process.platform', 'return !!this.manager && !this.#disposed && process.platform');
const astart=owner.indexOf('    private async artifact(): Promise<void>'),aend=owner.indexOf('    private async artifactCurrent()');assert(astart>0&&aend>astart);
owner=owner.slice(0,astart)+`    private async artifact():Promise<void> {
        this.#pin=undefined;
        const vendor=vscode.extensions.getExtension(CODEX_IDE_PIN.id),uri=vendor?.extensionUri,config=vscode.workspace.getConfiguration('chatgpt');
        if(!uri||uri.scheme!=='file'||uri.authority||uri.query||uri.fragment||!path.isAbsolute(uri.fsPath)
            ||config.get<string|null>('cliExecutable',null)||config.get<boolean>('runCodexInWindowsSubsystemForLinux',false)
            ||config.get<boolean>('useExperimentalLspMcpServer',false))throw Error('Unavailable');
        const files=['package.json','out/extension.js','bin/windows-x86_64/codex-package.json','bin/windows-x86_64/codex.exe'].map(relative=>path.join(uri.fsPath,relative));
        const stamps=await Promise.all(files.map(file=>this.stamp(file)));
        if(stamps[1].size!==CODEX_IDE_PIN.javascriptBytes||stamps[3].size!==CODEX_IDE_PIN.nativeBytes)throw Error('Unavailable');
        const hashFile=async(index:number):Promise<string>=>{
            const before=stamps[index],handle=await open(before.file,'r'),hash=createHash('sha256');let size=0;
            try {const opened=await handle.stat();if(!opened.isFile()||opened.ino!==before.ino||opened.nlink!==1||opened.size!==before.size)throw Error('Unavailable');
                const buffer=Buffer.alloc(65536);while(true){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;size+=bytesRead;if(size>before.size)throw Error('Unavailable');hash.update(buffer.subarray(0,bytesRead));}
                const after=await handle.stat();if(size!==before.size||after.ino!==opened.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.nlink!==1)throw Error('Unavailable');
            }finally{await handle.close();}return hash.digest('hex');
        };
        const [manifest,javascript,runtime,native]=await Promise.all([this.bounded(files[0],65536),hashFile(1),this.bounded(files[2],65536),hashFile(3)]);
        if(!verifyCodexIdeArtifact(manifest,javascript,runtime,native))throw Error('Unavailable');
        for(const before of stamps)if(JSON.stringify(before)!==JSON.stringify(await this.stamp(before.file)))throw Error('Unavailable');
        this.#pin=stamps;
    }
`+owner.slice(aend);
owner=replace(owner,'this.#pin.length !== 3','this.#pin.length !== 4');
owner=owner.replace('Select this dedicated home explicitly when launching Codex.','Select this dedicated CODEX_HOME before starting a new editor/native session. The current editor may use another home. Native code-mode preferences do not establish command confinement.');
owner=owner.replace('manager?: BrokerManager): void','manager: BrokerManager): void');
fs.writeFileSync(path.join(adapters,'CodexIdeAdapter.ts'),owner,{flag:'wx'});
const changed=['packages/vscode-extension/src/extension.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json'];
const snapshots=path.join(__dirname,'production-before-01');fs.mkdirSync(snapshots);
for(const relative of changed)fs.writeFileSync(path.join(snapshots,relative.replaceAll('/','__')),fs.readFileSync(path.join(repo,relative)),{flag:'wx'});
const extension=path.join(repo,changed[0]);let activation=read(extension);activation=replace(activation,'import { registerCodexCliAdapter }','import { registerCodexIdeAdapter } from "./adapters/CodexIdeAdapter";\nimport { registerCodexCliAdapter }');activation=replace(activation,'registerCodexCliAdapter(context, managedReader, brokerManager);','registerCodexCliAdapter(context, managedReader, brokerManager);\n    registerCodexIdeAdapter(context, managedReader, brokerManager);');fs.writeFileSync(extension,activation);
for(const relative of changed.slice(1)){
 const file=path.join(repo,relative),m=JSON.parse(read(file));m.capabilities.untrustedWorkspaces.restrictedConfigurations.push('soterai.lite.codexIdeAdapter');
 m.contributes.configuration.properties['soterai.lite.codexIdeAdapter']={type:'boolean',default:true,scope:'machine',description:'Enable reviewed pinned Codex IDE dedicated-home setup with F04 and buffered text Responses. Select this home before editor/native startup. Native tool preferences are not confinement; other profiles, overrides, unsupported context/images remain uncovered. Disabling revokes local roles and preserves configuration.'};
 for(const [name,title]of[['configurePinnedCodexIde','Configure pinned Codex IDE profile'],['restorePinnedCodexIde','Restore pinned Codex IDE profile'],['codexIdeAdapterStatus','Codex IDE adapter status']]){m.contributes.commands.push({command:'soterai.'+name,title:'SoterAI: '+title});m.contributes.menus.commandPalette.push({command:'soterai.'+name});}
 fs.writeFileSync(file,JSON.stringify(m,null,relative.includes('vscode-extension')?4:2)+'\n');
}
fs.writeFileSync(path.join(__dirname,'implementation-inputs-01.json'),JSON.stringify({status:'IMPLEMENTED_NOT_VERIFIED',sourcePattern:'Dedicated copied ownership contract from committed Codex CLI; independent IDE pin/flag/profile/registration and mandatory gateway, no generic version acceptance.',files:[...changed,'packages/vscode-extension/src/adapters/CodexIdeAdapterPolicy.ts','packages/vscode-extension/src/adapters/CodexIdeAdapter.ts'].map(relative=>({path:relative,sha256:sha(fs.readFileSync(path.join(repo,relative)))}))},null,2)+'\n',{flag:'wx'});
