import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { analyzeHygieneText, type HygieneInput } from "../hygiene/HygieneAnalysis";

const PRIVATE = "TEST_ONLY_F23_HISTORY_PRIVATE_51c9a7e4", KEY = Buffer.alloc(32, 23);
const oid = (ordinal: number) => ordinal.toString(16).padStart(40, "0");
const hash = (bytes: Buffer) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
const entry = (source: string, bytes: Buffer) => Buffer.from("100644 blob " + hash(bytes) + " " + bytes.length + "\t" + source + "\0");
const frame = (bytes: Buffer) => Buffer.concat([Buffer.from(hash(bytes) + " blob " + bytes.length + "\n"), bytes, Buffer.from("\n")]);
const clean = (value: unknown) => { const text = JSON.stringify(value); for (const secret of [PRIVATE, "private-history.env", "renamed-private.bak"]) assert(!text.includes(secret)); };
async function implementation() { return await import("../history/HistoryScanner"); }
function fixture(trees = new Map<string, Buffer>(), bodies = new Map<string, Buffer>(), commits = [...trees.keys()]) {
    let live = true, time = 0; const calls: any[] = [], analysis: HygieneInput[] = [];
    const options = {
        valid: () => live, now: () => time, deadline: 60000,
        analyze: (input: HygieneInput) => { analysis.push(input); return analyzeHygieneText(input, KEY); },
        run: async (operation: any, deadline: number): Promise<any> => {
            calls.push(operation); assert.equal(deadline, 60000);
            if (operation.kind === "version") return { status: "COMPLETE", bytes: Buffer.from("git version 2.53.0.windows.1\n") };
            if (operation.kind === "commits") return { status: "COMPLETE", bytes: Buffer.from(commits.length ? commits.join("\n") + "\n" : "") };
            if (operation.kind === "tree") { assert.match(operation.oid, /^[a-f0-9]{40}$/); return { status: "COMPLETE", bytes: trees.get(operation.oid) ?? Buffer.alloc(0) }; }
            assert.equal(operation.kind, "batch");
            for (const object of operation.objects) assert.deepEqual(Object.keys(object).sort(), ["oid", "size"]);
            return { status: "COMPLETE", bytes: Buffer.concat(operation.objects.map((object: any) => frame(bodies.get(object.oid)!))) };
        },
    };
    return { options, calls, analysis, withdraw: () => live = false, clock: (value: number) => time = value };
}

test("F23 scanner public and unborn controls are useful bounded analyses with no key/IO authority of their own", async () => {
    const { scanGitHistory } = await implementation();
    const empty = fixture(); const result = await scanGitHistory(empty.options);
    assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 0); assert.equal(result.files, 0); assert.deepEqual(result.findings, []);
    assert.deepEqual(empty.calls.map(c => c.kind), ["version", "commits"]); clean(result);
    const publicBytes = Buffer.from("PORT=3000\nMODE=public\n"), f = fixture(new Map([[oid(1), entry("public.txt", publicBytes)]]), new Map([[hash(publicBytes), publicBytes]]));
    const publicResult = await scanGitHistory(f.options); assert.equal(publicResult.status, "ANALYZED"); assert.equal(publicResult.commits, 1); assert.equal(publicResult.files, 1); assert.deepEqual(publicResult.findings, []); clean(publicResult);
});

test("F23 scanner finds committed then renamed then deleted credentials despite a clean public tip", async () => {
    const { scanGitHistory } = await implementation(); const bytes = Buffer.from("PASSWORD=" + PRIVATE + "\n");
    const f = fixture(new Map([[oid(3), Buffer.alloc(0)], [oid(2), entry("renamed-private.bak", bytes)], [oid(1), entry("private-history.env", bytes)]]), new Map([[hash(bytes), bytes]]));
    const result = await scanGitHistory(f.options); assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 3); assert.equal(result.files, 1); assert.equal(result.findings.length, 1);
    clean(result); assert(f.analysis[0].source.startsWith("history-v1/"));
    const batches = f.calls.filter(c => c.kind === "batch"); assert.equal(batches.length, 1); assert.equal(batches[0].objects.length, 1);
    assert.deepEqual(result.findings[0].suggestions, ["rotation-checklist"]); assert.equal(typeof result.guidance, "string");
});

test("F23 scanner deduplicates blob IO while preserving dotenv classification across a rename", async () => {
    const { scanGitHistory } = await implementation(); const bytes = Buffer.from("TOKEN=" + PRIVATE + "\n");
    const f = fixture(new Map([[oid(2), entry("renamed-private.bak", bytes)], [oid(1), entry(".env", bytes)]]), new Map([[hash(bytes), bytes]]));
    const result = await scanGitHistory(f.options); assert.equal(result.findings.length, 1); assert.equal(f.analysis.length, 1); assert.equal(f.analysis[0].environment, true); assert(f.analysis[0].source.endsWith("/.env")); clean(result);
});

test("F23 scanner disabled/expired authority schedules no version, tree or body operation", async () => {
    const { scanGitHistory } = await implementation();
    for (const change of [(f: ReturnType<typeof fixture>) => f.withdraw(), (f: ReturnType<typeof fixture>) => f.clock(60000)]) {
        const f = fixture(); change(f); const result = await scanGitHistory(f.options); assert.notEqual(result.status, "ANALYZED"); assert.equal(f.calls.length, 0); clean(result);
    }
});

test("F23 scanner version mismatch withholds before list or content and never echoes private errors", async () => {
    const { scanGitHistory } = await implementation(); const f = fixture(); let called = 0;
    const result = await scanGitHistory({ ...f.options, run: async () => { called++; return { status: "COMPLETE", bytes: Buffer.from("git version " + PRIVATE) }; } });
    assert.equal(result.status, "UNAVAILABLE"); assert.equal(called, 1); clean(result);
    const failed = await scanGitHistory({ ...f.options, run: async () => { throw Error(PRIVATE); } }); assert.equal(failed.status, "UNAVAILABLE"); clean(failed);
});

test("F23 scanner cancellation at an await boundary stops all subsequent children and analysis", async () => {
    const { scanGitHistory } = await implementation(); const f = fixture(); const original = f.options.run;
    const result = await scanGitHistory({ ...f.options, run: async (...args: Parameters<typeof original>) => { const value = await original(...args); f.withdraw(); return value; } });
    assert.notEqual(result.status, "ANALYZED"); assert.equal(f.calls.length, 1); assert.equal(f.analysis.length, 0); clean(result);
});

test("F23 scanner unconfirmed process, noncomplete output and clock reversal cannot return findings", async () => {
    const { scanGitHistory } = await implementation();
    for (const status of ["STOP_UNCONFIRMED", "UNAVAILABLE"]) { const f = fixture(); const result = await scanGitHistory({ ...f.options, run: async () => ({ status }) }); assert.equal(result.status, "UNAVAILABLE"); clean(result); }
    const f = fixture(); f.clock(20); const original = f.options.run;
    const result = await scanGitHistory({ ...f.options, run: async (...args: Parameters<typeof original>) => { const value = await original(...args); f.clock(10); return value; } }); assert.notEqual(result.status, "ANALYZED"); clean(result);
});

test("F23 scanner33rd reachable commit is explicit PARTIAL even when the first32 trees are public", async () => {
    const { scanGitHistory } = await implementation(); const f = fixture(new Map(), new Map(), Array.from({ length: 33 }, (_, i) => oid(i + 1)));
    const result = await scanGitHistory(f.options); assert.equal(result.status, "PARTIAL"); assert.equal(result.commits, 32); assert.equal(f.calls.filter(c => c.kind === "tree").length, 32); clean(result);
});

test("F23 scanner skips oversize, symlink and binary blobs explicitly and grants no clean-history claim", async () => {
    const { scanGitHistory } = await implementation(); const binary = Buffer.from([0, 1, 2]);
    const metadata = Buffer.concat([Buffer.from("100644 blob " + oid(9) + " 65537\tlarge.bin\0"), Buffer.from("120000 blob " + oid(10) + " 8\tlink\0"), entry("binary.bin", binary)]);
    const f = fixture(new Map([[oid(1), metadata]]), new Map([[hash(binary), binary]])); const result = await scanGitHistory(f.options);
    assert.equal(result.status, "PARTIAL"); assert.deepEqual(result.findings, []); assert.equal(f.calls.find(c => c.kind === "batch")!.objects.length, 1); clean(result);
});

test("F23 scanner never fetches a129th unique blob and reports PARTIAL", async () => {
    const { scanGitHistory } = await implementation(); const bodies = Array.from({ length: 129 }, (_, i) => Buffer.from("PORT=" + i + "\n"));
    const f = fixture(new Map([[oid(1), Buffer.concat(bodies.map((b, i) => entry("public-" + i + ".txt", b)))]]), new Map(bodies.map(b => [hash(b), b])));
    const result = await scanGitHistory(f.options); assert.equal(result.status, "PARTIAL"); const fetched = f.calls.filter(c => c.kind === "batch").flatMap(c => c.objects); assert(fetched.length <= 128); assert(!fetched.some(o => o.oid === hash(bodies[128]))); clean(result);
});

test("F23 scanner malformed tree or batch cannot release earlier findings or raw private bytes", async () => {
    const { scanGitHistory } = await implementation(); const bytes = Buffer.from("TOKEN=" + PRIVATE + "\n");
    for (const failure of ["tree", "batch"]) {
        const f = fixture(new Map([[oid(1), entry(".env", bytes)]]), new Map([[hash(bytes), bytes]])), original = f.options.run;
        const result = await scanGitHistory({ ...f.options, run: async (operation: any, deadline: number) => operation.kind === failure ? { status: "COMPLETE", bytes: Buffer.from(PRIVATE) } : original(operation, deadline) });
        assert.equal(result.status, "UNAVAILABLE"); assert.deepEqual(result.findings, []); clean(result);
    }
});

test("F23 scanner aggregate metadata is bounded independently of admitted blob bytes", async () => {
    const { scanGitHistory } = await implementation(); const f = fixture();
    const result = await scanGitHistory({ ...f.options, run: async (operation: any) => operation.kind === "version" ? { status: "COMPLETE", bytes: Buffer.alloc(4097, 0x61) } : { status: "COMPLETE", bytes: Buffer.alloc(0) } });
    assert.equal(result.status, "UNAVAILABLE"); clean(result);
});
