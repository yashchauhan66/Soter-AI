import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const extensionRoot = join(repoRoot, "packages", "vscode-extension");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const vsix = join(extensionRoot, `${manifest.name}-${manifest.version}.vsix`);
const ovsxBin = join(repoRoot, "node_modules", "ovsx", "bin", "ovsx");

if (!existsSync(vsix)) {
  throw new Error(`Missing ${vsix}. Run 'npm run openvsx:package' first.`);
}
if (!existsSync(ovsxBin)) {
  throw new Error("Open VSX CLI is not installed. Run 'npm install' first.");
}
if (!process.env.OVSX_PAT) {
  throw new Error("OVSX_PAT is not set. Create a scoped Open VSX token and provide it only through the environment or CI secret store.");
}

// The publish is the irreversible step: Open VSX does not allow overwriting a
// version, and one push is simultaneously the Cursor, Windsurf, VSCodium, Kiro
// and Antigravity release. Gate it on the same preflight a human would run, so
// the artifact and the registry state are re-checked at the moment of publish
// rather than whenever someone last looked.
execFileSync(process.execPath, [join(repoRoot, "scripts", "openvsx-publish-preflight.mjs"), "--require-token"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

execFileSync(process.execPath, [ovsxBin, "publish", "--packagePath", vsix], {
  cwd: extensionRoot,
  env: process.env,
  stdio: "inherit",
});

