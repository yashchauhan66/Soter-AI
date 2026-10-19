import { spawn } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import * as path from "node:path";
import { TextDecoder } from "node:util";
import { validConnection, type SafeReadConnection } from "./SafeReadProtocol";

type Transform = (mode: "seal" | "open", input: Buffer) => Promise<Buffer>;
const PREFIX = "STF18v1:", MAX_TICKET = 16384;
/** Windows built-in DPAPI only, bounded private pipes. Never signals a process. */
export const nativeTicketProtection: Transform = async (mode, input) => {
    if (process.platform !== "win32" || input.length > MAX_TICKET || !["seal", "open"].includes(mode)) throw Error("Session ticket unavailable.");
    const executable = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const operation = mode === "seal" ? "Protect" : "Unprotect";
    const script = `$ErrorActionPreference='Stop';try{Add-Type -AssemblyName System.Security;$taskInput=[Console]::In.ReadToEnd();if($taskInput.Length -gt 24000){throw 'Unavailable'};$taskBytes=[Convert]::FromBase64String($taskInput);$taskEntropy=[Text.Encoding]::UTF8.GetBytes('SoterAI.Lite.F18.ConnectionTicket.v1');$taskResult=[Security.Cryptography.ProtectedData]::${operation}($taskBytes,$taskEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($taskResult));exit 0}catch{[Console]::Out.Write('unavailable');exit 7}`;
    const environment: NodeJS.ProcessEnv = {};
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) if (process.env[key]) environment[key] = process.env[key];
    return new Promise((resolve, reject) => {
        let settled = false, total = 0, overflow = false; const output: Buffer[] = [];
        const finish = (result?: Buffer) => { if (settled) return; settled = true; clearTimeout(timer); if (result) resolve(result); else reject(Error("Session ticket unavailable.")); };
        const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, env: environment, stdio: ["pipe", "pipe", "pipe"] });
        const timer = setTimeout(() => { finish(); child.stdin.end(); }, 5000); timer.unref?.();
        child.on("error", () => finish()); child.stdin.on("error", () => finish()); child.stdout.on("error", () => finish()); child.stderr.on("error", () => finish());
        child.stdout.on("data", (chunk: Buffer) => { total += chunk.length; if (total > 32768) overflow = true; else if (!overflow) output.push(Buffer.from(chunk)); });
        // Drain error bytes without copying/logging them. Script exceptions are
        // constant failures; no error text or decoded capability leaves here.
        child.stderr.resume();
        child.once("close", code => {
            if (code !== 0 || overflow) { finish(); return; }
            try {
                const encoded = Buffer.concat(output).toString("ascii");
                if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) { finish(); return; }
                const value = Buffer.from(encoded, "base64"); if (value.length > MAX_TICKET || value.toString("base64") !== encoded) { finish(); return; } finish(value);
            } catch { finish(); }
        });
        child.stdin.end(input.toString("base64"));
    });
};
export async function sealBridgeConnection(connection: unknown, protect: Transform = nativeTicketProtection): Promise<Buffer | undefined> {
    try {
        if (!validConnection(connection)) return;
        const encoded = Buffer.from(JSON.stringify({ version: 1, connection }), "utf8");
        const sealed = await protect("seal", encoded);
        if (!Buffer.isBuffer(sealed) || !sealed.length || sealed.length > 12000) return;
        const ticket = Buffer.from(PREFIX + sealed.toString("base64"), "ascii"); return ticket.length <= MAX_TICKET ? ticket : undefined;
    } catch { return; }
}
export async function openBridgeTicket(ticket: Uint8Array, protect: Transform = nativeTicketProtection): Promise<SafeReadConnection | undefined> {
    try {
        if (!(ticket instanceof Uint8Array) || ticket.length <= PREFIX.length || ticket.length > MAX_TICKET) return;
        const text = new TextDecoder("utf-8", { fatal: true }).decode(ticket); if (!text.startsWith(PREFIX)) return;
        const encoded = text.slice(PREFIX.length); if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return;
        const cipher = Buffer.from(encoded, "base64"); if (!cipher.length || cipher.toString("base64") !== encoded) return;
        const decoded = await protect("open", cipher); if (!Buffer.isBuffer(decoded) || decoded.length > 4096) return;
        const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "connection,version") return;
        const envelope = value as { version: unknown; connection: unknown }; return envelope.version === 1 && validConnection(envelope.connection) ? Object.freeze({ ...envelope.connection }) : undefined;
    } catch { return; }
}
/** Reads only a bounded named opaque ticket, never an original project file. */
export async function loadBridgeTicket(file: unknown): Promise<SafeReadConnection | undefined> {
    try {
        if (typeof file !== "string" || file.length > 1024 || !path.isAbsolute(file) || path.basename(file) !== "cline-session.ticket" || path.basename(path.dirname(file)) !== "adapter-sessions") return;
        const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_TICKET || stat.size <= PREFIX.length) return;
        if (path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) return;
        const bytes = await readFile(file); const after = await lstat(file);
        if (after.dev !== stat.dev || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || bytes.length !== stat.size) return;
        return await openBridgeTicket(bytes);
    } catch { return; }
}
