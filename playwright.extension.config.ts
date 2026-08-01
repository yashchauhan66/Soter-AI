/**
 * Playwright config for the packaged-extension runtime lab.
 *
 * Deliberately separate from the root `playwright.config.ts`, which cannot be reused: that one
 * refuses to start without an isolated database, points at `tests/e2e`, runs a `globalSetup`
 * and boots a Next server. This suite needs none of that — it needs a real browser, a store
 * artefact and a loopback server, all of which the fixtures build themselves.
 *
 * Two projects rather than one parametrised run, because §22 requires the two engines to be
 * proven *separately*: an MV3 extension can behave differently on each, and "it worked on one"
 * is not evidence about the other.
 *
 * Measured limitation — why there is no Chrome-branded project. Chrome **stable**
 * 147.0.7727.57 ignores `--load-extension`: the browser launches, the artefact is never
 * installed, and no MV3 service worker is ever registered. Neither
 * `--disable-features=DisableLoadExtensionCommandLineSwitch` nor
 * `--enable-unsafe-extension-debugging` restores it, and no Chrome Dev/Beta/Canary build is
 * present on this machine. The same extracted directory installs on the first try in both
 * Microsoft Edge stable and Playwright's bundled Chromium, so this is Chrome's policy, not a
 * defect in the artefact or the lab. The Chrome-side proof therefore runs on the Chromium build
 * — the same engine Chrome ships, loading the same `soter-extension-chrome-*.zip` the Chrome Web
 * Store receives — and is reported as Chromium, never as Chrome. `SOTER_LAB_CHROMIUM_CHANNEL`
 * exists so a build that does accept unpacked extensions (a future Chrome, or Chrome for
 * Testing) can carry that proof unchanged.
 *
 * Serial and single-worker on purpose. Each worker launches a real persistent browser profile
 * with the extension installed and binds a loopback HTTPS port; running several at once would
 * multiply profiles and ports for no gain, and the tests assert on a shared request recorder
 * whose ordering is part of the proof.
 */
import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/extension-runtime",
  // Real browser launch + extension install + policy sync + several interactions per test.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  // No retries: a retry would relaunch the browser and quietly turn a flaky enforcement
  // failure into a pass, which is exactly the kind of evidence this suite must not produce.
  retries: 0,
  reporter: CI ? [["list"], ["github"]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { channel: process.env.SOTER_LAB_CHROMIUM_CHANNEL ?? "chromium" } },
    { name: "edge", use: { channel: "msedge" } },
  ],
});
