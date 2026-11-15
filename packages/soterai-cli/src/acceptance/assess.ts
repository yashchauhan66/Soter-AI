import path from "node:path";
import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { safeRelativePath, SecretContentScanner } from "@soterai/guard-core";
import { canonicalJson } from "../operations/ecs";
import { digest, exactObject, readStable } from "../security/bounded";
export const ACCEPTANCE_GATES = ["installed-package","isolation-runtime","real-provider","ec2-runtime","independent-security","accessibility","performance","human-pilot"] as const;
type Gate=typeof ACCEPTANCE_GATES[number];
export interface AcceptanceReport {schemaVersion:1;candidateSha256:string;releaseReady:false;evidenceBindingsComplete:boolean;accepted:Partial<Record<Gate,number>>;missing:Gate[];rejectedEvidence:number;assessment:"OWNER_REVIEW_REQUIRED"}
export async function assessAcceptance(root:string,input:unknown,reviewers:unknown,candidate:string,now=Date.now()):Promise<AcceptanceReport>{
    if(!/^[a-f0-9]{64}$/.test(candidate))throw Error();exactObject(input,["schemaVersion","entries"]);exactObject(reviewers,["schemaVersion","keys"]);
    if(input.schemaVersion!==1 || reviewers.schemaVersion!==1 || !Array.isArray(input.entries) || input.entries.length>256 || !Array.isArray(reviewers.keys) || reviewers.keys.length>64)throw Error();
    const keys=new Map<string,{key:KeyObject;independent:boolean;human:boolean}>(),signers=new Set<string>();
    for(const entry of reviewers.keys){exactObject(entry,["reviewerId","publicKey","independent","human"]);if(typeof entry.reviewerId!=="string" || !/^[a-f0-9]{64}$/.test(entry.reviewerId) || keys.has(entry.reviewerId)
        || typeof entry.publicKey!=="string" || entry.publicKey.length>2048 || !entry.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")
        || typeof entry.independent!=="boolean" || typeof entry.human!=="boolean")throw Error();
        const key=createPublicKey(entry.publicKey);if(key.asymmetricKeyType!=="ed25519")throw Error();
        const signer=digest(key.export({type:"spki",format:"der"}));if(signers.has(signer))throw Error();signers.add(signer);
        keys.set(entry.reviewerId,{key,independent:entry.independent,human:entry.human});}
    const accepted:Partial<Record<Gate,number>>={},seen=new Set<string>();let rejected=0;
    for(const entry of input.entries){try{
        exactObject(entry,["payload","signature"]);exactObject(entry.payload,["schemaVersion","gate","candidateSha256","reviewerId","evidencePath","evidenceSha256","observedAt","result"]);
        const p=entry.payload,key=keys.get(p.reviewerId as string),gate=p.gate as Gate;
        if(p.schemaVersion!==1 || !ACCEPTANCE_GATES.includes(gate) || p.candidateSha256!==candidate || p.result!=="PASS" || !key || !safeRelativePath(p.evidencePath)
            || typeof p.evidenceSha256!=="string" || !/^[a-f0-9]{64}$/.test(p.evidenceSha256) || !Number.isSafeInteger(p.observedAt) || (p.observedAt as number)>now || now-(p.observedAt as number)>30*86400000
            || typeof entry.signature!=="string" || !/^[A-Za-z0-9+/]{86}==$/.test(entry.signature) || !verify(null,Buffer.from(canonicalJson(p)),key.key,Buffer.from(entry.signature,"base64"))
            || ["independent-security","accessibility","human-pilot"].includes(gate) && (!key.independent || !key.human) || seen.has(gate+":"+p.reviewerId))throw Error();
        const evidenceFile=path.resolve(root,p.evidencePath);const actual=await import("node:fs/promises").then(fs=>fs.realpath(evidenceFile));
        if(!actual.startsWith(path.resolve(root)+path.sep))throw Error();const bytes=await readStable(evidenceFile,1048576),text=new TextDecoder("utf-8",{fatal:true}).decode(bytes),scan=new SecretContentScanner().scan(text);
        if(digest(bytes)!==p.evidenceSha256 || !scan.complete || scan.findings.length)throw Error();
        seen.add(gate+":"+p.reviewerId);accepted[gate]=(accepted[gate]??0)+1;
    }catch{rejected++;}}
    const missing=ACCEPTANCE_GATES.filter(gate=>(accepted[gate]??0)<(gate==="human-pilot"?5:1));
    return{schemaVersion:1,candidateSha256:candidate,releaseReady:false,evidenceBindingsComplete:missing.length===0 && rejected===0,accepted,missing,rejectedEvidence:rejected,assessment:"OWNER_REVIEW_REQUIRED"};
}
export async function runAcceptanceCommand(argv:string[],deps:{cwd:string;out(value:string):void;err(value:string):void}):Promise<number>{
    try{if(argv[0]!=="assess")throw Error();const options=new Map<string,string>();for(let i=1;i<argv.length;i++){const key=argv[i],value=argv[++i];if(!["--manifest","--reviewers","--candidate"].includes(key)||!value||options.has(key))throw Error();options.set(key,value);}
        if(options.size!==3)throw Error();const manifest=path.resolve(deps.cwd,options.get("--manifest")!);
        const report=await assessAcceptance(path.dirname(manifest),JSON.parse((await readStable(manifest)).toString()),JSON.parse((await readStable(path.resolve(deps.cwd,options.get("--reviewers")!))).toString()),options.get("--candidate")!);
        deps.out(JSON.stringify(report));return report.evidenceBindingsComplete?0:2;
    }catch{deps.err("Acceptance evidence unavailable; no release approval established.");return 2;}
}
