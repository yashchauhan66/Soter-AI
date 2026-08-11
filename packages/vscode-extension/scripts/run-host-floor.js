#!/usr/bin/env node
// Runs the real-host suite against the OLDEST VS Code the manifest claims to
// support, by reading `engines.vscode` instead of hardcoding a version.
//
// Why derive it: `engines.vscode` is a promise to every version from the floor
// upward. A hardcoded floor here would silently stop matching the manifest the
// moment someone edits `engines`, and the promise would go back to being
// untested without anything failing.
const { spawnSync } = require("child_process");
const path = require("path");

const { engines } = require("../package.json");
const range = engines && engines.vscode;

const floor = /^[\^~>=]*\s*(\d+\.\d+\.\d+)$/.exec(String(range || ""));
if (!floor) {
    console.error(
        `Cannot derive a testable floor from engines.vscode = ${JSON.stringify(range)}.\n` +
            "Expected a simple range like ^1.85.0. Update this script if the range grows more complex.",
    );
    process.exit(1);
}
const version = floor[1];

console.log(`engines.vscode = ${range} -> testing the floor: ${version}\n`);

const result = spawnSync("npm", ["run", "test:host"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, SOTERAI_HOST_VSCODE_VERSION: version },
});

if (result.status !== 0) {
    console.error(
        `\nFLOOR FAILED: the extension does not work on VS Code ${version}, ` +
            `but package.json promises ${range}.\n` +
            "Either raise engines.vscode to a version that passes, or fix the incompatibility.",
    );
}
process.exit(result.status === null ? 1 : result.status);
