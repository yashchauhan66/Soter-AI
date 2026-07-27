import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(import.meta.dirname, "..");
const extensionRoot = join(repoRoot, "packages", "vscode-extension");
const extensionId = "soterai.soterai-ide-guard";
const extensionPackage = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const vsix = join(extensionRoot, `soterai-ide-guard-${extensionPackage.version}.vsix`);
const requested = process.argv[2] ?? "all";
const requireEditor = process.env.SOTERAI_REQUIRE_EDITOR === "1";

const editors = {
  code: { command: "code", label: "VS Code" },
  cursor: { command: "cursor", label: "Cursor" },
  codium: { command: "codium", label: "VSCodium" },
  windsurf: { command: "windsurf", label: "Windsurf" },
};

function resolveLauncher(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const located = spawnSync(locator, [command], { encoding: "utf8" });
  if (located.status !== 0) return undefined;
  const candidates = located.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const commandPath = process.platform === "win32"
    ? candidates.find((path) => path.toLowerCase().endsWith(".cmd"))
    : candidates[0];
  if (!commandPath) return undefined;
  if (process.platform !== "win32" || !commandPath.toLowerCase().endsWith(".cmd")) {
    return { executable: commandPath, prefixArgs: [], env: process.env };
  }

  // VS Code-family .cmd launchers set Electron's Node mode and invoke a CLI JS
  // file. Calling that executable directly avoids cmd.exe keeping GUI children
  // attached and hanging a deterministic test run.
  const invocation = readFileSync(commandPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^"([^"]+)"\s+"([^"]+)"\s+%\*\s*$/i))
    .find(Boolean);
  if (!invocation) throw new Error(`Could not parse VS Code-family launcher: ${commandPath}`);
  const expand = (value) => resolve(value.replace(/^%~dp0/i, `${dirname(commandPath)}\\`));
  return {
    executable: expand(invocation[1]),
    prefixArgs: [expand(invocation[2])],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", VSCODE_DEV: "" },
  };
}

function packageExtension() {
  execFileSync("npm", ["run", "vscode:package"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: 120_000,
  });
  if (!existsSync(vsix)) throw new Error(`VSIX was not created: ${vsix}`);
}

function testEditor(key, editor) {
  const launcher = resolveLauncher(editor.command);
  if (!launcher) {
    const message = `SKIP ${editor.label}: '${editor.command}' is not installed or not on PATH.`;
    if (requireEditor) throw new Error(message);
    console.log(message);
    return "SKIP";
  }

  const root = join(tmpdir(), "soterai-vscode-family", key);
  const userData = join(root, "user-data");
  const extensions = join(root, "extensions");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });
  mkdirSync(extensions, { recursive: true });

  const common = ["--user-data-dir", userData, "--extensions-dir", extensions];
  try {
    execFileSync(launcher.executable, [...launcher.prefixArgs, ...common, "--install-extension", vsix, "--force"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: launcher.env,
      timeout: 45_000,
    });
    const installed = execFileSync(launcher.executable, [...launcher.prefixArgs, ...common, "--list-extensions", "--show-versions"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: launcher.env,
      timeout: 45_000,
    });
    if (!installed.toLowerCase().includes(`${extensionId}@`)) {
      throw new Error(`${extensionId} was not present in ${editor.label}'s isolated extension list.`);
    }
    console.log(`PASS ${editor.label}: isolated VSIX install and extension-list verification.`);
    return "PASS";
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (requested !== "all" && !editors[requested]) {
  throw new Error(`Unknown editor '${requested}'. Expected one of: all, ${Object.keys(editors).join(", ")}`);
}

if (process.env.SOTERAI_SKIP_PACKAGE !== "1") packageExtension();
else if (!existsSync(vsix)) throw new Error(`SOTERAI_SKIP_PACKAGE=1 but VSIX is missing: ${vsix}`);
const selected = requested === "all" ? Object.entries(editors) : [[requested, editors[requested]]];
const results = selected.map(([key, editor]) => [key, testEditor(key, editor)]);
console.log(`SoterAI VS Code-family install results: ${results.map(([key, result]) => `${key}=${result}`).join(", ")}`);
