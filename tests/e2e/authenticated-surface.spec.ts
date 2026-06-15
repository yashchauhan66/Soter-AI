import { expect, test } from "@playwright/test";

test.describe.serial("Authenticated surface smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev");
    await page.getByLabel("Password").fill(process.env.DEMO_USER_PASSWORD ?? "demo-cyberrakshak-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("agency, billing, enterprise, RAG, and report surfaces render without error", async ({ page }) => {
    const surfaces = [
      "/dashboard/agency",
      "/dashboard/billing",
      "/dashboard/enterprise/data-retention",
      "/dashboard/enterprise/audit",
      "/dashboard/security/supply-chain",
      "/dashboard/agent-firewall",
      "/dashboard/privacy",
      "/dashboard/rag/security",
    ];
    for (const path of surfaces) {
      const response = await page.goto(path);
      expect(response, `${path} navigation`).toBeTruthy();
      const status = response!.status();
      expect(status, `${path} status`).toBeLessThan(500);
      const body = await page.content();
      expect(body, `${path} body length`).not.toEqual("");
    }
  });
});
