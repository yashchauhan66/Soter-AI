import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionState } from "../apps/extension/src/lib/types";
import { EXTENSION_STATE_KEY } from "../packages/shared/src/constants";

type MessageListener = (message: unknown, sender: { tab?: { id?: number }; url?: string }, sendResponse: (response: unknown) => void) => boolean | void;

const repoRoot = resolve(import.meta.dirname, "..");
const extensionDist = resolve(repoRoot, "apps", "extension", "dist", "extension");
const storage = new Map<string, unknown>();
const messageListeners: MessageListener[] = [];
const installedListeners: Array<() => void> = [];
const alarmListeners: Array<(alarm: { name: string }) => void> = [];
const createdAlarms: Array<{ name: string; details: Record<string, unknown> }> = [];
const apiCalls: Array<{ path: string; method: string; body?: unknown; token?: string }> = [];
const apiBaseUrl = "https://extension-runtime.soterai.test";
const rawSecret = "api_key = soter_live_abcdefghijklmnop123456";

function installChromeShim() {
  (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
    storage: {
      local: {
        async get(keys: string[]) {
          return Object.fromEntries(keys.map((key) => [key, storage.get(key)]));
        },
        async set(items: Record<string, unknown>) {
          for (const [key, value] of Object.entries(items)) storage.set(key, value);
        },
        remove(keys: string[]) {
          for (const key of keys) storage.delete(key);
        },
      },
      managed: {
        get(_keys: string | string[] | null, callback: (result: Record<string, unknown>) => void) {
          callback({});
        },
      },
    },
    runtime: {
      onInstalled: {
        addListener(listener: () => void) {
          installedListeners.push(listener);
        },
      },
      onMessage: {
        addListener(listener: MessageListener) {
          messageListeners.push(listener);
        },
      },
      sendMessage(message: unknown, callback?: (response: unknown) => void) {
        void dispatchRuntimeMessage(message).then((response) => callback?.(response));
      },
      lastError: undefined,
    },
    alarms: {
      create(name: string, details: Record<string, unknown>) {
        createdAlarms.push({ name, details });
      },
      onAlarm: {
        addListener(listener: (alarm: { name: string }) => void) {
          alarmListeners.push(listener);
        },
      },
    },
    contextMenus: {
      removeAll(callback: () => void) {
        callback();
      },
      create() {},
      onClicked: { addListener() {} },
    },
    sidePanel: {
      async open() {},
    },
  };

  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "Mozilla/5.0 Chrome/126.0 Safari/537.36" },
    configurable: true,
  });
}

function installFetchMock(policy: NonNullable<ExtensionState["policy"]>) {
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const bodyText = typeof init?.body === "string" ? init.body : input instanceof Request ? await input.text().catch(() => "") : "";
    const body = bodyText ? JSON.parse(bodyText) as unknown : undefined;
    const token = (init?.headers as Record<string, string> | undefined)?.["x-soter-extension-token"];
    apiCalls.push({ path: url.pathname, method, body, token });

    if (url.pathname === "/api/extension/enroll") {
      assert.equal((body as { enrollmentCode?: string }).enrollmentCode, "soter_enroll_runtime_smoke");
      return jsonResponse({
        apiBaseUrl,
        organizationId: "org_extension_runtime",
        organizationName: "Runtime Smoke Org",
        employeeId: "employee_runtime_1",
        employeeEmail: "analyst@example.com",
        department: "Security",
        role: "Analyst",
        deviceToken: "soter_device_runtime_secret",
      });
    }
    if (url.pathname === "/api/extension/policy") return jsonResponse(policy);
    if (url.pathname === "/api/extension/destinations") return jsonResponse({ destinations: policy.destinations ?? [] });
    if (url.pathname === "/api/extension/fingerprint-bundle") return jsonResponse({ fingerprintBundle: [] });
    if (url.pathname === "/api/extension/heartbeat") return jsonResponse({ ok: true, shortPollingSeconds: 120 });
    if (["/api/extension/audit-log", "/api/extension/scan", "/api/extension/lineage-event"].includes(url.pathname)) return jsonResponse({ ok: true });
    throw new Error(`Unexpected extension API call: ${method} ${url.pathname}`);
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function dispatchRuntimeMessage(message: unknown, sender: { tab?: { id?: number }; url?: string } = {}) {
  for (const listener of messageListeners) {
    const response = await new Promise<unknown>((resolve) => {
      const maybeAsync = listener(message, sender, resolve);
      if (!maybeAsync) resolve(undefined);
    });
    if (response !== undefined) return response;
  }
  return undefined;
}

function assertBuiltExtension() {
  const manifestPath = resolve(extensionDist, "manifest.json");
  assert.equal(existsSync(manifestPath), true, "extension must be built before runtime smoke");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    background: { service_worker: string };
    action: { default_popup: string; default_icon: Record<string, string> };
    side_panel: { default_path: string };
    content_scripts: Array<{ js?: string[]; css?: string[] }>;
    icons: Record<string, string>;
  };
  const referencedFiles = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.side_panel.default_path,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((entry) => [...(entry.js ?? []), ...(entry.css ?? [])]),
  ];
  for (const file of referencedFiles) {
    assert.equal(existsSync(resolve(extensionDist, file)), true, `missing built extension file: ${file}`);
  }
}

function assertNoRawSecretInBackendCalls() {
  for (const call of apiCalls) {
    assert.equal(JSON.stringify(call.body ?? {}).includes(rawSecret), false, `${call.path} leaked raw prompt`);
    assert.equal(JSON.stringify(call.body ?? {}).includes("soter_live_abcdefghijklmnop123456"), false, `${call.path} leaked raw API key value`);
  }
}

async function main() {
  assertBuiltExtension();
  installChromeShim();

  const { defaultState, getState } = await import("../apps/extension/src/lib/storage");
  const runtimePolicy = {
    ...defaultState.policy!,
    organizationId: "org_extension_runtime",
    version: "runtime-browser-policy-1",
    updatedAt: "2026-07-26T15:15:00.000Z",
    destinations: defaultState.policy!.destinations?.map((destination) => ({
      ...destination,
      organizationId: "org_extension_runtime",
    })),
  };
  installFetchMock(runtimePolicy);

  await import("../apps/extension/src/background/service-worker");
  assert.ok(messageListeners.length >= 1, "service worker must register a runtime message listener");
  for (const listener of installedListeners) listener();
  assert.ok(createdAlarms.some((alarm) => alarm.name === "soter-heartbeat"));

  const enrollResponse = await dispatchRuntimeMessage({
    type: "SOTER_ENROLL",
    apiBaseUrl,
    enrollmentCode: "soter_enroll_runtime_smoke",
  }) as { ok?: boolean; state?: ExtensionState };
  assert.equal(enrollResponse.ok, true);
  assert.equal(enrollResponse.state?.enrollmentStatus, "enrolled");
  assert.equal(enrollResponse.state?.config.organizationId, "org_extension_runtime");
  assert.equal(enrollResponse.state?.config.deviceToken, "soter_device_runtime_secret");
  assert.equal(enrollResponse.state?.policySyncStatus, "fresh");
  assert.equal(enrollResponse.state?.policy?.version, "runtime-browser-policy-1");

  const stateResponse = await dispatchRuntimeMessage({ type: "SOTER_GET_STATE" }) as { ok?: boolean; state?: ExtensionState };
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state?.enrollmentMode, "self_service");

  const destinationResponse = await dispatchRuntimeMessage({
    type: "SOTER_GET_DESTINATION_CONTEXT",
    url: "https://chatgpt.com/",
  }) as { active?: boolean; employeeId?: string; destination?: { destinationId?: string } };
  assert.equal(destinationResponse.active, true);
  assert.equal(destinationResponse.employeeId, "employee_runtime_1");
  assert.equal(destinationResponse.destination?.destinationId, "chatgpt");

  const untrustedResponse = await dispatchRuntimeMessage(
    { type: "SOTER_SCAN_TEXT", text: rawSecret, url: "https://chatgpt.com/", eventType: "submit" },
    { tab: { id: 99 }, url: "https://evil.example/" },
  ) as { ok?: boolean; message?: string };
  assert.deepEqual(untrustedResponse, { ok: false, message: "Untrusted sender." });

  const scanResponse = await dispatchRuntimeMessage({
    type: "SOTER_SCAN_TEXT",
    text: rawSecret,
    url: "https://chatgpt.com/",
    eventType: "submit",
    lineageContext: {
      sourceDomain: "github.com",
      sourceApp: "GitHub",
      sourceCategory: "code_repo",
      sourceUrlHash: "sha256:source-url",
      sourceTitle: "Secret config",
      selectedTextHash: "sha256:selected-text",
      detectedDataTypes: ["source_code"],
      createdAt: "2026-07-26T15:16:00.000Z",
      expiresAt: "2026-07-26T15:21:00.000Z",
    },
  }, { tab: { id: 7 }, url: "https://chatgpt.com/" }) as { ok?: boolean; result?: { action: string; hasFindings: boolean; detectedDataTypes: string[]; redactedText: string } };
  assert.equal(scanResponse.ok, true);
  assert.equal(scanResponse.result?.action, "block");
  assert.equal(scanResponse.result?.hasFindings, true);
  assert.ok(scanResponse.result?.detectedDataTypes.includes("api_key"));
  assert.match(scanResponse.result?.redactedText ?? "", /\[REDACTED_(?:SECRET|API_KEY)\]/);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(apiCalls.some((call) => call.path === "/api/extension/audit-log"));
  assert.ok(apiCalls.some((call) => call.path === "/api/extension/scan"));
  assert.ok(apiCalls.some((call) => call.path === "/api/extension/lineage-event"));
  assertNoRawSecretInBackendCalls();

  const stored = storage.get(EXTENSION_STATE_KEY) as ExtensionState | undefined;
  assert.equal(stored?.latestScan?.action, "block");
  assert.equal(JSON.stringify(stored?.latestScan ?? {}).includes("soter_live_abcdefghijklmnop123456"), false);

  const finalState = await getState();
  assert.equal(finalState.lastHeartbeatAt !== undefined, true);
  assert.ok(apiCalls.some((call) => call.path === "/api/extension/heartbeat" && call.token === "soter_device_runtime_secret"));

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "Built extension manifest references are present",
      "Service worker registers runtime, install and alarm handlers",
      "Self-service enrollment stores organization/device state and syncs policy",
      "Destination context activates ChatGPT for enrolled employee",
      "Untrusted content-script sender is rejected",
      "Protected prompt is blocked and redacted through runtime message flow",
      "Audit, scan and lineage backend calls avoid raw prompt/API-key leakage",
      "Heartbeat uses enrolled device credential",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
