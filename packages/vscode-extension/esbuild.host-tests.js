// Bundles the host test suite into dist-test/host/index.js.
//
// Separate from esbuild.js because this output must NEVER end up in the VSIX —
// it is test-only and .vscodeignore excludes dist-test for that reason.
const esbuild = require("esbuild");
const path = require("path");

const extensionRoot = __dirname;

esbuild
    .build({
        absWorkingDir: extensionRoot,
        entryPoints: [path.join(extensionRoot, "src", "__tests__", "host", "index.ts")],
        bundle: true,
        outfile: path.join(extensionRoot, "dist-test", "host", "index.js"),
        platform: "node",
        format: "cjs",
        target: "node18",
        tsconfig: path.join(extensionRoot, "tsconfig.json"),
        // Provided by the host at runtime; bundling it would break the require.
        external: ["vscode"],
        sourcemap: true,
        logLevel: "info",
    })
    .then(() => console.log("[esbuild] built host test suite"))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
