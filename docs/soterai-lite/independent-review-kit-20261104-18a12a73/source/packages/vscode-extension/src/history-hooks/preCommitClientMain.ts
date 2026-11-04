import { runPreCommitClient } from "./PreCommitClient";
import { runPrePushClient } from "./PrePushClient";
import { PRE_PUSH_LIMITS } from "./PrePushProtocol";

// Keep ownership of stdin until natural EOF even after a cap or deadline.
// No unbounded replay, plaintext temporary input, stream destruction or signal.
function readPushTranscript(deadline: number): Promise<Buffer | undefined> {
    return new Promise(resolve => {
        const chunks: Buffer[] = []; let count = 0, live = true, settled = false;
        const clear = () => { chunks.forEach(chunk => chunk.fill(0)); chunks.length = 0; };
        const invalidate = () => { live = false; clear(); };
        const timer = setTimeout(invalidate, Math.max(1, deadline - performance.now()));
        const finish = (error = false) => {
            if (settled) return; settled = true; clearTimeout(timer);
            if (error || performance.now() >= deadline) invalidate();
            const value = live ? Buffer.concat(chunks, count) : undefined;
            clear(); resolve(value);
        };
        process.stdin.on("data", (raw: Buffer) => {
            if (!live) return;
            if (!Buffer.isBuffer(raw) || raw.length > PRE_PUSH_LIMITS.transcriptBytes - count || performance.now() >= deadline) { invalidate(); return; }
            chunks.push(Buffer.from(raw)); count += raw.length;
        });
        process.stdin.once("end", () => finish());
        process.stdin.once("error", () => finish(true));
        process.stdin.once("close", () => { if (!settled) finish(true); });
        process.stdin.resume();
    });
}

async function replayPush(pin: Buffer): Promise<void> {
    const deadline = performance.now() + PRE_PUSH_LIMITS.milliseconds;
    const input = await readPushTranscript(deadline);
    if (!input) { process.exitCode = 1; return; }
    try {
        if (await runPrePushClient(pin, input, { deadline }) !== "ALLOW" || performance.now() >= deadline) { process.exitCode = 1; return; }
        const output = Buffer.concat([input, Buffer.from(".")]);
        process.exitCode = 0;
        process.stdout.once("error", () => { process.exitCode = 1; output.fill(0); });
        process.stdout.write(output, error => { output.fill(0); if (error) process.exitCode = 1; });
    } finally { input.fill(0); }
}

// Fixed positional data only; there is no CLI option for a test seam, URL,
// signing key, root override, command, runtime or worker replacement.
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length === 4 && args[0] === "--pre-push" && args[1] === "--pin" && args[3] === "--replay") {
        if (args[2].length > 16384 || !/^[A-Za-z0-9_-]+$/.test(args[2])) { process.exitCode = 1; return; }
        const pin = Buffer.from(args[2], "base64url");
        if (pin.toString("base64url") !== args[2]) { process.exitCode = 1; return; }
        await replayPush(pin); return;
    }
    if (args.length !== 4 || args[0] !== "--pin" || args[2] !== "--index" || args[1].length > 16384 || !/^[A-Za-z0-9_-]+$/.test(args[1])) { process.exitCode = 1; return; }
    const pin = Buffer.from(args[1], "base64url");
    if (pin.toString("base64url") !== args[1]) { process.exitCode = 1; return; }
    process.exitCode = await runPreCommitClient(pin, args[3]) === "ALLOW" ? 0 : 1;
}
void main().catch(() => { process.exitCode = 1; });
