#!/usr/bin/env node
/**
 * soterai CLI entrypoint (bin shim).
 */
import { run, defaultDeps } from "./run";

/**
 * The exit code for a crash depends on what was being run.
 *
 * For every normal command, 1 means "it failed". For `soterai hook`, 1 means
 * something very different: Claude Code treats a non-zero, non-2 exit as a
 * NON-blocking error and runs the tool anyway. So a crash on the hook path
 * would silently become permission to proceed — the guard failing open at
 * exactly the moment it is failing.
 *
 * `cmdHook` renders its own errors and normally never throws. This covers what
 * it cannot: a failure in `defaultDeps()` or in argv handling, before any hook
 * code has run. `hook install` and `hook status` are excluded — they are
 * interactive commands, not gates, and 2 is already their usage code.
 */
function failureExitCode(argv: string[]): number {
    const [command, sub] = argv.filter((a) => !a.startsWith("--"));
    return command === "hook" && sub !== "install" && sub !== "status" ? 2 : 1;
}

const argv = process.argv.slice(2);

try {
    run(argv, defaultDeps())
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
            process.exitCode = failureExitCode(argv);
        });
} catch (error) {
    // A synchronous throw out of defaultDeps() would otherwise exit 1.
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = failureExitCode(argv);
}
