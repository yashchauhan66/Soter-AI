import { expect, test } from "@playwright/test";

test("key public and authenticated pages stay within a local navigation budget", async ({ page }) => {
  const timings: Record<string, number> = {};

  for (const path of ["/", "/pricing", "/docs"]) {
    const started = Date.now();
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    timings[path] = Date.now() - started;
  }

  await page.goto("/signin");
  await page.getByLabel("Email").fill(process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev");
  await page.getByLabel("Password").fill(process.env.DEMO_USER_PASSWORD ?? "demo-cyberrakshak-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const path of ["/dashboard", "/dashboard/logs", "/dashboard/reports", "/dashboard/rag", "/admin/production"]) {
    const started = Date.now();
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    timings[path] = Date.now() - started;
  }

  console.log(`REAL_USER_NAVIGATION_TIMINGS=${JSON.stringify(timings)}`);
  for (const [path, durationMs] of Object.entries(timings)) {
    expect(durationMs, `${path} local navigation`).toBeLessThan(15_000);
  }
});
