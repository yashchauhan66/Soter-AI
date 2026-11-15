import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { prepareIsolatedSession, runIsolatedSession, isolationCreationArgs, validateIsolationInspection } from "../isolation/session";
const image = "node@sha256:" + "a".repeat(64), id = "b".repeat(64), imageId = "sha256:" + "c".repeat(64);
async function root() { const dir = await fs.mkdtemp(path.join(tmpdir(), "soterai-isolation-")); await fs.writeFile(path.join(dir, "app.js"), "console.log('public application')"); return dir; }
test("snapshot proposal captures only finite public bytes and binds approval before Docker", async () => {
    const dir = await root(), proposal = await prepareIsolatedSession({ root: dir, image, files: ["app.js"] });
    assert.match(proposal.snapshotSha256, /^[a-f0-9]{64}$/);
    let calls = 0;
    const result = await runIsolatedSession(proposal, "f".repeat(64), "app.js", { runner: async () => { calls++; return Buffer.from("{}"); } });
    assert.equal(result.status, "DENIED"); assert.equal(calls, 0);
    await fs.writeFile(path.join(dir, "private.txt"), "DB_PASSWORD=BlueMango7!");
    await assert.rejects(prepareIsolatedSession({ root: dir, image, files: ["private.txt"] }));
});
test("approval binds the reviewed image even when snapshot bytes are identical", async () => {
    const dir = await root(), one = await prepareIsolatedSession({ root: dir, image, files: ["app.js"] });
    const two = await prepareIsolatedSession({ root: dir, image: "node@sha256:" + "e".repeat(64), files: ["app.js"] });
    assert.equal(one.snapshotSha256, two.snapshotSha256);
    let calls = 0;
    const runner = async () => { calls++; throw Error("SYNTHETIC_DOCKER_UNAVAILABLE"); };
    assert.equal((await runIsolatedSession(two, one.snapshotSha256, "app.js", { runner })).status, "DENIED");
    assert.equal(calls, 0);
    assert.match(one.approvalSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(one.approvalSha256, two.approvalSha256);
    assert.equal((await runIsolatedSession(two, one.approvalSha256, "app.js", { runner })).status, "DENIED");
    assert.equal((await runIsolatedSession(two, two.snapshotSha256, "app.js", { runner })).status, "DENIED");
    assert.equal(calls, 0);
    assert.equal((await runIsolatedSession(two, two.approvalSha256, "app.js", { runner })).status, "UNAVAILABLE");
    assert.equal(calls, 1);
});
test("image tags, traversal, secret names and unsupported snapshots are refused", async () => {
    for (const input of [{ image: "node:latest", files: ["app.js"] }, { image, files: ["../private"] }, { image, files: [] }])
        await assert.rejects(prepareIsolatedSession({ root: await root(), ...input }));
    const dir = await root(); await fs.writeFile(path.join(dir, "DB_PASSWORD=BlueMango7!.txt"), "public");
    await assert.rejects(prepareIsolatedSession({ root: dir, image, files: ["DB_PASSWORD=BlueMango7!.txt"] }));
});
export function inspection(nonce: string, snapshot: string): any {
    return { Id: id, Image: imageId, State: { Running: true, Restarting: false },
        Config: { User: "10001:10001", WorkingDir: "/workspace", Entrypoint: ["/usr/local/bin/node"], Cmd: ["-e", "setInterval(()=>{},1000)"],
            Labels: { "soterai.session": nonce, "soterai.snapshot": snapshot }, Env: ["HOME=/nonexistent", "NODE_OPTIONS=", "NODE_PATH="] },
        Mounts: [], NetworkSettings: { Networks: { none: {} }, Ports: {} },
        HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, CapDrop: ["ALL"], CapAdd: null, SecurityOpt: ["no-new-privileges"],
            Binds: null, VolumesFrom: null, Devices: [], DeviceRequests: null, DeviceCgroupRules: null, Links: null, ExtraHosts: null, PortBindings: {},
            PidMode: "", IpcMode: "none", UTSMode: "", CgroupnsMode: "private", Memory: 134217728, MemorySwap: 134217728, NanoCpus: 500000000, PidsLimit: 64,
            RestartPolicy: { Name: "no", MaximumRetryCount: 0 }, Ulimits: [{ Name: "core", Soft: 0, Hard: 0 }, { Name: "nofile", Soft: 256, Hard: 256 }],
            Tmpfs: { "/workspace": "rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700", "/tmp": "rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=0700" } } };
}
test("effective Docker settings reject every unsafe privilege and mount override", () => {
    const baseline = inspection("nonce", "d".repeat(64));
    assert.equal(validateIsolationInspection(baseline, { id, imageId, nonce: "nonce", snapshot: "d".repeat(64) }), true);
    const missing=structuredClone(baseline);delete missing.HostConfig.Devices;
    assert.equal(validateIsolationInspection(missing, { id, imageId, nonce: "nonce", snapshot: "d".repeat(64) }), false);
    for (const [key, value] of Object.entries({ Privileged: true, ReadonlyRootfs: false, NetworkMode: "host", CapAdd: ["SYS_ADMIN"], SecurityOpt: ["seccomp=unconfined"],
        Binds: ["/:/host"], Devices: [{}], PidMode: "host", IpcMode: "host", Memory: 0, NanoCpus: 0, PidsLimit: -1, CgroupnsMode: "host" })) {
        const changed = structuredClone(baseline); changed.HostConfig[key] = value;
        assert.equal(validateIsolationInspection(changed, { id, imageId, nonce: "nonce", snapshot: "d".repeat(64) }), false, key);
    }
    for (const mutate of [(v:any) => v.Mounts.push({Type:"bind"}), (v:any) => v.Config.User="0", (v:any) => v.Image="wrong", (v:any) => v.State.Running=false,
        (v:any) => v.NetworkSettings.Networks.bridge={}, (v:any) => v.Config.Env.push("AWS_SECRET_ACCESS_KEY=private")]) {
        const changed = structuredClone(baseline); mutate(changed); assert.equal(validateIsolationInspection(changed, { id, imageId, nonce: "nonce", snapshot: "d".repeat(64) }), false);
    }
});
test("creation pins image, namespaces, resources and host-independent environment", () => {
    const args = isolationCreationArgs(image, "nonce", "d".repeat(64));
    assert.ok(args.includes("--pull=never")); assert.ok(args.includes("--read-only")); assert.ok(args.includes("none"));
    assert.ok(!args.some(arg => arg.includes("/host") || arg === "--privileged")); assert.equal(args.at(-3), image);
});
test("missing Docker returns bounded unavailable output without host fallback or raw errors", async () => {
    const proposal = await prepareIsolatedSession({ root: await root(), image, files: ["app.js"] });
    const result = await runIsolatedSession(proposal, proposal.approvalSha256, "app.js", { runner: async () => { throw Error("RAW_PRIVATE_AWS_SECRET"); } });
    assert.equal(result.status, "UNAVAILABLE"); assert.ok(!JSON.stringify(result).includes("RAW_PRIVATE"));
});

const safeProcStatus = "CapEff:\t0000000000000000\nCapPrm:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\nSeccomp:\t2\n";
// Execute the actual program sent to `docker exec`, with synthetic guest I/O.
// This tests canary behavior, not native Docker enforcement.
async function runGuestCanary(status: string) {
    const proposal = await prepareIsolatedSession({ root: await root(), image, files: ["app.js"] });
    let nonce = "", guestRan = false;
    const result = await runIsolatedSession(proposal, proposal.approvalSha256, "app.js", { runner: async request => {
        const args = request.args.slice(2);
        if (args[0] === "info") return Buffer.from(JSON.stringify({ OSType: "linux", SecurityOptions: ["name=seccomp,profile=builtin"] }));
        if (args[0] === "image") return Buffer.from(JSON.stringify([{ Id: imageId, Config: { Volumes: null }, RepoDigests: [image] }]));
        if (args[0] === "create") { nonce = args[args.indexOf("--name") + 1].slice("soterai-".length); return Buffer.from(id); }
        if (args[0] === "start" || args[0] === "rm") return Buffer.alloc(0);
        if (args[0] === "inspect") return Buffer.from(JSON.stringify([inspection(nonce, proposal.snapshotSha256)]));
        if (args[0] === "exec" && args[1] === "-i") return Buffer.from("LOADED");
        if (args[0] === "exec" && args.includes("-e")) {
            guestRan = true; let output = "";
            const guestProcess = { getuid: () => 10001, getgid: () => 10001, setuid: () => { throw Error(); }, exitCode: 0,
                stdout: { write: (value: string) => { output += value; } } };
            const guestFs = { existsSync: () => false,
                readFileSync: (name: string) => name === "/proc/self/status" ? status : name === "/workspace/.soterai-public-canary" ? "soterai-public-canary-v1" : "public",
                writeFileSync: (name: string) => { if (name !== "/tmp/soterai-canary") throw Error(); } };
            const socket = { setTimeout() {}, destroy() {}, on(event: string, listener: () => void) { if (event === "error") queueMicrotask(listener); return this; } };
            await runInNewContext(args.at(-1)!, { process: guestProcess, require: (name: string) => {
                if (name === "fs") return guestFs; if (name === "net") return { connect: () => socket }; throw Error();
            } }, { timeout: 1000 });
            if (guestProcess.exitCode) throw Error("SYNTHETIC_CANARY_REFUSED");
            return Buffer.from(output);
        }
        if (args[0] === "exec") return Buffer.from("useful public application");
        throw Error("UNEXPECTED_REQUEST");
    } });
    assert.equal(guestRan, true); return result;
}
test("emitted guest canary accepts realistic Linux proc security status before useful execution", async () => {
    const result = await runGuestCanary(safeProcStatus);
    assert.equal(result.status, "COMPLETE"); assert.equal(result.isolationVerified, true);
    assert.equal(result.output, "useful public application"); assert.equal(result.cleanupVerified, true);
});
test("emitted guest canary refuses capabilities, privilege escalation and missing seccomp", async () => {
    for (const [before, after] of [["CapEff:\t0000000000000000", "CapEff:\t0000000000000001"], ["CapPrm:\t0000000000000000", "CapPrm:\t0000000000000001"],
        ["CapAmb:\t0000000000000000", "CapAmb:\t0000000000000001"], ["NoNewPrivs:\t1", "NoNewPrivs:\t0"], ["Seccomp:\t2", "Seccomp:\t0"]]) {
        const result = await runGuestCanary(safeProcStatus.replace(before, after));
        assert.equal(result.status, "UNAVAILABLE"); assert.equal(result.isolationVerified, false);
        assert.equal(result.output, undefined); assert.equal(result.cleanupVerified, true);
    }
});
