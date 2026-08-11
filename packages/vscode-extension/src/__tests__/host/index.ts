/**
 * Entry point VS Code loads via --extensionTestsPath.
 *
 * The host requires this module and calls `run()`. Resolving means the run
 * passed; rejecting fails it and gives the launcher a non-zero exit code.
 */

import { run as runControlPanel } from "./controlPanel.host";

export async function run(): Promise<void> {
    console.log("\n=== SoterAI Control Panel — real VS Code host verification ===\n");
    await runControlPanel();
}
