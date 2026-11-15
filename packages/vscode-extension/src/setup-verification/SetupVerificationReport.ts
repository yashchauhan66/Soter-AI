export type SetupStatus = "PASS" | "FAIL" | "NOT_TESTED";
export type SetupCheckId = "secret-matching" | "output-redactor" | "gateway-loopback";
export interface SetupCheck { readonly id: SetupCheckId; readonly status: SetupStatus; readonly passed: number; readonly total: number }
export interface SetupBinding { readonly binding: string; readonly extensionSha256: string; readonly brokerSha256: string }
export interface SetupReport extends SetupBinding { readonly schemaVersion: 1; readonly verifiedAt: string; readonly checks: readonly SetupCheck[] }
export interface SetupReportState { readonly state: "CURRENT" | "STALE" | "MISMATCH" | "INVALID" | "MISSING"; readonly report?: SetupReport }
const HASH=/^[a-f0-9]{64}$/;
const COUNTS: Readonly<Record<SetupCheckId,number>>=Object.freeze({"secret-matching":3,"output-redactor":10,"gateway-loopback":6});
const GATEWAY=["public_receiver_positive","registered_split_withheld","registered_encoding_withheld","unknown_profile_withheld","provider_output_withheld","disabled_routing_withheld"];
function record(value:unknown): Record<string,unknown> {
    if (!value||typeof value!=="object"||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error("Invalid metadata");
    const out:Record<string,unknown>=Object.create(null);
    for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(value))){if(!("value"in d))throw Error("Accessor metadata");out[key]=d.value;}
    return out;
}
function fields(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]):void {
    if(required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error("Unexpected metadata");
}
const absent=(id:SetupCheckId):SetupCheck=>Object.freeze({id,status:"NOT_TESTED",passed:0,total:COUNTS[id]});
function normalize(value:unknown,id:SetupCheckId,names:readonly string[],gateway=false):SetupCheck {
    try {
        const v=record(value);fields(v,gateway?["version","status","independence","checks"]:["status","cases"],gateway?["scope","verifiedAt"]:[]);
        if(gateway&&(v.version!==1||v.independence!=="LOW"))return absent(id);
        if(v.status!=="PASS"&&v.status!=="FAIL")return absent(id);
        const list=gateway?v.checks:v.cases;if(!Array.isArray(list)||list.length!==names.length)return absent(id);
        const seen=new Set<string>();let passed=0;
        for(const item of list){const r=record(item);fields(r,gateway?["id","status"]:["id","pass"]);
            if(typeof r.id!=="string"||!names.includes(r.id)||seen.has(r.id))return absent(id);seen.add(r.id);
            if(gateway){if(r.status!=="PASS"&&r.status!=="FAIL")return absent(id);if(r.status==="PASS")passed++;}
            else{if(typeof r.pass!=="boolean")return absent(id);if(r.pass)passed++;}
        }
        if(passed===names.length&&v.status!=="PASS")return absent(id);
        return Object.freeze({id,status:passed===names.length?"PASS":"FAIL",passed,total:names.length});
    }catch{return absent(id);}
}
export function validateOutputCheck(value:unknown):SetupCheck {return normalize(value,"output-redactor",Array.from({length:10},(_,i)=>`S${String(i+1).padStart(2,"0")}`));}
export function validateGatewayCheck(value:unknown):SetupCheck {return normalize(value,"gateway-loopback",GATEWAY,true);}
export function validSetupBinding(value:SetupBinding):boolean {return !!value&&[value.binding,value.extensionSha256,value.brokerSha256].every(v=>typeof v==="string"&&HASH.test(v));}
export function makeSetupReport(identity:SetupBinding&{verifiedAt:string},inputs:unknown):SetupReport {
    if(!validSetupBinding(identity)||!validDate(identity.verifiedAt))throw Error("Unavailable verification identity");
    let r:Record<string,unknown>;try{r=record(inputs);}catch{r={};}
    const checks=Object.freeze([normalize(r.matching,"secret-matching",["M01","M02","M03"]),validateOutputCheck(r.output),validateGatewayCheck(r.gateway)]);
    return Object.freeze({schemaVersion:1,binding:identity.binding,extensionSha256:identity.extensionSha256,brokerSha256:identity.brokerSha256,verifiedAt:identity.verifiedAt,checks});
}
function validDate(value:unknown):value is string{return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
export function inspectSetupReport(value:unknown,binding:string,now:number):SetupReportState {
    if(value===undefined||value===null)return{state:"MISSING"};
    try {
        const r=record(value);fields(r,["schemaVersion","binding","extensionSha256","brokerSha256","verifiedAt","checks"]);
        if(r.schemaVersion!==1||![r.binding,r.extensionSha256,r.brokerSha256].every(v=>typeof v==="string"&&HASH.test(v))||!validDate(r.verifiedAt)||!Number.isFinite(now))throw Error();
        if(!Array.isArray(r.checks)||r.checks.length!==3)throw Error();const seen=new Set<string>();
        const checks=r.checks.map(item=>{const c=record(item);fields(c,["id","status","passed","total"]);
            if(typeof c.id!=="string"||!Object.hasOwn(COUNTS,c.id)||seen.has(c.id))throw Error();seen.add(c.id);
            const id=c.id as SetupCheckId,total=COUNTS[id];if(c.total!==total||!Number.isSafeInteger(c.passed)||(c.passed as number)<0||(c.passed as number)>total)throw Error();
            if(typeof c.status!=="string"||!["PASS","FAIL","NOT_TESTED"].includes(c.status)||c.status==="PASS"&&c.passed!==total||c.status==="FAIL"&&c.passed===total||c.status==="NOT_TESTED"&&c.passed!==0)throw Error();
            return Object.freeze({id,status:c.status as SetupStatus,passed:c.passed as number,total});});
        const report:SetupReport=Object.freeze({schemaVersion:1,binding:r.binding as string,extensionSha256:r.extensionSha256 as string,brokerSha256:r.brokerSha256 as string,verifiedAt:r.verifiedAt,checks:Object.freeze(checks)});
        const age=now-Date.parse(report.verifiedAt);if(age<0)return{state:"INVALID"};
        if(report.binding!==binding)return{state:"MISMATCH",report};if(age>300000)return{state:"STALE",report};return{state:"CURRENT",report};
    }catch{return{state:"INVALID"};}
}
/** Local component checks never attest another tool's live route or an unmanaged surface. */
export function setupCoverage(state:SetupReportState):{tools:Array<{name:string;status:"NOT_TESTED";badge:"Uncovered"}>;surfaces:Array<{id:string;status:"NOT_TESTED"}>}{
    void state;
    return{tools:["Cline","Claude Code","Codex IDE","Codex CLI","Gemini CLI"].map(name=>({name,status:"NOT_TESTED",badge:"Uncovered"})),
        surfaces:["managed-reader","public-workspace","cline-tools","ordinary-terminal","buffers-clipboard","independent-network","os-isolation","trusted-runtime"].map(id=>({id,status:"NOT_TESTED"}))};
}
