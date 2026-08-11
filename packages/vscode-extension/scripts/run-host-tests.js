// Launches a real VS Code as an extension host and runs the suite in
// src/__tests__/host against it.
//
// By default it downloads (and caches in .vscode-test/) a pinned VS Code build.
// That costs one ~120MB download but buys two things the developer's own install
// cannot give: the version under test is the same on every machine and in CI,
// and the run is immune to Windows' `vscode-updating` mutex — a locally
// installed Code refuses to launch at all while an in-place update is staged.
//
// Set SOTERAI_HOST_CODE=/path/to/Code.exe to test against a specific binary
// instead. The runner always prints which host and version produced the result,
// because a host result is only meaningful next to the version it ran on.
//
// Set SOTERAI_HOST_VSCODE_VERSION=1.85.0 to download and test a different
// version. That is how the `engines.vscode` floor gets verified: the manifest
// promises every version from the floor upward, and an untested floor is a
// promise to users we have never checked. Keep the pin above as the everyday
// version; use this to prove the range.
const { spawnSync, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const extensionRoot = path.resolve(__dirname, "..");

// Pinned so a host result is reproducible. Bump deliberately, not incidentally:
// raising this is a claim that the panel was verified on the newer host.
const PINNED_VSCODE_VERSION = "1.104.0";

async function resolveHost() {
    const override = process.env.SOTERAI_HOST_CODE;
    if (override) {
        if (!fs.existsSync(override)) {
            console.error(`SOTERAI_HOST_CODE points at a missing file: ${override}`);
            process.exit(1);
        }
        return { bin: override, source: "SOTERAI_HOST_CODE" };
    }

    const { downloadAndUnzipVSCode } = require("@vscode/test-electron");
    const version = process.env.SOTERAI_HOST_VSCODE_VERSION || PINNED_VSCODE_VERSION;
    const bin = await downloadAndUnzipVSCode({
        version,
        cachePath: path.join(extensionRoot, ".vscode-test"),
    });
    return {
        bin,
        source: version === PINNED_VSCODE_VERSION ? `pinned ${version}` : `SOTERAI_HOST_VSCODE_VERSION ${version}`,
    };
}

// Read the version from product.json rather than `Code.exe --version`. Spawning
// the binary is unreliable on Windows: while an in-place update is staged it
// exits 0 with empty output, which would silently label a real result
// "(could not query)". Falling back to the spawn keeps non-standard layouts working.
function hostVersion(codeBin) {
    const productJson = path.join(path.dirname(codeBin), "resources", "app", "product.json");
    try {
        const p = JSON.parse(fs.readFileSync(productJson, "utf8"));
        if (p.version) return `${p.version}${p.commit ? ` (${p.commit})` : ""}`;
    } catch {
        /* fall through to the spawn */
    }
    try {
        const out = execFileSync(codeBin, ["--version"], { encoding: "utf8", timeout: 60000 })
            .split("\n")[0]
            .trim();
        if (out) return out;
    } catch {
        /* fall through */
    }
    return "(unknown — could not read product.json or query the binary)";
}

async function main() {
    const { bin: codeBin, source } = await resolveHost();

    console.log(`host: ${codeBin}\nsource: ${source}\nversion: ${hostVersion(codeBin)}\n`);

    // A throwaway profile so the run never touches the developer's real
    // settings, extensions or window state — and so settings a test writes are
    // discarded even if a test fails before its own cleanup runs.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "soterai-host-"));
    const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "soterai-host-ext-"));
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "soterai-host-ws-"));

    const args = [
        "--extensionDevelopmentPath=" + extensionRoot,
        "--extensionTestsPath=" + path.join(extensionRoot, "dist-test", "host", "index.js"),
        "--user-data-dir=" + userDataDir,
        "--extensions-dir=" + extensionsDir,
        "--disable-extensions",
        "--disable-workspace-trust",
        "--disable-gpu",
        "--disable-updates",
        "--skip-welcome",
        "--skip-release-notes",
        "--no-sandbox",
        workspaceDir,
    ];

    const result = spawnSync(codeBin, args, {
        stdio: "inherit",
        env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1", SOTERAI_HOST_TEST: "1" },
        timeout: 240000,
    });

    // Best-effort cleanup. On Windows the host's own log files can still be
    // held open for a moment after the process exits, so a plain rmSync throws
    // EBUSY and would fail a run whose 9 tests all passed. Retry briefly, then
    // leave the directory to the OS temp sweeper — a stale temp profile is not
    // a test result. `maxRetries` handles the transient case in-process; the
    // catch keeps a genuinely locked file from masking the real verdict.
    for (const dir of [userDataDir, extensionsDir, workspaceDir]) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch (err) {
            console.warn(`note: could not remove temp profile ${dir} (${err.code}); it will be swept by the OS.`);
        }
    }

    if (result.error) {
        console.error("Failed to launch the host:", result.error.message);
        process.exit(1);
    }
    process.exit(result.status === null ? 1 : result.status);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
