import { runPreCommitClient } from "./PreCommitClient";

// Fixed positional data only; there is no CLI option for a test seam, URL,
// signing key, root override, command, runtime or worker replacement.
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== "--pin" || args[2] !== "--index" || args[1].length > 16384 || !/^[A-Za-z0-9_-]+$/.test(args[1])) { process.exitCode = 1; return; }
    const pin = Buffer.from(args[1], "base64url");
    if (pin.toString("base64url") !== args[1]) { process.exitCode = 1; return; }
    process.exitCode = await runPreCommitClient(pin, args[3]) === "ALLOW" ? 0 : 1;
}
void main().catch(() => { process.exitCode = 1; });
