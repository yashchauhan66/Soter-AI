import { expect, test } from "@playwright/test";

test("new user can sign up and reach onboarding in mock-email mode", async ({ page }) => {
  test.skip(process.env.E2E_TEST_MOCK_EMAIL !== "true", "Production E2E requires an authorized real email provider; mock email is tested separately in development mode.");
  const suffix = Date.now().toString(36);
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("E2E New User");
  await page.getByLabel("Email").fill(`e2e.signup.${suffix}@example.test`);
  await page.getByLabel("Password").fill("E2E-safe-password-2026");
  await page.getByLabel("Workspace name").fill(`E2E Signup ${suffix}`);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Get to a protected chatbot" })).toBeVisible();
});
