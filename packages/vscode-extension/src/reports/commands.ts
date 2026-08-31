import * as vscode from "vscode";

import { REPORT_PICKS } from "./reportCatalog";

/**
 * GAP 5 — the single "Open Report" command.
 *
 * Eighteen `show*` palette rows required the user to know which report existed
 * before they could look at anything. This is one row that lists them with a
 * one-line description each, so the choice is made from the descriptions rather
 * than from memory. Every underlying command stays registered and callable; only
 * its palette row is gone.
 */
export function registerReportCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("soterai.openReport", async () => {
            const pick = await vscode.window.showQuickPick(
                REPORT_PICKS.map((report) => ({
                    label: report.label,
                    description: report.description,
                    command: report.command,
                })),
                {
                    title: "SoterAI: Open Report",
                    placeHolder: "Choose what you want to know. Every report is built locally.",
                    matchOnDescription: true,
                },
            );
            if (!pick) return;
            await vscode.commands.executeCommand(pick.command);
        }),
    );
}
