import {randomBytes} from "node:crypto";
export interface SetupMatcher {filter(text:string,values:readonly string[]):{allowed:boolean;text:string}}
export interface SetupMatchingReport {status:"PASS"|"FAIL"|"WITHHELD";cases:Array<{id:string;pass:boolean}>}
/** Only generated synthetic values; production matching is exercised without a vault, workspace read or transport. */
export function runSetupMatchingCheck(filter:SetupMatcher):SetupMatchingReport {
    const value="FAKE_ONLY_F30_SYNTHETIC_"+randomBytes(16).toString("hex"),publicText="Useful public verification output.";
    const cases:SetupMatchingReport["cases"]=[];
    try {
        const positive=filter.filter(publicText,[value]);if(!positive.allowed)return{status:"WITHHELD",cases};
        cases.push({id:"M01",pass:positive.text===publicText});
        for(const [index,text]of [value,Buffer.from(value,"utf8").toString("base64")].entries()){
            const result=filter.filter(text,[value]);cases.push({id:`M0${index+2}`,pass:result.allowed&&result.text==="[REDACTED_SECRET_OUTPUT]"&&!JSON.stringify(result).includes(value)});
        }
        return{status:cases.length===3&&cases.every(c=>c.pass)?"PASS":"FAIL",cases};
    }catch{return{status:"FAIL",cases};}
}
