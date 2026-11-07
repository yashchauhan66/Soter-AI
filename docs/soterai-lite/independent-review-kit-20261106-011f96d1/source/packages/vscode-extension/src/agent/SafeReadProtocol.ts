import { request } from "node:http";
import { randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";

export interface SafeReadConnection { endpoint: string; token: string; session: string }
export const SAFE_READ_TOOL = "soterai_read_project_file_safely";
export const SAFE_READ_DEFINITION = Object.freeze({ name: SAFE_READ_TOOL,
    description: "Read one saved local project file through SoterAI's native owner confirmation. Returns exactly the approved safe view: dotenv names with all values masked, or a redacted file/sensitive summary. Persistent restrictions remain. Direct tool reads are outside this route; requester identity is unverified. Requires this editor's live private session.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Relative path inside the editor's sole local workspace." } }, required: ["path"], additionalProperties: false } });
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const validSession = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
export function safeReadPath(args: unknown): string | undefined {
    if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length !== 1 || !Object.hasOwn(args, "path")) return;
    const value = (args as { path?: unknown }).path;
    if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > 2048 || /[\x00-\x1f\x7f\\:]/.test(value) || value.startsWith("/")) return;
    const segments = value.split("/");
    if (segments.some(part => !part || part === "." || part === ".." || /[. ]$/.test(part) || /^(?:\.git|\.soterai|\.aiignore|\.soterai-policy\.json)$/i.test(part)
        || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return;
    return value;
}
export function validConnection(value: unknown): value is SafeReadConnection {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as SafeReadConnection;
    if (Object.keys(item).sort().join(",") !== "endpoint,session,token" || typeof item.endpoint !== "string" || !/^[a-f0-9]{64}$/.test(item.token ?? "") || !validSession(item.session)) return false;
    try { const url = new URL(item.endpoint); return url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) > 0 && Number(url.port) <= 65535
        && url.pathname === "/safe-read" && !url.username && !url.password && !url.search && !url.hash && url.href === item.endpoint; } catch { return false; }
}
export function safeReadResult(value: unknown): AccessResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "UNAVAILABLE" };
    const result = value as Record<string, unknown>;
    if (result.status === "ALLOWED_ONCE" && Object.keys(result).sort().join(",") === "kind,status,text" && typeof result.text === "string" && Buffer.byteLength(result.text, "utf8") <= 16 * 1024
        && ["environment-schema", "sensitive-summary", "redacted-file"].includes(result.kind as string)) return { status: "ALLOWED_ONCE", kind: result.kind as "redacted-file", text: result.text };
    if (Object.keys(result).join(",") === "status" && ["DENIED", "UNAVAILABLE", "CHANGED", "EXPIRED", "BUSY"].includes(result.status as string)) return { status: result.status as "DENIED" };
    return { status: "UNAVAILABLE" };
}
/** Local fixed-route client. No redirect, proxy, file access or arbitrary endpoint fallback. */
export async function requestSafeRead(connection: unknown, args: unknown, signal?: AbortSignal): Promise<AccessResult> {
    const file = safeReadPath(args);
    if (!validConnection(connection) || !file || signal?.aborted) return { status: "UNAVAILABLE" };
    return new Promise(resolve => {
        let settled = false, total = 0; const chunks: Buffer[] = [];
        const finish = (result: AccessResult) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel); resolve(result); };
        const cancel = () => { finish({ status: "EXPIRED" }); req.destroy(); };
        const req = request(connection.endpoint, { method: "POST", agent: false,
            headers: { authorization: `Bearer ${connection.token}`, "content-type": "application/json", connection: "close" } }, res => {
            res.on("error", () => finish({ status: "UNAVAILABLE" }));
            if (res.statusCode !== 200 || res.headers["content-type"] !== "application/json") { res.resume(); finish({ status: "UNAVAILABLE" }); return; }
            res.on("data", (chunk: Buffer) => { total += chunk.length; if (total > 96 * 1024) { finish({ status: "UNAVAILABLE" }); req.destroy(); } else chunks.push(chunk); });
            res.on("end", () => { try { finish(safeReadResult(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))))); } catch { finish({ status: "UNAVAILABLE" }); } });
            res.on("aborted", () => finish({ status: "UNAVAILABLE" }));
        });
        const timer = setTimeout(cancel, 65_000); timer.unref?.();
        req.on("error", () => finish({ status: "UNAVAILABLE" })); signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        req.end(JSON.stringify({ version: 1, session: connection.session, id: randomUUID(), path: file }));
    });
}
export function connectionFromEnvironment(env: NodeJS.ProcessEnv): SafeReadConnection | undefined {
    const value = { endpoint: env.SOTERAI_SAFE_READ_ENDPOINT, token: env.SOTERAI_SAFE_READ_TOKEN, session: env.SOTERAI_SAFE_READ_SESSION };
    return validConnection(value) ? value : undefined;
}
