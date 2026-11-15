import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { SecretContentScanner, safeRelativePath, decodeBoundedJson } from '@soterai/guard-core';
import { scanDirectory } from '../ci/scan';
import { boundedProcess, digest, type ProcessRunner } from '../security/bounded';
import { prepareIsolatedSession, approvedIsolationPayload, isolationCreationArgs, validateIsolationInspection,
    ISOLATION_EXECUTABLE, ISOLATION_ENDPOINT, ISOLATION_LOADER, ISOLATION_CANARY, type IsolationProposal } from './session';
import { PROTECTED_AGENT_GUEST } from './ProtectedAgentGuest';

export interface ProtectedAgentProposal { readonly schemaVersion: 1; readonly image: string; readonly model: string; readonly snapshotSha256: string;
    readonly approvalSha256: string; readonly fileCount: number; readonly byteCount: number; readonly maxTurns: 8; readonly scope: string }
export interface ProtectedModelRequest { model: string; messages: unknown[]; tools: unknown[] }
export interface ProtectedOperationBinding { sessionId: string; imageDigest: string; artifactDigest: string; policyDigest: string }
export interface ProtectedAgentOptions { model(request: ProtectedModelRequest, signal: AbortSignal): Promise<unknown>; isCurrent(): boolean; signal?: AbortSignal;
    operation?(operationId: string, binding: ProtectedOperationBinding, signal: AbortSignal): Promise<unknown> }
export interface ProtectedAgentResult { status: 'COMPLETE' | 'DENIED' | 'UNAVAILABLE'; code: string; isolationVerified: boolean;
    cleanupVerified?: boolean; turns?: number; output?: string; changedFiles?: { path: string; text: string }[] }
interface PrivateProposal { root: string; files: string[]; prompt: string; values: string[]; base: IsolationProposal; consumed: boolean;
    operations: { id: string; label: string }[]; policyDigest: string }
const proposals = new WeakMap<object, PrivateProposal>();
const MAX_ACTIVE = 2, MAX_SESSION_MS = 180000;
let active = 0;
const TOOLS = ['read_file', 'write_file', 'run_node'].map(name => ({ type: 'function', function: { name,
    description: name === 'read_file' ? 'Read one saved file in the sanitized guest workspace.' : name === 'write_file' ? 'Write one text file in the sanitized guest workspace.' : 'Run one Node file only inside the isolated guest.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, ...(name === 'write_file' ? { text: { type: 'string' } } : {}) },
        required: name === 'write_file' ? ['path', 'text'] : ['path'], additionalProperties: false } } }));
const MODEL = /^[A-Za-z0-9][A-Za-z0-9_./:-]{0,127}$/;
const unavailable = (code: string, verified = false): ProtectedAgentResult => ({ status: 'UNAVAILABLE', code, isolationVerified: verified });
function ordinaryObject(value: unknown, keys: string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const fields = Object.getOwnPropertyDescriptors(value);
    return Object.keys(fields).sort().join(',') === keys.slice().sort().join(',') && Object.values(fields).every(v => Object.hasOwn(v, 'value'));
}
function clean(scanner: SecretContentScanner, text: string): boolean { const result = scanner.scan(text); return result.complete && result.findings.length === 0; }
export async function prepareProtectedAgent(input: { root: string; image: string; files: readonly string[]; prompt: string; model: string; registeredValues?: readonly string[];
    operations?: readonly { id: string; label: string }[]; operationPolicyDigest?: string }): Promise<ProtectedAgentProposal> {
    if (!MODEL.test(input.model) || typeof input.prompt !== 'string' || !input.prompt.trim() || Buffer.byteLength(input.prompt) > 8192) throw Error('AGENT_PROPOSAL_REFUSED');
    const values = [...input.registeredValues ?? []], scanner = new SecretContentScanner(values);
    if (!clean(scanner, input.prompt)) throw Error('AGENT_PROMPT_WITHHELD');
    if (input.operations !== undefined && (!Array.isArray(input.operations) || input.operations.length > 16)) throw Error('OPERATIONS_REFUSED');
    const ids = new Set<string>(), operations = (input.operations ?? []).map(item => {
        if (!ordinaryObject(item,['id','label']) || typeof item.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(item.id)
            || ids.has(item.id) || typeof item.label !== 'string' || !item.label || Buffer.byteLength(item.label) > 160 || !clean(scanner,JSON.stringify(item))) throw Error('OPERATIONS_REFUSED');
        ids.add(item.id); return { id: item.id, label: item.label };
    });
    if (operations.length && !/^[a-f0-9]{64}$/.test(input.operationPolicyDigest ?? '')) throw Error('OPERATIONS_REFUSED');
    const base = await prepareIsolatedSession(input), root = path.resolve(input.root);
    const policyDigest = digest(JSON.stringify([base.policyDigest,operations,input.operationPolicyDigest ?? null]));
    const binding = { schemaVersion: 1 as const, image: base.image, model: input.model, snapshotSha256: base.snapshotSha256,
        promptSha256: digest(input.prompt), policyDigest, agentSha256: digest(PROTECTED_AGENT_GUEST), toolsSha256: digest(JSON.stringify(TOOLS)), maxTurns: 8 as const };
    const proposal = Object.freeze({ schemaVersion: 1 as const, image: input.image, model: input.model, snapshotSha256: base.snapshotSha256,
        approvalSha256: digest(JSON.stringify(binding)), fileCount: base.fileCount, byteCount: base.byteCount, maxTurns: 8 as const,
        scope: 'New isolated SoterAI agent only: selected clean files, guest Node tools, no guest network/host mounts; owner-reviewed output only' });
    proposals.set(proposal, { root, files: [...input.files], prompt: input.prompt, values, base, consumed: false, operations, policyDigest }); return proposal;
}
export interface GuestProcessRequest { executable: string; args: string[]; env: NodeJS.ProcessEnv; start: object; signal: AbortSignal;
    exchange(request: unknown): Promise<object>; }
export type GuestProcessRunner = (request: GuestProcessRequest) => Promise<unknown>;
/** No shell, inherited environment, unbounded output, simultaneous requests or
 * partial results. Only the owning child is signalled; container cleanup is separate. */
export const runGuestProcess: GuestProcessRunner = request => new Promise((resolve, reject) => {
    const child = spawn(request.executable, request.args, { shell: false, windowsHide: true, env: request.env,
        cwd: path.dirname(request.executable), stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '', total = 0, busy = false, failed = false, result: unknown;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const fail = () => { if (failed) return; failed = true; child.kill(); child.stdin.destroy(); };
    const abort = () => fail(); request.signal.addEventListener('abort', abort, { once: true }); if (request.signal.aborted) fail();
    child.on('error', fail); child.stdin.on('error', fail);
    child.stderr.on('data', (chunk: Buffer) => { total += chunk.length; if (total > 1048576) fail(); });
    child.stdout.on('data', (chunk: Buffer) => {
        total += chunk.length; if (total > 2097152 || failed) { fail(); return; }
        try { buffer += decoder.decode(chunk, { stream: true }); } catch { fail(); return; }
        if (Buffer.byteLength(buffer) > 1048576) { fail(); return; }
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0 && !failed) {
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            let value: Record<string, unknown>;
            try { value = decodeBoundedJson(Buffer.from(line), { maxBytes: 1048576 }).body; } catch { fail(); return; }
            if (busy || result !== undefined) { fail(); return; }
            if (value.type === 'result') { result = value; continue; }
            if (value.type !== 'model-request' && value.type !== 'operation-request') { fail(); return; }
            busy = true;
            void request.exchange(value).then(response => { if (failed || request.signal.aborted) return; busy = false; child.stdin.write(JSON.stringify(response) + '\n'); }).catch(fail);
        }
    });
    child.on('close', code => { request.signal.removeEventListener('abort', abort);
        try { buffer += decoder.decode(); } catch { failed = true; }
        if (code !== 0 || failed || request.signal.aborted || busy || buffer.trim() || result === undefined) reject(Error('GUEST_UNAVAILABLE')); else resolve(result); });
    child.stdin.write(JSON.stringify(request.start) + '\n');
});
function assistantMessage(response: unknown, operations: readonly string[]): Record<string, unknown> {
    const text = JSON.stringify(response); if (Buffer.byteLength(text) > 131072) throw Error('MODEL_LIMIT');
    const parsed = decodeBoundedJson(Buffer.from(text)).body;
    if (!Array.isArray(parsed.choices) || parsed.choices.length !== 1) throw Error('MODEL_SHAPE');
    const message = (parsed.choices[0] as { message?: unknown })?.message;
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw Error('MODEL_SHAPE');
    const item = message as Record<string, unknown>;
    if (item.role !== 'assistant' || item.content !== null && typeof item.content !== 'string') throw Error('MODEL_SHAPE');
    const result: Record<string, unknown> = { role: 'assistant', content: item.content };
    if (item.tool_calls !== undefined) {
        if (!Array.isArray(item.tool_calls) || !item.tool_calls.length || item.tool_calls.length > 4) throw Error('MODEL_TOOLS');
        result.tool_calls = item.tool_calls.map(call => {
            if (!ordinaryObject(call, ['id','type','function']) || typeof call.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(call.id)
                || call.type !== 'function' || !ordinaryObject(call.function, ['name','arguments']) || !['read_file','write_file','run_node',...(operations.length ? ['approved_operation'] : [])].includes(String(call.function.name))
                || typeof call.function.arguments !== 'string' || Buffer.byteLength(call.function.arguments) > 70000) throw Error('MODEL_TOOLS');
            return { id: call.id, type: 'function', function: { name: call.function.name, arguments: call.function.arguments } };
        });
    }
    return result;
}
export async function runProtectedAgent(proposal: ProtectedAgentProposal, approval: string, options: ProtectedAgentOptions,
    testing?: { runner: ProcessRunner; guest: GuestProcessRunner }): Promise<ProtectedAgentResult> {
    const state = proposals.get(proposal);
    if (!state || state.consumed || proposal.approvalSha256 !== approval || !options.isCurrent() || options.signal?.aborted) return { status: 'DENIED', code: 'AGENT_APPROVAL_REFUSED', isolationVerified: false };
    state.consumed = true;
    if (active >= MAX_ACTIVE || !testing && process.platform !== 'win32') return unavailable('AGENT_RUNTIME_UNAVAILABLE');
    active++;
    const scanner = new SecretContentScanner(state.values), controller = new AbortController(), abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(abort, MAX_SESSION_MS);
    const runner = testing?.runner ?? boundedProcess, guest = testing?.guest ?? runGuestProcess;
    const environment = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PATH: 'C:\\Windows\\System32', DOCKER_CONFIG: 'C:\\ProgramData\\SoterAI\\docker-empty' };
    const invoke = (args: string[], input?: Buffer, timeoutMs = 15000) => runner({ executable: ISOLATION_EXECUTABLE, args: ['--host', ISOLATION_ENDPOINT, ...args], env: environment, input, timeoutMs, maxOutputBytes: 524288 });
    const nonce = randomBytes(16).toString('hex'); let id: string | undefined, owned = false, verified = false, turns = 0, rpcId = 0, operationCalls = 0, result = unavailable('ISOLATION_UNVERIFIED');
    async function fresh() {
        if (controller.signal.aborted || !options.isCurrent()) throw Error('SESSION_WITHDRAWN');
        const report = await scanDirectory(state!.root, { mode: 'artifact', maxFiles: 256, maxTotalBytes: 8388608 }, state!.values,
            { includePaths: state!.files, onFile: (name, bytes) => current.push({ name, base64: bytes.toString('base64'), sha256: digest(bytes) }) });
        if (report.status !== 'clean' || current.length !== state!.files.length) throw Error('SOURCE_CHANGED');
        current.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        if (digest(JSON.stringify(current)) !== proposal.snapshotSha256 || controller.signal.aborted || !options.isCurrent()) throw Error('SOURCE_CHANGED');
        current.length = 0;
    }
    const current: Array<{ name: string; base64: string; sha256: string }> = [];
    try {
        await fresh();
        const info = JSON.parse((await invoke(['info','--format','{{json .}}'])).toString());
        if (info.OSType !== 'linux' || !info.SecurityOptions?.some((s: unknown) => typeof s === 'string' && /name=seccomp.*profile=builtin/.test(s))) throw Error('ENGINE_UNAVAILABLE');
        const images = JSON.parse((await invoke(['image','inspect',proposal.image])).toString()), image = images[0];
        if (images.length !== 1 || !/^sha256:[a-f0-9]{64}$/.test(image.Id) || image.Config.Volumes && Object.keys(image.Config.Volumes).length
            || !image.RepoDigests?.includes(proposal.image)) throw Error('IMAGE_UNAVAILABLE');
        id = (await invoke(isolationCreationArgs(proposal.image, nonce, proposal.snapshotSha256))).toString().trim();
        if (!/^[a-f0-9]{64}$/.test(id)) { id = undefined; throw Error('CONTAINER_UNAVAILABLE'); }
        await invoke(['start',id]);
        const inspect = async () => { const data = JSON.parse((await invoke(['inspect',id!])).toString());
            if (data.length === 1 && data[0].Id === id && data[0].Config?.Labels?.['soterai.session'] === nonce
                && data[0].Config?.Labels?.['soterai.snapshot'] === proposal.snapshotSha256) owned = true;
            if (data.length !== 1 || !validateIsolationInspection(data[0], { id: id!, imageId: image.Id, nonce, snapshot: proposal.snapshotSha256 })) throw Error('ISOLATION_CHANGED'); };
        await inspect();
        if ((await invoke(['exec','-i',id,'/usr/local/bin/node','-e',ISOLATION_LOADER], approvedIsolationPayload(state.base,state.base.approvalSha256))).toString() !== 'LOADED') throw Error('LOAD_FAILED');
        if ((await invoke(['exec',id,'/usr/local/bin/node','-e',ISOLATION_CANARY])).toString() !== 'VERIFIED') throw Error('ISOLATION_UNVERIFIED');
        verified = true; await inspect(); await fresh();
        const completed = await guest({ executable: ISOLATION_EXECUTABLE, args: ['--host',ISOLATION_ENDPOINT,'exec','-i',id,'/usr/local/bin/node','-e',PROTECTED_AGENT_GUEST,'/workspace'],
            env: environment, signal: controller.signal, start: { type: 'start', prompt: state.prompt, model: proposal.model, maxTurns: 8, operations: state.operations.map(o=>o.id) },
            exchange: async request => {
                if (ordinaryObject(request,['type','id','operationId']) && request.type === 'operation-request') {
                    if (request.id !== ++rpcId || ++operationCalls > 8 || typeof request.operationId !== 'string' || !state.operations.some(o=>o.id===request.operationId) || !options.operation) throw Error('OPERATION_REFUSED');
                    await fresh(); await inspect();
                    const result = await options.operation(request.operationId, {sessionId:proposal.approvalSha256,imageDigest:proposal.image.split('@')[1],artifactDigest:proposal.snapshotSha256,policyDigest:state.policyDigest},controller.signal);
                    await fresh(); await inspect();const text=JSON.stringify(result);
                    if(typeof text!=='string'||Buffer.byteLength(text)>16384||!clean(scanner,text))throw Error('OPERATION_OUTPUT_WITHHELD');
                    return {type:'operation-response',id:rpcId,result:JSON.parse(text)};
                }
                if (!ordinaryObject(request,['type','id','model','messages']) || request.type !== 'model-request' || request.id !== ++rpcId || request.model !== proposal.model
                    || !Array.isArray(request.messages) || request.messages.length > 24 || ++turns > 8) throw Error('GUEST_REQUEST_REFUSED');
                const text = JSON.stringify(request.messages); if (Buffer.byteLength(text) > 100000 || !clean(scanner,text)) throw Error('GUEST_REQUEST_WITHHELD');
                await fresh(); await inspect();
                const tools = JSON.parse(JSON.stringify(TOOLS));
                if(state.operations.length)tools.push({type:'function',function:{name:'approved_operation',description:'Request one host operation. The owner must approve its exact resource before execution; credentials are never returned.',parameters:{type:'object',properties:{operation_id:{type:'string',enum:state.operations.map(o=>o.id)}},required:['operation_id'],additionalProperties:false}}});
                const response = await options.model({ model: proposal.model, messages: JSON.parse(text), tools }, controller.signal);
                await fresh(); await inspect(); const message = assistantMessage(response,state.operations.map(o=>o.id));
                if (!clean(scanner,JSON.stringify(message))) throw Error('MODEL_OUTPUT_WITHHELD');
                return { type: 'model-response', id: rpcId, message };
            } });
        if (!ordinaryObject(completed,['type','turns','output','changedFiles']) || completed.type !== 'result' || completed.turns !== turns
            || typeof completed.output !== 'string' || Buffer.byteLength(completed.output) > 65536 || !Array.isArray(completed.changedFiles) || completed.changedFiles.length > 32) throw Error('GUEST_RESULT_REFUSED');
        const files: { path: string; text: string }[] = [], seen = new Set<string>(); let bytes = 0;
        for (const file of completed.changedFiles) {
            if (!ordinaryObject(file,['path','text']) || typeof file.path !== 'string' || !safeRelativePath(file.path) || file.path.length > 200
                || seen.has(file.path.toLowerCase()) || typeof file.text !== 'string' || Buffer.byteLength(file.text) > 65536 || (bytes += Buffer.byteLength(file.text)) > 1048576
                || !clean(scanner,file.path) || !clean(scanner,file.text)) throw Error('GUEST_OUTPUT_WITHHELD');
            seen.add(file.path.toLowerCase()); files.push({ path: file.path, text: file.text });
        }
        if (!clean(scanner,completed.output)) throw Error('GUEST_OUTPUT_WITHHELD');
        await fresh(); await inspect();
        result = { status: 'COMPLETE', code: 'ISOLATED_AGENT_COMPLETED', isolationVerified: true, turns, output: completed.output, changedFiles: files };
    } catch { result = unavailable(controller.signal.aborted ? 'AGENT_CANCELLED' : verified ? 'AGENT_OUTCOME_WITHHELD' : 'ISOLATION_UNVERIFIED', verified); }
    finally {
        controller.abort(); clearTimeout(timer); options.signal?.removeEventListener('abort',abort);
        if (id && owned) { try { await invoke(['rm','--force',id]); result.cleanupVerified = true; } catch { result = { ...unavailable('SESSION_CLEANUP_UNVERIFIED',verified), cleanupVerified: false }; } }
        else if (id) result = { ...unavailable('SESSION_OWNERSHIP_UNVERIFIED',verified), cleanupVerified: false };
        state.values.fill(''); active--;
    }
    return result;
}
