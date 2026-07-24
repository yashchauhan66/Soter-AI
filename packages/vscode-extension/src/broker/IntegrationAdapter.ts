/**
 * Phase 7 — Integration usability adapter (pure + injectable I/O).
 *
 * Workflow:
 *   detect config path → proposed diff → backup → apply loopback broker URL
 *   (only after approval) → health check → stream smoke test → one-click restore
 *
 * Honesty: STRONG only for traffic that uses the broker after config.
 * Setup itself is usability, not universal protection. Never silent-write.
 */

export type IntegrationKind = "openai-compatible" | "anthropic-compatible" | "continue-config" | "generic-json";

export interface DetectedConfig {
    kind: IntegrationKind;
    path: string;
    exists: boolean;
    currentBaseUrl?: string;
    notes: string[];
}

export interface ProposedChange {
    path: string;
    kind: IntegrationKind;
    before: string;
    after: string;
    brokerBaseUrl: string;
    summary: string;
}

export interface ApplyResult {
    path: string;
    backupPath: string;
    applied: boolean;
    reason?: string;
}

export interface RestoreResult {
    path: string;
    restored: boolean;
    reason?: string;
}

export interface HealthCheckResult {
    ok: boolean;
    url: string;
    status?: number;
    detail: string;
}

export interface StreamSmokeResult {
    ok: boolean;
    detail: string;
}

export interface FileIO {
    readText(path: string): Promise<string | null>;
    writeText(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
}

export interface HttpIO {
    get(url: string, headers?: Record<string, string>): Promise<{ status: number; body: string }>;
    post(url: string, body: string, headers?: Record<string, string>): Promise<{ status: number; body: string }>;
}

const OPENAI_MARKERS = [/openai/i, /baseURL/i, /base_url/i, /OPENAI_BASE_URL/i, /api\.openai\.com/i];
const ANTHROPIC_MARKERS = [/anthropic/i, /ANTHROPIC_BASE_URL/i, /api\.anthropic\.com/i];
const CONTINUE_MARKERS = [/continue/i, /"models"\s*:/];

/** Detect a likely AI client config under workspace candidates. */
export async function detectIntegrationConfigs(
    candidates: string[],
    io: FileIO,
): Promise<DetectedConfig[]> {
    const found: DetectedConfig[] = [];
    for (const path of candidates) {
        const text = await io.readText(path);
        if (text === null) {
            found.push({ kind: "generic-json", path, exists: false, notes: ["file not found"] });
            continue;
        }
        const kind = classifyConfig(path, text);
        const currentBaseUrl = extractBaseUrl(text);
        const notes: string[] = [];
        if (currentBaseUrl) notes.push(`current base URL: ${currentBaseUrl}`);
        if (/127\.0\.0\.1|localhost/.test(currentBaseUrl ?? "")) notes.push("already points at loopback");
        found.push({ kind, path, exists: true, currentBaseUrl, notes });
    }
    return found.filter((c) => c.exists);
}

function classifyConfig(path: string, text: string): IntegrationKind {
    const lower = path.toLowerCase();
    if (lower.includes("continue") || CONTINUE_MARKERS.some((m) => m.test(text))) return "continue-config";
    if (ANTHROPIC_MARKERS.some((m) => m.test(text)) && !OPENAI_MARKERS.some((m) => m.test(text))) {
        return "anthropic-compatible";
    }
    if (OPENAI_MARKERS.some((m) => m.test(text))) return "openai-compatible";
    return "generic-json";
}

function extractBaseUrl(text: string): string | undefined {
    const patterns = [
        /"baseURL"\s*:\s*"([^"]+)"/i,
        /"base_url"\s*:\s*"([^"]+)"/i,
        /"apiBase"\s*:\s*"([^"]+)"/i,
        /OPENAI_BASE_URL\s*=\s*(\S+)/i,
        /ANTHROPIC_BASE_URL\s*=\s*(\S+)/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]) return m[1];
    }
    return undefined;
}

/**
 * Build a proposed rewrite that points the client at the loopback broker.
 * Does not write anything.
 */
export function proposeBrokerRewrite(
    path: string,
    currentText: string,
    kind: IntegrationKind,
    brokerPort: number,
): ProposedChange {
    const brokerBaseUrl =
        kind === "anthropic-compatible"
            ? `http://127.0.0.1:${brokerPort}/v1/ai/anthropic-compatible`
            : `http://127.0.0.1:${brokerPort}/v1/ai/openai-compatible`;

    let after = currentText;
    let summary = `Point integration at ${brokerBaseUrl}`;

    // JSON-style base URL fields
    if (/"baseURL"\s*:/.test(currentText)) {
        after = currentText.replace(/("baseURL"\s*:\s*")[^"]*(")/i, `$1${brokerBaseUrl}$2`);
    } else if (/"base_url"\s*:/.test(currentText)) {
        after = currentText.replace(/("base_url"\s*:\s*")[^"]*(")/i, `$1${brokerBaseUrl}$2`);
    } else if (/"apiBase"\s*:/.test(currentText)) {
        after = currentText.replace(/("apiBase"\s*:\s*")[^"]*(")/i, `$1${brokerBaseUrl}$2`);
    } else if (/OPENAI_BASE_URL\s*=/.test(currentText)) {
        after = currentText.replace(/(OPENAI_BASE_URL\s*=\s*)\S+/i, `$1${brokerBaseUrl}`);
    } else if (/ANTHROPIC_BASE_URL\s*=/.test(currentText)) {
        after = currentText.replace(/(ANTHROPIC_BASE_URL\s*=\s*)\S+/i, `$1${brokerBaseUrl}`);
    } else {
        // Append a clearly marked block rather than inventing structure silently
        const block =
            kind === "anthropic-compatible"
                ? `\n# SoterAI broker (added — review before commit)\nANTHROPIC_BASE_URL=${brokerBaseUrl}\n`
                : `\n# SoterAI broker (added — review before commit)\nOPENAI_BASE_URL=${brokerBaseUrl}\n`;
        after = currentText.endsWith("\n") ? currentText + block.trimStart() : currentText + "\n" + block.trimStart();
        summary = `Append broker base URL directive for ${kind}`;
    }

    return {
        path,
        kind,
        before: currentText,
        after,
        brokerBaseUrl,
        summary,
    };
}

/**
 * Apply a proposed change with mandatory backup. Never silent:
 * requires `approved === true`.
 */
export async function applyProposedChange(
    change: ProposedChange,
    io: FileIO,
    approved: boolean,
    backupSuffix = `.soterai-backup-${Date.now()}`,
): Promise<ApplyResult> {
    if (!approved) {
        return { path: change.path, backupPath: "", applied: false, reason: "user did not approve write" };
    }
    if (change.after === change.before) {
        return { path: change.path, backupPath: "", applied: false, reason: "no diff to apply" };
    }
    const backupPath = `${change.path}${backupSuffix}`;
    const existing = await io.readText(change.path);
    if (existing === null) {
        return { path: change.path, backupPath: "", applied: false, reason: "source file missing" };
    }
    // Defensive: re-check content has not drifted from the proposed before
    if (existing !== change.before) {
        return {
            path: change.path,
            backupPath: "",
            applied: false,
            reason: "file changed since proposal; re-detect and re-approve",
        };
    }
    await io.writeText(backupPath, existing);
    await io.writeText(change.path, change.after);
    return { path: change.path, backupPath, applied: true };
}

/** One-click restore from a backup written by applyProposedChange. */
export async function restoreFromBackup(
    originalPath: string,
    backupPath: string,
    io: FileIO,
    approved: boolean,
): Promise<RestoreResult> {
    if (!approved) {
        return { path: originalPath, restored: false, reason: "user did not approve restore" };
    }
    const backup = await io.readText(backupPath);
    if (backup === null) {
        return { path: originalPath, restored: false, reason: "backup missing" };
    }
    await io.writeText(originalPath, backup);
    return { path: originalPath, restored: true };
}

/** Health check against broker unauthenticated /health. */
export async function healthCheckBroker(
    brokerPort: number,
    http: HttpIO,
): Promise<HealthCheckResult> {
    const url = `http://127.0.0.1:${brokerPort}/health`;
    try {
        const res = await http.get(url);
        const ok = res.status >= 200 && res.status < 300;
        return {
            ok,
            url,
            status: res.status,
            detail: ok ? "broker health OK" : `broker health returned HTTP ${res.status}`,
        };
    } catch (err) {
        return {
            ok: false,
            url,
            detail: err instanceof Error ? err.message : "health check failed",
        };
    }
}

/**
 * Lightweight stream smoke: POST a tiny chat completion with stream:true
 * against the OpenAI-compatible broker path. Does not claim full protection
 * — only verifies the stream path is reachable when auth is provided.
 */
export async function streamSmokeTest(
    brokerPort: number,
    authToken: string,
    http: HttpIO,
): Promise<StreamSmokeResult> {
    if (!authToken) {
        return { ok: false, detail: "missing broker auth token — cannot smoke stream" };
    }
    const url = `http://127.0.0.1:${brokerPort}/v1/ai/openai-compatible/chat/completions`;
    try {
        const res = await http.post(
            url,
            JSON.stringify({
                model: "smoke",
                stream: true,
                messages: [{ role: "user", content: "ping" }],
            }),
            {
                authorization: `Bearer ${authToken}`,
                "content-type": "application/json",
            },
        );
        // 2xx, 4xx from policy, or 502 upstream all prove the route is wired;
        // only transport failure is a hard fail for smoke.
        if (res.status === 401 || res.status === 403) {
            return { ok: false, detail: `stream smoke auth failed HTTP ${res.status}` };
        }
        if (res.status === 404) {
            return { ok: false, detail: "stream route not found (404)" };
        }
        return {
            ok: true,
            detail: `stream route responded HTTP ${res.status} (smoke only — not a protection claim)`,
        };
    } catch (err) {
        return {
            ok: false,
            detail: err instanceof Error ? err.message : "stream smoke failed",
        };
    }
}

/** Default candidate relative paths for common AI client configs. */
export const DEFAULT_INTEGRATION_CANDIDATES = [
    ".continue/config.json",
    "continue/config.json",
    ".env",
    ".env.local",
    "config/openai.json",
    ".soterai/openai-client.json",
];
