import { randomBytes } from "node:crypto";
import { safeRelativePath, SecretContentScanner } from "@soterai/guard-core";
import { scanDirectory } from "../ci/scan";
import { boundedProcess, digest, type ProcessRunner } from "../security/bounded";

const EXECUTABLE = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const ENDPOINT = "npipe:////./pipe/dockerDesktopLinuxEngine";
const KEEPALIVE = "setInterval(()=>{},1000)";
const TMPFS = { "/workspace": "rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700", "/tmp": "rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=0700" };
const IMAGE = /^[a-z0-9][a-z0-9./:_-]{0,200}@sha256:[a-f0-9]{64}$/;
interface Captured { name: string; base64: string; sha256: string }
const proposals = new WeakMap<object, { payload: Buffer; captured: Captured[]; values: string[] }>();
export interface IsolationProposal { readonly schemaVersion: 1; readonly image: string; readonly snapshotSha256: string; readonly approvalSha256: string; readonly policyDigest: string; readonly fileCount: number; readonly byteCount: number }
export interface IsolationResult { status: "COMPLETE" | "DENIED" | "UNAVAILABLE"; isolationVerified: boolean; snapshotSha256?: string; output?: string; cleanupVerified?: boolean; code: string }

export async function prepareIsolatedSession(input: { root: string; image: string; files: readonly string[]; registeredValues?: readonly string[] }): Promise<IsolationProposal> {
    if (!IMAGE.test(input.image) || !Array.isArray(input.files) || input.files.length < 1 || input.files.length > 256
        || input.files.some(name => !safeRelativePath(name) || Buffer.byteLength(name) > 200 || name === ".soterai-public-canary")
        || new Set(input.files.map(name => name.toLowerCase())).size !== input.files.length) throw Error("SNAPSHOT_REFUSED");
    const captured: Captured[] = [], values = [...(input.registeredValues ?? [])];
    const report = await scanDirectory(input.root, { mode: "artifact", maxFiles: 256, maxTotalBytes: 8388608 }, values,
        { includePaths: [...input.files], onFile: (name, bytes) => captured.push({ name, base64: bytes.toString("base64"), sha256: digest(bytes) }) });
    if (report.status !== "clean" || captured.length !== input.files.length) throw Error("SNAPSHOT_REFUSED");
    captured.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const payload = Buffer.from(JSON.stringify(captured));
    const manifest = { schemaVersion: 1 as const, image: input.image, snapshotSha256: digest(payload), policyDigest: report.policyDigest };
    const proposal = Object.freeze({ ...manifest, approvalSha256: digest(JSON.stringify(manifest)), fileCount: captured.length, byteCount: report.scannedBytes });
    proposals.set(proposal, { payload, captured, values });
    return proposal;
}
export function isolationCreationArgs(image: string, nonce: string, snapshot: string): string[] {
    return ["create", "--pull=never", "--name", "soterai-" + nonce, "--label", "soterai.session=" + nonce, "--label", "soterai.snapshot=" + snapshot,
        "--user", "10001:10001", "--entrypoint", "/usr/local/bin/node", "--workdir", "/workspace", "--network", "none", "--read-only", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges", "--ipc", "none", "--cgroupns", "private", "--pids-limit", "64", "--memory", "128m", "--memory-swap", "128m", "--cpus", "0.5",
        "--ulimit", "core=0:0", "--ulimit", "nofile=256:256", "--restart", "no", ...Object.entries(TMPFS).flatMap(([target, options]) => ["--tmpfs", target + ":" + options]),
        "--env", "HOME=/nonexistent", "--env", "NODE_OPTIONS=", "--env", "NODE_PATH=", image, "-e", KEEPALIVE];
}
const empty = (value: unknown) => value === null || value === undefined || Array.isArray(value) && !value.length || typeof value === "object" && value !== null && !Object.keys(value).length;
/** Every security-relevant field must be observed; omitted enforcement is rejected. */
export function validateIsolationInspection(value: any, binding: { id: string; imageId: string; nonce: string; snapshot: string }): boolean {
    try {
        const h = value.HostConfig, c = value.Config, n = value.NetworkSettings;
        const fields=["Binds","VolumesFrom","Devices","DeviceRequests","DeviceCgroupRules","Links","ExtraHosts","PortBindings","CapAdd"];
        return fields.every(key=>Object.hasOwn(h,key)) && Object.hasOwn(n,"Ports")
            && value.Id === binding.id && value.Image === binding.imageId && value.State.Running === true && value.State.Restarting === false
            && c.User === "10001:10001" && c.WorkingDir === "/workspace" && JSON.stringify(c.Entrypoint) === JSON.stringify(["/usr/local/bin/node"])
            && JSON.stringify(c.Cmd) === JSON.stringify(["-e", KEEPALIVE]) && c.Labels["soterai.session"] === binding.nonce && c.Labels["soterai.snapshot"] === binding.snapshot
            && Array.isArray(c.Env) && c.Env.every((s:unknown) => typeof s === "string" && /^(?:PATH|NODE_VERSION|YARN_VERSION|HOME|NODE_OPTIONS|NODE_PATH)=/.test(s))
            && ["HOME=/nonexistent", "NODE_OPTIONS=", "NODE_PATH="].every(s => c.Env.includes(s))
            && h.NetworkMode === "none" && h.ReadonlyRootfs === true && h.Privileged === false && JSON.stringify(h.CapDrop) === '["ALL"]' && empty(h.CapAdd)
            && Array.isArray(h.SecurityOpt) && h.SecurityOpt.length === 1 && ["no-new-privileges", "no-new-privileges=true"].includes(h.SecurityOpt[0])
            && [h.Binds, h.VolumesFrom, h.Devices, h.DeviceRequests, h.DeviceCgroupRules, h.Links, h.ExtraHosts, h.PortBindings, n.Ports].every(empty)
            && ["", "private"].includes(h.PidMode) && h.IpcMode === "none" && ["", "private"].includes(h.UTSMode) && h.CgroupnsMode === "private"
            && h.Memory === 134217728 && h.MemorySwap === 134217728 && h.NanoCpus === 500000000 && h.PidsLimit === 64
            && h.RestartPolicy.Name === "no" && h.RestartPolicy.MaximumRetryCount === 0
            && Array.isArray(h.Ulimits) && h.Ulimits.length === 2 && h.Ulimits.some((x:any) => x.Name === "core" && x.Soft === 0 && x.Hard === 0)
            && h.Ulimits.some((x:any) => x.Name === "nofile" && x.Soft === 256 && x.Hard === 256)
            && JSON.stringify(Object.keys(h.Tmpfs).sort()) === '["/tmp","/workspace"]' && Object.entries(TMPFS).every(([key, options]) => h.Tmpfs[key] === options)
            && Array.isArray(value.Mounts) && value.Mounts.every((m:any) => m.Type === "tmpfs" && Object.hasOwn(TMPFS, m.Destination)) && value.Mounts.length <= 2
            && JSON.stringify(Object.keys(n.Networks)) === '["none"]';
    } catch { return false; }
}
// The fixed loader transfers approved bytes over stdin. No host mount or archive extraction.
const LOADER = String.raw`const fs=require('fs'),p=require('path'),crypto=require('crypto');let chunks=[],n=0;process.stdin.on('data',b=>{n+=b.length;if(n>12000000)process.exit(2);chunks.push(b)});process.stdin.on('end',()=>{try{const files=JSON.parse(Buffer.concat(chunks));if(!Array.isArray(files)||files.length>256)throw 0;const names=new Set();for(const f of files){if(typeof f.name!=='string'||f.name.length>200||!f.name.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!/[\:\u0000-\u001f]/.test(s))||f.name[0]==='/'||names.has(f.name.toLowerCase()))throw 0;names.add(f.name.toLowerCase());const b=Buffer.from(f.base64,'base64');if(b.length>131072||crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw 0;const target=p.join('/workspace',f.name);fs.mkdirSync(p.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,b,{flag:'wx',mode:0o444});}fs.writeFileSync('/workspace/.soterai-public-canary','soterai-public-canary-v1',{flag:'wx',mode:0o444});process.stdout.write('LOADED')}catch{process.exit(2)}});`;
const CANARY = String.raw`const fs=require('fs'),net=require('net');(async()=>{try{if(process.getuid()!==10001||process.getgid()!==10001)throw 0;const status=fs.readFileSync('/proc/self/status','utf8');for(const re of [/^CapEff:[\t ]+0+$/m,/^CapPrm:[\t ]+0+$/m,/^CapAmb:[\t ]+0+$/m,/^NoNewPrivs:[\t ]+1$/m,/^Seccomp:[\t ]+2$/m])if(!re.test(status))throw 0;for(const p of ['/root/.aws','/root/.ssh','/root/.config','/var/run/docker.sock','/run/docker.sock','/host','/home/USER'])if(fs.existsSync(p))throw 0;if(fs.readFileSync('/workspace/.soterai-public-canary','utf8')!=='soterai-public-canary-v1')throw 0;fs.writeFileSync('/tmp/soterai-canary','public',{flag:'wx'});if(fs.readFileSync('/tmp/soterai-canary','utf8')!=='public')throw 0;let root=false,write=false;try{process.setuid(0);root=true}catch{}try{fs.writeFileSync('/soterai-forbidden','public');write=true}catch{}if(root||write)throw 0;const connected=await new Promise(r=>{const s=net.connect({host:'192.0.2.1',port:443});s.setTimeout(1000);s.on('connect',()=>{s.destroy();r(true)});s.on('error',()=>r(false));s.on('timeout',()=>{s.destroy();r(false)})});if(connected)throw 0;process.stdout.write('VERIFIED')}catch{process.exitCode=2}})();`;

/** Trusted host composition only. No registration values or mutable references
 * escape; a guessed/copied proposal cannot authorize snapshot access. */
export function approvedIsolationPayload(proposal: IsolationProposal, approval: string): Buffer {
    const state = proposals.get(proposal);
    if (!state || approval !== proposal.approvalSha256 || digest(state.payload) !== proposal.snapshotSha256) throw Error("SNAPSHOT_REFUSED");
    return Buffer.from(state.payload);
}
export { EXECUTABLE as ISOLATION_EXECUTABLE, ENDPOINT as ISOLATION_ENDPOINT, LOADER as ISOLATION_LOADER, CANARY as ISOLATION_CANARY };

export async function runIsolatedSession(proposal: IsolationProposal, approval: string, entry: string, testing?: { runner: ProcessRunner }): Promise<IsolationResult> {
    const state = proposals.get(proposal);
    if (!state || approval !== proposal.approvalSha256 || !state.captured.some(file => file.name === entry) || !/\.(?:js|cjs|mjs)$/.test(entry)) return { status: "DENIED", code: "APPROVAL_OR_ENTRY_REFUSED", isolationVerified: false };
    const snapshot = proposal.snapshotSha256;
    if (!testing && process.platform !== "win32") return { status: "UNAVAILABLE", code: "UNSUPPORTED_HOST", isolationVerified: false };
    const runner = testing?.runner ?? boundedProcess, nonce = randomBytes(16).toString("hex");
    let id: string | undefined, verified = false, result: IsolationResult = { status: "UNAVAILABLE", code: "ISOLATION_UNVERIFIED", isolationVerified: false };
    const invoke = (args: string[], input?: Buffer, timeoutMs = 15000, maxOutputBytes = 262144) => runner({ executable: EXECUTABLE, args: ["--host", ENDPOINT, ...args],
        env: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: "C:\\Windows\\System32", DOCKER_CONFIG: "C:\\ProgramData\\SoterAI\\docker-empty" }, input, timeoutMs, maxOutputBytes });
    try {
        const info = JSON.parse((await invoke(["info", "--format", "{{json .}}"])).toString());
        if (info.OSType !== "linux" || !Array.isArray(info.SecurityOptions) || !info.SecurityOptions.some((s:unknown) => typeof s === "string" && /name=seccomp.*profile=builtin/.test(s))) throw Error();
        const images = JSON.parse((await invoke(["image", "inspect", proposal.image])).toString()), inspectedImage = images[0];
        if (images.length !== 1 || !/^sha256:[a-f0-9]{64}$/.test(inspectedImage.Id) || !empty(inspectedImage.Config.Volumes)
            || !Array.isArray(inspectedImage.RepoDigests) || !inspectedImage.RepoDigests.includes(proposal.image)) throw Error();
        if (digest(state.payload) !== snapshot) throw Error();
        const created = (await invoke(isolationCreationArgs(proposal.image, nonce, snapshot))).toString().trim();
        if (!/^[a-f0-9]{64}$/.test(created)) throw Error(); id = created;
        await invoke(["start", id]);
        const binding = { id, imageId: inspectedImage.Id, nonce, snapshot };
        const inspect = async () => { const values = JSON.parse((await invoke(["inspect", id!])).toString()); if (values.length !== 1 || !validateIsolationInspection(values[0], binding)) throw Error(); };
        await inspect();
        if ((await invoke(["exec", "-i", id, "/usr/local/bin/node", "-e", LOADER], Buffer.from(state.payload))).toString() !== "LOADED") throw Error();
        await inspect();
        if ((await invoke(["exec", id, "/usr/local/bin/node", "-e", CANARY])).toString() !== "VERIFIED") throw Error();
        verified = true; await inspect();
        const output = await invoke(["exec", id, "/usr/local/bin/node", "--", "/workspace/" + entry], undefined, 30000, 65536);
        const text = new TextDecoder("utf-8", { fatal: true }).decode(output), scanned = new SecretContentScanner(state.values).scan(text);
        if (!scanned.complete || scanned.findings.length) { result = { status: "DENIED", code: "OUTPUT_WITHHELD", isolationVerified: true, snapshotSha256: snapshot }; }
        else result = { status: "COMPLETE", code: "FINITE_APPLICATION_COMPLETED", isolationVerified: true, snapshotSha256: snapshot, output: text };
    } catch { result = { status: "UNAVAILABLE", code: verified ? "APPLICATION_OUTCOME_UNKNOWN" : "ISOLATION_UNVERIFIED", isolationVerified: verified, snapshotSha256: snapshot }; }
    finally {
        if (id) { try { await invoke(["rm", "--force", id]); result.cleanupVerified = true; } catch { result = { status: "UNAVAILABLE", code: "SESSION_CLEANUP_UNVERIFIED", isolationVerified: verified, snapshotSha256: snapshot, cleanupVerified: false }; } }
    }
    return result;
}
