/**
 * Entry point VS Code loads via --extensionTestsPath.
 *
 * The host requires this module and calls `run()`. Resolving means the run
 * passed; rejecting fails it and gives the launcher a non-zero exit code.
 *
 * SOTERAI_HOST_SWEEP=1 runs the all-commands sweep *instead of* the three
 * feature suites. It is a separate run rather than a fourth suite because it
 * probes every command — including lockdown — and would leave protection state
 * the feature suites assume nothing about, and because it needs a wall clock the
 * feature suites should not have to share.
 */

import { run as runControlPanel } from "./controlPanel.host";
import { run as runRealUser } from "./realUser.host";
import { run as runDiscoverability } from "./discoverability.host";
import { run as runAgentTools } from "./agentTools.host";
import { run as runCommandSweep } from "./commandSweep.host";

// @ts-ignore — process is available in the VS Code extension host (Node runtime)
const sweepOnly = Boolean(process.env.SOTERAI_HOST_SWEEP);

export async function run(): Promise<void> {
    if (sweepOnly) {
        console.log("\n=== SoterAI command sweep — every contributed command, executed once ===\n");
        await runCommandSweep();
        return;
    }
    console.log("\n=== SoterAI Control Panel — real VS Code host verification ===\n");
    await runControlPanel();
    console.log("\n=== SoterAI real-user verification — the five buttons, executed ===\n");
    await runRealUser();
    // Runs last: it opens editors, writes fixtures and selects text, and the two
    // suites above assume nothing about which editor is active.
    console.log("\n=== SoterAI discoverability — every menu, keybinding and welcome link, invoked ===\n");
    await runDiscoverability();
    // Gap 2. Also the suite that carries the floor check: on VS Code 1.85 there is
    // no `vscode.lm`, and this asserts the graceful no-op rather than mocking it.
    console.log("\n=== SoterAI agent tools — invoked through vscode.lm.invokeTool ===\n");
    await runAgentTools();
}

