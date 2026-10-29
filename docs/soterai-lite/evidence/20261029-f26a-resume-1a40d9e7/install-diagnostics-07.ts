const WORDS = new Set(["command-start","command-return","filesystem","listener-created","listener-listening","listener-close","listener-error","storage-uri","configuration-event","workspace-event","assertion-frame",
    "installPreCommitGuard","resumePreCommitGuard","restorePreCommitGuard","preCommitGuardStatus","APPLIED","RESUMED","RESTORED","CANCELLED","UNAVAILABLE","ROLLED_BACK","INCOMPLETE","LIVE","OWNER_REVIEW_REQUIRED","OTHER",
    "mkdirSync","lstatSync","openSync","RETURNED","THREW","storage","storage-parent","ENOENT","EACCES","EPERM","ENOSPC","EEXIST","EIO","EMFILE","ENFILE","ENOTDIR","EADDRINUSE","EADDRNOTAVAIL","UNKNOWN"]);
const FIELDS = new Set(["command","status","operation","outcome","target","code","fileScheme","authority","query","fragment","withinWorkspace","loopback","line","column"]);
export class InstallDiagnostics07 {
    readonly rows: Readonly<Record<string,string|number|boolean>>[] = [];
    dropped = 0;
    record(event: string, details: unknown = {}): void {
        try {
            if(!WORDS.has(event))return;
            if(this.rows.length>=256){this.dropped++;return;}
            const row:Record<string,string|number|boolean>={event};
            if(details && typeof details === "object")for(const [key,field] of Object.entries(Object.getOwnPropertyDescriptors(details))){
                if(!FIELDS.has(key)||!("value" in field))continue;
                const value=field.value;
                if(typeof value==="boolean"||typeof value==="number"&&Number.isSafeInteger(value)&&value>=0&&value<=10000000||typeof value==="string"&&WORDS.has(value))row[key]=value;
            }
            this.rows.push(Object.freeze(row));
        } catch { /* Diagnostic input has no authority over the tested route. */ }
    }
    frames(error: unknown): void {
        try {
            if(!(error instanceof Error)||typeof error.stack!=="string")return;
            // Retain locations only: never exception messages, assertion values,
            // function names, source paths, environment or private store data.
            for(const line of error.stack.split("\n").slice(1,17)){
                if(!/^\s+at /.test(line))continue;
                const match=/:([0-9]+):([0-9]+)\)?$/.exec(line);
                if(match)this.record("assertion-frame",{line:Number(match[1]),column:Number(match[2])});
            }
        } catch { /* No diagnostic failure changes the original failure. */ }
    }
    snapshot(){return {scope:"BOUNDED_ENUMERATED_METADATA_ONLY_NO_VALUES_OR_PATHS",rows:this.rows.slice(),dropped:this.dropped};}
}
