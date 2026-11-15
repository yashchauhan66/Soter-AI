import * as vscode from "vscode";
import { inspectRecoveryEnvelope, RECOVERY_ENVELOPE_LIMITS } from "../../../core/src/RecoveryEnvelope";
import { VaultManager, vaultModeEnabled } from "./VaultManager";
import { PortableRecoveryFile } from "./PortableRecoveryFile";

const validatePassword = (value: string): string | undefined => Array.from(value).length < RECOVERY_ENVELOPE_LIMITS.minPassphraseCharacters
    || Buffer.byteLength(value, "utf8") > RECOVERY_ENVELOPE_LIMITS.maxPassphraseBytes ? "Use a generated recovery password of at least 16 characters (maximum 1024 UTF-8 bytes)." : undefined;
async function password(confirm: boolean): Promise<string | undefined> {
    const first = await vscode.window.showInputBox({ title: confirm ? "Create a vault recovery password" : "Unlock vault recovery",
        prompt: "Use your separately saved recovery password. Losing it makes the recovery file unusable.", password: true, ignoreFocusOut: true, validateInput: validatePassword });
    if (first === undefined || validatePassword(first)) return undefined;
    if (confirm) {
        const second = await vscode.window.showInputBox({ title: "Confirm vault recovery password", prompt: "Enter the same recovery password again.", password: true, ignoreFocusOut: true });
        if (second !== first) return undefined;
    }
    return first;
}

/** User-invoked native UI only. Caller arguments cannot provide a password,
 * path, consent token or material. Command results never contain payloads. */
export function registerPortableVaultRecoveryCommands(context: vscode.ExtensionContext, refreshViews: () => void): void {
    const vault = new VaultManager(context), storage = context.globalStorageUri.with({ scheme: "file" }).fsPath;
    let busy = false;
    const reg = (name: string, action: () => Promise<"EXPORTED" | "IMPORTED" | "CANCELLED">) => {
        context.subscriptions.push(vscode.commands.registerCommand(name, async (...args: unknown[]) => {
            if (args.length || busy || !vaultModeEnabled() || vscode.env.remoteName) return { status: "WITHHELD" };
            busy = true;
            try { const status = await action(); if (status !== "CANCELLED") refreshViews(); return { status }; }
            catch {
                await vscode.window.showWarningMessage("Vault recovery was withheld. Existing data was not replaced. If an import was interrupted, select the same recovery file and password to resume it.");
                return { status: "WITHHELD" };
            } finally { busy = false; }
        }));
    };
    reg("soterai.exportVaultRecovery", async () => {
        const uri = await vscode.window.showSaveDialog({ title: "Export encrypted vault recovery outside the workspace", saveLabel: "Choose recovery file",
            filters: { "SoterAI encrypted recovery": ["soterai-recovery"] } });
        if (!uri) return "CANCELLED";
        const file = await PortableRecoveryFile.capture(uri, storage), passphrase = await password(true);
        if (passphrase === undefined) return "CANCELLED";
        if (await vscode.window.showWarningMessage("Export an encrypted recovery copy of this vault?", { modal: true,
            detail: "The file includes the vault key and encrypted recovery history, protected by your recovery password. Use a password-manager-generated password with at least 128 bits of randomness and save it separately. Anyone with both can access the vault. A lost password cannot be reset. Existing files are never overwritten." }, "Export encrypted recovery") !== "Export encrypted recovery") return "CANCELLED";
        await file.fresh(); const envelope = await vault.exportPortableRecovery(passphrase);
        try { await file.create(envelope); } finally { envelope.fill(0); }
        await vscode.window.showInformationMessage("Encrypted vault recovery exported. Keep the file and recovery password in separate safe locations.");
        return "EXPORTED";
    });
    reg("soterai.importVaultRecovery", async () => {
        const selected = await vscode.window.showOpenDialog({ title: "Choose encrypted vault recovery", canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
            filters: { "SoterAI encrypted recovery": ["soterai-recovery"] } });
        if (!selected || selected.length !== 1) return "CANCELLED";
        const file = await PortableRecoveryFile.capture(selected[0], storage), before = await file.read();
        try {
            const inspected = inspectRecoveryEnvelope(before.bytes), passphrase = await password(false);
            if (passphrase === undefined) return "CANCELLED";
            if (await vscode.window.showWarningMessage("Import this vault recovery into an empty vault?", { modal: true,
                detail: `Only an empty vault or an interrupted import of these exact bytes is eligible. Project files are not restored by this operation. Existing or conflicting vault records and keys are never replaced. Recovery file SHA-256: ${inspected.envelopeSha256}` }, "Import encrypted recovery") !== "Import encrypted recovery") return "CANCELLED";
            const after = await file.read();
            try {
                if (after.identity !== before.identity || after.sha256 !== inspected.envelopeSha256) throw new Error("Changed recovery file");
                await vault.importPortableRecovery(after.bytes, passphrase, inspected.envelopeSha256);
            } finally { after.bytes.fill(0); }
            await vscode.window.showInformationMessage("Vault recovery imported. Project files remain unchanged; review the vault before using it.");
            return "IMPORTED";
        } finally { before.bytes.fill(0); }
    });
}
