// Bundles the extension (and inlines @soterai/guard-core) into a single
// dist/extension.js so `vsce package` never follows the symlinked monorepo.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const extensionRoot = __dirname;

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Remove stale output (e.g. old `tsc` compile artifacts) so the packaged VSIX
// contains only the single bundled entry point.
fs.rmSync(path.join(extensionRoot, "dist"), { recursive: true, force: true });

/** @type {import('esbuild').BuildOptions} */
const options = {
    absWorkingDir: extensionRoot,
    entryPoints: [path.join(extensionRoot, "src", "extension.ts")],
    bundle: true,
    outfile: path.join(extensionRoot, "dist", "extension.js"),
    platform: "node",
    format: "cjs",
    target: "node18",
    tsconfig: path.join(extensionRoot, "tsconfig.json"),
    // vscode is provided by the host at runtime and must never be bundled.
    external: ["vscode"],
    // Inline @soterai/guard-core and everything else it needs.
    minify: production,
    sourcemap: !production,
    logLevel: "info",
};

/** Standalone broker entry bundled into the VSIX; no runtime node_modules needed. */
const brokerOptions = {
    absWorkingDir: extensionRoot,
    entryPoints: [path.join(extensionRoot, "..", "..", "apps", "local-ai-broker", "src", "cli.ts")],
    bundle: true,
    outfile: path.join(extensionRoot, "dist", "local-ai-broker.js"),
    platform: "node",
    format: "cjs",
    target: "node18",
    minify: production,
    sourcemap: !production,
    logLevel: "info",
};

async function main() {
    if (watch) {
        const ctx = await esbuild.context(options);
        const brokerCtx = await esbuild.context(brokerOptions);
        await ctx.watch();
        await brokerCtx.watch();
        console.log("[esbuild] watching...");
    } else {
        await Promise.all([esbuild.build(options), esbuild.build(brokerOptions)]);
        console.log(`[esbuild] built extension + local broker (${production ? "production" : "development"})`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
