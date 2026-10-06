/**
 * PHASE 2 — VS Code API stub.
 *
 * SCOPE OF TRUST. This file supplies PLUMBING ONLY: URIs, a real filesystem
 * bridge, workspace folders, editor/tab state and a sink recorder. It contains
 * no protection logic. Every decision a test asserts on is made by the real
 * module under test (`ContextGatherer`, `WorkspaceGuard`, `SafeContextBuilder`),
 * so a finding here is a finding in the product, not in the stub.
 *
 * WHERE THE STUB IS THE ORACLE. `workspace.findFiles` is a glob walk I wrote.
 * Any assertion that depends on WHICH files it returns is marked
 * "stub-dependent" in the results table and needs host verification before it
 * can be called proven. Everything else reads or writes real bytes on disk.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as nodePath from "node:path";

// ── sink recorder ────────────────────────────────────────────────────────────

export interface SinkRecord {
    sink: string;
    detail: string;
    text: string;
}

/** Every byte the extension pushed toward an observable sink this scenario. */
export const sinks: SinkRecord[] = [];

export function recordSink(sink: string, detail: string, text: string): void {
    sinks.push({ sink, detail, text });
}

export function resetSinks(): void {
    sinks.length = 0;
}

/** All sink text concatenated — what the leak oracle is run over. */
export function capturedText(): string {
    return sinks.map((s) => `--- ${s.sink} ${s.detail} ---\n${s.text}`).join("\n");
}

// ── Uri ──────────────────────────────────────────────────────────────────────

export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query = "";
    readonly fragment = "";

    private constructor(scheme: string, authority: string, path: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
    }

    static file(p: string): Uri {
        const normalized = p.replace(/\\/g, "/");
        return new Uri("file", "", normalized.startsWith("/") ? normalized : `/${normalized}`);
    }

    static parse(value: string): Uri {
        const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):(?:(?:\/\/)([^/]*))?(\/.*)?$/.exec(value);
        if (!m) throw new Error("Invalid test URI");
        return new Uri(m[1], m[2] ?? "", m[3] ?? "/");
    }

    static joinPath(base: Uri, ...parts: string[]): Uri {
        const joined = nodePath.posix.join(base.path, ...parts.map((p) => p.replace(/\\/g, "/")));
        return new Uri(base.scheme, base.authority, joined);
    }

    get fsPath(): string {
        // Mirrors VS Code: a leading slash before a drive letter is dropped.
        const p = /^\/[a-zA-Z]:/.test(this.path) ? this.path.slice(1) : this.path;
        return nodePath.normalize(p);
    }

    with(change: { scheme?: string; path?: string }): Uri {
        return new Uri(change.scheme ?? this.scheme, this.authority, change.path ?? this.path);
    }

    toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }
}

// ── workspace state, settable by a test ──────────────────────────────────────

export interface WorkspaceFolderStub { uri: Uri; name: string; index: number }

export const state: {
    folders: WorkspaceFolderStub[];
    isTrusted: boolean;
    config: Map<string, unknown>;
    configInspect: Map<string, Record<string, unknown>>;
    activeEditor: unknown;
    tabs: Array<{ input: { uri?: Uri } }>;
    clipboard: string;
    telemetryEnabled: boolean;
} = {
    folders: [],
    isTrusted: true,
    config: new Map(),
    configInspect: new Map(),
    activeEditor: undefined,
    tabs: [],
    clipboard: "",
    telemetryEnabled: true,
};

export function setWorkspace(root: string): void {
    state.folders = [{ uri: Uri.file(root), name: nodePath.basename(root), index: 0 }];
}

export function resetState(root?: string): void {
    state.isTrusted = true;
    state.config = new Map();
    state.configInspect = new Map();
    state.activeEditor = undefined;
    state.tabs = [];
    state.clipboard = "";
    state.telemetryEnabled = true;
    state.folders = [];
    if (root) setWorkspace(root);
    resetSinks();
}

// ── enums / small value types ────────────────────────────────────────────────

export const StatusBarAlignment = { Left: 1, Right: 2 } as const;
export const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2 } as const;
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const;
export const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 } as const;
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 } as const;
export const ProgressLocation = { Notification: 15, Window: 10 } as const;
export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const;
export const ExtensionMode = { Production: 1, Development: 2, Test: 3 } as const;
export const QuickPickItemKind = { Separator: -1, Default: 0 } as const;

export class Disposable {
    constructor(private readonly fn: () => void = () => undefined) {}
    dispose(): void { this.fn(); }
    static from(...items: Array<{ dispose(): void }>): Disposable {
        return new Disposable(() => items.forEach((i) => i.dispose()));
    }
}

export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];
    readonly event = (listener: (e: T) => void): Disposable => {
        this.listeners.push(listener);
        return new Disposable(() => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        });
    };
    fire(data: T): void { for (const l of [...this.listeners]) l(data); }
    dispose(): void { this.listeners = []; }
}

export class MarkdownString {
    isTrusted = false;
    supportThemeIcons = false;
    constructor(public value = "") {}
    appendMarkdown(v: string): this { this.value += v; return this; }
    appendText(v: string): this { this.value += v; return this; }
}

export class ThemeColor { constructor(public readonly id: string) {} }
export class ThemeIcon { constructor(public readonly id: string) {} }
export class Position { constructor(public readonly line: number, public readonly character: number) {} }
export class Range {
    constructor(public readonly start: Position, public readonly end: Position) {}
    get isEmpty(): boolean { return this.start.line === this.end.line && this.start.character === this.end.character; }
}
export class Selection extends Range {
    constructor(anchor: Position, active: Position) { super(anchor, active); }
}
export class RelativePattern {
    constructor(public readonly base: unknown, public readonly pattern: string) {}
}
export class CancellationTokenSource {
    token = { isCancellationRequested: false, onCancellationRequested: new EventEmitter<void>().event };
    cancel(): void { this.token.isCancellationRequested = true; }
    dispose(): void { /* noop */ }
}

// ── glob matching, used only by findFiles ────────────────────────────────────

/**
 * Glob → RegExp for the stub's own findFiles. NOT the product's matcher.
 * Case-insensitive, matching a Windows/macOS filesystem.
 */
function stubGlobToRegExp(glob: string): RegExp {
    let out = "";
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === "*") {
            if (glob[i + 1] === "*") {
                i++;
                if (glob[i + 1] === "/") { i++; out += "(?:.*/)?"; } else { out += ".*"; }
            } else {
                out += "[^/]*";
            }
        } else if (ch === "?") out += "[^/]";
        else if (ch === "{") {
            const close = glob.indexOf("}", i);
            if (close === -1) out += "\\{";
            else {
                out += `(?:${glob.slice(i + 1, close).split(",").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
                i = close;
            }
        } else if (".+^$()|[]\\".includes(ch)) out += `\\${ch}`;
        else out += ch;
    }
    return new RegExp(`^${out}$`, "i");
}

function walk(dir: string, root: string, acc: string[]): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
        const abs = nodePath.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === ".git") continue;
            walk(abs, root, acc);
        } else {
            acc.push(nodePath.relative(root, abs).replace(/\\/g, "/"));
        }
    }
}

// ── workspace ────────────────────────────────────────────────────────────────

export const workspace = {
    get workspaceFolders(): WorkspaceFolderStub[] | undefined {
        return state.folders.length ? state.folders : undefined;
    },
    get isTrusted(): boolean { return state.isTrusted; },
    get name(): string | undefined { return state.folders[0]?.name; },

    getWorkspaceFolder(uri: Uri): WorkspaceFolderStub | undefined {
        const target = nodePath.resolve(uri.fsPath);
        return state.folders.find((f) => {
            const root = nodePath.resolve(f.uri.fsPath);
            const rel = nodePath.relative(root, target);
            return rel === "" || (!rel.startsWith("..") && !nodePath.isAbsolute(rel));
        });
    },

    asRelativePath(input: Uri | string, includeWorkspaceFolder = false): string {
        const p = typeof input === "string" ? input : input.fsPath;
        const abs = nodePath.resolve(p);
        for (const f of state.folders) {
            const root = nodePath.resolve(f.uri.fsPath);
            const rel = nodePath.relative(root, abs);
            if (rel && !rel.startsWith("..") && !nodePath.isAbsolute(rel)) {
                const posix = rel.replace(/\\/g, "/");
                return includeWorkspaceFolder ? `${f.name}/${posix}` : posix;
            }
        }
        return p.replace(/\\/g, "/");
    },

    fs: {
        async readFile(uri: Uri): Promise<Uint8Array> {
            return new Uint8Array(await fsp.readFile(uri.fsPath));
        },
        async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
            recordSink("fs.writeFile", workspace.asRelativePath(uri), Buffer.from(content).toString("utf8"));
            await fsp.mkdir(nodePath.dirname(uri.fsPath), { recursive: true });
            await fsp.writeFile(uri.fsPath, content);
        },
        async stat(uri: Uri): Promise<{ type: number; size: number; ctime: number; mtime: number }> {
            const st = await fsp.stat(uri.fsPath);
            return {
                type: st.isDirectory() ? FileType.Directory : FileType.File,
                size: st.size,
                ctime: st.ctimeMs,
                mtime: st.mtimeMs,
            };
        },
        async createDirectory(uri: Uri): Promise<void> {
            await fsp.mkdir(uri.fsPath, { recursive: true });
        },
        async delete(uri: Uri, options?: { recursive?: boolean }): Promise<void> {
            await fsp.rm(uri.fsPath, { recursive: options?.recursive ?? false, force: true });
        },
        async rename(from: Uri, to: Uri): Promise<void> {
            await fsp.rename(from.fsPath, to.fsPath);
        },
        async readDirectory(uri: Uri): Promise<Array<[string, number]>> {
            const entries = await fsp.readdir(uri.fsPath, { withFileTypes: true });
            return entries.map((e) => [e.name, e.isDirectory() ? FileType.Directory : FileType.File]);
        },
    },

    getConfiguration(section?: string) {
        const key = (k: string) => (section ? `${section}.${k}` : k);
        return {
            get<T>(k: string, fallback?: T): T | undefined {
                return (state.config.has(key(k)) ? state.config.get(key(k)) : fallback) as T | undefined;
            },
            async update(k: string, value: unknown): Promise<void> {
                state.config.set(key(k), value);
            },
            inspect(k: string): Record<string, unknown> | undefined {
                return state.configInspect.get(key(k));
            },
            has(k: string): boolean { return state.config.has(key(k)); },
        };
    },

    /** STUB ORACLE — see the header note. */
    async findFiles(include: string | RelativePattern, exclude?: string | RelativePattern | null, max?: number): Promise<Uri[]> {
        const root = state.folders[0];
        if (!root) return [];
        const pattern = typeof include === "string" ? include : include.pattern;
        const re = stubGlobToRegExp(pattern);
        const exRe = exclude ? stubGlobToRegExp(typeof exclude === "string" ? exclude : exclude.pattern) : undefined;
        const all: string[] = [];
        walk(root.uri.fsPath, root.uri.fsPath, all);
        const hits = all.filter((rel) => re.test(rel) && !(exRe && exRe.test(rel)));
        return hits.slice(0, max ?? hits.length).map((rel) => Uri.joinPath(root.uri, rel));
    },

    async openTextDocument(arg: Uri | { content?: string; language?: string }): Promise<unknown> {
        if (arg instanceof Uri) {
            const text = await fsp.readFile(arg.fsPath, "utf8");
            return makeDocument(arg, text);
        }
        recordSink("untitled-document", arg.language ?? "plaintext", arg.content ?? "");
        return makeDocument(Uri.file("/untitled"), arg.content ?? "");
    },

    onDidOpenTextDocument: new EventEmitter<unknown>().event,
    onDidSaveTextDocument: new EventEmitter<unknown>().event,
    onDidChangeTextDocument: new EventEmitter<unknown>().event,
    onDidChangeConfiguration: new EventEmitter<unknown>().event,
    onDidChangeWorkspaceFolders: new EventEmitter<unknown>().event,
    onDidGrantWorkspaceTrust: new EventEmitter<unknown>().event,
    createFileSystemWatcher(): { onDidCreate: unknown; onDidChange: unknown; onDidDelete: unknown; dispose(): void } {
        const e = new EventEmitter<unknown>();
        return { onDidCreate: e.event, onDidChange: e.event, onDidDelete: e.event, dispose: () => e.dispose() };
    },
};

export function makeDocument(uri: Uri, text: string) {
    const lines = text.split("\n");
    return {
        uri,
        fileName: uri.fsPath,
        languageId: "plaintext",
        lineCount: lines.length,
        isUntitled: false,
        isDirty: false,
        getText(range?: Range): string {
            if (!range) return text;
            const start = lines.slice(0, range.start.line).join("\n").length + (range.start.line ? 1 : 0) + range.start.character;
            const end = lines.slice(0, range.end.line).join("\n").length + (range.end.line ? 1 : 0) + range.end.character;
            return text.slice(start, end);
        },
        lineAt(line: number) {
            return { text: lines[line] ?? "", lineNumber: line, range: new Range(new Position(line, 0), new Position(line, (lines[line] ?? "").length)) };
        },
        positionAt(offset: number) {
            const prefix = text.slice(0, Math.max(0, Math.min(offset, text.length))).split("\n");
            return new Position(prefix.length - 1, prefix[prefix.length - 1].length);
        },
        offsetAt(position: Position) {
            const line = Math.max(0, Math.min(position.line, lines.length - 1));
            return lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0)
                + Math.max(0, Math.min(position.character, lines[line].replace(/\r$/, "").length));
        },
        save: async () => true,
    };
}

/** Build an editor whose document is a real file on disk. */
export async function openEditor(absPath: string, selection?: { from: number; to: number }): Promise<void> {
    const uri = Uri.file(absPath);
    const text = await fsp.readFile(absPath, "utf8");
    const doc = makeDocument(uri, text);
    const lines = text.split("\n");
    const sel = selection
        ? new Selection(new Position(selection.from, 0), new Position(selection.to, (lines[selection.to] ?? "").length))
        : new Selection(new Position(0, 0), new Position(0, 0));
    state.activeEditor = { document: doc, selection: sel, selections: [sel], edit: async () => true };
}

export function openTab(absPath: string): void {
    state.tabs.push({ input: { uri: Uri.file(absPath) } });
}

// ── window ───────────────────────────────────────────────────────────────────

export const window = {
    get activeTextEditor() { return state.activeEditor as never; },
    get visibleTextEditors() { return state.activeEditor ? [state.activeEditor] : []; },
    get tabGroups() { return { all: [{ tabs: state.tabs }], onDidChangeTabs: new EventEmitter<unknown>().event }; },

    createStatusBarItem() {
        return { text: "", tooltip: "", command: "", backgroundColor: undefined, show(): void {}, hide(): void {}, dispose(): void {} };
    },
    createOutputChannel(name: string) {
        return {
            name,
            appendLine(line: string): void { recordSink("outputChannel", name, line); },
            append(line: string): void { recordSink("outputChannel", name, line); },
            show(): void {}, clear(): void {}, dispose(): void {},
        };
    },
    createTreeView() { return { dispose(): void {}, onDidChangeVisibility: new EventEmitter<unknown>().event }; },
    createWebviewPanel(_id: string, title: string) {
        const emitter = new EventEmitter<unknown>();
        return {
            title,
            webview: {
                set html(v: string) { recordSink("webview.html", title, v); },
                get html() { return ""; },
                onDidReceiveMessage: emitter.event,
                postMessage: async (m: unknown) => { recordSink("webview.postMessage", title, JSON.stringify(m)); return true; },
                asWebviewUri: (u: Uri) => u,
                cspSource: "vscode-resource:",
                options: {},
            },
            onDidDispose: new EventEmitter<unknown>().event,
            onDidChangeViewState: new EventEmitter<unknown>().event,
            reveal(): void {}, dispose(): void {},
        };
    },
    registerWebviewViewProvider() { return new Disposable(); },
    async showTextDocument(doc: unknown) { return { document: doc }; },
    async showInformationMessage(msg: string, ...rest: unknown[]) { recordSink("notification", "info", msg); return pickFirstAction(rest); },
    async showWarningMessage(msg: string, ...rest: unknown[]) { recordSink("notification", "warn", msg); return pickFirstAction(rest); },
    async showErrorMessage(msg: string, ...rest: unknown[]) { recordSink("notification", "error", msg); return pickFirstAction(rest); },
    async showQuickPick() { return undefined; },
    async showInputBox() { return undefined; },
    async withProgress<T>(_o: unknown, task: (p: unknown, t: unknown) => Promise<T>): Promise<T> {
        return task({ report(): void {} }, { isCancellationRequested: false });
    },
    onDidChangeActiveTextEditor: new EventEmitter<unknown>().event,
    onDidOpenTerminal: new EventEmitter<unknown>().event,
    onDidCloseTerminal: new EventEmitter<unknown>().event,
    terminals: [] as unknown[],
    createTerminal() { return { sendText(): void {}, show(): void {}, dispose(): void {} }; },
};

/** Notifications never auto-confirm: a test must not silently accept a prompt. */
function pickFirstAction(rest: unknown[]): undefined {
    void rest;
    return undefined;
}

// ── commands / env / misc ────────────────────────────────────────────────────

export const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();

export const commands = {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
        registeredCommands.set(id, handler);
        return new Disposable(() => registeredCommands.delete(id));
    },
    registerTextEditorCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
        return commands.registerCommand(id, handler);
    },
    async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
        recordSink("executeCommand", id, JSON.stringify(args ?? []));
        const handler = registeredCommands.get(id);
        return handler ? handler(...args) : undefined;
    },
    async getCommands(): Promise<string[]> { return [...registeredCommands.keys()]; },
};

export const env = {
    appName: "Visual Studio Code",
    appHost: "desktop",
    machineId: "phase2-stub-machine",
    sessionId: "phase2-stub-session",
    language: "en",
    uriScheme: "vscode",
    get isTelemetryEnabled() { return state.telemetryEnabled; },
    onDidChangeTelemetryEnabled: new EventEmitter<boolean>().event,
    clipboard: {
        async readText(): Promise<string> { return state.clipboard; },
        async writeText(value: string): Promise<void> {
            recordSink("clipboard", "writeText", value);
            state.clipboard = value;
        },
    },
    async openExternal(uri: Uri): Promise<boolean> { recordSink("openExternal", uri.toString(), ""); return true; },
};

export const extensions = {
    all: [] as unknown[],
    getExtension() { return undefined; },
    onDidChange: new EventEmitter<void>().event,
};

export const languages = {
    createDiagnosticCollection(name: string) {
        return { name, set(): void {}, delete(): void {}, clear(): void {}, dispose(): void {} };
    },
    registerCodeActionsProvider() { return new Disposable(); },
    registerHoverProvider() { return new Disposable(); },
};

export const lm = {
    registerTool() { return new Disposable(); },
    async invokeTool() { return { content: [] }; },
    tools: [] as unknown[],
};

export const version = "1.85.0";

export class Diagnostic {
    constructor(public range: Range, public message: string, public severity?: number) {}
}
export class CodeAction { constructor(public title: string, public kind?: unknown) {} }
export const CodeActionKind = { QuickFix: { value: "quickfix" } };
export class TreeItem { constructor(public label: string, public collapsibleState?: number) {} }
export class WorkspaceEdit {
    replace(): void {}
    insert(): void {}
    delete(): void {}
}
export const tasks = { onDidStartTaskProcess: new EventEmitter<unknown>().event, executeTask: async () => undefined };
export const authentication = { getSession: async () => undefined };
export const l10n = { t: (s: string) => s };

/** A minimal ExtensionContext backed by in-memory maps a test can inspect. */
export function makeExtensionContext(storageRoot: string) {
    const globalStore = new Map<string, unknown>();
    const workspaceStore = new Map<string, unknown>();
    const secretStore = new Map<string, string>();
    return {
        subscriptions: [] as Array<{ dispose(): void }>,
        extensionUri: Uri.file(storageRoot),
        extensionPath: storageRoot,
        globalStorageUri: Uri.file(nodePath.join(storageRoot, "globalStorage")),
        storageUri: Uri.file(nodePath.join(storageRoot, "workspaceStorage")),
        logUri: Uri.file(nodePath.join(storageRoot, "logs")),
        extensionMode: ExtensionMode.Test,
        asAbsolutePath: (rel: string) => nodePath.join(storageRoot, rel),
        globalState: {
            get: <T>(k: string, fallback?: T) => (globalStore.has(k) ? (globalStore.get(k) as T) : fallback),
            update: async (k: string, v: unknown) => {
                recordSink("globalState", k, typeof v === "string" ? v : JSON.stringify(v));
                globalStore.set(k, v);
            },
            keys: () => [...globalStore.keys()],
            setKeysForSync: () => undefined,
        },
        workspaceState: {
            get: <T>(k: string, fallback?: T) => (workspaceStore.has(k) ? (workspaceStore.get(k) as T) : fallback),
            update: async (k: string, v: unknown) => {
                recordSink("workspaceState", k, typeof v === "string" ? v : JSON.stringify(v));
                workspaceStore.set(k, v);
            },
            keys: () => [...workspaceStore.keys()],
        },
        secrets: {
            get: async (k: string) => secretStore.get(k),
            store: async (k: string, v: string) => {
                // Recorded under a sink name the leak scan EXCLUDES: SecretStorage
                // is the approved destination (I7). Recording it anyway means a
                // test can assert a secret went here and nowhere else.
                recordSink("secretStorage", k, v);
                secretStore.set(k, v);
            },
            delete: async (k: string) => void secretStore.delete(k),
            onDidChange: new EventEmitter<unknown>().event,
        },
        _inspect: { globalStore, workspaceStore, secretStore },
    };
}
