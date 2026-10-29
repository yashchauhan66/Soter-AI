'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../../../../packages/vscode-extension/src/history-hooks'),get=n=>fs.readFileSync(path.join(dir,n),'utf8'),put=(n,s)=>fs.writeFileSync(path.join(dir,n),s,{flag:'wx'}),facts=[];
function derive(from,to,extra=s=>s){let s=get(from);const sourceSha256=crypto.createHash('sha256').update(s).digest('hex');for(const[a,b]of [['PreCommit','PrePush'],['preCommit','prePush'],['pre-commit','pre-push'],['CheckedHookFile','CheckedPrePushHookFile']])s=s.replaceAll(a,b);s=extra(s);put(to,s);facts.push({source:from,sourceSha256,target:to,sha256:crypto.createHash('sha256').update(s).digest('hex')});}
derive('CheckedHookFile.ts','CheckedPrePushHookFile.ts');
derive('PreCommitHookTransaction.ts','PrePushHookTransaction.ts');
derive('PreCommitHookRestore.ts','PrePushHookRestore.ts');
derive('PreCommitFlags.ts','PrePushFlags.ts');
derive('PreCommitController.ts','PrePushController.ts',s=>s.replaceAll('pre-push-client.js','pre-commit-client.js').replaceAll('staged-tree','pushed-history').replaceAll('withhold commits','withhold pushes').replace('Full staged tree:128 entries,64KiB per blob,1MiB total,60 seconds.','Full reachable branch history:32 commits,128 blobs,64KiB per blob,1MiB total,60 seconds. Commit messages and tags are outside this blob-only check.'));
derive('PreCommitOwnerService.ts','PrePushOwnerService.ts',s=>{
 s=s.replace('captureHookIndex, isCheckedHookIndex, prepareCheckedHookIndex, type CheckedHookIndex','isCheckedPushRefs, prepareCheckedPushRefs, type CheckedPushRefs').replace('./CheckedHookIndex','./CheckedPushRefs');
 s=s.replaceAll('CheckedHookIndex','CheckedPushRefs').replaceAll('prepareIndex','prepareRefs').replaceAll('typeof prepareCheckedHookIndex','typeof prepareCheckedPushRefs').replaceAll('index:','refs:').replaceAll('indexSha256','transcriptSha256').replaceAll('indexIdentity','rootIdentity');
 const start=s.indexOf('            const index = await'),end=s.indexOf('            if (!valid()) {',start);assert(start>0&&end>start);
 s=s.slice(0,start)+`            const rawTranscript = Buffer.from(request.transcript, "base64url");
            const refs = await (this.options.prepareRefs ?? prepareCheckedPushRefs)(this.options.root, rawTranscript, this.options.ambient ?? process.env, valid);
            rawTranscript.fill(0);
            if (!valid() || !isCheckedPushRefs(refs) || refs.root !== this.options.root || !refs.available()) { this.#refuse(res); return; }
            const scan = (this.options.createScan ?? (input => new PrePushScan(input)))({ refs, valid, deadline }); job.scan = scan;
`+s.slice(end);
 s=s.replaceAll('!index.available()','!refs.available()').replaceAll('index.transcriptSha256','refs.transcriptSha256').replaceAll('index.rootIdentity','refs.rootIdentity');
 s=s.replaceAll('/^[1-9][0-9]{0,3}$/','/^[1-9][0-9]{0,4}$/').replaceAll('count <= 4096','count <= 49152').replaceAll('total > 4096','total > 49152');
 assert(!/captureHookIndex|prepareCheckedHookIndex|request[.]indexFile|\bindex[.]/.test(s));return s;
});
const original=get('PreCommitClient.ts'),requestStart=original.indexOf('function requestOwner('),requestEnd=original.indexOf('/** Minimal finite packaged verifier');assert(requestStart>0&&requestEnd>requestStart);
const request=original.slice(requestStart,requestEnd);
const client=`import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { observeHookArtifact, hookArtifactIdentity } from "./PreCommitClient";
import { parseHookClientPin } from "./PreCommitHookText";
import { prePushTranscriptDigest } from "./PrePushProtocol";
import { pushRootIdentity } from "./PushRootSnapshot";
import { verifyHookDecision, verifyHookDescriptor } from "./PrePushWire";
export { observeHookArtifact, hookArtifactIdentity } from "./PreCommitClient";
interface Options { runtime?: string; worker?: string; now?: () => number; request?: (endpoint: string, raw: Buffer, deadline: number) => Promise<Buffer | undefined> }
type Outcome = "ALLOW" | "BLOCK" | "UNAVAILABLE";
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const unavailable = (): never => { throw Error("Pre-push unavailable."); };
const nativeLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
${request}
/** Exact transcript/root/artifact binding. Only the finite main module may
 * replay stdin; this API returns a fixed status and never invokes an owner hook. */
export async function runPrePushClient(rawPin: Buffer, rawTranscript: Buffer, options: Options = {}): Promise<Outcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ownership: { cancel?: () => void } = {}; let transcript: Buffer | undefined;
    try {
        if (process.platform !== "win32") return "UNAVAILABLE";
        const transcriptSha256 = prePushTranscriptDigest(rawTranscript), pin = parseHookClientPin(rawPin);
        if (!transcriptSha256 || !pin) return "UNAVAILABLE";
        transcript = Buffer.alloc(nativeLength.call(rawTranscript)); Uint8Array.prototype.set.call(transcript, rawTranscript);
        if (!same(options.runtime ?? process.execPath, pin.runtime) || !same(options.worker ?? __filename, pin.worker)) return "UNAVAILABLE";
        const clock = options.now ?? (() => performance.now()), start = clock(), deadline = start + 60000;
        if (!Number.isFinite(start) || !Number.isFinite(deadline)) return "UNAVAILABLE";
        let last = start, live = true;
        const valid = () => { if (!live) return false; try { const now = clock(); live = Number.isFinite(now) && now >= last && now >= start && now < deadline; last = now; } catch { live = false; } return live; };
        const runtime = observeHookArtifact(pin.runtime, 536870912, valid), worker = observeHookArtifact(pin.worker, 2097152, valid);
        if (runtime.digest !== pin.runtimeSha256 || worker.digest !== pin.workerSha256) return "UNAVAILABLE";
        const physicalRoot = pushRootIdentity(pin.root); if (!physicalRoot || !valid()) return "UNAVAILABLE";
        const endpoint = observeHookArtifact(pin.descriptor, 8192, valid, true);
        const descriptor = verifyHookDescriptor(endpoint.bytes, pin.publicKey, { root: pin.root, generation: pin.generation, workerSha256: pin.workerSha256, runtimeSha256: pin.runtimeSha256 });
        if (!descriptor || !valid()) return "UNAVAILABLE";
        const nonce = randomUUID(), body = Buffer.from(JSON.stringify({ version: 1, generation: pin.generation, session: descriptor.session, nonce, transcript: transcript.toString("base64url") }));
        const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => { ownership.cancel?.(); resolve(undefined); }, Math.max(1, deadline - clock())); });
        const request = options.request ?? ((endpoint: string, raw: Buffer, bound: number) => requestOwner(endpoint, raw, bound, ownership));
        const reply = await Promise.race([request(descriptor.endpoint, body, deadline), timeout]); clearTimeout(timer);
        if (!reply || !valid()) return "UNAVAILABLE";
        const decision = verifyHookDecision(reply, pin.publicKey, { root: pin.root, generation: pin.generation, session: descriptor.session, nonce });
        if (!decision || !["ALLOW", "BLOCK"].includes(decision.status) || decision.transcriptSha256 !== transcriptSha256 || decision.rootIdentity !== physicalRoot) return "UNAVAILABLE";
        const finalEndpoint = observeHookArtifact(pin.descriptor, 8192, valid, true), finalWorker = observeHookArtifact(pin.worker, 2097152, valid), finalRuntime = observeHookArtifact(pin.runtime, 536870912, valid);
        if (pushRootIdentity(pin.root) !== physicalRoot || finalEndpoint.stamp !== endpoint.stamp || finalEndpoint.digest !== endpoint.digest
            || finalWorker.stamp !== worker.stamp || finalWorker.digest !== worker.digest || finalRuntime.stamp !== runtime.stamp || finalRuntime.digest !== runtime.digest || !valid()) return "UNAVAILABLE";
        return decision.status as "ALLOW" | "BLOCK";
    } catch { return "UNAVAILABLE"; } finally { transcript?.fill(0); clearTimeout(timer); try { ownership.cancel?.(); } catch { /* Only this private HTTP transport. */ } }
}
`;
put('PrePushClient.ts',client);facts.push({source:'PreCommitClient.ts#requestOwner',target:'PrePushClient.ts',httpTransportDelegationByteExact:true});
fs.writeFileSync(path.join(__dirname,'owner-recovery-source-01.json'),JSON.stringify({status:'NEW_F26B_PRIVATE_IMPLEMENTATION_NOT_REGISTERED_NOT_NATIVE_VERIFIED',facts,existingF26aSourceChanged:0},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'NEW_F26B_PRIVATE_IMPLEMENTATION_NOT_REGISTERED',files:facts.length}));
