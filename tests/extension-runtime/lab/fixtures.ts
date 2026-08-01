/**
 * Playwright fixtures for the packaged-extension runtime lab.
 *
 * One lab per worker: certificate → loopback server → real browser with the store artefact
 * loaded → the extension's own popup page kept open as the privileged message sender.
 *
 * Why the popup: `SOTER_SYNC_POLICY` and `SOTER_GET_STATE` are `extension_page` scope in
 * `message-guard.ts`, so they are only accepted from a `chrome-extension://<id>/` document.
 * Driving them from there rather than from a content script means the test never has to
 * relax the message boundary it is also asserting.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { createLabCertificate, type LabCertificate } from "./tls";
import { startLabServer, type LabServer } from "./server";
import { launchLabBrowser, builtManifestSha256, packagePathFor, type LabBrowser, type LabChannel } from "./browser";
import type { LabPolicyMode } from "./policy-fixtures";

/** The fields of the extension state this suite asserts on. */
export interface StateSnapshot {
  enabled?: boolean;
  policySyncStatus?: string;
  policyIntegrity?: { verified?: boolean; code?: string; reason?: string; contentHash?: string };
  policy?: { version?: string; rules?: Array<{ id?: string; action?: string }> };
  config?: { apiBaseUrl?: string; organizationId?: string };
  policyTrust?: { signedBundleSeen?: boolean };
}

export interface Lab {
  server: LabServer;
  browser: LabBrowser;
  certificate: LabCertificate;
  channel: LabChannel;
  extensionOrigin: string;
  /** Kept open for the run; the privileged (`extension_page`) message sender. */
  privilegedPage: Page;
  /** Sends a runtime message from the extension popup and resolves the response. */
  send(message: Record<string, unknown>): Promise<unknown>;
  /** Switches what the control plane serves, forces a re-sync, returns the new state. */
  applyPolicy(mode: LabPolicyMode): Promise<StateSnapshot>;
  state(): Promise<StateSnapshot>;
  /** Opens the synthetic AI page and waits for the guard to report itself active. */
  openChat(): Promise<Page>;
  /**
   * Everything the MV3 service worker logged since the last call.
   *
   * The background script is the only place that knows *why* a policy sync ended the way it
   * did, and Playwright surfaces no console events for service workers. Without this, a failed
   * enforcement assertion says "expected error, got offline" and nothing about the cause, which
   * for a fail-closed control is the difference between a tamper signal and a transport fault.
   */
  workerLog(): Promise<string[]>;
  /** Evidence record for the report. */
  evidence: {
    packagePath: string;
    manifestSha256: string;
    builtManifestSha256: string;
    launchArgs: string[];
    userAgent: string;
  };
}

// `Record<never, never>` for the test-scoped args, not `Record<string, never>`: the latter makes
// every fixture key resolve to `never` and rejects the worker-scoped `lab` value.
export const test = base.extend<Record<never, never>, { lab: Lab }>({
  lab: [
    async ({}, use, workerInfo) => {
      const channel = (workerInfo.project.use.channel as LabChannel | undefined) ?? "chromium";
      const certificate = createLabCertificate();
      const server = await startLabServer({ cert: certificate.cert, key: certificate.key });
      const browser = await launchLabBrowser({
        channel,
        labPort: server.port,
        spkiSha256Base64: certificate.spkiSha256Base64,
        headless: process.env.SOTER_LAB_HEADLESS === "1",
      });

      // The first policy sync is triggered by `chrome.runtime.onInstalled`, which a fresh
      // temp profile guarantees. Waiting for it here means no test races the bootstrap.
      await expect
        .poll(() => server.policyServeCount(), { timeout: 30_000, message: "extension never fetched a policy bundle" })
        .toBeGreaterThan(0);

      const extensionOrigin = `chrome-extension://${browser.extensionId}`;
      const privilegedPage = await browser.context.newPage();
      await privilegedPage.goto(`${extensionOrigin}/popup/index.html`, { waitUntil: "domcontentloaded" });

      // Drain-on-read console tap in the background worker. Installed by evaluating in the
      // worker itself because Playwright emits no console events for service workers. If the
      // worker is idle-terminated the tap dies with it, so every read tolerates failure.
      const worker = browser.context.serviceWorkers()[0];
      await worker
        ?.evaluate(() => {
          const sink: string[] = ((globalThis as any).__soterLabLog ??= []);
          for (const level of ["warn", "error"] as const) {
            const original = (console as any)[level].bind(console);
            (console as any)[level] = (...args: unknown[]) => {
              sink.push(`${level}: ${args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" ")}`);
              original(...args);
            };
          }
        })
        .catch(() => undefined);
      const workerLog = async () =>
        (await worker
          ?.evaluate(() => {
            const sink = ((globalThis as any).__soterLabLog ?? []) as string[];
            return sink.splice(0, sink.length);
          })
          .catch(() => ["<worker console tap unavailable — the service worker restarted>"])) ?? [];

      const send = (message: Record<string, unknown>) =>
        privilegedPage.evaluate(
          (payload) =>
            new Promise<unknown>((resolve) => {
              const runtime = (globalThis as unknown as { chrome?: { runtime?: { sendMessage?: Function } } }).chrome?.runtime;
              if (typeof runtime?.sendMessage !== "function") {
                resolve({ __labError: "chrome.runtime.sendMessage unavailable" });
                return;
              }
              runtime.sendMessage(payload, (response: unknown) => resolve(response));
            }),
          message,
        );

      const state = async () => ((await send({ type: "SOTER_GET_STATE" })) as { state?: StateSnapshot })?.state ?? {};

      const lab: Lab = {
        server,
        browser,
        certificate,
        channel,
        extensionOrigin,
        privilegedPage,
        send,
        state,
        workerLog,
        applyPolicy: async (mode) => {
          server.setPolicyMode(mode);
          const before = server.policyServeCount();
          const response = (await send({ type: "SOTER_SYNC_POLICY" })) as { ok?: boolean; state?: StateSnapshot };
          expect(server.policyServeCount(), "re-sync did not reach the lab control plane").toBeGreaterThan(before);
          // A lab fault reaches the extension as an HTTP 500, i.e. as a transport failure, and a
          // transport failure looks like a healthy fail-safe. Checked here so the *next*
          // assertion cannot pass or fail for a reason that has nothing to do with the extension.
          expect(server.faults(), "the lab control plane faulted while serving the policy").toEqual([]);
          return response?.state ?? (await state());
        },
        openChat: async () => {
          const page = await browser.context.newPage();
          await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
          await page.waitForSelector("html[data-soter-active-domain='true']", { timeout: 25_000 });
          return page;
        },
        evidence: {
          packagePath: packagePathFor(channel),
          manifestSha256: browser.manifestSha256,
          builtManifestSha256: builtManifestSha256(),
          launchArgs: browser.launchArgs,
          userAgent: browser.userAgent,
        },
      };

      await use(lab);

      await browser.dispose();
      await server.stop();
      certificate.dispose();
    },
    { scope: "worker" },
  ],
});

export { expect };
