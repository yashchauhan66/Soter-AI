import * as vscode from "vscode";
import { ExtensionState } from "../state";
import type { Finding, GuardDecision } from "@soterai/guard-core";

// ── Live inline scanning (VS Code Diagnostics) + one-click Quick Fixes ─────────
//
// As the developer types/opens a supported file, SoterAI scans it locally and
// surfaces secrets / PII / prompt-injection as native squiggly diagnostics —
// zero commands required. Every diagnostic offers a lightbulb Quick Fix.
//
// Privacy/perf guarantees:
// - Detection is 100% local (engine.scan is offline); no network, ever.
// - Debounced per-document so fast typing does not thrash the CPU.
// - Skips oversized files, excluded globs, and non-file schemes.
// - Runs in untrusted workspaces too (local-only, no secrets leave the machine).

const SOURCE = "SoterAI";
const DEBOUNCE_MS = 500;

/** Language IDs we scan inline. Kept broad but excludes binary/huge doc types. */
const SUPPORTED_LANGUAGES = new Set([
    "javascript", "javascriptreact", "typescript", "typescriptreact",
    "python", "markdown", "mdx", "json", "jsonc", "yaml",
    "dotenv", "properties", "shellscript", "plaintext", "env",
]);

function isEnvFile(uri: vscode.Uri): boolean {
    const name = uri.path.split("/").pop() ?? "";
    return name === ".env" || name.startsWith(".env.");
}

function severityToVscode(severity: Finding["severity"]): vscode.DiagnosticSeverity {
    switch (severity) {
        case "critical":
        case "high":
            return vscode.DiagnosticSeverity.Error;
        case "medium":
            return vscode.DiagnosticSeverity.Warning;
        case "low":
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}

export class LiveScanner implements vscode.CodeActionProvider {
    public static readonly fixableCommand = "soterai.applyFindingFix";
    private readonly diagnostics: vscode.DiagnosticCollection;
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        this.diagnostics = vscode.languages.createDiagnosticCollection("soterai");
        this.disposables.push(this.diagnostics);

        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => this.schedule(doc)),
            vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
            vscode.workspace.onDidCloseTextDocument((doc) => this.diagnostics.delete(doc.uri)),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration("soterai.liveScan")) this.rescanVisible();
            }),
        );

        // Register the lightbulb Quick Fix provider + the fix-applying command.
        this.disposables.push(
            vscode.languages.registerCodeActionsProvider("*", this, {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            }),
            vscode.commands.registerCommand("soterai.applyFindingFix", (args: FindingFixArgs) => this.applyFix(args)),
        );

        this.rescanVisible();
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration("soterai").get<boolean>("liveScan.enabled", true);
    }

    /** Decide whether a document is eligible for inline scanning. */
    public isScannable(doc: vscode.TextDocument): boolean {
        if (doc.uri.scheme !== "file") return false;
        if (doc.isUntitled) return false;
        if (!SUPPORTED_LANGUAGES.has(doc.languageId) && !isEnvFile(doc.uri)) return false;
        const maxKb = vscode.workspace.getConfiguration("soterai").get<number>("scan.maxFileSizeKb", 256);
        // getText() length is chars; bytes are ≥ chars for UTF-8, so this is a
        // conservative upper bound that keeps big files off the hot path.
        if (Buffer.byteLength(doc.getText(), "utf8") > maxKb * 1024) return false;
        const excludes = vscode.workspace.getConfiguration("soterai").get<string[]>("scan.excludeGlobs", []);
        const rel = vscode.workspace.asRelativePath(doc.uri);
        return !excludes.some((glob) => matchesGlob(rel, glob));
    }

    private schedule(doc: vscode.TextDocument): void {
        if (!this.isEnabled() || !this.isScannable(doc)) {
            this.diagnostics.delete(doc.uri);
            return;
        }
        const key = doc.uri.toString();
        const existing = this.timers.get(key);
        if (existing) clearTimeout(existing);
        this.timers.set(key, setTimeout(() => {
            this.timers.delete(key);
            void this.scan(doc);
        }, DEBOUNCE_MS));
    }

    private async scan(doc: vscode.TextDocument): Promise<void> {
        // The document may have closed/changed during the debounce window.
        if (doc.isClosed || !this.isEnabled() || !this.isScannable(doc)) return;
        const state = ExtensionState.getInstance();
        let decision: GuardDecision;
        try {
            decision = await state.engine.scan(doc.getText(), { context: "file" });
        } catch {
            // Never let a scan failure surface as a user-facing error.
            return;
        }
        const diags: vscode.Diagnostic[] = [];
        // DEDUP FIX: the engine can emit the same logical finding multiple times
        // (e.g. layered detectors). Key on range+category+title and keep one.
        const seenKeys = new Set<string>();
        for (const finding of decision.findings) {
            const range = this.rangeFor(doc, finding);
            const key = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}|${finding.category ?? ""}|${finding.title}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            const diag = new vscode.Diagnostic(
                range,
                `${finding.title}: ${finding.reason}`,
                severityToVscode(finding.severity),
            );
            diag.source = SOURCE;
            diag.code = finding.category; // used by the Quick Fix provider
            diags.push(diag);
        }
        this.diagnostics.set(doc.uri, diags);
    }

    /** Map a finding's char offsets to an editor range; fall back to line 1. */
    private rangeFor(doc: vscode.TextDocument, finding: Finding): vscode.Range {
        if (typeof finding.start === "number" && typeof finding.end === "number" && finding.end > finding.start) {
            return new vscode.Range(doc.positionAt(finding.start), doc.positionAt(finding.end));
        }
        const firstLine = doc.lineAt(0);
        return new vscode.Range(firstLine.range.start, firstLine.range.end);
    }

    private rescanVisible(): void {
        for (const editor of vscode.window.visibleTextEditors) this.schedule(editor.document);
    }

    // ── Quick Fix provider ────────────────────────────────────────────────────
    public provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        for (const diag of context.diagnostics) {
            if (diag.source !== SOURCE) continue;
            const category = String(diag.code ?? "");
            const evidence = document.getText(diag.range);

            // 1) Redact in place (undoable WorkspaceEdit; user-initiated via lightbulb).
            const redact = new vscode.CodeAction(`SoterAI: Redact this ${category || "finding"}`, vscode.CodeActionKind.QuickFix);
            redact.diagnostics = [diag];
            redact.command = {
                command: LiveScanner.fixableCommand,
                title: "Redact finding",
                arguments: [{ kind: "redact", uri: document.uri.toString(), range: serializeRange(diag.range), category } as FindingFixArgs],
            };
            actions.push(redact);

            // 2) Copy a safe version of the line to the clipboard (non-destructive).
            const copy = new vscode.CodeAction("SoterAI: Copy safe version of this line", vscode.CodeActionKind.QuickFix);
            copy.diagnostics = [diag];
            copy.command = {
                command: LiveScanner.fixableCommand,
                title: "Copy safe line",
                arguments: [{ kind: "copySafeLine", uri: document.uri.toString(), range: serializeRange(diag.range), category } as FindingFixArgs],
            };
            actions.push(copy);

            // 3) Category-specific escalation into an existing safe flow.
            if (/secret|credential|key|token/i.test(category)) {
                const vault = new vscode.CodeAction("SoterAI: Move secrets to protected vault…", vscode.CodeActionKind.QuickFix);
                vault.diagnostics = [diag];
                vault.command = { command: "soterai.migrateSecretsToVault", title: "Move to vault" };
                actions.push(vault);
            }
            // Avoid unused-var lint on evidence; it documents intent for future fixes.
            void evidence;
        }
        return actions;
    }

    private async applyFix(args: FindingFixArgs): Promise<void> {
        const uri = vscode.Uri.parse(args.uri);
        const doc = await vscode.workspace.openTextDocument(uri);
        const range = deserializeRange(args.range);
        if (args.kind === "redact") {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, range, `«REDACTED:${args.category || "sensitive"}»`);
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage("SoterAI redacted the finding (Ctrl/Cmd+Z to undo).");
            return;
        }
        if (args.kind === "copySafeLine") {
            const line = doc.lineAt(range.start.line);
            const masked = line.text.slice(0, range.start.character - line.range.start.character)
                + `«REDACTED:${args.category || "sensitive"}»`
                + line.text.slice(range.end.character - line.range.start.character);
            await vscode.env.clipboard.writeText(masked.trim());
            vscode.window.showInformationMessage("Safe version of the line copied to clipboard.");
        }
    }

    public dispose(): void {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        for (const d of this.disposables) d.dispose();
    }
}

type FindingFixArgs = {
    kind: "redact" | "copySafeLine";
    uri: string;
    range: SerializedRange;
    category: string;
};

type SerializedRange = { sl: number; sc: number; el: number; ec: number };
function serializeRange(r: vscode.Range): SerializedRange {
    return { sl: r.start.line, sc: r.start.character, el: r.end.line, ec: r.end.character };
}
function deserializeRange(r: SerializedRange): vscode.Range {
    return new vscode.Range(r.sl, r.sc, r.el, r.ec);
}

/**
 * Minimal glob matcher for the extension's default exclude patterns.
 *
 * Built in ONE pass, not a chain of `.replace()` calls. The chained version was
 * silently broken: it expanded a leading double-star segment into `(.*` + `/)?`
 * and then a later single-star rule rewrote the star inside that very output.
 * So the pattern for "any node_modules directory" compiled to
 * `^(.[^/]*` + `/).node_modules/.[^/]*$` and matched nothing. Every default
 * exclude was dead, meaning `node_modules`, `dist` and vendored bundles were
 * live-scanned on each keystroke.
 *
 * A single scan over the pattern cannot rewrite its own output, which is the
 * property the chain lacked.
 */
function globToRegExp(glob: string): RegExp {
    const normalized = glob.replace(/\\/g, "/");
    let out = "^";
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === "*") {
            if (normalized[i + 1] === "*") {
                // `**/` spans zero or more leading segments; a bare `**`
                // spans anything including separators.
                if (normalized[i + 2] === "/") {
                    out += "(?:.*/)?";
                    i += 2;
                } else {
                    out += ".*";
                    i += 1;
                }
            } else {
                out += "[^/]*"; // single `*` never crosses a separator
            }
        } else if (ch === "?") {
            out += "[^/]";
        } else {
            out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(out + "$");
}

function matchesGlob(path: string, glob: string): boolean {
    try {
        return globToRegExp(glob).test(path.replace(/\\/g, "/"));
    } catch {
        // A user-supplied pattern must never break scanning. Treat an
        // uncompilable glob as "does not exclude" — the file still gets
        // scanned, which fails safe for a security feature.
        return false;
    }
}

export function registerLiveScanner(context: vscode.ExtensionContext): LiveScanner {
    const scanner = new LiveScanner(context);
    context.subscriptions.push(scanner);
    return scanner;
}
