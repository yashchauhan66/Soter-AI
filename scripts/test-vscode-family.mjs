import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const repoRoot = resolve(import.meta.dirname, "..");
const extensionRoot = join(repoRoot, "packages", "vscode-extension");
const extensionId = "soterai.soterai-ide-guard";
const extensionPackage = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const vsix = join(extensionRoot, `soterai-ide-guard-${extensionPackage.version}.vsix`);
const requested = process.argv[2] ?? "all";
const requireEditor = process.env.SOTERAI_REQUIRE_EDITOR === "1";
const packagedRuntime = process.env.SOTERAI_PACKAGED_RUNTIME === "1";
const runtimeEvidenceRoot = join(repoRoot, "artifacts", "editor-runtime");
// Cold-start cost differs a lot between forks (Cursor and Antigravity boot extra
// vendor services before the extension host runs), so the probe budget is
// generous and overridable rather than tuned to the fastest host.
const probeTimeoutMs = Number(process.env.SOTERAI_PROBE_TIMEOUT_MS ?? "") || 240_000;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// spawnSync returns the moment the launcher process dies, but the extension host
// that writes the evidence is a child of it. Give the file a short grace period
// before declaring the run unproven.
function waitForFile(path, ms) {
  const deadline = Date.now() + ms;
  while (!existsSync(path) && Date.now() < deadline) sleepSync(500);
  return existsSync(path);
}

// Windows keeps exthost.log open after the host exits; a failed cleanup must not
// replace the real pass/fail reason with an EBUSY stack. SOTERAI_KEEP_TEMP=1
// preserves the isolated profile so a failed probe can be read out of its logs.
function removeQuietly(path) {
  if (process.env.SOTERAI_KEEP_TEMP === "1") {
    console.log(`NOTE keeping ${path} (SOTERAI_KEEP_TEMP=1)`);
    return;
  }
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (error) {
    console.log(`NOTE could not fully remove ${path}: ${error.code ?? error.message}`);
  }
}

// Every target is a VS Code-family host that consumes the SAME audited VSIX.
// `gallery` records the extension registry each host actually resolves at
// runtime (read from its own product.json), because that determines whether a
// single Open VSX publish makes the extension installable by search there.
const editors = {
  code: { command: "code", label: "VS Code", gallery: "Visual Studio Marketplace" },
  cursor: { command: "cursor", label: "Cursor", gallery: "marketplace.cursorapi.com (Cursor proxy)" },
  codium: { command: "codium", label: "VSCodium", gallery: "open-vsx.org" },
  windsurf: { command: "windsurf", label: "Windsurf", gallery: "marketplace.windsurf.com (Open VSX mirror)" },
  kiro: { command: "kiro", label: "Kiro", gallery: "open-vsx.org" },
  antigravity: { command: "antigravity", label: "Antigravity", gallery: "open-vsx.org" },
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
  // Consume the audited artifact when it already exists: this script's contract
  // is that every host runs "the SAME audited VSIX" (see the header comment).
  // Repackaging on every run embeds fresh zip timestamps, so the bytes — and
  // therefore every recorded sha256 — drift between runs and invalidate the
  // provenance and preflight evidence that reference this artifact.
  // Delete the VSIX or set SOTERAI_REPACKAGE=1 to force a fresh build.
  if (existsSync(vsix) && process.env.SOTERAI_REPACKAGE !== "1") {
    console.log(`[test-vscode-family] using existing ${basename(vsix)} (SOTERAI_REPACKAGE=1 to rebuild)`);
    return;
  }
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
  removeQuietly(root);
  mkdirSync(userData, { recursive: true });
  mkdirSync(extensions, { recursive: true });

  const common = ["--user-data-dir", userData, "--extensions-dir", extensions];
  const runtimeReport = join(runtimeEvidenceRoot, `${key}.json`);
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
    if (packagedRuntime) {
      mkdirSync(runtimeEvidenceRoot, { recursive: true });
      rmSync(runtimeReport, { force: true });
      rmSync(`${runtimeReport}.partial`, { force: true });
      const runtimeEnv = { ...process.env, SOTERAI_PACKAGED_RUNTIME_PROBE: runtimeReport };
      delete runtimeEnv.ELECTRON_RUN_AS_NODE;
      delete runtimeEnv.VSCODE_DEV;
      const startedAt = Date.now();
      const launched = spawnSync(
        launcher.executable,
        [
          ...common,
          "--new-window",
          "--skip-welcome",
          "--skip-release-notes",
          "--disable-workspace-trust",
          repoRoot,
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: runtimeEnv,
          timeout: probeTimeoutMs,
          windowsHide: true,
        },
      );
      if (launched.error && launched.error.code !== "ETIMEDOUT") throw launched.error;
      if (!waitForFile(runtimeReport, 20_000)) {
        const partial = existsSync(`${runtimeReport}.partial`) ? " a .partial write was left behind, so the host died mid-report;" : "";
        throw new Error(
          `${editor.label} produced no packaged-runtime evidence after ${Math.round((Date.now() - startedAt) / 1000)}s.${partial} status=${launched.status} signal=${launched.signal} stderr=${launched.stderr ?? ""}`,
        );
      }
      const raw = readFileSync(runtimeReport, "utf8");
      if (raw.trim().length === 0) throw new Error(`${editor.label} wrote an empty evidence file: ${runtimeReport}`);
      const evidence = JSON.parse(raw);
      if (evidence.result !== "PASS" || evidence.packagedExecution !== true) {
        throw new Error(`${editor.label} packaged-runtime probe failed: ${JSON.stringify(evidence)}`);
      }
      if (evidence.version && evidence.version !== extensionPackage.version) {
        throw new Error(`${editor.label} evidence is for ${evidence.version}, not the packaged ${extensionPackage.version}.`);
      }
      // Bind the evidence to the exact bytes that ran. A version string alone lets
      // a rebuilt 0.2.1 inherit an older build's proof.
      const artifact = {
        file: basename(vsix),
        sha256: createHash("sha256").update(readFileSync(vsix)).digest("hex"),
      };
      writeFileSync(runtimeReport, `${JSON.stringify({ ...evidence, artifact }, null, 2)}\n`, "utf8");
      console.log(`PASS ${editor.label}: packaged VSIX executed in editor host (${evidence.checks.length} runtime checks). Registry: ${editor.gallery}.`);
    } else {
      console.log(`PASS ${editor.label}: isolated VSIX install and extension-list verification. Registry: ${editor.gallery}.`);
    }

    execFileSync(launcher.executable, [...launcher.prefixArgs, ...common, "--uninstall-extension", extensionId], {
      cwd: repoRoot,
      stdio: "inherit",
      env: launcher.env,
      timeout: 45_000,
    });
    const afterUninstall = execFileSync(launcher.executable, [...launcher.prefixArgs, ...common, "--list-extensions"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: launcher.env,
      timeout: 45_000,
    });
    if (afterUninstall.toLowerCase().includes(extensionId)) {
      throw new Error(`${extensionId} remained installed after ${editor.label} uninstall.`);
    }
    console.log(`PASS ${editor.label}: clean uninstall verified.`);
    return "PASS";
  } finally {
    removeQuietly(root);
  }
}

if (requested !== "all" && !editors[requested]) {
  throw new Error(`Unknown editor '${requested}'. Expected one of: all, ${Object.keys(editors).join(", ")}`);
}

if (process.env.SOTERAI_SKIP_PACKAGE !== "1") packageExtension();
else if (!existsSync(vsix)) throw new Error(`SOTERAI_SKIP_PACKAGE=1 but VSIX is missing: ${vsix}`);
const selected = requested === "all" ? Object.entries(editors) : [[requested, editors[requested]]];
// One failing host must not hide the remaining ones: every editor is attempted,
// and the process still exits non-zero if any of them failed.
const results = selected.map(([key, editor]) => {
  try {
    return [key, testEditor(key, editor)];
  } catch (error) {
    console.error(`FAIL ${editor.label}: ${error instanceof Error ? error.message : String(error)}`);
    return [key, "FAIL"];
  }
});
console.log(`SoterAI VS Code-family install results: ${results.map(([key, result]) => `${key}=${result}`).join(", ")}`);
if (results.some(([, result]) => result === "FAIL")) process.exitCode = 1;
