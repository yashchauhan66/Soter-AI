import { request } from "node:http";
import { randomUUID } from "node:crypto";
import * as path from "node:path";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { safeReadPath, validConnection, type SafeReadConnection } from "../agent/SafeReadProtocol";
import type { NativeClassification } from "../agent/SafeReadBridge";

export type NativeIntent = "read" | "write";
export interface HookResult { cancel: boolean; errorMessage?: string }
const withheld = (): HookResult => ({ cancel: true, errorMessage: "Native operation withheld. Use the approved SoterAI safe reader for protected saved files or a SoterAI checked terminal. Direct context and vendor hook failures remain outside this route." });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function parameter(value: unknown): unknown {
    if (typeof value !== "string") return value;
    if (Buffer.byteLength(value) > 4096) throw Error("Unsupported hook input");
    if (!/^[\[{"]/.test(value.trim())) return value;
    return decodeBoundedJson(Buffer.from('{"value":' + value + '}'), { maxBytes: 8192, maxDepth: 8, maxNodes: 128, maxStringBytes: 4096 }).body.value;
}
function nativeFile(value: unknown, workspace?: string): string | undefined {
    const parsed = parameter(value); if (typeof parsed !== "string") return;
    let file = safeReadPath({ path: parsed });
    if (!file) {
        const local = parsed.replaceAll("\\", "/");
        if (!workspace || !path.win32.isAbsolute(workspace) || !/^[A-Za-z]:\//.test(local) || /[\x00-\x1f\x7f]/.test(local)
            || local.slice(3).split("/").some(part => !part || part === "." || part === "..")) return;
        file = safeReadPath({ path: path.win32.relative(workspace, parsed).replaceAll("\\", "/") });
    }
    // These files implement the reviewed adapter itself. Native tools cannot
    // change their own permission gate even when a hook contains public text.
    return file && !file.toLowerCase().startsWith(".clinerules/hooks/") ? file : undefined;
}
const lineInteger = (value: unknown): boolean => (typeof value === "number" && Number.isSafeInteger(value) || typeof value === "string") && /^[1-9][0-9]{0,5}$/.test(String(value));
/** Vendor permission adapter only. A classification never releases file text. */
export async function evaluateClineHook(frame: unknown, classify: (file: string, intent: NativeIntent) => Promise<NativeClassification>, ready?: () => Promise<boolean>, workspace = process.env.SOTERAI_CLINE_WORKSPACE): Promise<HookResult> {
    try {
        if (record(frame) && Object.hasOwn(frame, "taskStart") && Object.hasOwn(frame, "preToolUse")) return withheld();
        if (record(frame) && record(frame.taskStart) && !Object.hasOwn(frame, "preToolUse") && !Object.hasOwn(frame, "approved") && !Object.hasOwn(frame, "raw")) return await ready?.() === true ? { cancel: false } : withheld();
        if (!record(frame) || Object.hasOwn(frame, "approved") || Object.hasOwn(frame, "raw") || !record(frame.preToolUse)) return withheld();
        const tool = frame.preToolUse; if (Object.keys(tool).some(key => !["toolName", "parameters"].includes(key)) || !record(tool.parameters)) return withheld();
        const args = tool.parameters;
        if (tool.toolName === "soterai_safe_read__soterai_read_project_file_safely") {
            const parsed = Object.fromEntries(Object.entries(args).map(([key, value]) => [key, parameter(value)]));
            return safeReadPath(parsed) ? { cancel: false } : withheld();
        }
        if (tool.toolName === "editor") {
            if (Object.keys(args).some(key => !["path", "old_text", "new_text", "insert_line"].includes(key))) return withheld();
            const file = nativeFile(args.path, workspace), insertion = parameter(args.insert_line), hasInsertion = Object.hasOwn(args, "insert_line") && insertion !== null && insertion !== "null";
            const text = (value: unknown) => typeof value === "string" && Buffer.byteLength(value, "utf8") <= 2048 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
            if (!file || !text(args.new_text) || Object.hasOwn(args, "old_text") && !text(args.old_text)
                || hasInsertion && (!lineInteger(insertion) || Object.hasOwn(args, "old_text"))) return withheld();
            return await classify(file, "write") === "PUBLIC" ? { cancel: false } : withheld();
        }
        if (tool.toolName !== "read_files") return withheld();
        if (Object.hasOwn(args, "files")) {
            if (Object.keys(args).length !== 1) return withheld();
            const requests = parameter(args.files); if (!Array.isArray(requests) || !requests.length || requests.length > 8) return withheld();
            const paths: string[] = [];
            for (const request of requests) {
                if (!record(request) || Object.keys(request).some(key => !["path", "start_line", "end_line"].includes(key))) return withheld();
                const file = nativeFile(request.path, workspace); if (!file) return withheld();
                for (const key of ["start_line", "end_line"]) if (Object.hasOwn(request, key) && request[key] !== null && !lineInteger(request[key])) return withheld();
                if (request.start_line != null && request.end_line != null && Number(request.start_line) > Number(request.end_line)) return withheld();
                paths.push(file);
            }
            for (const file of paths) if (await classify(file, "read") !== "PUBLIC") return withheld();
            return { cancel: false };
        }
        if (Object.keys(args).some(key => !["path", "paths", "start_line", "end_line", "offset", "limit"].includes(key))) return withheld();
        for (const key of ["start_line", "end_line", "offset", "limit"]) if (Object.hasOwn(args, key) && (!(typeof args[key] === "string" || typeof args[key] === "number" && Number.isSafeInteger(args[key])) || !/^[0-9]{1,6}$/.test(String(args[key])))) return withheld();
        if (Object.hasOwn(args, "path") === Object.hasOwn(args, "paths")) return withheld();
        const targets = Object.hasOwn(args, "path") ? [parameter(args.path)] : parameter(args.paths);
        if (!Array.isArray(targets) || !targets.length || targets.length > 8) return withheld();
        const paths: string[] = [];
        for (const value of targets) { const file = nativeFile(value, workspace); if (!file) return withheld(); paths.push(file); }
        for (const file of paths) if (await classify(file, "read") !== "PUBLIC") return withheld();
        return { cancel: false };
    } catch { return withheld(); }
}
export async function requestNativeClassification(connection: unknown, file: string, intent: NativeIntent | "ready", signal?: AbortSignal, workspace = process.env.SOTERAI_CLINE_WORKSPACE): Promise<NativeClassification> {
    if (!validConnection(connection) || !safeReadPath({ path: file }) || !["read", "write", "ready"].includes(intent) || signal?.aborted
        || typeof workspace !== "string" || workspace.length > 1024 || !path.win32.isAbsolute(workspace) || /[\x00-\x1f\x7f]/.test(workspace)) return "UNAVAILABLE";
    return new Promise(resolve => {
        let settled = false, size = 0; const chunks: Buffer[] = [];
        const finish = (value: NativeClassification) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel); resolve(value); };
        const cancel = () => { finish("UNAVAILABLE"); req.destroy(); };
        const req = request(connection.endpoint, { method: "POST", agent: false, headers: { authorization: "Bearer " + connection.token, "content-type": "application/json", connection: "close" } }, response => {
            response.on("error", () => finish("UNAVAILABLE")); response.on("aborted", () => finish("UNAVAILABLE"));
            if (response.statusCode !== 200 || response.headers["content-type"] !== "application/json") { response.resume(); finish("UNAVAILABLE"); return; }
            response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 128) cancel(); else chunks.push(Buffer.from(chunk)); });
            // The bounded parser counts keys as nodes: one object plus two
            // keys and their two values requires exactly five nodes.
            response.on("end", () => { try { const value = decodeBoundedJson(Buffer.concat(chunks), { maxBytes: 128, maxDepth: 2, maxNodes: 5, maxStringBytes: 64 }).body; finish(Object.keys(value).sort().join(",") === "session,status" && value.session === connection.session && (value.status === "PUBLIC" || value.status === "RESTRICTED") ? value.status : "UNAVAILABLE"); } catch { finish("UNAVAILABLE"); } });
        });
        const timer = setTimeout(cancel, 1500); timer.unref?.(); req.on("error", () => finish("UNAVAILABLE")); signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        req.end(JSON.stringify({ version: 1, id: randomUUID(), session: (connection as SafeReadConnection).session, path: file, operation: "classify-" + intent, workspace }));
    });
}
export async function runClineHook(connection: SafeReadConnection | undefined, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): Promise<void> {
    let size = 0, overflow = false; const chunks: Buffer[] = [];
    try {
        for await (const chunk of input) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > 8192) overflow = true; else if (!overflow) chunks.push(bytes); }
        if (overflow || !connection) { output.write(JSON.stringify(withheld()) + "\n"); return; }
        const frame = decodeBoundedJson(Buffer.concat(chunks), { maxBytes: 8192, maxDepth: 8, maxNodes: 128, maxStringBytes: 4096 }).body;
        const result = await evaluateClineHook(frame, (file, intent) => requestNativeClassification(connection, file, intent), async () => await requestNativeClassification(connection, "__soterai_session__", "ready") === "PUBLIC"); output.write(JSON.stringify(result) + "\n");
    } catch { output.write(JSON.stringify(withheld()) + "\n"); }
}
