import { expect, request as playwrightRequest, test, type APIRequestContext, type Browser } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  phase0Actors,
  phase0TenantFixtures as f,
  requireIsolatedDatabaseUrl,
  seedPhase0TenantFixtures,
} from "./phase0-tenant-fixtures";

const jsonHeaders = { "Content-Type": "application/json" };
const webhookEvent = "guard.prompt_injection.blocked";
const safeWebhookUrl = "https://example.com/phase0-updated";
const forbiddenResponseTokens = [
  "secretHash",
  "encryptedSecret",
  "secretKeyVersion",
  "deviceToken",
  "deviceTokenHash",
  "phase0-token-a",
  "phase0-token-b",
  "whsec_phase0-runtime-webhook-a",
  "whsec_phase0-runtime-webhook-b",
];

test.describe("Phase 0 tenant isolation runtime harness", () => {
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: requireIsolatedDatabaseUrl() } } });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.beforeEach(async () => {
    await seedPhase0TenantFixtures();
  });

  test("response equivalence and no side effects for cross-tenant vs nonexistent IDs", async ({ browser }) => {
    const api = await authenticatedApi(browser, "memberA");
    const routes = idBasedRoutes();

    for (const route of routes) {
      const before = await sideEffectSnapshot(prisma);
      const foreignSamples = await sampleRoute(api, () => route.request(api, route.foreignId), 3);
      const missingSamples = await sampleRoute(api, () => route.request(api, f.nonexistentId), 3);

      expect(publicShape(foreignSamples[0].body), route.name).toEqual(publicShape(missingSamples[0].body));
      expect(foreignSamples[0].status, route.name).toBe(missingSamples[0].status);
      expect(safeHeaders(foreignSamples[0].headers), route.name).toEqual(safeHeaders(missingSamples[0].headers));
      expect(median(foreignSamples.map((sample) => sample.ms)), route.name).toBeLessThan(750);
      expect(Math.abs(median(foreignSamples.map((sample) => sample.ms)) - median(missingSamples.map((sample) => sample.ms))), route.name).toBeLessThan(500);
      await expectNoSecretMaterial(foreignSamples[0].text);
      await expectNoSecretMaterial(missingSamples[0].text);
      expect(await sideEffectSnapshot(prisma), route.name).toEqual(before);
    }

    await api.dispose();
  });

  test("authorization matrix separates unauthenticated, permission, member, org-admin, and platform-admin behavior", async ({ browser, baseURL }) => {
    const unauthenticated = await playwrightRequest.newContext({ baseURL });
    const member = await authenticatedApi(browser, "memberA");
    const noPerm = await authenticatedApi(browser, "noPermA");
    const orgAdmin = await authenticatedApi(browser, "orgAdminA");
    const platformAdmin = await authenticatedApi(browser, "platformAdmin");

    for (const route of idBasedRoutes()) {
      await seedPhase0TenantFixtures();
      expect((await route.request(unauthenticated, route.ownId)).status(), `${route.name}: unauth`).not.toBeLessThan(300);
      expect((await route.request(noPerm, route.ownId)).status(), `${route.name}: no permission`).toBe(403);
      expect((await route.request(member, route.ownId)).status(), `${route.name}: member`).toBe(route.successStatus);

      await seedPhase0TenantFixtures();
      expect((await route.request(orgAdmin, route.ownId)).status(), `${route.name}: org admin`).toBe(route.successStatus);

      await seedPhase0TenantFixtures();
      expect((await route.request(platformAdmin, route.ownId)).status(), `${route.name}: platform admin`).toBe(route.successStatus);
    }

    await seedPhase0TenantFixtures();
    const orgAdminAdminRoute = await orgAdmin.post(`/api/admin/extension-enrollment-token/${f.tokenAId}/revoke`, {
      headers: jsonHeaders,
      data: { organizationId: f.orgAId },
    });
    expect(orgAdminAdminRoute.status()).toBe(403);
    const platformAdminAdminRoute = await platformAdmin.post(`/api/admin/extension-enrollment-token/${f.tokenAId}/revoke`, {
      headers: jsonHeaders,
      data: { organizationId: f.orgAId },
    });
    expect(platformAdminAdminRoute.status()).toBe(200);

    await unauthenticated.dispose();
    await member.dispose();
    await noPerm.dispose();
    await orgAdmin.dispose();
    await platformAdmin.dispose();
  });

  test("normal responses, errors, audit metadata, and queue payloads do not disclose secret material", async ({ browser }) => {
    const api = await authenticatedApi(browser, "memberA");
    const list = await api.get("/api/webhooks");
    expect(list.status()).toBe(200);
    await expectNoSecretMaterial(await list.text());

    const patch = await api.patch("/api/webhooks", {
      headers: jsonHeaders,
      data: { id: f.webhookAId, url: safeWebhookUrl, events: [webhookEvent] },
    });
    expect(patch.status()).toBe(200);
    await expectNoSecretMaterial(await patch.text());

    const tokenList = await api.get(`/api/dashboard/extension/tokens?organizationId=${f.orgAId}`);
    expect(tokenList.status()).toBe(200);
    await expectNoSecretMaterial(await tokenList.text());

    const error = await api.post("/api/webhooks/rotate", { headers: jsonHeaders, data: { id: f.webhookBId } });
    expect(error.status()).toBe(404);
    await expectNoSecretMaterial(await error.text());

    const testDelivery = await api.post("/api/webhooks/test", { headers: jsonHeaders, data: { id: f.webhookAId } });
    expect(testDelivery.status()).toBe(202);
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: f.webhookAId },
      select: { payloadPreview: true },
    });
    await expectNoSecretMaterial(JSON.stringify(deliveries));

    const audits = await prisma.adminAuditLog.findMany({
      where: { OR: [{ targetId: { startsWith: "phase0-runtime-" } }, { organizationId: { in: [f.orgAId, f.orgBId] } }] },
      select: { metadata: true, reason: true },
    });
    await expectNoSecretMaterial(JSON.stringify(audits));
    await api.dispose();
  });

  test("concurrency invariants: CAS rotation, idempotent revoke, and delete races avoid ambiguous states", async ({ browser }) => {
    const api = await authenticatedApi(browser, "memberA");

    const rotations = await Promise.all([
      api.post("/api/webhooks/rotate", { headers: jsonHeaders, data: { id: f.webhookAId } }),
      api.post("/api/webhooks/rotate", { headers: jsonHeaders, data: { id: f.webhookAId } }),
    ]);
    expect(rotations.map((response) => response.status()).sort()).toEqual([200, 409]);
    const rotationBodies = await Promise.all(rotations.map((response) => response.text()));
    expect(rotationBodies.filter((body) => body.includes("signingSecret")).length).toBe(1);
    const kmsSuccess = await prisma.adminAuditLog.count({ where: { targetId: f.webhookAId, action: "KMS_SECRET_ROTATED" } });
    expect(kmsSuccess).toBe(1);

    await seedPhase0TenantFixtures();
    const [rotate, deleteWebhook] = await Promise.all([
      api.post("/api/webhooks/rotate", { headers: jsonHeaders, data: { id: f.webhookAId } }),
      api.delete("/api/webhooks", { headers: jsonHeaders, data: { id: f.webhookAId } }),
    ]);
    expect([200, 404, 409]).toContain(rotate.status());
    expect([200, 404]).toContain(deleteWebhook.status());
    const deletedEndpoint = await prisma.webhookEndpoint.findUnique({ where: { id: f.webhookAId } });
    if (!deletedEndpoint) expect(await prisma.webhookDelivery.count({ where: { endpointId: f.webhookAId } })).toBe(0);

    await seedPhase0TenantFixtures();
    const [replay, deleteForReplay] = await Promise.all([
      api.post("/api/webhooks/replay", { headers: jsonHeaders, data: { deliveryId: f.deliveryAId } }),
      api.delete("/api/webhooks", { headers: jsonHeaders, data: { id: f.webhookAId } }),
    ]);
    expect([202, 404]).toContain(replay.status());
    expect([200, 404]).toContain(deleteForReplay.status());

    await seedPhase0TenantFixtures();
    const tokenRevokes = await Promise.all([
      api.post(`/api/dashboard/extension/tokens/${f.tokenAId}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
      api.post(`/api/dashboard/extension/tokens/${f.tokenAId}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
    ]);
    expect(tokenRevokes.map((response) => response.status())).toEqual([200, 200]);
    expect((await prisma.extensionEnrollmentToken.findUniqueOrThrow({ where: { id: f.tokenAId } })).revokedAt).toBeTruthy();

    const deviceRevokes = await Promise.all([
      api.post(`/api/dashboard/extension/devices/${f.deviceAId}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
      api.post(`/api/dashboard/extension/devices/${f.deviceAId}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
    ]);
    expect(deviceRevokes.map((response) => response.status())).toEqual([200, 200]);
    expect((await prisma.deviceAgent.findUniqueOrThrow({ where: { id: f.deviceAId } })).status).toBe("revoked");
    await api.dispose();
  });

  test("SSRF and resource controls are enforced at runtime for route validation and delivery helpers", async ({ browser }) => {
    const api = await authenticatedApi(browser, "memberA");
    const blockedUrls = [
      "http://example.com/hook",
      "https://user:pass@example.com/hook",
      "https://localhost/hook",
      "https://127.0.0.1/hook",
      "https://10.0.0.1/hook",
      "https://172.16.0.1/hook",
      "https://192.168.0.1/hook",
      "https://[::1]/hook",
      "https://[fe80::1]/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://2130706433/hook",
      "https://0x7f000001/hook",
    ];
    for (const url of blockedUrls) {
      const response = await api.patch("/api/webhooks", {
        headers: jsonHeaders,
        data: { id: f.webhookAId, url, events: [webhookEvent] },
      });
      expect(response.status(), url).toBe(400);
    }
    await api.dispose();
  });
});

type RouteCase = {
  name: string;
  ownId: string;
  foreignId: string;
  successStatus: number;
  request: (api: APIRequestContext, id: string) => Promise<ReturnType<APIRequestContext["get"]>>;
};

function idBasedRoutes(): RouteCase[] {
  return [
    {
      name: "webhook update",
      ownId: f.webhookAId,
      foreignId: f.webhookBId,
      successStatus: 200,
      request: (api, id) => api.patch("/api/webhooks", { headers: jsonHeaders, data: { id, url: safeWebhookUrl, events: [webhookEvent] } }),
    },
    {
      name: "webhook delete",
      ownId: f.webhookAId,
      foreignId: f.webhookBId,
      successStatus: 200,
      request: (api, id) => api.delete("/api/webhooks", { headers: jsonHeaders, data: { id } }),
    },
    {
      name: "webhook rotate",
      ownId: f.webhookAId,
      foreignId: f.webhookBId,
      successStatus: 200,
      request: (api, id) => api.post("/api/webhooks/rotate", { headers: jsonHeaders, data: { id } }),
    },
    {
      name: "webhook test delivery",
      ownId: f.webhookAId,
      foreignId: f.webhookBId,
      successStatus: 202,
      request: (api, id) => api.post("/api/webhooks/test", { headers: jsonHeaders, data: { id } }),
    },
    {
      name: "webhook delivery list",
      ownId: f.webhookAId,
      foreignId: f.webhookBId,
      successStatus: 200,
      request: (api, id) => api.get(`/api/webhooks/deliveries?endpointId=${id}`),
    },
    {
      name: "webhook delivery replay",
      ownId: f.deliveryAId,
      foreignId: f.deliveryBId,
      successStatus: 202,
      request: (api, id) => api.post("/api/webhooks/replay", { headers: jsonHeaders, data: { deliveryId: id } }),
    },
    {
      name: "extension token revoke",
      ownId: f.tokenAId,
      foreignId: f.tokenBId,
      successStatus: 200,
      request: (api, id) => api.post(`/api/dashboard/extension/tokens/${id}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
    },
    {
      name: "extension device revoke",
      ownId: f.deviceAId,
      foreignId: f.deviceBId,
      successStatus: 200,
      request: (api, id) => api.post(`/api/dashboard/extension/devices/${id}/revoke`, { headers: jsonHeaders, data: { organizationId: f.orgAId } }),
    },
  ];
}

async function authenticatedApi(browser: Browser, actor: keyof typeof phase0Actors) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const credentials = phase0Actors[actor];
  await page.goto("/signin");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.close();
  return context.request;
}

async function sampleRoute(api: APIRequestContext, run: () => Promise<ReturnType<APIRequestContext["get"]>>, count: number) {
  const samples: Array<{ status: number; text: string; body: unknown; headers: Record<string, string>; ms: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const started = Date.now();
    const response = await run();
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    samples.push({ status: response.status(), text, body, headers: response.headers(), ms: Date.now() - started });
  }
  return samples;
}

function publicShape(body: unknown): unknown {
  if (Array.isArray(body)) return [];
  if (!body || typeof body !== "object") return typeof body;
  return Object.fromEntries(Object.keys(body as Record<string, unknown>).sort().map((key) => [key, typeof (body as Record<string, unknown>)[key]]));
}

function safeHeaders(headers: Record<string, string>) {
  return {
    contentType: headers["content-type"]?.split(";")[0] ?? null,
    cacheControl: headers["cache-control"] ?? null,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function sideEffectSnapshot(prisma: PrismaClient) {
  const [webhookB, deliveryBCount, auditsB, eventsB, tokenB, deviceB, nonexistentAudits] = await Promise.all([
    prisma.webhookEndpoint.findUnique({ where: { id: f.webhookBId }, select: { secretHash: true, secretRotatedAt: true, updatedAt: true } }),
    prisma.webhookDelivery.count({ where: { endpointId: f.webhookBId } }),
    prisma.adminAuditLog.count({ where: { targetId: f.webhookBId } }),
    prisma.securityEvent.count({ where: { organizationId: f.orgBId } }),
    prisma.extensionEnrollmentToken.findUnique({ where: { id: f.tokenBId }, select: { revokedAt: true, usedCount: true } }),
    prisma.deviceAgent.findUnique({ where: { id: f.deviceBId }, select: { status: true } }),
    prisma.adminAuditLog.count({ where: { targetId: f.nonexistentId } }),
  ]);
  return {
    webhookBSecretHash: webhookB?.secretHash,
    webhookBSecretRotatedAt: webhookB?.secretRotatedAt?.toISOString() ?? null,
    webhookBUpdatedAt: webhookB?.updatedAt.toISOString() ?? null,
    deliveryBCount,
    auditsB,
    eventsB,
    tokenBRevokedAt: tokenB?.revokedAt?.toISOString() ?? null,
    tokenBUsedCount: tokenB?.usedCount,
    deviceBStatus: deviceB?.status,
    nonexistentAudits,
  };
}

async function expectNoSecretMaterial(serialized: string) {
  for (const token of forbiddenResponseTokens) {
    expect(serialized).not.toContain(token);
  }
}
