import assert from "node:assert/strict";
import { test } from "node:test";
import { emitOwnedDiagnostic } from "../../../core/src/OwnedSinkMetadata";

test("F27 diagnostic emission keeps useful public code and bounded numeric metadata", () => {
    const output: unknown[] = [];
    assert.equal(emitOwnedDiagnostic(true, event => output.push(event), "broker_started", { port: 12345, status: 200 }), true);
    assert.deepEqual(output, [{ code: "broker_started", port: 12345, status: 200 }]);
});
test("F27 diagnostic flag-off withholds before metadata access or callback", () => {
    let calls = 0;
    const metadata = new Proxy({}, { getOwnPropertyDescriptor() { calls++; throw new Error("Unexpected read"); } });
    assert.equal(emitOwnedDiagnostic(false, () => { calls++; }, "request_failed", metadata), false);
    assert.equal(calls, 0);
});
test("F27 diagnostic canaries, unknown fields, error messages and caller paths are omitted", () => {
    const canary = "F27_SYNTHETIC_DIAGNOSTIC_8c16e402", output: unknown[] = [];
    assert.equal(emitOwnedDiagnostic(true, event => output.push(event), canary, { message: canary, path: canary, token: canary }), true);
    assert.deepEqual(output, [{ code: "event" }]);
});
test("F27 diagnostic metadata accessors are not invoked and invalid counts are refused", () => {
    let calls = 0; const output: unknown[] = [];
    const metadata = Object.defineProperty({ status: Infinity }, "port", { get() { calls++; return 123; } });
    emitOwnedDiagnostic(true, event => output.push(event), "request_failed", metadata);
    assert.equal(calls, 0); assert.deepEqual(output, [{ code: "request_failed" }]);
});
test("F27 diagnostic callback failure is value-free and does not escape to crash reporting", () => {
    assert.equal(emitOwnedDiagnostic(true, () => { throw new Error("F27_SYNTHETIC_CALLBACK_8c16e402"); }, "request_failed"), false);
});
