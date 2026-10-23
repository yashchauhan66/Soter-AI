import * as vscode from "vscode";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
type Definition = { command: string; args: string[]; env: Record<string, string> };
type Provider = { provideMcpServerDefinitions(): Promise<Definition[]> };
let provider: Provider | undefined;
export function installSafeReadMcpProbe(patch: (object: object, name: string, value: unknown) => void): void {
    const lm = vscode.lm, original = lm.registerMcpServerDefinitionProvider;
    patch(lm, "registerMcpServerDefinitionProvider", function(id: string, candidate: Provider) {
        if (id === "soterai.guard-tools") provider = candidate;
        return Reflect.apply(original, lm, [id, candidate]);
    });
}
const PRIVATE = "TEST_ONLY_F17_NATIVE_PRIVATE_20261018";
const PUBLIC = "Public F17 native route control.\n";
const tick = () => new Promise<void>(done => setImmediate(done));
async function until(check: () => boolean, ms = 5000): Promise<void> { const deadline = Date.now() + ms; while (!check() && Date.now() < deadline) await new Promise(done => setTimeout(done, 10)); assert.ok(check(), "F17 native condition timed out"); }
class Client {
    readonly child: ChildProcess; closed = false; outEof = false; errEof = false;
    private buffer = ""; private stderr = ""; private sequence = 0;
    private readonly pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    readonly results: Array<{ id: number; status: string; bytes: number; digest: string }> = [];
    constructor(definition: Definition, noSession = false) {
        const env: NodeJS.ProcessEnv = {};
        for (const key of ["SystemRoot", "WINDIR", "COMSPEC", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
        Object.assign(env, noSession ? { ELECTRON_RUN_AS_NODE: "1" } : definition.env);
        this.child = spawn(definition.command, definition.args, { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
        this.child.once("close", () => { this.closed = true; for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(Error("F17 child closed")); } this.pending.clear(); });
        this.child.stdout!.setEncoding("utf8"); this.child.stderr!.setEncoding("utf8");
        this.child.stdout!.once("end", () => { this.outEof = true; }); this.child.stderr!.once("end", () => { this.errEof = true; });
        this.child.stderr!.on("data", chunk => { this.stderr += String(chunk).slice(0, 4096); });
        this.child.stdout!.on("data", chunk => {
            this.buffer += chunk; let index;
            while ((index = this.buffer.indexOf("\n")) >= 0) {
                const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
                assert.ok(!line.includes(PRIVATE), "MCP stdout released synthetic private content");
                for (const key of ["SOTERAI_SAFE_READ_TOKEN", "SOTERAI_SAFE_READ_SESSION"]) if (env[key]) assert.ok(!line.includes(env[key]!), "MCP stdout released private transport material");
                const reply = JSON.parse(line), item = this.pending.get(reply.id);
                if (item) { clearTimeout(item.timer); this.pending.delete(reply.id); item.resolve(reply); }
            }
        });
    }
    send(value: unknown): void { this.child.stdin!.write(JSON.stringify(value) + "\n"); }
    request(method: string, params?: unknown) {
        const id = ++this.sequence;
        const promise = new Promise<any>((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(Error("F17 MCP request timed out")); }, 12000); this.pending.set(id, { resolve, reject, timer }); });
        this.send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }); return { id, promise };
    }
    async initialize(): Promise<void> { assert.ok((await this.request("initialize").promise).result); }
    read(path: string, fields: Record<string, unknown> = {}) { const call = this.request("tools/call", { name: "soterai_read_project_file_safely", arguments: { path, ...fields } });
        return { id: call.id, promise: call.promise.then(reply => { const result = reply.result?.content?.[0]?.text ? JSON.parse(reply.result.content[0].text) : { status: "PROTOCOL_ERROR" };
            this.results.push({ id: call.id, status: result.status, bytes: Buffer.byteLength(JSON.stringify(result)), digest: createHash("sha256").update(JSON.stringify(result)).digest("hex") }); return result; }) };
    }
    cancel(id: number): void { this.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id } }); }
    async close(): Promise<void> { this.child.stdin!.end(); await until(() => this.closed && this.outEof && this.errEof); assert.equal(this.stderr, ""); }
}
export async function runSafeReadMcpChecks(options: { context: vscode.ExtensionContext; check(index: number, action: () => Promise<void>): Promise<void> }): Promise<void> {
    const { context, check } = options, root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const config = vscode.workspace.getConfiguration("soterai"), clients: Client[] = [];
    let definition!: Definition, client!: Client, reviews = 0;
    let decide: (message: string, detail: string) => Promise<string | undefined> = async () => "Allow safe read once";
    const original = vscode.window.showWarningMessage, descriptor = Object.getOwnPropertyDescriptor(vscode.window, "showWarningMessage");
    Object.defineProperty(vscode.window, "showWarningMessage", { configurable: true, writable: true, value: async (message: string, opts?: { detail?: string }) => {
        if (message.startsWith("Allow one safe read")) { reviews++; assert.ok(opts?.detail !== undefined); assert.match(message, /Destination: SoterAI MCP session .*identity unverified/); assert.ok(!opts.detail.includes(PRIVATE)); return decide(message, opts.detail); }
        return undefined;
    } });
    const open = async (noSession = false) => { const found = new Client(definition, noSession); clients.push(found); await found.initialize(); return found; };
    const uri = (file: string) => vscode.Uri.file(join(root, file));
    const savedFlag = config.inspect<boolean>("lite.safeReadMcp")?.globalValue;
    try {
        await check(92, async () => {
            assert.ok(provider, "Actual packaged extension must register its MCP provider");
            const definitions = await provider.provideMcpServerDefinitions(); assert.equal(definitions.length, 1); definition = definitions[0];
            assert.equal(definition.command, process.execPath); assert.equal(definition.args.length, 1); assert.equal(definition.args[0], join(context.extensionUri.fsPath, "dist/soterai-mcp-server.js"));
            assert.match(definition.env.SOTERAI_SAFE_READ_ENDPOINT, /^http:\/\/127\.0\.0\.1:\d+\/safe-read$/); assert.match(definition.env.SOTERAI_SAFE_READ_TOKEN, /^[a-f0-9]{64}$/);
            client = await open(); const list = await client.request("tools/list").promise; assert.ok(list.result.tools.some((item: { name: string }) => item.name === "soterai_read_project_file_safely"));
        });
        await check(93, async () => { await writeFile(uri("f17-public.txt").fsPath, PUBLIC); let preview = ""; decide = async (_message, text) => { preview = text; return "Allow safe read once"; };
            const result = await client.read("f17-public.txt").promise; assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, PUBLIC); assert.equal(result.text, preview); assert.ok(!vscode.workspace.textDocuments.some(doc => doc.uri.toString() === uri("f17-public.txt").toString())); });
        await check(94, async () => { const file = uri("f17-ordinary.txt"); await writeFile(file.fsPath, PUBLIC); await vscode.commands.executeCommand("soterai.blockFromAI", file);
            const before = JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1")); assert.ok(before?.includes("f17-ordinary.txt")); assert.equal((await client.read("f17-ordinary.txt").promise).text, PUBLIC); assert.equal(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1")), before); });
        await check(95, async () => { await writeFile(uri(".env.f17").fsPath, `F17_TOKEN=${PRIVATE}\nPORT=1234\nEMPTY=\n`); const result = await client.read(".env.f17").promise;
            assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, "F17_TOKEN=[MASKED]\nPORT=[MASKED]\nEMPTY=[MASKED]"); });
        await check(96, async () => { const file = uri("f17-sensitive.txt"); await writeFile(file.fsPath, PRIVATE); const saved = await vscode.commands.executeCommand<{ status: string }>("soterai.restrictSensitiveFile", file); assert.equal(saved?.status, "SAVED");
            const result = await client.read("f17-sensitive.txt").promise; assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.kind, "sensitive-summary"); assert.ok(!result.text.includes(PRIVATE)); });
        await check(97, async () => { const before = reviews; for (const fields of [{ approved: true }, { raw: true }, { recipient: "owner" }]) assert.notEqual((await client.read(".env.f17", fields).promise).status, "ALLOWED_ONCE");
            for (const file of ["../.env", ".git/config", "C:/fake.env"]) assert.notEqual((await client.read(file).promise).status, "ALLOWED_ONCE"); assert.equal(reviews, before); });
        await check(98, async () => { decide = async () => undefined; assert.equal((await client.read("f17-public.txt").promise).status, "DENIED"); });
        await check(99, async () => { let resolve!: (value: string | undefined) => void; decide = () => new Promise(done => { resolve = done; }); const before = reviews;
            const pending = client.read("f17-public.txt"); await until(() => reviews > before); client.cancel(pending.id); const result = await pending.promise; resolve("Allow safe read once"); assert.notEqual(result.status, "ALLOWED_ONCE"); await tick(); });
        await check(100, async () => { let resolve!: (value: string | undefined) => void; decide = () => new Promise(done => { resolve = done; }); const before = reviews;
            const pending = client.read("f17-public.txt"); await until(() => reviews > before); await writeFile(uri("f17-public.txt").fsPath, "Changed public text\n"); resolve("Allow safe read once"); assert.equal((await pending.promise).status, "CHANGED"); await writeFile(uri("f17-public.txt").fsPath, PUBLIC); });
        await check(101, async () => { let resolve!: (value: string | undefined) => void; decide = () => new Promise(done => { resolve = done; }); const before = reviews;
            const pending = client.read("f17-public.txt"); await until(() => reviews > before); await vscode.commands.executeCommand("soterai.revokeProjectReads"); assert.notEqual((await pending.promise).status, "ALLOWED_ONCE"); resolve("Allow safe read once"); await tick(); });
        await check(102, async () => { let resolve!: (value: string | undefined) => void; decide = () => new Promise(done => { resolve = done; }); const before = reviews;
            const pending = client.read("f17-public.txt"); await until(() => reviews > before); await config.update("lite.safeReadMcp", false, vscode.ConfigurationTarget.Global);
            assert.notEqual((await pending.promise).status, "ALLOWED_ONCE"); resolve("Allow safe read once"); assert.deepEqual(await provider!.provideMcpServerDefinitions(), []); await config.update("lite.safeReadMcp", true, vscode.ConfigurationTarget.Global);
            definition = (await provider!.provideMcpServerDefinitions())[0]; decide = async () => "Allow safe read once"; assert.notEqual((await client.read("f17-public.txt").promise).status, "ALLOWED_ONCE"); client = await open(); assert.equal((await client.read("f17-public.txt").promise).text, PUBLIC); });
        await check(103, async () => { const missing = await open(true); assert.notEqual((await missing.read(".env.f17").promise).status, "ALLOWED_ONCE"); const before = reviews;
            client.child.stdin!.write("{malformed\n" + "x".repeat(1024 * 1024 + 1)); client.child.stdin!.write('{"tail":"discard"}\n'); await tick(); assert.equal((await client.read("f17-public.txt").promise).text, PUBLIC); assert.equal(reviews, before + 1);
            await writeFile(uri("f17-binary.dat").fsPath, Buffer.from([0, 1, 2])); const count = reviews; assert.notEqual((await client.read("f17-binary.dat").promise).status, "ALLOWED_ONCE"); assert.equal(reviews, count); });
    } finally {
        for (const child of clients) await child.close();
        await config.update("lite.safeReadMcp", savedFlag, vscode.ConfigurationTarget.Global);
        if (descriptor) Object.defineProperty(vscode.window, "showWarningMessage", descriptor); else Object.defineProperty(vscode.window, "showWarningMessage", { configurable: true, value: original });
        await writeFile(join(root, "f17-mcp-route-receipt.json"), JSON.stringify({ status: "COMPLETED_CHECK_ATTEMPT", independence: "LOW", route: "actual packaged standalone stdio + actual native editor bridge, scripted modal decisions", reviews,
            children: clients.map(item => ({ closed: item.closed, stdoutEof: item.outEof, stderrEof: item.errEof, results: item.results })) }, null, 2) + "\n", { flag: "wx" });
    }
}
