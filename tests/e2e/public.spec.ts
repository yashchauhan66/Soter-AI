import { expect, test } from "@playwright/test";

test("landing page and sign-in page load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Secure your AI chatbot from hidden risk." })).toBeVisible();
  await expect(page.getByRole("link", { name: "CyberRakshak Guard" })).toBeVisible();

  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
