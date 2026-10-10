import * as vscode from "vscode";

export const COVERAGE_DISCLOSURE = [
    "Covers: SoterAI-managed context filtering, recognized-value redaction and requests routed through the configured broker.",
    "Does not cover: native agents or same-user filesystem/process access; other extensions, open buffers, tabs, clipboard, screenshots or arbitrary network traffic.",
    "Operational setup is not verified protection. Selected-architecture guarantees remain UNTESTED. No independent consent or durable OS boundary is provided.",
].join("\n\n");

export function operationalCoverage(state: string): string {
    return `Operational state: ${state}. Verification: UNTESTED for selected-architecture guarantees.`;
}

/** Ordinary editor review, not authenticated user presence or an agent boundary.
 * Every public setup entry point performs its own review; no command argument
 * or reusable approval value can suppress this gate. */
export async function reviewCoverageForSetup(): Promise<boolean> {
    const enabled = () => vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.coverageDisclosure", true);
    if (!enabled()) {
        void vscode.window.showWarningMessage("Managed setup is unavailable while coverage disclosure is disabled.");
        return false;
    }
    const choice = await vscode.window.showInformationMessage(COVERAGE_DISCLOSURE, { modal: true }, "Review scoped setup", "Cancel");
    return choice === "Review scoped setup" && enabled();
}
