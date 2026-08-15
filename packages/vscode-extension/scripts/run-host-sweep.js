#!/usr/bin/env node
// Runs the all-commands sweep: every contributed command executed once in a real
// editor, by a user who cancels every prompt.
//
// Separate from `test:host` because it needs a different budget, not because it
// is optional. `test:host` proves fifteen features behave; this proves the other
// 143 palette entries are not dead buttons. Both belong in a release.
//
// Pass a version through the same lever the floor runner uses:
//   SOTERAI_HOST_VSCODE_VERSION=1.85.0 node scripts/run-host-sweep.js
const { spawnSync } = require("child_process");
const path = require("path");

const result = spawnSync("npm", ["run", "test:host"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
    env: {
        ...process.env,
        SOTERAI_HOST_SWEEP: "1",
        // The sweep stops itself at nine minutes and reports what it skipped;
        // this only has to outlast that, so a spawn kill (which prints no report
        // at all) is never what ends the run.
        SOTERAI_HOST_TIMEOUT_MS: process.env.SOTERAI_HOST_TIMEOUT_MS || "900000",
    },
});

process.exit(result.status === null ? 1 : result.status);
