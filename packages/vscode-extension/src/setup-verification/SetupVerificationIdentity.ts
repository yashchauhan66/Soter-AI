import * as fs from "node:fs";
import * as path from "node:path";
import {createHash} from "node:crypto";
const NAMES=["local-ai-broker.js","pre-commit-client.js","soterai-mcp-server.js"] as const;
export type SetupCompanions=Readonly<Record<typeof NAMES[number],string>>;
function fixedHash(file:string):string {
    const first=fs.lstatSync(file),safe=(s:fs.Stats)=>s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=8*1024*1024;
    if(!safe(first)||path.resolve(fs.realpathSync.native(file)).toLowerCase()!==path.resolve(file).toLowerCase())throw Error("Unavailable runtime identity");
    const fd=fs.openSync(file,"r"),hash=createHash("sha256"),buffer=Buffer.allocUnsafe(Math.min(65536,first.size+1));let bytes=0;
    try {
        const opened=fs.fstatSync(fd);if(!safe(opened))throw Error();for(const k of ["ino","size","mtimeMs","ctimeMs","nlink"] as const)if(opened[k]!==first[k])throw Error();
        for(;;){const count=fs.readSync(fd,buffer,0,Math.min(buffer.length,first.size+1-bytes),null);if(!count)break;bytes+=count;if(bytes>first.size)throw Error();hash.update(buffer.subarray(0,count));}
        const ended=fs.fstatSync(fd),after=fs.lstatSync(file);if(!safe(ended)||!safe(after)||bytes!==first.size)throw Error();
        for(const k of ["ino","dev","size","mtimeMs","ctimeMs","nlink"] as const)if(ended[k]!==opened[k]||after[k]!==first[k])throw Error();
        if(path.resolve(fs.realpathSync.native(file)).toLowerCase()!==path.resolve(file).toLowerCase())throw Error();
        return hash.digest("hex");
    }finally{fs.closeSync(fd);}
}
/** Fixed companion names only; no caller input reaches this function from a VS Code command. */
export function captureSetupCompanions(directory:string):SetupCompanions|undefined {
    try{if(path.basename(directory)!=="dist")return;const result=Object.fromEntries(NAMES.map(name=>[name,fixedHash(path.join(directory,name))]));return Object.freeze(result) as SetupCompanions;}catch{return;}
}
export function sameSetupCompanions(first:SetupCompanions|undefined,second:SetupCompanions|undefined):boolean {
    return !!first&&!!second&&NAMES.every(name=>/^[a-f0-9]{64}$/.test(first[name])&&first[name]===second[name]);
}
