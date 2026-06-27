import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

const result = spawnSync(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    // Playwright's synchronous module hook expects an Array for
    // `context.conditions`, while current Node 22 releases provide a Set.
    // The async loader uses the stable hook contract on every supported OS.
    PLAYWRIGHT_FORCE_ASYNC_LOADER: process.env.PLAYWRIGHT_FORCE_ASYNC_LOADER ?? "1",
  },
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
