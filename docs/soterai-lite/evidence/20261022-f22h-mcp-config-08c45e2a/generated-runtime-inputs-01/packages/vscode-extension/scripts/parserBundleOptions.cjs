const fs = require("node:fs");
const path = require("node:path");

/** jsonc-parser's UMD factory aliases require, preventing static inlining.
 * Its declared ESM entry is the same pinned parser and bundles completely. */
function parserBundleOptions(repo) {
    const root = path.join(repo, "node_modules", "jsonc-parser");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (manifest.version !== "3.3.1" || manifest.module !== "./lib/esm/main.js") {
        throw new Error("Reviewed JSONC parser version/module binding changed.");
    }
    const entry = path.join(root, "lib", "esm", "main.js");
    if (!fs.statSync(entry).isFile()) throw new Error("Pinned JSONC module entry unavailable.");
    return { alias: { "jsonc-parser": entry } };
}
module.exports = { parserBundleOptions };
