import { expect, test } from "@playwright/test";

test("public badge exposes only allowlisted status fields", async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.goto("/signin");
  await page.getByLabel("Email").fill(process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev");
  await page.getByLabel("Password").fill(process.env.DEMO_USER_PASSWORD ?? "demo-cyberrakshak-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const created = await page.request.post("/api/projects", {
    data: { name: `E2E Badge ${suffix}`, publicName: `Public Badge ${suffix}` },
  });
  expect(created.status()).toBe(201);
  const project = await created.json() as { id: string; badgeSlug: string };

  const enabled = await page.request.patch("/api/projects/badge", {
    data: { id: project.id, badgeEnabled: true },
  });
  expect(enabled.status()).toBe(200);

  const badge = await page.request.get(`/api/badge/${encodeURIComponent(project.badgeSlug)}`);
  expect(badge.status()).toBe(200);
  const payload = await badge.json() as Record<string, unknown>;
  expect(Object.keys(payload).sort()).toEqual([
    "alignment",
    "brandColor",
    "lastActivity",
    "message",
    "monitoringActive",
    "monthRequestsScanned",
    "monthRisksBlocked",
    "slug",
    "status",
  ]);
  for (const privateField of ["id", "projectId", "organizationId", "name", "publicName", "apiKey", "secret", "originalText"]) {
    expect(payload).not.toHaveProperty(privateField);
  }
});
