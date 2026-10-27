import assert from "node:assert/strict";
import { test } from "node:test";

// F26c test-first pure text/pattern contract, synthetic data only. Native callback
// and persistence are separate actual PowerShell checks, never inferred here.
const generation = "a1234567-1234-4567-8123-123456789abc";
const enabled = { enabled: true, generation };
async function api() { return import("../history-hooks/PowerShellHistoryText"); }

test("F26c canonical pattern projection is frozen public data with all detector classes", async () => {
    const core = await import("../../../guard-core/src/detectors/SecretDetector");
    assert(Array.isArray(core.SECRET_PATTERN_SNAPSHOT)); assert(Object.isFrozen(core.SECRET_PATTERN_SNAPSHOT));
    assert.deepEqual([...new Set(core.SECRET_PATTERN_SNAPSHOT.map(row => row.type))], core.SECRET_DETECTOR_CLASSES);
    for (const row of core.SECRET_PATTERN_SNAPSHOT) { assert(Object.isFrozen(row)); assert.deepEqual(Object.keys(row).sort(), ["flags", "source", "type"]); new RegExp(row.source, row.flags); }
    const canary = "ghp_A9b8C7d6E5f4G3h2I1j0K9l8M7n6O5p4";
    const before = core.detectSecrets(canary); assert(before.matches.some(row => row.type === "github_token"));
    assert.throws(() => (core.SECRET_PATTERN_SNAPSHOT as unknown as unknown[]).push({}));
    assert.deepEqual(core.detectSecrets(canary), before);
});

test("F26c default/off/missing/invalid opt-in produces no executable profile text", async () => {
    const text = await api();
    for (const value of [undefined, null, {}, { generation }, { enabled: false, generation }, { enabled: 1, generation }, { ...enabled, extra: true }])
        assert.equal(text.buildPowerShellHistoryText(value), undefined);
});

test("F26c refuses noncanonical generations instead of interpolating caller code", async () => {
    const text = await api();
    for (const value of ["", generation.toUpperCase(), "x';& exit", generation+"\n", "../other", "a1234567-1234-1567-8123-123456789abc"])
        assert.equal(text.buildPowerShellHistoryText({ enabled: true, generation: value }), undefined);
});

test("F26c rejects proxy/accessor/coercion options without executing them", async () => {
    const text = await api(); let reads = 0;
    const proxy = new Proxy({}, { get() { reads++; throw Error("Synthetic getter"); }, ownKeys() { reads++; throw Error("Synthetic ownKeys"); } });
    const accessor = { get enabled() { reads++; return true; }, generation };
    assert.equal(text.buildPowerShellHistoryText(proxy), undefined); assert.equal(text.buildPowerShellHistoryText(accessor), undefined); assert.equal(reads, 0);
});

test("F26c generated callback is deterministic ASCII with bounded decisions and exact enum returns", async () => {
    const text = await api(), first = text.buildPowerShellHistoryText(enabled);
    assert.equal(typeof first, "string"); assert.equal(first, text.buildPowerShellHistoryText(enabled));
    assert(first!.length < 65536); assert(!/[^\x09\x0a\x0d\x20-\x7e]/.test(first!));
    assert(first!.includes(generation)); assert(first!.includes("SkipAdding") && first!.includes("MemoryOnly") && first!.includes("MemoryAndFile"));
    assert(first!.includes("4096") && first!.includes("250") && first!.includes("FromMilliseconds(20)"));
    assert(!/SaveNothing|Set-Content|Add-Content|Invoke-Expression|Start-Process|HistorySavePath\s*=|HistorySaveStyle\s*=/.test(first!));
});

test("F26c projection directly embeds every unchanged canonical regex without secret values", async () => {
    const text = await api(), core = await import("../../../guard-core/src/detectors/SecretDetector"), output = text.buildPowerShellHistoryText(enabled)!;
    for (const row of core.SECRET_PATTERN_SNAPSHOT) assert(output.includes("'" + row.source.replaceAll("'", "''") + "'"));
    assert(!output.includes("FAKE_ONLY_F26C_SECRET_VALUE"));
});

test("F26c accepts absent empty and ordinary comment-only profile inputs", async () => {
    const text = await api();
    for (const before of [undefined, Buffer.alloc(0), Buffer.from("\r\n \t\n"), Buffer.from("# owner comment\r\n# retained\n"), Buffer.from("\ufeff# Unicode comment: cafe\r\n")])
        assert.equal(text.supportedHistoryProfile(before), true);
});

test("F26c preserves original UTF8 bytes including BOM and final comment without newline", async () => {
    const text = await api();
    for (const before of [Buffer.alloc(0), Buffer.from("# final comment"), Buffer.from("\ufeff# owner comment\r\n")]) {
        const saved = Buffer.from(before), after = text.buildHistoryProfile(before, enabled); assert(Buffer.isBuffer(after));
        assert(after.subarray(0, before.length).equals(before)); assert(before.equals(saved));
        assert(after.subarray(before.length).toString().startsWith("\n# SoterAI Lite PSReadLine history v1 "));
    }
});

test("F26c rejects executable profile syntax including flow, multiline comments and here-strings", async () => {
    const text = await api();
    for (const source of ["exit\n", "Set-PSReadLineOption -AddToHistoryHandler { $false }\n", "<# unterminated", "@'\n", "function prompt { 'public' }", "# harmless\nWrite-Output public\n"])
        assert.equal(text.buildHistoryProfile(Buffer.from(source), enabled), undefined);
});

test("F26c refuses requires, signed, owned and ambiguous comment profiles", async () => {
    const text = await api();
    for (const source of ["#requires -Version 99", "  #ReQuIrEs -RunAsAdministrator", "# SIG # Begin signature block", "# SoterAI Lite PSReadLine history v1 old", "# comment\u202e", "# one\rtwo", "# comment\0"])
        assert.equal(text.supportedHistoryProfile(Buffer.from(source)), false);
});

test("F26c no duplicate hook insertion and opt-out does not return a modified buffer", async () => {
    const text = await api(), once = text.buildHistoryProfile(undefined, enabled); assert(Buffer.isBuffer(once));
    assert.equal(text.buildHistoryProfile(once, enabled), undefined);
    assert.equal(text.buildHistoryProfile(Buffer.from("# original"), { enabled: false, generation }), undefined);
});

test("F26c rejects malformed UTF8, nonbuffers and bounded oversized profile inputs", async () => {
    const text = await api(); let reads = 0; const proxy = new Proxy({}, { get() { reads++; throw Error("Synthetic coercion"); } });
    for (const value of [Buffer.from([0xff]), Buffer.alloc(65537, 32), "# comment", {}, proxy, new Uint8Array(4), null])
        assert.equal(text.supportedHistoryProfile(value as never), false);
    assert.equal(reads, 0);
});

test("F26c generated profile has explicit limitation notice and no history-read/rewrite command", async () => {
    const text = await api(), output = text.buildHistoryProfile(undefined, enabled)!.toString();
    assert(output.includes("conservative") && output.includes("existing history"));
    assert(!/ReadAllText|WriteAllText|Get-History|GetHistoryItems|Clear-History|Remove-Item|Get-Content/.test(output));
});
