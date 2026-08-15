import * as vscode from "vscode";
import { ExtensionState } from "../state";
import type { Finding, GuardDecision } from "@soterai/guard-core";

// ── Live inline scanning — subtle markers + soft highlights ────────────────
//
// As the developer types/opens a supported file, SoterAI scans it locally and
// surfaces secrets / PII / prompt-injection as non-intrusive inline markers and
// soft background highlights — no harsh red squiggles that disrupt editing flow.
// Every finding still offers a lightbulb Quick Fix.
//
// UX design:
// - critical/high  → amber alert marker  + very light amber line tint (no red)
// - medium         → blue info marker    + very light blue line tint
// - low            → grey dot marker     + no background tint
// All use DiagnosticSeverity.Hint so VS Code never shows red/yellow underlines.
// The Problems panel still lists every finding for users who want to browse them.
//
// Privacy/perf guarantees:
// - Detection is 100% local (engine.scan is offline); no network, ever.
// - Debounced per-document so fast typing does not thrash the CPU.
// - Skips oversized files, excluded globs, and non-file schemes.
// - Runs in untrusted workspaces too (local-only, no secrets leave the machine).

const SOURCE = "SoterAI";

/**
 * Debounce window for live scanning.
 *
 * 500 ms was the original value. AI coding agents (Cline, Claude Code, OpenCode,
 * Blackbox) stream edits into files much faster than a human types — they can
 * produce hundreds of document-change events per second. A 500 ms debounce means
 * the scan engine fires on every momentary pause in the stream, which causes
 * continuous CPU load in the shared extension host and makes those agents slow.
 *
 * 1500 ms means scans only fire when editing has genuinely stopped for 1.5 s —
 * this is still fast enough to give real-time feedback during human typing, while
 * skipping the intermediate churn that agent-driven edits produce.
 */
const DEBOUNCE_MS = 1500;

/**
 * Maximum file size to scan live.
 *
 * The original limit was 256 KB (from soterai.scan.maxFileSizeKb). AI agents
 * often generate large files. We add a hard cap of 64 KB here specifically for
 * the live (as-you-type) path — the user can still scan larger files on demand
 * via soterai.scanCurrentFile. This prevents the regex engine from running on a
 * 200 KB generated file during an active coding session.
 */
const LIVE_SCAN_MAX_BYTES = 64 * 1024; // 64 KB hard cap for as-you-type path

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

/**
 * All findings are surfaced as Hint severity.
 *
 * This prevents VS Code from drawing red (Error) or yellow (Warning) squiggly
 * underlines that make an entire file look broken. Security findings are not
 * code errors — they are advisory notices. The Problems panel still shows every
 * finding with its full message; only the in-editor underline style is toned
 * down. Custom decorations (inline marker + line background) provide the visual
 * signal without the visual noise.
 */
function severityToVscode(_severity: Finding["severity"]): vscode.DiagnosticSeverity {
    return vscode.DiagnosticSeverity.Hint;
}

/**
 * Decoration set: one TextEditorDecorationType per severity tier.
 * Created once per LiveScanner instance, disposed with it.
 *
 * critical / high  → amber alert marker  + very faint amber wash on the line
 * medium           → blue info marker    + very faint blue wash on the line
 * low              → grey dot marker     + no background
 *
 * Colours use 8 % opacity so they read on both dark and light themes without
 * overwhelming the code. The inline marker is the primary visual cue; the
 * background tint is secondary. A ThemeIcon id cannot be used as
 * `gutterIconPath`: VS Code treats it as a file URI and logs a failed resource
 * load, so these decorations intentionally use text markers instead.
 */
interface SeverityDecorations {
    critical: vscode.TextEditorDecorationType;
    medium: vscode.TextEditorDecorationType;
    low: vscode.TextEditorDecorationType;
}

function buildDecorationTypes(): SeverityDecorations {
    return {
        // Amber / warm-orange — draws attention without screaming "error"
        critical: vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"),
            overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            light: {
                backgroundColor: "rgba(255, 180, 0, 0.07)",
                after: {
                    contentText: " !",
                    color: "rgba(200, 130, 0, 0.6)",
                    margin: "0 0 0 8px",
                    fontStyle: "normal",
                },
            },
            dark: {
                backgroundColor: "rgba(255, 180, 0, 0.06)",
                after: {
                    contentText: " !",
                    color: "rgba(255, 200, 80, 0.55)",
                    margin: "0 0 0 8px",
                    fontStyle: "normal",
                },
            },
        }),
        // Soft blue — informational, calm
        medium: vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor("editorInfo.foreground"),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            light: {
                backgroundColor: "rgba(0, 120, 212, 0.05)",
                after: {
                    contentText: " i",
                    color: "rgba(0, 100, 180, 0.5)",
                    margin: "0 0 0 8px",
                    fontStyle: "normal",
                },
            },
            dark: {
                backgroundColor: "rgba(0, 150, 255, 0.05)",
                after: {
                    contentText: " i",
                    color: "rgba(80, 160, 255, 0.45)",
                    margin: "0 0 0 8px",
                    fontStyle: "normal",
                },
            },
        }),
        // Neutral grey — lowest-priority findings, barely noticeable
        low: vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor("editorHint.foreground"),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            light: {
                after: {
                    contentText: " ·",
                    color: "rgba(100, 100, 100, 0.4)",
                    margin: "0 0 0 6px",
                },
            },
            dark: {
                after: {
                    contentText: " ·",
                    color: "rgba(180, 180, 180, 0.3)",
                    margin: "0 0 0 6px",
                },
            },
        }),
    };
}

/** Map a finding's severity to the right decoration bucket. */
function decorationTier(severity: Finding["severity"]): keyof SeverityDecorations {
    switch (severity) {
        case "critical":
        case "high":
            return "critical";
        case "medium":
            return "medium";
        default:
            return "low";
    }
}

export class LiveScanner implements vscode.CodeActionProvider {
    public static readonly fixableCommand = "soterai.applyFindingFix";
    private readonly diagnostics: vscode.DiagnosticCollection;
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly disposables: vscode.Disposable[] = [];

    // Custom decoration types — subtle inline markers + soft line backgrounds.
    // Kept as instance state so they are properly disposed when the scanner is.
    private readonly decor: SeverityDecorations;

    // Per-document decoration ranges, keyed by document URI string.
    // Needed so we can clear old decorations before applying fresh ones.
    private readonly decorRanges = new Map<string, {
        critical: vscode.Range[];
        medium: vscode.Range[];
        low: vscode.Range[];
    }>();

    constructor(private readonly context: vscode.ExtensionContext) {
        this.diagnostics = vscode.languages.createDiagnosticCollection("soterai");
        this.decor = buildDecorationTypes();

        this.disposables.push(
            this.diagnostics,
            this.decor.critical,
            this.decor.medium,
            this.decor.low,
        );

        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => this.schedule(doc)),
            vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this.diagnostics.delete(doc.uri);
                this.clearDecorations(doc.uri);
            }),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration("soterai.liveScan")) this.rescanVisible();
            }),
            // Re-apply decorations whenever a different editor becomes active —
            // VS Code does NOT persist custom decorations across editor switches.
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) this.reapplyDecorations(editor);
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
        // Hard cap for the live path: skip files larger than 64 KB so the regex
        // engine never runs on AI-generated large files during active editing.
        // Users can scan larger files on demand via soterai.scanCurrentFile.
        const bytes = Buffer.byteLength(doc.getText(), "utf8");
        if (bytes > LIVE_SCAN_MAX_BYTES) return false;
        // Also respect the user-configured limit (may be lower than 64 KB).
        const maxKb = vscode.workspace.getConfiguration("soterai").get<number>("scan.maxFileSizeKb", 256);
        if (bytes > maxKb * 1024) return false;
        const excludes = vscode.workspace.getConfiguration("soterai").get<string[]>("scan.excludeGlobs", []);
        const rel = vscode.workspace.asRelativePath(doc.uri);
        return !excludes.some((glob) => matchesGlob(rel, glob));
    }

    private schedule(doc: vscode.TextDocument): void {
        if (!this.isEnabled() || !this.isScannable(doc)) {
            this.diagnostics.delete(doc.uri);
            this.clearDecorations(doc.uri);
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
        const ranges: { critical: vscode.Range[]; medium: vscode.Range[]; low: vscode.Range[] } = {
            critical: [],
            medium: [],
            low: [],
        };

        // DEDUP FIX: the engine can emit the same logical finding multiple times
        // (e.g. layered detectors). Key on range+category+title and keep one.
        const seenKeys = new Set<string>();
        for (const finding of decision.findings) {
            const range = this.rangeFor(doc, finding);
            const key = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}|${finding.category ?? ""}|${finding.title}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            // Diagnostic (Hint severity = no squiggly underline, Problems panel only)
            const diag = new vscode.Diagnostic(
                range,
                `🛡 ${finding.title}: ${finding.reason}`,
                severityToVscode(finding.severity),
            );
            diag.source = SOURCE;
            diag.code = finding.category; // used by the Quick Fix provider
            diags.push(diag);

            // Decoration range — whole-line range for the background tint
            const lineRange = doc.lineAt(range.start.line).range;
            ranges[decorationTier(finding.severity)].push(lineRange);
        }

        // Commit diagnostics (Problems panel)
        this.diagnostics.set(doc.uri, diags);

        // Commit decorations (in-editor soft highlight + inline marker)
        this.decorRanges.set(doc.uri.toString(), ranges);
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === doc.uri.toString()) {
                this.applyDecorationsToEditor(editor, ranges);
            }
        }
    }

    /**
     * Apply (or refresh) stored decoration ranges onto a given editor.
     * Called both after a fresh scan and when the active editor changes,
     * because VS Code clears custom decorations on editor switches.
     */
    private applyDecorationsToEditor(
        editor: vscode.TextEditor,
        ranges: { critical: vscode.Range[]; medium: vscode.Range[]; low: vscode.Range[] },
    ): void {
        editor.setDecorations(this.decor.critical, ranges.critical);
        editor.setDecorations(this.decor.medium, ranges.medium);
        editor.setDecorations(this.decor.low, ranges.low);
    }

    /** Re-apply cached decoration ranges when an editor regains focus. */
    private reapplyDecorations(editor: vscode.TextEditor): void {
        const cached = this.decorRanges.get(editor.document.uri.toString());
        if (cached) this.applyDecorationsToEditor(editor, cached);
    }

    /** Clear all decoration tiers for a document (on close or when disabled). */
    private clearDecorations(uri: vscode.Uri): void {
        this.decorRanges.delete(uri.toString());
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === uri.toString()) {
                editor.setDecorations(this.decor.critical, []);
                editor.setDecorations(this.decor.medium, []);
                editor.setDecorations(this.decor.low, []);
            }
        }
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

    private async applyFix(args?: FindingFixArgs): Promise<void> {
        // The command is registered with the CodeAction-provider path always
        // passing arguments, but a direct palette invocation (or any caller
        // without a specific finding) lands here with none. Fail with a
        // user-actionable message instead of a raw undefined access.
        if (!args || typeof args.uri !== "string" || !args.kind) {
            vscode.window.showWarningMessage("SoterAI: No fix target. Use the lightbulb on a SoterAI finding to apply a fix.");
            return;
        }
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
        this.decorRanges.clear();
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
