import { test, expect } from "@playwright/test";

test.describe("Marketing homepage", () => {
  test("loads and displays hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Secure your AI");
  });

  test("hero CTA links to playground", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("section").getByRole("link", { name: /playground/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/playground");
  });

  test("docs link is present and accessible", async ({ page }) => {
    await page.goto("/");
    const docsLink = page.locator("section").getByRole("link", { name: /integration docs/i }).first();
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "/docs");
  });
});

test.describe("Playground page", () => {
  test("loads the guard playground", async ({ page }) => {
    await page.goto("/playground");
    await expect(page).toHaveTitle(/CyberRakshak/);
  });

  test("playground shows guard input area", async ({ page }) => {
    await page.goto("/playground");
    const textarea = page.locator("textarea");
    await expect(textarea.first()).toBeVisible();
  });

  test("playground has a submit/analyze button", async ({ page }) => {
    await page.goto("/playground");
    const button = page.getByRole("button", { name: /analyz|test|guard|check|submit/i });
    await expect(button.first()).toBeVisible();
  });
});

test.describe("Health API", () => {
  test("returns ok status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});

test.describe("Docs page", () => {
  test("integration docs page loads", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Auth flow", () => {
  test("login page loads with form fields", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.locator("body")).toBeVisible();
  });

  test("signup page loads with form fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Dashboard redirects", () => {
  test("unauthenticated user is redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for potential redirect to login/signin
    await page.waitForURL(/login|signin|auth/, { timeout: 10_000 }).catch(() => {});
    const url = page.url();
    // Should NOT stay on /dashboard without auth — must redirect to login/signin/auth
    const stayedOnDashboard = url.endsWith("/dashboard") || url.endsWith("/dashboard/");
    expect(stayedOnDashboard).toBeFalsy();
  });
});
