import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Paired provider-usefulness/strict-admission regressions. All bytes are
// synthetic and in memory; no process, file, profile, key store or network.
const PROVIDER = "postgresql://TEST_ONLY_F25_PROVIDER:synthetic-password@f25-provider.invalid/database";
const MASK = "[REDACTED_SECRET_OUTPUT]", WARNING = "Public F25 provider warning\n";
const EXIT = 37;
type Collector = { push(channel: "stdout" | "stderr", bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }>;
    finish(code: number): OutputResult; canRelease(output: OutputResult): boolean; dispose(): void };
type Constructor = new (values: readonly string[], enabled: () => boolean) => Collector;
async function collect(t: TestContext, stdout: string, stderr = WARNING, values: readonly string[] = []) {
    const module = await import("../logs/ManagedLogCollector"), Factory = module.ManagedLogCollector as unknown as Constructor;
    const collector = new Factory(values, () => true); t.after(() => collector.dispose());
    for (const [channel, text] of [["stdout", stdout], ["stderr", stderr]] as const) {
        const bytes = Buffer.from(text, "utf8");
        for (let index = 0; index < bytes.length; index += 3) {
            const progress = collector.push(channel, bytes.subarray(index, index + 3));
            assert.equal(progress.status === "BUFFERED" && Object.keys(progress).join(",") === "status", true,
                "Private provider collection must buffer without publishing prefixes or previews.");
        }
    }
    return { collector, output: collector.finish(EXIT) };
}
function noProvider(output: OutputResult): void {
    assert.equal(JSON.stringify(output).includes(PROVIDER), false, "A completion must never contain the synthetic provider credential.");
}
function masked(value: Awaited<ReturnType<typeof collect>>): void {
    const { collector, output } = value;
    assert.equal(Object.isFrozen(output) && output.status === "COMPLETE" && output.stdout === MASK && output.stderr === MASK
        && output.redacted && output.exitCode === EXIT, true,
        "Supported provider output must complete with both channels masked and the actual nonzero exit.");
    assert.equal(collector.canRelease(output), true, "The exact sanitized provider completion must remain releasable."); noProvider(output);
}
function withheld(value: Awaited<ReturnType<typeof collect>>): void {
    const { collector, output } = value;
    assert.equal(Object.isFrozen(output) && output.status === "WITHHELD" && output.stdout === "" && output.stderr === "" && !output.redacted, true,
        "Unsupported structured content must withhold the complete operation even when provider redaction would otherwise match.");
    assert.equal(collector.canRelease(output), false, "Malformed structured content must never receive final release authority."); noProvider(output);
}

test("F25-P01 plain provider URLs retain COMPLETE masking with and without an explicit registration", async t => {
    for (const values of [[], [PROVIDER]] as const) masked(await collect(t, "Public failure: " + PROVIDER + "\n", WARNING, values));
});

test("F25-P02 a malformed late JSON property containing a provider withholds original structured content", async t => {
    withheld(await collect(t, '{"actual":' + JSON.stringify(PROVIDER) + ',"late":', WARNING, [PROVIDER]));
});

test("F25-P03 duplicate decoded JSON names containing a provider remain atomic WITHHELD inputs", async t => {
    for (const source of ['{"actual":' + JSON.stringify(PROVIDER) + ',"actual":"public"}',
        '{"nested":{"actual":' + JSON.stringify(PROVIDER) + ',"act\\u0075al":"public"}}'])
        withheld(await collect(t, source, WARNING, [PROVIDER]));
});

test("F25-P04 valid nested provider JSON retains COMPLETE sanitized output", async t => {
    masked(await collect(t, JSON.stringify({ failure: { actual: PROVIDER }, message: "public assertion failed" }), WARNING, [PROVIDER]));
});

test("F25-P05 ANSI and CRLF normalized valid provider JSON preserves strict admission and COMPLETE masks", async t => {
    const source = "\u001b[32m" + JSON.stringify({ actual: PROVIDER, message: "public normalized failure" }) + "\u001b[0m\r\n";
    masked(await collect(t, source, "\u001b[33m" + WARNING.trimEnd() + "\u001b[0m\r\n", [PROVIDER]));
});

test("F25-P06 valid public JSON stays useful after the same ANSI UTF8 and CRLF normalization", async t => {
    const body = JSON.stringify({ message: "Public caf\u00e9 \u96ea assertion", code: 7, extra: ["public stack.cjs:4:2", false, null] });
    const value = await collect(t, "\u001b[32m" + body + "\u001b[0m\r\n", WARNING);
    assert.equal(value.output.status === "COMPLETE" && value.output.stdout === body + "\n" && value.output.stderr === WARNING
        && !value.output.redacted && value.output.exitCode === EXIT, true,
        "Strict structured admission must preserve useful public reports and their actual exit.");
    assert.equal(value.collector.canRelease(value.output), true); noProvider(value.output);
});

test("F25-P07 ANSI normalized malformed provider JSON still withholds before any fallback release", async t => {
    const source = "\u001b[32m" + '{"actual":' + JSON.stringify(PROVIDER) + ',"late":' + "\u001b[0m\r\n";
    withheld(await collect(t, source, WARNING, [PROVIDER]));
});
