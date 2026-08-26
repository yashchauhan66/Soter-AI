import { expect, test } from "@playwright/test";

test("landing page and sign-in page load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Stop sensitive company data and risky AI-agent actions before they reach external AI systems.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "SoterAI Browser Guard" })).toBeVisible();

  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
