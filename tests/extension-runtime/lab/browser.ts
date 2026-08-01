/**
 * Launches the *packaged* extension in a real installed browser for the runtime lab.
 *
 * Three properties matter here, and each is why a particular flag is present:
 *
 *  1. The artefact under test is the store zip (`dist/soter-extension-<store>-v<x>.zip`),
 *     extracted to a throwaway directory. Testing `dist/extension/` directly would prove
 *     something about the build tree rather than about what a user installs, so the caller
 *     is also handed `manifestSha256` to pin the identity of what was loaded.
 *  2. `--host-resolver-rules` maps the two hostnames the test needs onto the loopback lab
 *     and sends *everything else* to `~NOTFOUND`. The store manifest only injects its
 *     content script on real https AI origins, so the test has to be served from one; the
 *     blackhole half means no request can leave the machine even if the extension tried.
 *  3. `--ignore-certificate-errors-spki-list` trusts exactly one ephemeral public key —
 *     the lab's. The blanket `--ignore-certificate-errors` switch is deliberately not used.
 *
 * The browser profile is a fresh temp directory per run, so the install is a genuine first
 * install (`chrome.runtime.onInstalled` fires, which is what triggers the first policy sync)
 * and no state leaks between runs or from the user's real profile.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";

/**
 * Browser builds the lab can drive.
 *
 * `"chromium"` is Playwright's bundled Chromium and `"msedge"` is the installed Microsoft Edge.
 * `"chrome"` is kept because the switch plumbing is identical, but note the measured limitation
 * recorded in `playwright.extension.config.ts`: Chrome **stable** 147 ignores `--load-extension`
 * entirely, so it never registers the extension's service worker and the lab cannot install into
 * it. Nothing here works around that — a build that refuses the artefact is reported, not faked.
 */
export type LabChannel = "chromium" | "chrome" | "msedge";

/** Playwright's `channel` for a lab channel; the bundled Chromium is "no channel". */
function playwrightChannel(channel: LabChannel): string | undefined {
  return channel === "chromium" ? undefined : channel;
}


export interface LabBrowserOptions {
  channel: LabChannel;
  /** Port the lab server bound. Both impersonated hostnames map here. */
  labPort: number;
  /** base64(SHA-256(SPKI)) of the lab certificate. */
  spkiSha256Base64: string;
  headless?: boolean;
}

export interface LabBrowser {
  context: BrowserContext;
  /** Runtime id of the loaded unpacked extension. */
  extensionId: string;
  /** Directory the store zip was extracted into. */
  extensionDir: string;
  /** Store artefact this run loaded. */
  packagePath: string;
  /** SHA-256 of the manifest inside that artefact, for the evidence record. */
  manifestSha256: string;
  /** Exactly the switches this run passed, for the evidence record. */
  launchArgs: string[];
  /** User-agent of the build that actually ran, for the evidence record. */
  userAgent: string;
  dispose(): Promise<void>;
}

const REPO_ROOT = process.cwd();

export function extensionVersion(): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "apps/extension/package.json"), "utf8")) as { version: string };
  return pkg.version;
}

export function packagePathFor(channel: LabChannel): string {
  const store = channel === "msedge" ? "edge" : "chrome";
  return join(REPO_ROOT, "apps/extension/dist", `soter-extension-${store}-v${extensionVersion()}.zip`);
}

/** SHA-256 of `dist/extension/manifest.json`, i.e. the manifest the packager zipped. */
export function builtManifestSha256(): string {
  return sha256File(join(REPO_ROOT, "apps/extension/dist/extension/manifest.json"));
}

export async function launchLabBrowser(options: LabBrowserOptions): Promise<LabBrowser> {
  const packagePath = packagePathFor(options.channel);
  if (!existsSync(packagePath)) {
    throw new Error(
      `Packaged extension not found: ${packagePath}\nRun \`npm run package\` in apps/extension first — the runtime lab tests the store artefact, not the build tree.`,
    );
  }

  const extensionDir = mkdtempSync(join(tmpdir(), "soter-ext-lab-unpacked-"));
  const userDataDir = mkdtempSync(join(tmpdir(), "soter-ext-lab-profile-"));
  extractZip(packagePath, extensionDir);

  const manifestPath = join(extensionDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Extracted artefact has no top-level manifest.json: ${extensionDir}`);
  }
  const manifestSha256 = sha256File(manifestPath);

  const launchArgs = [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    // Two impersonated hostnames, then a blackhole for the entire rest of the internet.
    `--host-resolver-rules=MAP chatgpt.com 127.0.0.1:${options.labPort},MAP soterai.in 127.0.0.1:${options.labPort},MAP * ~NOTFOUND,EXCLUDE localhost`,
    // One key, not "all certificate errors".
    `--ignore-certificate-errors-spki-list=${options.spkiSha256Base64}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: playwrightChannel(options.channel),
    // MV3 service workers and extension pages are exercised most faithfully headed; the
    // env override exists for machines without a display.
    headless: options.headless ?? false,
    args: launchArgs,
    viewport: { width: 1280, height: 900 },
  });

  const extensionId = await resolveExtensionId(context, options.channel);
  const probe = await context.newPage();
  const userAgent = await probe.evaluate(() => navigator.userAgent);
  await probe.close();

  return {
    context,
    extensionId,
    extensionDir,
    packagePath,
    manifestSha256,
    launchArgs,
    userAgent,
    async dispose() {
      await context.close().catch(() => undefined);
      rmSync(extensionDir, { recursive: true, force: true });
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

/**
 * The MV3 service worker is the only reliable carrier of the runtime id for an unpacked
 * extension: its script URL is `chrome-extension://<id>/background/service-worker.js`.
 *
 * If it never appears, the browser silently declined to install the extension. That is a real
 * outcome for some builds (Chrome stable ignores `--load-extension`), so the error says so
 * rather than leaving a bare event timeout to be misread as a flaky test.
 */
async function resolveExtensionId(context: BrowserContext, channel: LabChannel): Promise<string> {
  const existing = context.serviceWorkers()[0];
  const worker =
    existing ??
    (await context.waitForEvent("serviceworker", { timeout: 30_000 }).catch(() => {
      throw new Error(
        `The ${channel} build never registered the extension's MV3 service worker, so it did not install the artefact.\n` +
          `Chrome stable ignores --load-extension (measured on 147.0.7727.57); use the "chromium" or "edge" project, or a build that still accepts unpacked extensions.`,
      );
    }));
  const id = new URL(worker.url()).hostname;
  if (!id) throw new Error(`Could not derive the extension id from ${worker.url()}`);
  return id;
}

function extractZip(zipPath: string, destination: string) {
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", "Expand-Archive", "-Path", zipPath, "-DestinationPath", destination, "-Force"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return;
  }
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", destination], { stdio: ["ignore", "ignore", "pipe"] });
}

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
