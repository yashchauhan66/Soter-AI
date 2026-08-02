/**
 * @soterai/cli — library entrypoint.
 *
 * Exposes the full CLI command layer for programmatic use and testing.
 * The `soterai` bin runs `dist/cli.js` which calls `run` with default deps.
 */
export { run, defaultDeps, parseArgs } from "./run";
export type { CliDeps } from "./run";
