#!/usr/bin/env node
/**
 * soterai CLI entrypoint (bin shim).
 */
import { run, defaultDeps } from "./run";

run(process.argv.slice(2), defaultDeps())
    .then((code) => {
        process.exitCode = code;
    })
    .catch((error) => {
        process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
        process.exitCode = 1;
    });
