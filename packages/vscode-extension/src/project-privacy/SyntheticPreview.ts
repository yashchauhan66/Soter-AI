import * as vscode from "vscode";
import { createServer, type Server } from "node:http";

/** Fixed mock HTTP service; no file, credential, environment or request-body reads. */
export class SyntheticPreview {
    private server: Server | undefined;
    private starting: Promise<string> | undefined;
    private epoch = 0;
    private address: string | undefined;
    async start(): Promise<string> {
        if (this.address) return this.address;
        if (this.starting) return this.starting;
        const epoch = this.epoch;
        const server = createServer((request, response) => {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("X-Content-Type-Options", "nosniff");
            const pathname = (request.url ?? "").split("?")[0];
            if (request.method !== "GET") { response.writeHead(405); response.end('{"syntheticOnly":true,"error":"GET only"}'); request.resume(); return; }
            if (pathname === "/health") { response.end(JSON.stringify({ syntheticOnly: true, status: "ready", realServiceAccess: false })); return; }
            if (pathname === "/api/users") { response.end(JSON.stringify({ syntheticOnly: true, users: [{ id: "fixture-user-1",
                displayName: "Synthetic Developer", email: "fixture@example.invalid" }] })); return; }
            response.writeHead(404); response.end('{"syntheticOnly":true,"error":"Unknown fixture route"}');
        });
        server.requestTimeout = 5_000; server.headersTimeout = 5_000; server.maxHeadersCount = 32;
        this.server = server;
        this.starting = new Promise<string>((resolve, reject) => {
            server.once("error", () => { this.server = undefined; reject(new Error("Synthetic preview unavailable.")); });
            server.listen(0, "127.0.0.1", () => {
                const bound = server.address();
                if (this.epoch !== epoch || !bound || typeof bound === "string") {
                    server.close(); reject(new Error("Synthetic preview cancelled.")); return;
                }
                this.address = `http://127.0.0.1:${bound.port}`; resolve(this.address);
            });
        });
        try { return await this.starting; } finally { this.starting = undefined; }
    }
    async stop(): Promise<void> {
        this.epoch++; this.address = undefined;
        const server = this.server; this.server = undefined;
        if (!server) return;
        await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    }
}

export function registerSyntheticPreviewCommands(context: vscode.ExtensionContext): void {
    const preview = new SyntheticPreview();
    const enabled = () => vscode.workspace.isTrusted
        && vscode.workspace.getConfiguration("soterai").get("projectPrivacy.enabled", true)
        && vscode.workspace.getConfiguration("soterai").get("projectPrivacy.syntheticRuntime", false);
    context.subscriptions.push(new vscode.Disposable(() => { void preview.stop(); }),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai") && !enabled()) void preview.stop(); }),
        vscode.commands.registerCommand("soterai.startSyntheticPreview", async () => {
            if (!enabled()) return { status: "UNAVAILABLE" };
            try {
                const url = await preview.start();
                if (!enabled()) { await preview.stop(); return { status: "UNAVAILABLE" }; }
                void vscode.window.showInformationMessage(`Synthetic preview: ${url}/api/users. Generated fixtures only; no real database, application or OS isolation.`);
                return { status: "STARTED", url, syntheticOnly: true };
            } catch { return { status: "FAILED" }; }
        }), vscode.commands.registerCommand("soterai.stopSyntheticPreview", async () => {
            await preview.stop(); return { status: "STOPPED" };
        }));
}
