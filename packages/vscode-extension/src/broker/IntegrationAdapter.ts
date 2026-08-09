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
    /**
     * Set when the file could not be rewritten without corrupting it.
     * `after === before` in that case; callers must report "not secured".
     */
    unsupportedReason?: string;
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
 * File shapes we may be asked to rewrite. The append-a-shell-directive
 * fallback is only ever legal for line-oriented formats: appending
 * `KEY=value` after the closing brace of a JSON file produces a file the
 * owning tool can no longer parse, which breaks the very tool we claim to
 * be protecting.
 */
export type ConfigFormat = "json" | "yaml" | "dotenv" | "shell" | "unknown";

/** Classify by extension/filename first, then by content shape. */
export function detectConfigFormat(filePath: string, text: string): ConfigFormat {
    const base = filePath.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
    if (base.endsWith(".json") || base.endsWith(".jsonc")) return "json";
    if (base.endsWith(".yml") || base.endsWith(".yaml")) return "yaml";
    if (base === ".env" || base.startsWith(".env.")) return "dotenv";
    if (/^\.(bashrc|zshrc|profile|bash_profile|zprofile|zshenv|kshrc)$/.test(base)) return "shell";
    if (base.endsWith(".sh")) return "shell";
    // Content fallback: a document that parses as JSON is JSON regardless of name.
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try { JSON.parse(trimmed); return "json"; } catch { return "json"; }
    }
    return "unknown";
}

/**
 * Shell profiles need `export` or the variable is set only in the profile's
 * own shell and never inherited by the AI CLI the user actually runs —
 * i.e. the "protection" would be inert while the UI claimed success.
 * `.env` files are read by dotenv loaders and must NOT carry `export`.
 */
function directiveFor(format: ConfigFormat, varName: string, url: string): string {
    const assignment = `${varName}=${url}`;
    return format === "shell" ? `export ${assignment}` : assignment;
}

/**
 * Build a proposed rewrite that points the client at the loopback broker.
 * Does not write anything.
 *
 * Returns `after === before` (a no-op) when the file cannot be rewritten
 * safely. Callers MUST treat a no-op as "not secured" and report it
 * honestly rather than claiming coverage.
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
    let unsupportedReason: string | undefined;

    // In-place edits of an existing base-URL field are safe in every format:
    // they replace a value without changing the document's structure.
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
        // No field to edit. Appending is only safe in line-oriented formats.
        const format = detectConfigFormat(path, currentText);
        if (format === "json" || format === "yaml" || format === "unknown") {
            unsupportedReason =
                `${path} is ${format === "unknown" ? "an unrecognised format" : format.toUpperCase()} with no base-URL field; ` +
                "appending a shell directive would corrupt it. Left untouched — set the base URL manually.";
            summary = `Cannot auto-route ${path} safely (${format}); left unchanged`;
        } else {
            const varName = kind === "anthropic-compatible" ? "ANTHROPIC_BASE_URL" : "OPENAI_BASE_URL";
            const block =
                `# SoterAI broker (added — review before commit)\n` +
                `${directiveFor(format, varName, brokerBaseUrl)}\n`;
            after = currentText.endsWith("\n") || currentText === ""
                ? currentText + block
                : currentText + "\n" + block;
            summary = `Append broker base URL directive for ${kind}`;
        }
    }

    return {
        path,
        kind,
        before: currentText,
        after,
        brokerBaseUrl,
        summary,
        unsupportedReason,
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
