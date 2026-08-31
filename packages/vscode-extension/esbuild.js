// Bundles the extension (and inlines @soterai/guard-core) into a single
// dist/extension.js so `vsce package` never follows the symlinked monorepo.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const extensionRoot = __dirname;
const repoRoot = path.resolve(extensionRoot, "..", "..");

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
    absWorkingDir: repoRoot,
    entryPoints: [path.join(repoRoot, "apps", "local-ai-broker", "src", "cli.ts")],
    bundle: true,
    outfile: path.join(extensionRoot, "dist", "local-ai-broker.js"),
    platform: "node",
    format: "cjs",
    target: "node18",
    minify: production,
    sourcemap: !production,
    logLevel: "info",
};

/**
 * The MCP server (Gap 2), a third bundle rather than part of extension.js.
 *
 * VS Code spawns it as a plain Node child process with no extension host, so it
 * needs its own entry point: `require("vscode")` would throw before the first
 * JSON-RPC line is read. `src/agent/toolLogic.ts` is imported by both bundles and
 * stays free of `vscode` for exactly this reason, so the verdicts an MCP agent
 * gets are byte-for-byte the ones a Copilot agent gets.
 *
 * No `external` here: unlike the extension, nothing at runtime provides its
 * imports, so guard-core must be inlined.
 */
const mcpServerOptions = {
    absWorkingDir: extensionRoot,
    entryPoints: [path.join(extensionRoot, "src", "agent", "mcpServer.ts")],
    bundle: true,
    outfile: path.join(extensionRoot, "dist", "soterai-mcp-server.js"),
    platform: "node",
    format: "cjs",
    target: "node18",
    tsconfig: path.join(extensionRoot, "tsconfig.json"),
    minify: production,
    sourcemap: !production,
    logLevel: "info",
};

async function main() {
    if (watch) {
        const ctx = await esbuild.context(options);
        const brokerCtx = await esbuild.context(brokerOptions);
        const mcpCtx = await esbuild.context(mcpServerOptions);
        await ctx.watch();
        await brokerCtx.watch();
        await mcpCtx.watch();
        console.log("[esbuild] watching...");
    } else {
        await Promise.all([
            esbuild.build(options),
            esbuild.build(brokerOptions),
            esbuild.build(mcpServerOptions),
        ]);
        console.log(
            `[esbuild] built extension + local broker + MCP server (${production ? "production" : "development"})`,
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
