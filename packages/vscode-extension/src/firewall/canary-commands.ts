import * as vscode from "vscode";
import { type FirewallDeps } from "./shared";
import { firstWorkspaceFolder } from "./util";
import { LedgerStore } from "./LedgerStore";
import { PolicyStore } from "./PolicyStore";
import { workspacePseudoId } from "./util";

export function registerCanaryCommands(deps: FirewallDeps): void {
    const { context, refreshViews, canary } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const generateLocalCanary = async () => {
        const c = await canary.create();
        await vscode.env.clipboard.writeText(c.token);
        vscode.window.showWarningMessage(
            `Canary generated and copied to clipboard (${c.redactedPreview}). Paste it into a decoy file/secret. The raw token is stored in SecretStorage only.`,
        );
        refreshViews();
    };

    const insertCanaryIntoTestFile = async () => {
        if (!firstWorkspaceFolder()) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        const confirm = await vscode.window.showWarningMessage(
            "Create .soterai/canary.env containing a decoy canary secret? (Local only — never commit it.)",
            { modal: true },
            "Create Canary File",
        );
        if (confirm !== "Create Canary File") return;
        const c = await canary.create();
        const dir = vscode.Uri.joinPath(firstWorkspaceFolder()!.uri, ".soterai");
        await vscode.workspace.fs.createDirectory(dir);
        const fileUri = vscode.Uri.joinPath(dir, "canary.env");
        const body = `# SoterAI decoy canary — DO NOT COMMIT. If this value appears in AI output, protected context leaked.\nCANARY_API_KEY=${c.token}\n`;
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body));
        vscode.window.showInformationMessage(`Inserted canary into ${vscode.workspace.asRelativePath(fileUri)} (${c.redactedPreview}).`);
        refreshViews();
    };

    const scanWorkspaceForCanary = async () => {
        const active = await canary.loadForScan();
        if (active.length === 0) return void vscode.window.showInformationMessage("No canaries generated yet.");
        const config = vscode.workspace.getConfiguration("soterai");
        const excludeGlobs = config.get<string[]>("scan.excludeGlobs", ["**/node_modules/**", "**/.git/**"]);
        const files = await vscode.workspace.findFiles("**/*", `{${excludeGlobs.join(",")}}`, 2000);
        const hitFiles: string[] = [];
        for (const f of files) {
            try {
                const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(f));
                if ((await canary.scan(text)).length > 0) hitFiles.push(vscode.workspace.asRelativePath(f));
            } catch {
                /* skip */
            }
        }
        vscode.window.showInformationMessage(
            hitFiles.length
                ? `Canary present in ${hitFiles.length} file(s): ${hitFiles.slice(0, 10).join(", ")}. Ensure these are gitignored.`
                : "No canary exposure found in workspace files.",
        );
    };

    const verifyNoCanaryInLogs = async () => {
        const jsonl = await LedgerStore.exportSafe();
        const active = await canary.loadForScan();
        const leaked = active.filter((c) => jsonl.includes(c.token));
        if (leaked.length) {
            vscode.window.showErrorMessage(`[SoterAI] Canary token found in ledger export — investigate immediately.`);
        } else {
            vscode.window.showInformationMessage("Verified: no raw canary token appears in the AI ledger/export.");
        }
    };

    const rotateCanary = async () => {
        const c = await canary.rotate();
        await vscode.env.clipboard.writeText(c.token);
        vscode.window.showInformationMessage(`Canary rotated. New canary copied (${c.redactedPreview}). Old canaries invalidated.`);
        refreshViews();
    };

    reg("soterai.generateCanary", generateLocalCanary);
    reg("soterai.insertCanaryIntoTestFile", insertCanaryIntoTestFile);
    reg("soterai.scanWorkspaceForCanary", scanWorkspaceForCanary);
    reg("soterai.verifyNoCanaryInLogs", verifyNoCanaryInLogs);
    reg("soterai.rotateCanary", rotateCanary);
}
