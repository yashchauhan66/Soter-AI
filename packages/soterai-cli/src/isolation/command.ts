import path from "node:path";
import { prepareIsolatedSession, runIsolatedSession } from "./session";
export async function runIsolationCommand(argv:string[],deps:{cwd:string;out(value:string):void;err(value:string):void}):Promise<number>{
    try{
        const [action,...args]=argv;if(!["plan","run"].includes(action))throw Error();const options=new Map<string,string>(),files:string[]=[];
        for(let i=0;i<args.length;i++){let key=args[i];const value=args[++i];if(!value || value.startsWith("--"))throw Error();if(key==="--approve-snapshot")key="--approve-proposal";if(key==="--file")files.push(value);
            else if(["--root","--image","--approve-proposal","--entry"].includes(key) && !options.has(key))options.set(key,value);else throw Error();}
        if(!options.has("--image") || action==="plan" && (options.has("--approve-proposal") || options.has("--entry")))throw Error();
        const proposal=await prepareIsolatedSession({root:path.resolve(deps.cwd,options.get("--root")??"."),image:options.get("--image")!,files});
        if(action==="plan"){deps.out(JSON.stringify({...proposal,status:"OWNER_REVIEW_REQUIRED",isolationVerified:false}));return 0;}
        const result=await runIsolatedSession(proposal,options.get("--approve-proposal")??"",options.get("--entry")??"");deps.out(JSON.stringify(result));return result.status==="COMPLETE"?0:2;
    }catch{deps.err("Isolated session unavailable. Rerun isolate plan and use isolate run --root <directory> --image <name@sha256:digest> --file <relative-file> [--file ...] --approve-proposal <approvalSha256> --entry <file.js>.");return 2;}
}
