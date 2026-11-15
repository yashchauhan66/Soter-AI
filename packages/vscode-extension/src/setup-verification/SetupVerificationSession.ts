import { inspectSetupReport, makeSetupReport, validSetupBinding, type SetupBinding, type SetupReport, type SetupReportState } from "./SetupVerificationReport";
export interface SetupVerificationDependencies {
    enabled():boolean;trusted():boolean;now():number;binding():SetupBinding|undefined;
    run():Promise<unknown>;save(report:SetupReport):Promise<void>;changed():void;initialReport?:unknown;
}
export class SetupVerificationSession {
    private disposed=false;private pending=false;private epoch=0;private last:unknown;
    constructor(private readonly deps:SetupVerificationDependencies){this.last=deps.initialReport;}
    private available():boolean {try{return !this.disposed&&this.deps.enabled()===true&&this.deps.trusted()===true;}catch{return false;}}
    private changed():void {try{this.deps.changed();}catch{/* Never expose an observer's text. */}}
    private binding():SetupBinding|undefined {try{const b=this.deps.binding();return b&&validSetupBinding(b)?{...b}:undefined;}catch{return undefined;}}
    private same(before:SetupBinding,epoch:number):boolean {const after=this.binding();return this.available()&&this.epoch===epoch&&!!after&&before.binding===after.binding&&before.extensionSha256===after.extensionSha256&&before.brokerSha256===after.brokerSha256;}
    current():SetupReportState {if(!this.available())return{state:"MISSING"};const b=this.binding();if(!b)return{state:"MISMATCH"};try{return inspectSetupReport(this.last,b.binding,this.deps.now());}catch{return{state:"INVALID"};}}
    invalidate():void {this.epoch++;this.last=undefined;this.changed();}
    async run(signal?:AbortSignal):Promise<{status:"SAVED"|"UNAVAILABLE"|"CANCELLED"|"FAILED"}> {
        if(signal?.aborted)return{status:"CANCELLED"};if(!this.available()||this.pending)return{status:"UNAVAILABLE"};
        const before=this.binding();if(!before)return{status:"UNAVAILABLE"};const epoch=this.epoch;this.pending=true;this.last=undefined;this.changed();
        try {
            const inputs=await this.deps.run();if(signal?.aborted)return{status:"CANCELLED"};if(!this.same(before,epoch))return{status:"UNAVAILABLE"};
            const report=makeSetupReport({...before,verifiedAt:new Date(this.deps.now()).toISOString()},inputs);await this.deps.save(report);
            if(signal?.aborted)return{status:"CANCELLED"};if(!this.same(before,epoch))return{status:"UNAVAILABLE"};this.last=report;return{status:"SAVED"};
        }catch{return{status:"FAILED"};}finally{this.pending=false;this.changed();}
    }
    dispose():void {this.disposed=true;this.epoch++;this.last=undefined;this.changed();}
}
