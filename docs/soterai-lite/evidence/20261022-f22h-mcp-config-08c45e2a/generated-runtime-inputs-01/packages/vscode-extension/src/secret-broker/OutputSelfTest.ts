import { randomBytes } from "node:crypto";
import type { OutputFilter } from "./OutputFilter";
import { STREAM_OUTPUT_LIMITS, type OutputChannel, type OutputResult } from "../../../core/src/StreamingOutputRedactor";

export interface OutputSelfTestReport { status: "PASS" | "FAIL" | "WITHHELD"; cases: Array<{ id: string; pass: boolean }> }

/** Synthetic in-process checks of the supplied production singleton. No
 * network/process/source input, and no values returned in report metadata. */
export function runOutputSelfTest(filter: OutputFilter): OutputSelfTestReport {
    const value = `F08 synthetic private caf\u00e9 \u96ea \u{1f9ed} output ${randomBytes(8).toString("hex")}`;
    const bytes = Buffer.from(value, "utf8"), marker = "[REDACTED_SECRET_OUTPUT]";
    const chunk = (text: string, channel: OutputChannel = "stdout") => ({ channel, bytes: Buffer.from(text, "utf8") });
    const masked = (result: OutputResult): boolean => result.status === "COMPLETE" && result.redacted && result.stdout === marker && result.stderr === ""
        && !JSON.stringify(result).includes(value);
    const withheld = (result: OutputResult): boolean => result.status === "WITHHELD" && !result.stdout && !result.stderr && !result.redacted;
    const cases: OutputSelfTestReport["cases"] = [];
    try {
        const publicResult = filter.filterChunks([chunk("Useful public output\n"), chunk("Ordinary warning\n", "stderr")], [value]);
        if (publicResult.status === "WITHHELD") return { status: "WITHHELD", cases };
        cases.push({ id: "S01", pass: publicResult.stdout === "Useful public output\n" && publicResult.stderr === "Ordinary warning\n" && !publicResult.redacted });
        const split = Math.floor(bytes.length / 2);
        cases.push({ id: "S02", pass: masked(filter.filterChunks([{ channel: "stdout", bytes: bytes.subarray(0, split) }, { channel: "stdout", bytes: bytes.subarray(split) }], [value])) });
        const encoded = Buffer.from(bytes.toString("base64")), middle = Math.floor(encoded.length / 2);
        cases.push({ id: "S03", pass: masked(filter.filterChunks([{ channel: "stdout", bytes: encoded.subarray(0, middle) }, { channel: "stdout", bytes: encoded.subarray(middle) }], [value])) });
        cases.push({ id: "S04", pass: masked(filter.filterChunks([...bytes].map(byte => ({ channel: "stdout" as const, bytes: Uint8Array.of(byte) })), [value])) });
        const decorated = Buffer.from(Array.from(value).join("\x1b[31m") + "\x1b[0m"), at = Math.floor(decorated.length / 2);
        cases.push({ id: "S05", pass: masked(filter.filterChunks([{ channel: "stdout", bytes: decorated.subarray(0, at) }, { channel: "stdout", bytes: decorated.subarray(at) }], [value])) });
        const osc = filter.filterChunks([chunk("before\x1b]52;c;" + value), chunk("\x1b\\after")], [value]);
        cases.push({ id: "S06", pass: osc.status === "COMPLETE" && osc.stdout === "beforeafter" && !osc.redacted && !JSON.stringify(osc).includes(value) });
        const failedProcess = filter.filterChunks([chunk("Useful public output"), chunk("Expected warning", "stderr")], [value], 23);
        cases.push({ id: "S07", pass: failedProcess.status === "COMPLETE" && failedProcess.exitCode === 23 && failedProcess.stdout === "Useful public output" && failedProcess.stderr === "Expected warning" });
        cases.push({ id: "S08", pass: withheld(filter.filterChunks([chunk("Useful prefix"), { channel: "stderr", bytes: Uint8Array.of(0xf0, 0x9f) }], [value])) });
        cases.push({ id: "S09", pass: withheld(filter.filterChunks([chunk("Useful prefix"), { channel: "stdout", bytes: Buffer.alloc(STREAM_OUTPUT_LIMITS.maxInputBytes + 1, 0x20) }], [value])) });
        const left = value.slice(0, 12), right = value.slice(12), first = filter.filterChunks([chunk(left)], [value]), second = filter.filterChunks([chunk(right)], [value]);
        cases.push({ id: "S10", pass: first.status === "COMPLETE" && second.status === "COMPLETE" && !first.redacted && !second.redacted && first.stdout === left && second.stdout === right });
        return { status: cases.length === 10 && cases.every(item => item.pass) ? "PASS" : "FAIL", cases };
    } catch { return { status: "FAIL", cases }; }
}
