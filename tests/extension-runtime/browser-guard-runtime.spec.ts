/**
 * RT-700 … RT-708 — runtime proof battery for the *packaged* Browser Guard extension.
 *
 * Everything here is observed from outside the extension: a real Chrome or Edge install, the
 * store zip as the artefact, a synthetic AI origin the store manifest genuinely matches, and
 * a loopback server that is simultaneously the submission destination and the control plane.
 * A test passes only when the *observable* outcome changed — a request that never arrived, a
 * page handler that never ran, a byte sequence absent from every body the extension emitted.
 * Manifest entries, routes and passing unit tests are not accepted as proof of enforcement
 * here (§2 of docs/SOTERAI-BROWSER-GUARD-WORK-STATUS.md).
 *
 * The suite is serial and RT-700 runs first: it asserts the lab is testing what it claims to
 * be testing, so a broken harness fails loudly instead of letting the rest pass vacuously.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, type Lab } from "./lab/fixtures";
import { LAB_PAGE_MARKER } from "./lab/server";
import { LAB_PROMPT_WITH_SECRET, LAB_SECRET } from "./lab/policy-fixtures";

test.describe.configure({ mode: "serial" });

/** Overlay host + shadow-root selectors. Playwright's CSS engine pierces the open root. */
const OVERLAY = "[data-soter-overlay]";
const BADGE = `${OVERLAY} .status-badge`;
const REPLACE = `${OVERLAY} [data-action="replace"]`;
const PREVIEW = `${OVERLAY} textarea`;

/** The hardened extension-pages CSP SS-5 claims, directive by directive. */
const EXPECTED_CSP = ["base-uri 'none'", "form-action 'none'", "object-src 'self'", "script-src 'self'"];

/** Redaction token the scanner substitutes for an AWS key. */
const REDACTION_TOKEN = "[REDACTED_AWS_KEY]";

/**
 * `.status-badge` is `text-transform: uppercase`, and Chrome applies text-transform to
 * `innerText`. Only `textContent` returns the literal string the extension chose.
 */
async function badgeText(page: Page): Promise<string> {
  await expect(page.locator(BADGE), "the enforcement overlay never appeared").toBeVisible();
  return (await page.locator(BADGE).evaluate((el) => el.textContent ?? "")).trim();
}

async function submitPrompt(page: Page, text: string = LAB_PROMPT_WITH_SECRET) {
  await page.fill("#prompt-textarea", text);
  await page.click('[data-testid="send-button"]');
}

/** The manifest inside the extracted store artefact — the bytes the browser was handed. */
function packagedManifest(lab: Lab): Record<string, any> {
  return JSON.parse(readFileSync(join(lab.browser.extensionDir, "manifest.json"), "utf8"));
}

/** The manifest the *running* extension reports, read from a privileged extension page. */
function liveManifest(lab: Lab): Promise<Record<string, any>> {
  return lab.privilegedPage.evaluate(
    () => (globalThis as any).chrome.runtime.getManifest() as Record<string, unknown>,
  ) as Promise<Record<string, any>>;
}

/** Compare CSP as a directive set, so whitespace or ordering cannot fake a match. */
function cspDirectives(value: unknown): string[] {
  return String(value ?? "")
    .split(";")
    .map((directive) => directive.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort();
}

test("RT-700 lab integrity: packaged artefact, real https origin, DNS blackholed, guard active", async ({ lab }) => {
  const page = await lab.openChat();

  // 1. The document under test is the lab's, served on an origin the *store* manifest matches.
  await expect(page.locator("#lab-marker")).toHaveAttribute("data-lab", LAB_PAGE_MARKER);
  expect(new URL(page.url()).origin, "the lab page is not on an impersonated https origin").toBe("https://chatgpt.com");

  // 2. The artefact loaded is the packaged one, not the build tree.
  expect(lab.evidence.manifestSha256, "loaded manifest is not the packaged manifest").toBe(
    lab.evidence.builtManifestSha256,
  );

  // 3. The *running* extension reports the packaged manifest's security-relevant fields.
  const disk = packagedManifest(lab);
  const live = await liveManifest(lab);
  expect(live.manifest_version).toBe(3);
  expect(live.manifest_version).toBe(disk.manifest_version);
  expect(live.version).toBe(disk.version);
  expect(live.permissions).toEqual(disk.permissions);
  expect(live.host_permissions).toEqual(disk.host_permissions);
  expect(cspDirectives(live.content_security_policy?.extension_pages)).toEqual(
    cspDirectives(disk.content_security_policy?.extension_pages),
  );
  expect(cspDirectives(live.content_security_policy?.extension_pages)).toEqual(EXPECTED_CSP);
  expect(live.content_scripts?.[0]?.matches).toEqual(disk.content_scripts?.[0]?.matches);
  expect(live.web_accessible_resources).toBeUndefined();

  // 4. Every hostname except the two the lab maps is blackholed, so nothing can leave the box.
  const stray = await lab.browser.context.newPage();
  const navError = await stray
    .goto("https://example.com/")
    .then(() => null)
    .catch((error: Error) => error.message);
  await stray.close();
  expect(navError, "real DNS was not blackholed — traffic could leave the machine").toContain("ERR_NAME_NOT_RESOLVED");

  // 5. The guard injected and claimed the domain.
  await expect(page.locator("html")).toHaveAttribute("data-soter-active-domain", "true");
  await page.close();

  // The run prints its own provenance, so §27's evidence record is transcribed from the run
  // rather than from memory: which artefact, which manifest bytes, which build, which switches.
  console.log(`[RT-700 evidence] ${JSON.stringify(lab.evidence, null, 2)}`);
});

/**
 * SS-5's only honest proof: load both extension pages under the hardened CSP in a real
 * browser and show that they still work *and* that the engine reported no violation. The
 * `#root` assertion is what makes this non-vacuous — both pages render only after their
 * module script runs and a `SOTER_GET_STATE` round-trip returns, so a CSP that blocked the
 * bundle would leave `#root` empty rather than silently pass.
 */
test("RT-701 SS-5: extension pages render under the hardened CSP with zero violations", async ({ lab }) => {
  for (const path of ["popup/index.html", "sidepanel/index.html"]) {
    const page = await lab.browser.context.newPage();
    const consoleCsp: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /content security policy|refused to (load|execute|apply)/i.test(message.text())) {
        consoleCsp.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      if (/content security policy/i.test(error.message)) consoleCsp.push(error.message);
    });

    // Registered before navigation, so the listener exists for the document's first byte.
    await page.addInitScript(() => {
      const probe: { installed: boolean; violations: string[] } = { installed: true, violations: [] };
      (globalThis as any).__soterCspProbe = probe;
      globalThis.addEventListener("securitypolicyviolation", (event: any) => {
        probe.violations.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
      });
    });

    await page.goto(`${lab.extensionOrigin}/${path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root"), `${path} rendered nothing — its script did not run`).not.toBeEmpty();

    const probe = (await page.evaluate(() => (globalThis as any).__soterCspProbe)) as
      | { installed?: boolean; violations?: string[] }
      | undefined;
    expect(probe?.installed, `${path}: the CSP probe never installed, so a pass would be vacuous`).toBe(true);
    expect(probe?.violations, `${path}: securitypolicyviolation events fired`).toEqual([]);
    expect(consoleCsp, `${path}: CSP console errors`).toEqual([]);
    await page.close();
  }
});

/**
 * The page's own send handler is an ordinary bubble-phase listener on the button — exactly
 * where a real site's handler sits. `#sent-count` and `window.__labSent` are therefore a
 * direct readout of whether the site's code ran, which is what "the submission was prevented"
 * has to mean. `applyPolicy` runs before any `server.reset()`, because reset() also zeroes the
 * policy-serve counter that applyPolicy asserts on.
 */
test("RT-702 BLOCK: the page's own submit handler never runs", async ({ lab }) => {
  await lab.applyPolicy("block");
  const page = await lab.openChat();

  await submitPrompt(page);

  expect(await badgeText(page)).toBe("Submission Blocked");
  expect(await page.locator("#sent-count").textContent(), "the site's handler ran").toBe("0");
  expect(await page.evaluate(() => (window as any).__labSent.length)).toBe(0);
  expect(await page.locator("#ingest-status").textContent()).toBe("idle");
  // The prompt is left exactly as typed; a block is not a silent rewrite.
  expect(await page.inputValue("#prompt-textarea")).toBe(LAB_PROMPT_WITH_SECRET);
  await page.close();
});

/**
 * RT-702 proves the *page* did not send. This proves nothing else did either — including the
 * extension's own audit, scan and lineage POSTs, which the lab receives because it also
 * impersonates the control-plane origin. Waiting for the audit event first is deliberate:
 * without it, "no body contains the secret" could pass simply because no body existed.
 */
test("RT-703 BLOCK: the secret reaches no endpoint, including the extension's own telemetry", async ({ lab }) => {
  await lab.applyPolicy("block");
  const page = await lab.openChat();
  lab.server.reset();

  await submitPrompt(page);
  expect(await badgeText(page)).toBe("Submission Blocked");

  await expect
    .poll(() => lab.server.ofPath("/api/extension/audit-log").length, {
      timeout: 20_000,
      message: "the extension emitted no audit event, so a leak search would be vacuous",
    })
    .toBeGreaterThan(0);

  expect(lab.server.ofPath("/lab/model-ingest"), "the destination received a request").toHaveLength(0);
  expect(lab.server.allBodies(), "a raw secret left the browser").not.toContain(LAB_SECRET);
  await page.close();
});

/**
 * Redaction is only a security control if the transformation happens *before* the bytes leave.
 * So this asserts on the destination's received body, not on the overlay preview: the request
 * must arrive, carry the redaction token and the surviving benign text, and never carry the
 * secret.
 */
test("RT-705 REDACT: the destination receives the redacted prompt and never the secret", async ({ lab }) => {
  await lab.applyPolicy("redact");
  const page = await lab.openChat();
  lab.server.reset();

  await submitPrompt(page);
  expect(await badgeText(page)).toBe("Security Warning");

  await page.locator(REPLACE).click();

  await expect
    .poll(() => lab.server.ofPath("/lab/model-ingest").length, {
      timeout: 20_000,
      message: "the approved safe prompt never reached the destination",
    })
    .toBeGreaterThan(0);

  const delivered = lab.server
    .ofPath("/lab/model-ingest")
    .map((request) => request.body)
    .join("\n");
  expect(delivered, "the destination received the raw secret").not.toContain(LAB_SECRET);
  expect(delivered, "nothing was redacted").toContain(REDACTION_TOKEN);
  expect(delivered, "the benign part of the prompt was destroyed").toContain("keeps failing");
  expect(lab.server.allBodies()).not.toContain(LAB_SECRET);
  await page.close();
});

/**
 * SS-4 + SS-11 in one interaction, against a completely unmodified packaged artefact.
 *
 * The control plane serves a bundle that was signed correctly and then mutated, so the content
 * hash the signature binds no longer matches. Because `verifyPolicyBundle` recomputes and
 * compares that hash *before* it selects a candidate key, the failure is `hash_mismatch` even
 * with no trusted key configured — no storage seeding, no patched build.
 *
 * SS-11 is the second half: a fail-closed block must not hand the prompt back to the page it
 * just refused. So the remediation button must be absent, the textarea untouched, and the
 * overlay's own preview redacted.
 */
test("RT-704 / RT-708 tamper: fails closed and leaks nothing back into the page", async ({ lab }) => {
  const state = await lab.applyPolicy("tampered");
  // The worker log is folded into the message so a failure distinguishes the two ways this can
  // go wrong: a tamper signal that was not raised, or a transport fault that never got as far
  // as verification.
  const syncLog = (await lab.workerLog()).join(" | ") || "<no worker output>";
  expect(state.policySyncStatus, `a tampered bundle was accepted as a healthy sync — worker said: ${syncLog}`).toBe(
    "error",
  );
  expect(state.policyIntegrity?.verified).toBe(false);
  expect(state.policyIntegrity?.code).toBe("hash_mismatch");

  const page = await lab.openChat();
  lab.server.reset();

  await submitPrompt(page);
  expect(await badgeText(page)).toBe("Submission Blocked — Policy Unverified");

  // SS-11: no write-back path is offered at all, so none can be replayed.
  await expect(page.locator(REPLACE), "a fail-closed block still offered write-back").toHaveCount(0);
  expect(await page.inputValue("#prompt-textarea")).toBe(LAB_PROMPT_WITH_SECRET);

  const preview = await page.locator(PREVIEW).inputValue();
  expect(preview, "the overlay preview handed the raw secret back to the page").not.toContain(LAB_SECRET);
  expect(preview).toContain(REDACTION_TOKEN);

  expect(await page.locator("#sent-count").textContent()).toBe("0");
  expect(lab.server.ofPath("/lab/model-ingest")).toHaveLength(0);
  expect(lab.server.allBodies()).not.toContain(LAB_SECRET);
  await page.close();
});

/**
 * SS-3 from both sides of the boundary. From the page there must be no channel at all (no
 * `externally_connectable`), and a SOTER-shaped `postMessage` — the cheapest thing a hostile
 * page can try — must move nothing. From the *privileged* popup, the deleted
 * `SOTER_SET_STATE` type must still be refused, which is the part a type allowlist can only
 * prove at runtime: the background listener returns without calling `sendResponse`, so the
 * caller sees a closed port rather than a success payload.
 */
test("RT-706 SS-3: the runtime message boundary holds at runtime", async ({ lab }) => {
  const page = await lab.openChat();
  const before = await lab.state();
  expect(before.enabled, "the guard was already disabled, so this test could not detect a write").toBe(true);
  const servesBefore = lab.server.policyServeCount();

  // (a) No runtime channel is exposed to the page's main world.
  expect(await page.evaluate(() => typeof (globalThis as any).chrome?.runtime?.sendMessage)).not.toBe("function");
  expect(await page.evaluate(() => typeof (globalThis as any).chrome?.runtime?.connect)).not.toBe("function");

  // (b) A SOTER-shaped postMessage from the page changes nothing.
  await page.evaluate(() => {
    window.postMessage({ type: "SOTER_SET_STATE", state: { enabled: false } }, "*");
    window.postMessage({ type: "SOTER_SYNC_POLICY" }, "*");
    window.postMessage({ type: "SOTER_GET_STATE" }, "*");
  });
  await page.waitForTimeout(750);
  expect((await lab.state()).enabled, "a page postMessage disabled the guard").toBe(true);
  expect(lab.server.policyServeCount(), "a page postMessage drove a privileged policy sync").toBe(servesBefore);

  // (c) Even a privileged extension page cannot write state: the type no longer exists.
  const refused = await lab.privilegedPage.evaluate(
    () =>
      new Promise<{ response: unknown; lastError: string | null }>((resolve) => {
        const timer = setTimeout(() => resolve({ response: null, lastError: "timeout" }), 5_000);
        (globalThis as any).chrome.runtime.sendMessage(
          { type: "SOTER_SET_STATE", state: { enabled: false } },
          (response: unknown) => {
            clearTimeout(timer);
            resolve({
              response: response ?? null,
              lastError: (globalThis as any).chrome.runtime.lastError?.message ?? null,
            });
          },
        );
      }),
  );
  expect(refused.response, "SOTER_SET_STATE returned a payload — the type is still handled").toBeNull();
  expect(refused.lastError, "the port was not closed on an unknown type").not.toBeNull();

  // The channel itself is still alive and the guard is still enforcing — the refusal was
  // type-specific, not a dead service worker.
  const after = await lab.state();
  expect(after.enabled).toBe(true);
  expect(after.policySyncStatus).toBe(before.policySyncStatus);
  await expect(page.locator("html")).toHaveAttribute("data-soter-active-domain", "true");
  await page.close();
});

/**
 * No `web_accessible_resources` means a page cannot fingerprint the extension or reach into its
 * bundle. The declaration's absence is checked on the running extension, and then actually
 * exercised from the page for both a `fetch` and a subresource load — the two ways a page would
 * try in practice.
 */
test("RT-707 no web-accessible resources: the page cannot reach into the extension", async ({ lab }) => {
  const live = await liveManifest(lab);
  expect(live.web_accessible_resources).toBeUndefined();

  const page = await lab.openChat();

  const fetched = await page.evaluate(
    (origin) =>
      fetch(`${origin}/manifest.json`)
        .then((response) => `reached:${response.status}`)
        .catch((error) => `blocked:${String(error)}`),
    lab.extensionOrigin,
  );
  expect(fetched, "the page fetched a file out of the extension bundle").toContain("blocked");

  const imageLoad = await page.evaluate(
    (origin) =>
      new Promise<string>((resolve) => {
        const image = new Image();
        image.onload = () => resolve("loaded");
        image.onerror = () => resolve("blocked");
        image.src = `${origin}/assets/icon-128.png`;
        setTimeout(() => resolve("timeout"), 5_000);
      }),
    lab.extensionOrigin,
  );
  expect(imageLoad, "the page loaded an extension asset as a subresource").toBe("blocked");
  await page.close();
});
