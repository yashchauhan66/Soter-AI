import assert from "node:assert/strict";
import { test } from "node:test";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";

const PRIVATE = "TEST_ONLY_F25_AGGREGATE_PRIVATE_caf\u00e9/\u96ea_91b8";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const body = [...PRIVATE].map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const options = { completedLogFraming: "original-lines-v1" };
for (const first of ["stdout", "stderr"] as const) {
    test("F25 aggregate JSON-body framing preserves cross-channel arrival matching starting in " + first, () => {
        const other = first === "stdout" ? "stderr" : "stdout", stream = new StreamingOutputRedactor([PRIVATE], options as never);
        const a = 12 * 6, b = 29 * 6;
        for (const [channel, text] of [[first, body.slice(0, a)], [other, body.slice(a, b)], [first, body.slice(b) + "\n"]] as const)
            assert(stream.push(channel, Buffer.from(text)).status === "BUFFERED", "Private undecided fragments must stay buffered.");
        const result = stream.finish(7);
        assert(result.status === "COMPLETE" && result.redacted, "An interleaved escaped registration must be masked.");
        assert(result.stdout === MASK && result.stderr === MASK && result.exitCode === 7, "Both nonempty channels must receive the canonical safe marker.");
    });
}

test("F25 canonical aggregate framing admits32 candidate lines and withholds33 atomically", () => {
    // Isolate the line-count boundary from the independent canonical decoder
    // work/candidate limits. Keep the fully escaped32-line refusal below.
    const partialBody = JSON.stringify(PRIVATE).slice(1, -1).replace("PRIVATE", "\\u0050RIVATE");
    for (const count of [32, 33]) {
        const stream = new StreamingOutputRedactor([PRIVATE], options as never);
        assert(stream.push("stdout", Buffer.from((partialBody + "\n").repeat(count))).status === "BUFFERED");
        const result = stream.finish(0);
        if (count === 32) assert(result.status === "COMPLETE" && result.redacted && result.stdout === MASK, "The inclusive framing budget remains useful.");
        else assert(result.status === "WITHHELD" && result.stdout === "" && result.stderr === "", "Overflow must withhold earlier matching lines too.");
    }
});

test("F25 aggregate line framing preserves independent matcher refusal for a dense fully escaped input", () => {
    const stream = new StreamingOutputRedactor([PRIVATE], options as never);
    stream.push("stdout", Buffer.from((body + "\n").repeat(32))); const result = stream.finish(0);
    assert(result.status === "WITHHELD" && result.stdout === "" && result.stderr === "", "Framing must not bypass an unavailable complete canonical match.");
});

test("F25 unknown completed-log framing modes cannot silently opt into unframed release", () => {
    const stream = new StreamingOutputRedactor([PRIVATE], { completedLogFraming: "unknown-mode" } as never);
    stream.push("stdout", Buffer.from("ordinary public output\n")); const result = stream.finish(0);
    assert(result.status === "WITHHELD" && result.stdout === "" && result.stderr === "", "Invalid private mode admission must fail closed.");
});

test("F25 canonical framing keeps normalized public Windows locations useful in both modes", () => {
    const text = "Error: public failure\n    at C:\\public\\test\\build.cjs:12:7\n";
    for (const mode of [{}, options]) {
        const stream = new StreamingOutputRedactor([PRIVATE], mode as never);
        stream.push("stdout", Buffer.from(text)); stream.push("stderr", Buffer.from("ordinary public warning\n")); const result = stream.finish(3);
        assert(result.status === "COMPLETE" && !result.redacted, "Public stack output must remain useful.");
        assert(result.stdout === text && result.stderr === "ordinary public warning\n" && result.exitCode === 3, "Framing must not rewrite useful locations.");
    }
});
