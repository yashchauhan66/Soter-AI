import { expect, test } from "@playwright/test";

test("landing page and sign-in page load", async ({ page }) => {
  await page.goto("/");
  // Substring, not the full string: the em-dash in heroCopy.headline has changed
  // twice, and this assertion was silently stale against the served page both
  // times. Matching the stable tail can't drift.
  await expect(
    page.getByRole("heading", { name: "before they become incidents" }),
  ).toBeVisible();
  // The redesign moved the two extension cards into the Surfaces grid, where the
  // tiles are named "Browser Guard" / "IDE Guard" (no "SoterAI" prefix) under the
  // section heading below.
  await expect(
    page.getByRole("heading", { name: "Install it where your team already uses AI" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser Guard" })).toBeVisible();

  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  // Not getByLabel("Email"): the SiteFooter support link is aria-labelled
  // "Email SoterAI support", which substring-matches and resolves to two elements
  // — a strict-mode violation on any page that renders the footer. The form's
  // own ids are unambiguous (same reason audit-rendered-contrast.mjs signs in
  // through #email/#password).
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

