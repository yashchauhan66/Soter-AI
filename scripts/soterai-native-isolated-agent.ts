import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { boundedProcess } from '../packages/soterai-cli/src/security/bounded';
import { prepareProtectedAgent, runProtectedAgent, runGuestProcess } from '../packages/soterai-cli/src/isolation/agent';
const image = process.argv[3];
const out = path.resolve(process.argv[2] ?? '');
const repo = path.resolve(__dirname, '..');
if (!out.startsWith(path.join(repo, 'output') + path.sep) || !image?.includes('@sha256:')) throw Error('NATIVE_TEST_SCOPE');
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
async function main() {
    await fs.mkdir(out); const root = path.join(out, 'workspace'); await fs.mkdir(root);
    const original = "process.stdout.write('PUBLIC_BASELINE\\n');\n";
    const privateValue = randomBytes(24).toString('hex');
    await fs.writeFile(path.join(root, 'app.cjs'), original, { flag: 'wx' });
    await fs.writeFile(path.join(out, 'private-host.txt'), privateValue, { flag: 'wx', mode: 0o600 });
    const proposal = await prepareProtectedAgent({ root, image, files: ['app.cjs'], model: 'synthetic-isolation-control',
        prompt: 'Read the public app, create a public verification script, run it, and summarize the result.', registeredValues: [privateValue] });
    const proof = "const fs=require('node:fs'),net=require('node:net');(async()=>{let rootWrite=false;try{fs.writeFileSync('/soterai-root-write','public');rootWrite=true}catch{}const connected=await new Promise(r=>{const s=net.connect({host:'192.0.2.1',port:443});s.setTimeout(800);s.on('connect',()=>{s.destroy();r(true)});s.on('error',()=>r(false));s.on('timeout',()=>{s.destroy();r(false)})});const ok=process.getuid()===10001&&!rootWrite&&!connected&&process.env.SOTERAI_NATIVE_TEST_VALUE===undefined&&!fs.existsSync('/host');process.stdout.write(ok?'ISOLATED_GUEST_OK\\n':'ISOLATED_GUEST_FAILED\\n');process.exitCode=ok?0:1})()";
    process.env.SOTERAI_NATIVE_TEST_VALUE = privateValue;
    let calls = 0, traversalDenied = false, executionVerified = false;
    const message = (calls: Array<{ id: string; name: string; args: object }>) => ({ choices: [{ message: { role: 'assistant', content: null,
        tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } }] });
    const diagnosticMode=['--diagnostic','--diagnostic-async'].includes(process.argv[4]);const diagnostics:unknown[]=[];
    const transport=diagnosticMode?{guest:runGuestProcess,runner:async(request:any)=>{
        if(process.argv[4]==='--diagnostic-async'){try{const b=await boundedProcess(request);diagnostics.push({operation:request.args[2],status:'PASS'});return b;}catch(e){diagnostics.push({operation:request.args[2],errorCode:(e as NodeJS.ErrnoException).code});throw e;}}
        const response=spawnSync(request.executable,request.args,{env:request.env,windowsHide:true,input:request.input,timeout:Math.max(30000,request.timeoutMs??0),maxBuffer:request.maxOutputBytes,encoding:'buffer'});
        const row:any={operation:request.args[2],exitCode:response.status,errorCode:response.error?.code,stderr:response.stderr?.toString('utf8').replaceAll(privateValue,'[MASKED]').slice(0,600)};
        if(request.args[2]==='inspect'&&response.status===0){const inspected=JSON.parse(response.stdout.toString());row.hostConfigKeys=Object.keys(inspected[0].HostConfig);row.securityOpt=inspected[0].HostConfig.SecurityOpt;row.mounts=inspected[0].Mounts;row.environmentNames=inspected[0].Config.Env.map((s:string)=>s.split('=')[0]);}
        diagnostics.push(row);if(response.status!==0)throw Error('DIAGNOSTIC_DOCKER_FAILED');return Buffer.from(response.stdout);
    }}:undefined;
    const result = await runProtectedAgent(proposal, proposal.approvalSha256, { isCurrent: () => true, model: async request => {
        calls++; if (JSON.stringify(request).includes(privateValue)) throw Error('HOST_VALUE_DISCLOSED');
        if (calls === 1) return message([{ id: 'read-public', name: 'read_file', args: { path: 'app.cjs' } }, { id: 'read-outside', name: 'read_file', args: { path: '../private-host.txt' } }]);
        if (calls === 2) { traversalDenied = JSON.stringify(request.messages).includes('GUEST_TOOL_REFUSED');
            return message([{ id: 'write-proof', name: 'write_file', args: { path: 'proof.cjs', text: proof } }]); }
        if (calls === 3) return message([{ id: 'run-proof', name: 'run_node', args: { path: 'proof.cjs' } }]);
        executionVerified = JSON.stringify(request.messages).includes('ISOLATED_GUEST_OK');
        return { choices: [{ message: { role: 'assistant', content: 'Completed the public isolated verification task.' } }] };
    } },transport);
    delete process.env.SOTERAI_NATIVE_TEST_VALUE;
    const sourceUnchanged = await fs.readFile(path.join(root, 'app.cjs'), 'utf8') === original;
    let guestWriteReachedHost = true; try { await fs.lstat(path.join(root, 'proof.cjs')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') guestWriteReachedHost = false; else throw error; }
    const ok = result.status === 'COMPLETE' && result.isolationVerified && result.cleanupVerified && result.turns === 4
        && traversalDenied && executionVerified && sourceUnchanged && !guestWriteReachedHost;
    const report = { schemaVersion: 1, status: ok ? 'PASS_NATIVE_ISOLATED_AGENT' : 'FAIL_NATIVE_ISOLATED_AGENT', image,
        modelProvider: 'Synthetic deterministic callback; no external provider test', actualGuestPlanningAndTools: true,
        rootSourceUnchanged: sourceUnchanged, guestWritesNeverAppliedToHost: !guestWriteReachedHost, traversalDenied, executionVerified,
        result: { status: result.status, code: result.code, isolationVerified: result.isolationVerified, cleanupVerified: result.cleanupVerified, turns: result.turns },
        sourceHashes: Object.fromEntries(await Promise.all(['packages/soterai-cli/src/isolation/agent.ts','packages/soterai-cli/src/isolation/ProtectedAgentGuest.ts','packages/soterai-cli/src/isolation/session.ts'].map(async name => [name, sha(await fs.readFile(path.join(repo, name)))]))),
        diagnostics,diagnosticTransport:diagnosticMode,releaseReady: false };
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report)); if (!ok) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ status: 'NATIVE_TEST_UNAVAILABLE', errorClass: error.name, code: error.code })); process.exitCode = 2; });
