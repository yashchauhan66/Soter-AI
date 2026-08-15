import * as vscode from "vscode";
import { extractVaultCandidates } from "@soterai/guard-core";

/**
 * FileReadSentinel — privacy-safe sensitive-document-open audit log.
 *
 * When VS Code opens a sensitive document, this sentinel:
 *   1. Reports which installed AI extensions are active as context only. VS Code
 *      does not expose the extension that triggered the open.
 *   2. Checks whether the file still contains raw secrets (not yet vault-migrated).
 *   3. Stores redacted metadata for the local access log.
 *   4. Records the event to the SoterAI audit ledger (redacted evidence only).
 *
 * This is visibility only. It does not prove that an AI tool opened or received
 * the file. On-disk vault migration is the enforceable cross-process control.
 *
 * Known AI agent extension IDs tracked:
 */
const KNOWN_AI_AGENTS: Record<string, string> = {
    "saoudrizwan.claude-dev": "Cline",
    "rooveterinaryinc.roo-cline": "Roo-Cline",
    "kodu-ai.claude-dev-experimental": "Kodu AI",
    "continuedev.continue": "Continue",
    "sourcegraph.cody-ai": "Cody (Sourcegraph)",
    "blackboxapp.blackbox": "Blackbox AI",
    "codeium.codeium": "Codeium / Windsurf",
    "github.copilot": "GitHub Copilot",
    "github.copilot-chat": "GitHub Copilot Chat",
    "anysphere.cursor-always-local": "Cursor",
    "cursor.cursor": "Cursor",
    "supermaven-inc.supermaven": "Supermaven",
    "tabbyml.vscode-tabby": "Tabby",
    "openai.openai-chatgpt-adhoc": "OpenAI Codex",
    "anthropic.claude-code": "Claude Code",
    "google.gemini-code-assist": "Gemini Code Assist",
    "amazonwebservices.aws-toolkit-vscode": "Amazon Q / CodeWhisperer",
    "aws-scripting-guy.codewhisperer": "CodeWhisperer",
    "tabnine.tabnine-vscode": "Tabnine",
    "visualstudioexptteam.vscodeintellicode": "IntelliCode",
};

/**
 * Broad signal: any extension with these keywords in id/name is suspicious.
 * Used as a fallback when the exact ID is not in KNOWN_AI_AGENTS.
 */
const AI_KEYWORD_PATTERNS = [
    /\bcline\b/i,
    /\bcopilot\b/i,
    /\bcursor\b/i,
    /\bclaude\b/i,
    /\bcodex\b/i,
    /\bgemini\b/i,
    /\bgpt\b/i,
    /\bai\b/,
    /\bcody\b/i,
    /\btabby\b/i,
    /\btabnine\b/i,
    /\bcodeium\b/i,
    /\bwindsurf\b/i,
    /\bblackbox\b/i,
    /\bsupermaven\b/i,
    /\bopencode\b/i,
    /\bamazonq\b/i,
];

interface ReadEvent {
    timestamp: number;
    agentId: string;
    agentName: string;
    filePath: string;
    secretCount: number;
}

const READ_EVENTS_KEY = "soterai.fileReadSentinelEvents";
const MAX_EVENTS = 200;

export class FileReadSentinel implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private events: ReadEvent[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        const stored = context.globalState.get<ReadEvent[]>(READ_EVENTS_KEY);
        if (stored) this.events = stored;

        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                void this.onDocumentOpened(doc);
            }),
        );
    }

    /** Return the stored read-event log (for dashboard display). */
    getEvents(): ReadonlyArray<ReadEvent> {
        return this.events;
    }

    clearEvents(): void {
        this.events = [];
        void this.context.globalState.update(READ_EVENTS_KEY, this.events);
    }

    private async onDocumentOpened(doc: vscode.TextDocument): Promise<void> {
        if (doc.uri.scheme !== "file") return;
        if (!isSensitiveFilename(doc.uri)) return;

        // Only alert if the file STILL has raw secrets (not yet migrated).
        let secretCount = 0;
        try {
            const candidates = extractVaultCandidates(doc.getText());
            secretCount = candidates.length;
        } catch {
            return;
        }
        if (secretCount === 0) return;

        const { id: agentId, name: agentName } = detectCallingAgent();
        const rel = vscode.workspace.asRelativePath(doc.uri);

        // Record the event (redacted — no raw secret values stored).
        const event: ReadEvent = {
            timestamp: Date.now(),
            agentId,
            agentName,
            filePath: rel,
            secretCount,
        };
        this.events.push(event);
        if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
        await this.context.globalState.update(READ_EVENTS_KEY, this.events);

    }

    dispose(): void {
        for (const d of this.disposables) d.dispose();
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSensitiveFilename(uri: vscode.Uri): boolean {
    const name = uri.path.split("/").pop() ?? "";
    return (
        /^\.env($|\.)/i.test(name) ||
        /\.(pem|key|p12|pfx)$/i.test(name) ||
        /^id_(rsa|ed25519)/i.test(name) ||
        /^\.npmrc$/i.test(name) ||
        /^\.pypirc$/i.test(name) ||
        /credentials$/i.test(name) ||
        /secrets\.(json|ya?ml)$/i.test(name) ||
        /^\.docker\/config\.json$/i.test(name) ||
        /^\.kube\/config$/i.test(name)
    );
}

/**
 * Best-effort attempt to identify which extension triggered the document open.
 *
 * VS Code does not expose a "who-called-this" API for document events, but the
 * known AI agents can only be listed as active context. This is never presented
 * as caller attribution because an active extension may not have touched the file.
 */
function detectCallingAgent(): { id: string; name: string } {
    const activeAI = vscode.extensions.all.filter((ext) => {
        if (!ext.isActive) return false;
        const id = ext.id.toLowerCase();
        const name = ((ext.packageJSON as { displayName?: string })?.displayName ?? "").toLowerCase();
        if (KNOWN_AI_AGENTS[ext.id]) return true;
        return AI_KEYWORD_PATTERNS.some((p) => p.test(id) || p.test(name));
    });

    if (activeAI.length === 1) {
        const ext = activeAI[0];
        return {
            id: ext.id,
            name: `${KNOWN_AI_AGENTS[ext.id] ??
                (ext.packageJSON as { displayName?: string })?.displayName ??
                ext.id} (active; not attributed as caller)`,
        };
    }

    // Multiple AI agents installed — can't pinpoint the caller.
    if (activeAI.length > 1) {
        const names = activeAI
            .map((e) => KNOWN_AI_AGENTS[e.id] ?? e.id)
            .join(", ");
        return { id: "multi-agent", name: `${names} (active; caller unknown)` };
    }

    return { id: "unknown", name: "Unknown" };
}
