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
  /** Evidence record for the report. */
  evidence: { packagePath: string; manifestSha256: string; builtManifestSha256: string; launchArgs: string[] };
}

export const test = base.extend<Record<string, never>, { lab: Lab }>({
  lab: [
    async ({}, use, workerInfo) => {
      const channel = (workerInfo.project.use.channel as LabChannel | undefined) ?? "chrome";
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
        applyPolicy: async (mode) => {
          server.setPolicyMode(mode);
          const before = server.policyServeCount();
          const response = (await send({ type: "SOTER_SYNC_POLICY" })) as { ok?: boolean; state?: StateSnapshot };
          expect(server.policyServeCount(), "re-sync did not reach the lab control plane").toBeGreaterThan(before);
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
