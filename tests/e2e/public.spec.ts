import { expect, test } from "@playwright/test";

test("landing page and sign-in page load", async ({ page }) => {
  await page.goto("/");
  // The soterai.in redesign replaced the homepage. The H1 is the approved copy
  // from the Phase 3 deck; if the copy is changed on purpose, change it here too.
  await expect(
    page.getByRole("heading", { level: 1, name: "Decide what your AI can see, say and do." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pick the place your team already works." }),
  ).toBeVisible();
  // The surfaces are rows of a table, not headings. Scope the lookup to that table
  // by its caption: the header menus also link to "Browser Guard" and sit in the DOM
  // while closed, so an unscoped link lookup would be ambiguous.
  const surfaces = page.getByRole("table", {
    name: "Where it runs, how mature it is, and what it does not do yet",
  });
  await expect(surfaces).toBeVisible();
  await expect(surfaces.getByRole("link", { name: "Browser Guard" })).toBeVisible();
  await expect(surfaces.getByRole("link", { name: "IDE Guard" })).toBeVisible();

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

