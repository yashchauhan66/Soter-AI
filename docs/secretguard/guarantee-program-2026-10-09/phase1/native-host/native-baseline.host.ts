/** Synthetic Phase 1 baseline. A successful harness can report failed guarantees. */
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { BrokerManager } from '../../../../../packages/vscode-extension/src/broker/BrokerManager';
import { ProtectionStateService } from '../../../../../packages/vscode-extension/src/protection/ProtectionStateService';

const execute = promisify(execFile);
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fake = () => 'amber meadow ' + randomBytes(8).toString('hex').match(/.{4}/g)!.join(' ');
interface Observation { id: string; operation: string; status: string; boundary: string; gates: string[]; details?: unknown; canarySha256?: string }

export async function run(): Promise<void> {
  const runDir = await fs.realpath(process.env.SOTERAI_PHASE1_RUN!);
  const freeze = JSON.parse(await fs.readFile(path.join(runDir, 'freeze.json'), 'utf8'));
  if (freeze.syntheticOnly !== true || freeze.phase !== 1 || freeze.run !== runDir) throw new Error('Invalid isolated run identity');
  const root = await fs.realpath(path.join(runDir, 'workspace'));
  if (await fs.readFile(path.join(root, '.synthetic-phase1-lab'), 'utf8') !== 'synthetic-only-v1') throw new Error('Missing fake-data marker');
  if (vscode.workspace.workspaceFolders?.length !== 1 || vscode.workspace.workspaceFolders[0].uri.fsPath.toLowerCase() !== root.toLowerCase()) throw new Error('Wrong workspace');
  if (path.resolve(process.env.USERPROFILE!).toLowerCase() !== path.join(runDir, 'profile').toLowerCase()) throw new Error('Wrong user profile');
  const journal = path.join(runDir, 'observations.jsonl');
  await fs.writeFile(journal, '', { flag: 'wx' });
  const observations: Observation[] = [];
  const record = async (row: Observation) => { observations.push(row); await fs.appendFile(journal, JSON.stringify({ ...row, timestamp: new Date().toISOString() }) + '\n'); };
  const attempt = async (id: string, operation: string, fn: () => Promise<void>) => {
    await fs.appendFile(path.join(runDir, 'progress.jsonl'), JSON.stringify({ id, operation, stage: 'STARTED', timestamp: new Date().toISOString() }) + '\n');
    try { await fn(); } catch (error) {
      await record({ id, operation, status: 'ERROR', boundary: 'harness/runtime', gates: [], details: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) } });
    }
  };
  const observed = async (id: string, operation: string, text: string, value: string, boundary: string, gates: string[], control = false) => {
    const present = text.includes(value);
    await record({ id, operation, status: control ? (present ? 'PUBLIC_CONTROL_PASS' : 'CONTROL_FAIL') : present ? 'LEAK_CONFIRMED' : 'BLOCKED_SCOPED',
      boundary, gates, canarySha256: digest(value), details: { protectedBytesPresent: present, observedBytes: Buffer.byteLength(text), observationSha256: digest(text) } });
  };
  const preview = async (relative: string) => {
    await vscode.commands.executeCommand('soterai.openRedactedPreview', vscode.Uri.file(path.join(root, relative)));
    if (vscode.window.activeTextEditor?.document.uri.scheme !== 'soterai-redacted') throw new Error('Preview command did not open its protected URI');
    return vscode.window.activeTextEditor.document.getText();
  };
  let extension: vscode.Extension<unknown> | undefined;
  let restartManager: BrokerManager | undefined;
  const values = new Map([['.env', fake()], ['nested/private.txt', fake()], ['private.pem', fake()], ['selected.txt', fake()]]);
  let fatal: string | undefined;
  try {
    extension = vscode.extensions.getExtension('soterai.soterai-ide-guard');
    if (!extension) throw new Error('Frozen extension missing');
    await extension.activate();
    if (!extension.isActive || extension.extensionPath.toLowerCase() !== path.join(runDir, 'snapshot').toLowerCase()) throw new Error('Wrong extension activated');
    const actual = digest(await fs.readFile(path.join(extension.extensionPath, 'dist/extension.js')));
    if (actual !== freeze.suppliedBuild.find((p: any) => p.snapshot === 'dist/extension.js').sha256) throw new Error('Frozen bundle identity changed');
    await record({ id: 'IDENTITY', operation: 'activate frozen supplied build', status: 'IDENTITY_VERIFIED', boundary: 'actual VS Code host', gates: [],
      details: { host: vscode.version, extension: extension.packageJSON.version, bundleSha256: actual } });
    await fs.mkdir(path.join(root, 'nested'));
    for (const [relative, value] of values) await fs.writeFile(path.join(root, relative), relative === 'private.pem'
      ? '-----BEGIN PRIVATE KEY-----\n' + value + '\n-----END PRIVATE KEY-----\n' : relative === 'selected.txt' ? 'Public start.\n' + value + '\nPublic end.' : value);
    await fs.writeFile(path.join(runDir, 'fixtures.json'), JSON.stringify({ syntheticOnly: true, values: [...values].map(([file, value]) => ({ file, sha256: digest(value) })) }, null, 2), { flag: 'wx' });
    await fs.writeFile(path.join(root, 'public.txt'), 'public baseline greeting');
    await observed('C01', 'public preview positive control', await preview('public.txt'), 'public baseline greeting', 'actual preview', [], true);
    await observed('C02', 'ordinary nested file before folder mark', await preview('nested/private.txt'), values.get('nested/private.txt')!, 'actual preview before enrollment', [], true);
    await observed('C03', 'ordinary selection file before region mark', await preview('selected.txt'), values.get('selected.txt')!, 'actual preview before enrollment', [], true);
    await vscode.commands.executeCommand('soterai.enableProtectedWorkspace');
    for (const relative of ['.env', 'nested', 'private.pem']) await vscode.commands.executeCommand('soterai.blockFromAI', vscode.Uri.file(path.join(root, relative)));
    const selected = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, 'selected.txt')));
    const selectedEditor = await vscode.window.showTextDocument(selected);
    const regionStart = selected.getText().indexOf(values.get('selected.txt')!);
    selectedEditor.selection = new vscode.Selection(selected.positionAt(regionStart), selected.positionAt(regionStart + values.get('selected.txt')!.length));
    await vscode.commands.executeCommand('soterai.blockSelectionFromAI');
    let n = 0;
    for (const [relative, value] of values) {
      n++;
      await attempt('P0' + n, 'marked preview ' + relative, async () => {
        const text = await preview(relative);
        await observed('P0' + n, 'marked preview ' + relative, text, value, 'actual SoterAI preview', ['G1']);
        if (relative === 'selected.txt') await observed('C04', 'unmarked region remains useful', text, 'Public start.', 'actual region preview', [], true);
      });
      await attempt('L0' + n, 'marked original direct read ' + relative, async () => await observed('L0' + n, 'marked original direct read ' + relative,
        await fs.readFile(path.join(root, relative), 'utf8'), value, 'Node fs in actual extension host', ['G1','G3','G5']));
    }
    const raw = values.get('.env')!;
    await attempt('L05', 'hardlink direct read and scoped preview', async () => {
      await fs.link(path.join(root, '.env'), path.join(root, 'hardlink.txt'));
      await observed('L05', 'hardlink direct read', await fs.readFile(path.join(root, 'hardlink.txt'), 'utf8'), raw, 'native filesystem alias', ['G1']);
      await observed('P05', 'hardlink scoped preview', await preview('hardlink.txt'), raw, 'SoterAI path checks', ['G1']);
    });
    await attempt('L06', 'junction direct read and scoped preview', async () => {
      await fs.symlink(path.join(root, 'nested'), path.join(root, 'junction'), 'junction');
      const value = values.get('nested/private.txt')!;
      await observed('L06', 'junction direct read', await fs.readFile(path.join(root, 'junction/private.txt'), 'utf8'), value, 'native directory alias', ['G1']);
      await observed('P06', 'junction scoped preview', await preview('junction/private.txt'), value, 'SoterAI path checks', ['G1']);
    });
    await attempt('L07', 'repository deny policy removal', async () => {
      const custom = 'note ' + randomBytes(4).toString('hex');
      await fs.writeFile(path.join(root, 'custom.txt'), custom);
      await observed('C05', 'repo-rule public control', await preview('custom.txt'), custom, 'before repo deny', [], true);
      await fs.writeFile(path.join(root, '.aiignore'), 'custom.txt\n');
      await observed('P07', 'repo deny active', await preview('custom.txt'), custom, 'repo policy scoped preview', ['G1']);
      await fs.writeFile(path.join(root, '.aiignore'), '');
      await observed('L07', 'agent removes repo deny', await preview('custom.txt'), custom, 'agent-writable deny policy', ['G1','G2','G3']);
    });
    await attempt('L08', 'synthetic environment and stdout', async () => {
      const result = await execute(process.execPath, ['-e', 'process.stdout.write(process.env.SOTERAI_PHASE1_FAKE_VALUE)'], {
        env: { SystemRoot: process.env.SystemRoot, ELECTRON_RUN_AS_NODE: '1', SOTERAI_PHASE1_FAKE_VALUE: raw }, windowsHide: true, timeout: 10000 });
      await observed('L08', 'synthetic environment reaches child stdout', result.stdout, raw, 'independent synthetic child; not sanitized broker child', ['G1','G5']);
    });
    await attempt('L09', 'marked path Git history', async () => {
      const git = process.env.SOTERAI_PHASE1_GIT;
      if (!git || !path.isAbsolute(git)) throw new Error('Absolute Git fixture runtime unavailable');
      const hooks = path.join(root, 'empty-hooks'); await fs.mkdir(hooks);
      const gitRun = (args: string[]) => execute(git, ['-c','core.hooksPath=' + hooks,'-c','core.fsmonitor=false','-c','commit.gpgSign=false',
        '-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid',...args], { cwd: root,
        env: { SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'NUL',GIT_TERMINAL_PROMPT:'0' }, windowsHide:true,timeout:15000 });
      await gitRun(['init','--quiet','--template=' + hooks]);
      const historical = fake();
      await fs.writeFile(path.join(root,'history.txt'), historical);
      await gitRun(['add','--','history.txt']); await gitRun(['commit','--quiet','-m','Fake Phase 1 fixture']);
      await fs.writeFile(path.join(root,'history.txt'),'public working replacement');
      await observed('C06','history working-tree positive control',await preview('history.txt'),'public working replacement','before manual file deny',[],true);
      await vscode.commands.executeCommand('soterai.blockFromAI',vscode.Uri.file(path.join(root,'history.txt')));
      await observed('P08','history path manual deny active',await preview('history.txt'),'public working replacement','actual preview after manual mark',['G1']);
      await observed('L09','Git object under marked path', (await gitRun(['show','HEAD:history.txt'])).stdout,historical,'new fake Git repository only',['G1','G5']);
    });
    await attempt('L10','encoded/chunked loopback receiver',async () => {
      let capture = ''; const receiver = createServer((req,res) => {
        req.setEncoding('utf8'); req.on('data',chunk=>{capture+=chunk;});req.on('end',()=>res.end('public receiver control')); });
      await new Promise<void>((resolve,reject)=>{receiver.once('error',reject);receiver.listen(0,'127.0.0.1',resolve);});
      try {
        const address = receiver.address(); if(!address || typeof address==='string')throw new Error('Invalid receiver');
        const encoded=Buffer.from(raw).toString('base64');const fragments=[encoded.slice(0,12),encoded.slice(12)];
        const response=await fetch(`http://127.0.0.1:${address.port}/fake-only`,{method:'POST',body:JSON.stringify({fragments}),signal:AbortSignal.timeout(10000)});
        if(await response.text()!=='public receiver control')throw new Error('Receiver acknowledgment mismatch');
        await fs.writeFile(path.join(runDir,'captures/loopback.json'),capture,{flag:'wx'});
        const decoded=Buffer.from(JSON.parse(capture).fragments.join(''),'base64').toString('utf8');
        await observed('L10','receiver reconstructs protected value',decoded,raw,'independent HTTP; on-machine loopback only',['G1','G4']);
      }finally{receiver.closeAllConnections();await new Promise<void>(resolve=>receiver.close(()=>resolve()));}
    });
    await attempt('R01','real native broker restart/runtime state',async()=>{
      // Real unmodified source manager plus frozen CLI, synthetic storage maps.
      const state=new Map<string,unknown>(); const secretValues=new Map<string,string>();
      const memento={get:(key:string,fallback?:unknown)=>state.has(key)?state.get(key):fallback,update:async(key:string,value:unknown)=>{state.set(key,value);},keys:()=>[...state.keys()]};
      const context={globalState:memento,workspaceState:memento,subscriptions:[],globalStorageUri:vscode.Uri.file(path.join(runDir,'profile/fake-manager-storage')),
        asAbsolutePath:(name:string)=>path.join(runDir,'snapshot',name),secrets:{get:async(key:string)=>secretValues.get(key),store:async(key:string,value:string)=>{secretValues.set(key,value);},delete:async(key:string)=>{secretValues.delete(key);}}} as unknown as vscode.ExtensionContext;
      await fs.mkdir(context.globalStorageUri.fsPath,{recursive:true});
      restartManager=new BrokerManager(context);
      const before=await restartManager.start();if(!before.running||before.state!=='healthy')throw new Error('Native fake-manager broker did not start');
      await restartManager.request('/v1/safe-mode/enable',{method:'POST',body:JSON.stringify({level:'strict'})});
      await memento.update('soterai.safeMode',{enabled:true,level:'strict'});
      const enabled=await restartManager.status();if(enabled.safeMode?.enabled!==true)throw new Error('Strict precondition missing');
      const after=await restartManager.restart(); const settled=await restartManager.status();
      const service=new ProtectionStateService(context,{brokerManager:restartManager,workspaceGuard:{isEnabled:true} as any,sentinel:{isEnabled:true} as any});
      const snapshot=await service.refresh();
      await record({id:'R01',operation:'native broker restart loses strict state',status:settled.safeMode?.enabled===false&&snapshot.facts.safeModeEnabled===true?'BYPASS_CONFIRMED':'NOT_REPRODUCED',
        boundary:'real native process and source state service; fake storage maps',gates:['G3','G6'],details:{before:enabled.safeMode,after:settled.safeMode,brokerHealthy:after.state==='healthy',displayFact:snapshot.facts.safeModeEnabled,headline:snapshot.descriptor.state,liveAgent:false}});
    });
  }catch(error){fatal=error instanceof Error?error.message:String(error);await record({id:'FATAL',operation:'host baseline setup',status:'ERROR',boundary:'harness/runtime',gates:[],details:{message:fatal}});}
  finally {
    if(restartManager){try{await restartManager.stop();restartManager.dispose();}catch{await record({id:'CLEANUP',operation:'stop synthetic restart broker',status:'ERROR',boundary:'cleanup',gates:[]});}}
    try{await vscode.commands.executeCommand('soterai.stopLocalAIBroker');}catch{}
    const result={schemaVersion:1,phase:1,runId:freeze.runId,host:vscode.version,platform:process.platform,extensionVersion:extension?.packageJSON.version,
      suppliedBundleSha256:freeze.suppliedBuild.find((p:any)=>p.snapshot==='dist/extension.js').sha256,probeSha256:digest(await fs.readFile(__filename)),
      syntheticOnly:true,realAgentTested:false,liveModelContacted:false,productionCodeModified:false,observations,fatal,
      counts:observations.reduce((a:Record<string,number>,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),guaranteesPassed:false,
      limits:['Windows cached VS Code 1.104.0 only','No real agents/models/accounts','No external recipient or OS egress proof','Fake storage used in native restart probe','Live unload/uninstall and other platforms not tested']};
    await fs.writeFile(path.join(runDir,'results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({phase1:freeze.runId,counts:result.counts,guaranteesPassed:false}));
  }
  if(fatal||observations.some(r=>r.status==='ERROR'||r.status==='CONTROL_FAIL'))throw new Error('Phase 1 harness had recorded errors; inspect new per-run evidence');
}
