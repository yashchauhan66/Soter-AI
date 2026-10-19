import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { clineHook } from "../../../../packages/vscode-extension/src/adapters/ClineAdapterPolicy";
import { sealBridgeConnection } from "../../../../packages/vscode-extension/src/agent/SealedBridgeTicket";
import { SafeReadBridge } from "../../../../packages/vscode-extension/src/agent/SafeReadBridge";

async function main() {
    const root = await mkdtemp("D:/SoterAI-Lite-test-profiles/f18-hook-live-"), project = join(root, "project"), profile = join(root, "profile");
    await mkdir(join(project, ".clinerules/hooks"), { recursive: true }); await mkdir(join(profile, "Temp"), { recursive: true });
    for (const [key, value] of Object.entries({ USERPROFILE: profile, HOME: profile, APPDATA: join(profile, "AppData/Roaming"), LOCALAPPDATA: join(profile, "AppData/Local"), TEMP: join(profile, "Temp"), TMP: join(profile, "Temp") })) process.env[key] = value;
    const bridge = new SafeReadBridge({ workspace: project, enabled: () => true, ready: async () => true, read: async () => ({ status: "DENIED" }), classify: async file => file === "public.txt" ? "PUBLIC" : "RESTRICTED" });
    const connection = await bridge.start(), ticket = await sealBridgeConnection(connection); if (!ticket) throw Error("Synthetic ticket unavailable");
    const ticketPath = join(profile, "adapter-sessions/cline-session.ticket"); await mkdir(join(profile, "adapter-sessions")); await writeFile(ticketPath, ticket);
    const inspection = JSON.parse(await readFile(join(__dirname, "vsix-inspection-03.json"), "utf8")).replace(/^\uFEFF/, ""));
    const codePath = "C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/Code.exe", mcpPath = join(inspection.extractedExtensionRoot, "dist/soterai-mcp-server.js");
    const script = clineHook({ url: "http://127.0.0.1:12345/v1/ai/openai-compatible", credential: "TEST_ONLY_F18_SESSION", codePath, mcpPath, ticketPath, workspace: project, session: connection.session });
    const scriptPath = join(project, ".clinerules/hooks/TaskStart.ps1"); await writeFile(scriptPath, script, { flag: "wx" });
    const rows: unknown[] = [];
    async function call(id: string, frame: unknown, expected: boolean) {
        const result = await new Promise<Record<string, unknown>>(resolve => {
            const environment: NodeJS.ProcessEnv = {}; for (const key of ["SystemRoot", "WINDIR", "COMSPEC", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"]) if (process.env[key]) environment[key] = process.env[key];
            const child = spawn(join(process.env.SystemRoot!, "System32/WindowsPowerShell/v1.0/powershell.exe"), ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath], { cwd: project, env: environment, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
            let bytes = 0, errors = 0, outEOF = false, errEOF = false; const chunks: Buffer[] = [];
            const timer = setTimeout(() => resolve({ status: "INCOMPLETE_TIMEOUT_NO_SIGNAL" }), 15000); timer.unref();
            child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes <= 8192) chunks.push(Buffer.from(chunk)); }); child.stderr.on("data", (chunk: Buffer) => { errors += chunk.length; });
            child.stdout.once("end", () => { outEOF = true; }); child.stderr.once("end", () => { errEOF = true; });
            child.once("close", code => { clearTimeout(timer); try { const reply = JSON.parse(Buffer.concat(chunks).toString("utf8")).replace(/^\uFEFF/, "")); resolve({ status: reply.cancel === expected && code === 0 && outEOF && errEOF ? "PASS" : "FAIL", cancel: reply.cancel, code, bytes, errors, outEOF, errEOF }); } catch { resolve({ status: "FAIL_REPLY", code, bytes, errors, outEOF, errEOF }); } });
            child.stdin.end(JSON.stringify(frame));
        }); rows.push({ id, ...result });
    }
    try {
        await call("ready", { taskStart: { userInput: "Synthetic readiness" } }, false);
        await call("public", { preToolUse: { toolName: "read_files", parameters: { path: "public.txt" } } }, false);
        await call("restricted", { preToolUse: { toolName: "read_files", parameters: { path: ".env" } } }, true);
        bridge.rotate(); await call("revoked", { taskStart: { userInput: "Synthetic revoked session" } }, true);
    } finally { await bridge.dispose(); }
    const report = { status: rows.every(row => (row as { status: string }).status === "PASS") ? "PASS_SCOPED_GENERATED_HOOK" : "FAIL", root, rows, scriptSha256: createHash("sha256").update(script).digest("hex"), vsixSha256: inspection.sha256, scope: "Actual Windows PS5.1 and installed Code GUI executable/private ticket/live metadata bridge; synthetic only; not vendor routing", independence: "LOW" };
    const output = process.argv[2]; if (!output) throw Error("Unique output required"); await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify(report, null, 2)); if (report.status === "FAIL") process.exitCode = 1;
}
void main();

