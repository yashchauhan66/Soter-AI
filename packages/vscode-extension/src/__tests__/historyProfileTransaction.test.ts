import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

const generation = "b1234567-1234-4567-8123-123456789abc";
const identity = "a".repeat(64), sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const privateComment = "# FAKE_ONLY_F26C_PRIVATE_COMMENT_b3a91\r\n";
async function api() { return import("../history-hooks/HistoryProfileTransaction"); }
function fixture(...args: [original?: Buffer]) {
    const original = args.length ? args[0] : Buffer.from(privateComment);
    let current = original && Buffer.from(original), record: unknown, authorized = true;
    let backups = 0, writes = 0, journals = 0, readbacks = 0;
    const saved = new Map<string, string>();
    const f = {
        fault: "", onBackup: undefined as (() => void) | undefined, onJournal: undefined as (() => void) | undefined,
        get current() { return current && Buffer.from(current); }, set current(value: Buffer | undefined) { current = value && Buffer.from(value); },
        get record() { return structuredClone(record); }, set record(value: unknown) { record = structuredClone(value); },
        set authorized(value: boolean) { authorized = value; }, get counts() { return { backups, writes, journals, readbacks }; },
        deps: {
            authorized: () => authorized,
            snapshot: async () => ({ identity, content: current && Buffer.from(current) }),
            replace: async (before: { identity: string; content?: Buffer }, after: Buffer | undefined) => {
                assert.equal(before.identity, identity); assert.equal(sha(before.content ?? Buffer.alloc(0)), sha(current ?? Buffer.alloc(0))); assert.equal(before.content === undefined, current === undefined);
                if (f.fault === "replace-before") throw Error("FAKE_ONLY_REPLACE_ERROR");
                writes++; current = after && Buffer.from(after);
                if (f.fault === "replace-after") throw Error("FAKE_ONLY_POST_REPLACE_ERROR");
            },
            readReceipt: () => structuredClone(record),
            writeReceipt: async (value: unknown) => {
                journals++; if (f.fault === "journal-first" && journals === 1) throw Error("FAKE_ONLY_JOURNAL_ERROR");
                if (f.fault === "journal-final" && journals === 2) throw Error("FAKE_ONLY_JOURNAL_FINAL");
                if (f.fault !== "journal-noop") record = structuredClone(value); f.onJournal?.();
            },
            backup: {
                store: async (_identity: string, text: string) => { backups++; if (f.fault === "backup-store") throw Error("FAKE_ONLY_BACKUP_ERROR"); const handle = backups.toString(16).padStart(32, "0"); saved.set(handle, text); f.onBackup?.(); return handle; },
                retrieve: async (handle: string) => { readbacks++; if (f.fault === "backup-missing") return null; if (f.fault === "backup-tamper") return "# FAKE_ONLY_DIFFERENT_BACKUP"; return saved.get(handle) ?? null; },
            },
        },
    }; return f;
}

test("F26c transaction installs absent profile with durable owned receipt and no unnecessary backup", async () => {
    const { installHistoryProfile } = await api(), f = fixture(undefined);
    const result = await installHistoryProfile(f.deps, generation); assert.equal(result.status, "APPLIED");
    assert(f.current!.toString().includes(generation)); assert.equal(f.counts.backups, 0); assert.equal(f.counts.writes, 1);
    const record = f.record as Record<string, unknown>; assert.equal(record.phase, "APPLIED"); assert.equal(record.existed, false); assert.equal(record.identity, identity);
});

test("F26c transaction encrypts/read-verifies existing original before the first write", async () => {
    const { installHistoryProfile } = await api(), f = fixture();
    const result = await installHistoryProfile(f.deps, generation); assert.equal(result.status, "APPLIED"); assert(f.current!.subarray(0, Buffer.byteLength(privateComment)).equals(Buffer.from(privateComment)));
    assert.equal(f.counts.backups, 1); assert(f.counts.readbacks >= 1);
    assert(!JSON.stringify({ result, receipt: f.record }).includes("FAKE_ONLY_F26C_PRIVATE_COMMENT"));
});

test("F26c transaction refuses unapproved install with no backup key journal or mutation", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.authorized = false;
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "UNAVAILABLE"); assert.deepEqual(f.counts, { backups: 0, writes: 0, journals: 0, readbacks: 0 });
});

for (const fault of ["backup-store", "backup-missing", "backup-tamper", "journal-first", "journal-noop"])
    test("F26c transaction withholds before write on " + fault, async () => {
        const { installHistoryProfile } = await api(), f = fixture(); f.fault = fault;
        const result = await installHistoryProfile(f.deps, generation); assert.notEqual(result.status, "APPLIED"); assert.equal(f.counts.writes, 0); assert.equal(f.current!.toString(), privateComment);
        assert(!JSON.stringify(result).includes("FAKE_ONLY"));
    });

test("F26c withdrawal during encrypted backup withholds file and journal", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.onBackup = () => { f.authorized = false; };
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "UNAVAILABLE"); assert.equal(f.counts.writes, 0); assert.equal(f.counts.journals, 0);
});

test("F26c file drift during backup is preserved and cannot be overwritten", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.onBackup = () => { f.current = Buffer.from("# independently changed"); };
    assert.notEqual((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert.equal(f.counts.writes, 0); assert.equal(f.current!.toString(), "# independently changed");
});

test("F26c withdrawal after PREPARED preserves original and recoverable metadata", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.onJournal = () => { f.authorized = false; };
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "UNAVAILABLE"); assert.equal(f.counts.writes, 0); assert.equal((f.record as { phase: string }).phase, "PREPARED");
});

test("F26c ambiguous post-write failure retains PREPARED and stronger installed bytes", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.fault = "replace-after";
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "INCOMPLETE"); assert.equal((f.record as { phase: string }).phase, "PREPARED"); assert(f.current!.toString().includes(generation));
});

test("F26c final journal failure recovers exact after bytes without duplicate write or backup", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.fault = "journal-final";
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "INCOMPLETE"); const before = f.counts; f.fault = "";
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert.equal(f.counts.writes, before.writes); assert.equal(f.counts.backups, before.backups);
});

test("F26c durable PREPARED with exact before bytes resumes the same original backup", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); f.fault = "replace-before";
    assert.notEqual((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); const before = f.counts; f.fault = "";
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert.equal(f.counts.backups, before.backups); assert.equal(f.counts.writes, 1);
});

test("F26c repeated applied install is byte-idempotent without new key or backup", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); assert.equal((await installHistoryProfile(f.deps, generation)).status, "APPLIED");
    const bytes = f.current!, counts = f.counts; assert.equal((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert(f.current!.equals(bytes)); assert.equal(f.counts.writes, counts.writes); assert.equal(f.counts.backups, counts.backups);
});

test("F26c foreign generation or file identity cannot adopt a receipt", async () => {
    const { installHistoryProfile } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation); const before = f.current!;
    assert.notEqual((await installHistoryProfile(f.deps, "c1234567-1234-4567-8123-123456789abc")).status, "APPLIED");
    f.record = { ...(f.record as object), identity: "b".repeat(64) }; assert.notEqual((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert(f.current!.equals(before));
});

test("F26c corrupt or extra-field receipt refuses without replacement", async () => {
    const { installHistoryProfile } = await api();
    for (const value of [null, [], {}, { generation }, { phase: "APPLIED", extra: "FAKE_ONLY" }]) {
        const f = fixture(); f.record = value; assert.notEqual((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert.equal(f.counts.writes, 0);
    }
});

test("F26c executable original profile is refused before creating backups or receipt", async () => {
    const { installHistoryProfile } = await api(), f = fixture(Buffer.from("Write-Output public\n"));
    assert.notEqual((await installHistoryProfile(f.deps, generation)).status, "APPLIED"); assert.equal(f.counts.backups, 0); assert.equal(f.counts.writes, 0); assert.equal(f.counts.journals, 0);
});

test("F26c explicit reviewed restore returns original exact bytes and clears receipt", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation);
    assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "RESTORED"); assert.equal(f.current!.toString(), privateComment); assert.equal(f.record, undefined);
});

test("F26c explicit restore of originally absent profile removes only exact owned bytes", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api(), f = fixture(undefined); await installHistoryProfile(f.deps, generation);
    assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "RESTORED"); assert.equal(f.current, undefined); assert.equal(f.record, undefined);
});

test("F26c restore refuses file drift and missing or tampered encrypted backup", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api();
    for (const fault of ["drift", "backup-missing", "backup-tamper"]) {
        const f = fixture(); await installHistoryProfile(f.deps, generation); if (fault === "drift") f.current = Buffer.from("# independent edit"); else f.fault = fault;
        const bytes = f.current!, writes = f.counts.writes; assert.notEqual((await restoreHistoryProfile(f.deps, generation)).status, "RESTORED"); assert.equal(f.counts.writes, writes); assert(f.current!.equals(bytes)); assert(f.record);
    }
});

test("F26c restore withdrawal preserves the installed exclusion and its receipt", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation); f.authorized = false;
    const bytes = f.current!; assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "UNAVAILABLE"); assert(f.current!.equals(bytes)); assert(f.record);
});

test("F26c restore final-journal failure is recoverable without overwriting original again", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation);
    f.fault = "journal-final"; const priorWrite = f.deps.writeReceipt; let finalFault = true;
    f.deps.writeReceipt = async value => { if (value === undefined && finalFault) throw Error("FAKE_ONLY_RESTORE_FINAL"); await priorWrite(value); };
    assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "INCOMPLETE"); assert.equal(f.current!.toString(), privateComment);
    finalFault = false; f.fault = ""; const writes = f.counts.writes;
    assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "RESTORED"); assert.equal(f.counts.writes, writes); assert.equal(f.record, undefined);
});

test("F26c receipt parser accepts its own exact eight-field durable schema", async () => {
    const { installHistoryProfile, parseHistoryProfileReceipt } = await api(), f = fixture();
    assert.equal((await installHistoryProfile(f.deps, generation)).status, "APPLIED");
    const row = f.record; assert.equal(Object.keys(row as object).length, 8);
    assert.deepEqual(parseHistoryProfileReceipt(row), row);
});

test("F26c receipt parser refuses getters proxies symbol additions and unsafe backup handles", async () => {
    const { installHistoryProfile, parseHistoryProfileReceipt } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation);
    const row = f.record as Record<string, unknown>; let reads = 0;
    const accessor = { ...row }; Object.defineProperty(accessor, "phase", { enumerable: true, get() { reads++; return "APPLIED"; } });
    const proxy = new Proxy(row, { ownKeys() { reads++; throw Error("Synthetic trap"); } });
    for (const value of [accessor, proxy, { ...row, [Symbol("unexpected")]: true }, { ...row, backupHandle: "../other" }, { ...row, existed: false }, { ...row, afterDigest: "bad" }])
        assert.equal(parseHistoryProfileReceipt(value), undefined);
    assert.equal(reads, 0);
});

test("F26c restore withdrawal during snapshot prevents subsequent encrypted-backup access", async () => {
    const { installHistoryProfile, restoreHistoryProfile } = await api(), f = fixture(); await installHistoryProfile(f.deps, generation);
    const readbacks = f.counts.readbacks, previous = f.deps.snapshot;
    f.deps.snapshot = async () => { const value = await previous(); f.authorized = false; return value; };
    assert.equal((await restoreHistoryProfile(f.deps, generation)).status, "UNAVAILABLE"); assert.equal(f.counts.readbacks, readbacks);
});
