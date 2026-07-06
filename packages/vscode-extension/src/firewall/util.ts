import * as vscode from "vscode";
import { hashContent } from "@soterai/guard-core";

/** Escape a string for safe interpolation into webview HTML (prevents XSS). */
export function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Random nonce for nonce-based webview CSP. */
export function getNonce(): string {
    let text = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}

/** The first workspace folder, or undefined. */
export function firstWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

/** A pseudonymous, stable id for the current workspace (never a raw path). */
export async function workspacePseudoId(): Promise<string> {
    const folder = firstWorkspaceFolder();
    if (!folder) return "no-workspace";
    const hash = await hashContent(folder.uri.fsPath);
    return `ws_${hash.slice(0, 16)}`;
}

/** Render a standalone CSP-hardened webview HTML document (no scripts by default). */
export function renderWebviewHtml(title: string, bodyHtml: string, nonce: string): string {
    const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      h1, h2 { color: var(--vscode-textLink-foreground); }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; vertical-align: top; }
      th { color: var(--vscode-descriptionForeground); font-weight: 600; }
      code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
      .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 700; color: #fff; }
      .block { background: #ef4444; } .approval_required { background: #f59e0b; }
      .redact { background: #8b5cf6; } .warn { background: #f59e0b; } .allow { background: #22c55e; }
      .protected { background: #ef4444; } .sensitive { background: #f59e0b; } .normal { background: #3b82f6; }
      .note { color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 16px; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

/** Open a read-only webview panel with the given CSP-safe HTML. */
export function showInfoWebview(viewType: string, title: string, bodyHtml: string): void {
    const panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Two, { enableScripts: false });
    panel.webview.html = renderWebviewHtml(title, bodyHtml, getNonce());
}
