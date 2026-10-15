import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";
import { OutputFilter } from "../secret-broker/OutputFilter";

const MASK = "[REDACTED_SECRET_OUTPUT]";
test("F08-X01 a registered redaction marker cannot be released as its own replacement", () => {
    for (const value of [MASK, "SECRET_OUTPUT"]) {
        const stream = new StreamingOutputRedactor([value]);
        stream.push("stdout", Buffer.from(value));
        const result = stream.finish(0);
        assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
        assert.ok(!JSON.stringify(result).includes(value));
    }
});
test("F08-X02 the string filter withholds marker collisions found only by semantic JSON leaf grouping", () => {
    const result = new OutputFilter().filter(JSON.stringify([MASK.slice(0, 12), MASK.slice(12)]), [MASK]);
    assert.equal(result.allowed, false); assert.ok(!result.text.includes(MASK));
});
test("F08-X03 a registered marker does not prevent unrelated public completed output", () => {
    const stream = new StreamingOutputRedactor([MASK]); stream.push("stdout", Buffer.from("Useful public output."));
    assert.deepEqual(stream.finish(0), { status: "COMPLETE", stdout: "Useful public output.", stderr: "", redacted: false, exitCode: 0 });
});

// Additional review regressions, frozen before the corresponding source fixes.
type StreamResult = ReturnType<StreamingOutputRedactor["finish"]>;
function expectWithheld(result: StreamResult): void {
    assert.ok(Object.isFrozen(result)); assert.equal(result.status, "WITHHELD");
    assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); assert.equal(result.redacted, false);
    assert.equal(typeof result.reason, "string");
}

test("F08-X04 short registered words inside the replacement marker cannot be released as a purported mask", () => {
    for (const value of ["SECRET", "OUTPUT"]) {
        const stream = new StreamingOutputRedactor([value]); stream.push("stdout", Buffer.from(value));
        const result = stream.finish(0); expectWithheld(result);
        assert.ok(!JSON.stringify(result).includes(value));
    }
});

test("F08-X05 semantic JSON leaf grouping cannot release a marker containing a short registered value", () => {
    for (const [value, parts] of [["SECRET", ["SEC", "RET"]], ["OUTPUT", ["OUT", "PUT"]]] as const) {
        const result = new OutputFilter().filter(JSON.stringify(parts), [value]);
        assert.equal(result.allowed, false); assert.ok(!result.text.includes(value));
    }
});

for (const code of [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]) {
    test(`F08-X06 bidi control U+${code.toString(16).toUpperCase().padStart(4, "0")} withholds at every byte split`, () => {
        const bytes = Buffer.from("Useful prefix" + String.fromCodePoint(code) + "suffix");
        for (let split = 0; split <= bytes.length; split++) {
            const stream = new StreamingOutputRedactor([]);
            stream.push("stdout", bytes.subarray(0, split)); stream.push("stdout", bytes.subarray(split));
            expectWithheld(stream.finish(0));
        }
    });
}

for (const [label, invalid, end] of [["non-ST ESC", "\u001bx", "\u0007"], ["nested CSI", "\u001b[31m", "\u0007"],
    ["nested OSC", "\u001b]nested", "\u0007"], ["repeated ESC", "\u001b\u001b\\", ""],
    ["ESC followed by BEL", "\u001b\u0007", ""], ["ESC followed by C1 ST", "\u001b\u009c", ""]] as const) {
    test(`F08-X07 ${label} inside OSC is malformed rather than a removable complete control`, () => {
        for (const intro of ["\u001b]", "\u009d"]) {
            const stream = new StreamingOutputRedactor([]);
            stream.push("stdout", Buffer.from("Useful prefix"));
            for (const char of intro + "0;title" + invalid + "tail" + end) stream.push("stdout", Buffer.from(char));
            expectWithheld(stream.finish(0));
        }
    });
}

for (const [label, codes] of [
    ["C0", Array.from({ length: 32 }, (_, code) => code).filter(code => code !== 0x07 && code !== 0x1b)],
    ["DEL", [0x7f]],
    ["C1", Array.from({ length: 32 }, (_, index) => 0x80 + index).filter(code => code !== 0x9c)],
] as const) {
    test(`F08-X08 unsupported ${label} bytes inside OSC withhold the operation`, () => {
        for (const code of codes) for (const intro of ["\u001b]", "\u009d"]) {
            const stream = new StreamingOutputRedactor([]);
            stream.push("stderr", Buffer.from("Useful warning"));
            stream.push("stdout", Buffer.from("before" + intro + "0;title" + String.fromCodePoint(code) + "tail\u0007after"));
            expectWithheld(stream.finish(0));
        }
    });
}

test("F08-X09 ordinary Unicode OSC payloads and each legal terminator remain supported across chunks", () => {
    for (const intro of ["\u001b]", "\u009d"]) for (const end of ["\u0007", "\u001b\\", "\u009c"]) {
        const stream = new StreamingOutputRedactor(["F08 hidden OSC value"]);
        const bytes = Buffer.from("before" + intro + "0;Useful É🔐 F08 hidden OSC value" + end + "after");
        for (const byte of bytes) assert.equal(stream.push("stdout", Uint8Array.of(byte)).status, "BUFFERED");
        assert.deepEqual(stream.finish(0), { status: "COMPLETE", stdout: "beforeafter", stderr: "", redacted: false, exitCode: 0 });
    }
});

for (const method of ["cancel", "dispose"] as const) {
    test(`F08-X10 a final availability callback that calls ${method} cannot release cached output`, () => {
        let calls = 0; let stream: StreamingOutputRedactor;
        stream = new StreamingOutputRedactor([], { enabled: () => {
            if (++calls === 3) stream[method]();
            return true;
        } });
        assert.equal(stream.push("stdout", Buffer.from("Useful but still undecided output")).status, "BUFFERED");
        expectWithheld(stream.finish(0)); assert.equal(calls, 3);
        assert.equal(stream.push("stderr", Buffer.from("late output")).status, "WITHHELD");
        expectWithheld(stream.finish(0)); assert.equal(calls, 3);
    });
}
