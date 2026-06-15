import { expect, test } from "@playwright/test";
import { authorizationFixtures } from "./authorization-fixtures";

test("admin denial, RBAC enforcement, and tenant isolation", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(authorizationFixtures.viewerEmail);
  await page.getByLabel("Password").fill(authorizationFixtures.viewerPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Guard operations" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin only" })).toBeVisible();
  await expect(page.getByText("Internal admin", { exact: false })).toHaveCount(0);

  const projectsResponse = await page.request.get("/api/projects");
  expect(projectsResponse.status()).toBe(200);
  const projects = await projectsResponse.json() as Array<{ id: string }>;
  expect(projects.map((project) => project.id)).toContain(authorizationFixtures.viewerProjectId);
  expect(projects.map((project) => project.id)).not.toContain(authorizationFixtures.foreignProjectId);

  const ownPrivilegedResponse = await page.request.get(
    `/api/projects/policy?projectId=${authorizationFixtures.viewerProjectId}`,
  );
  expect(ownPrivilegedResponse.status()).toBe(403);
  await expect(ownPrivilegedResponse.json()).resolves.toMatchObject({
    error: true,
    message: "Missing permission: policy:manage",
  });

  const foreignProjectResponse = await page.request.get(
    `/api/projects/policy?projectId=${authorizationFixtures.foreignProjectId}`,
  );
  expect(foreignProjectResponse.status()).toBe(403);
  await expect(foreignProjectResponse.json()).resolves.toMatchObject({
    error: true,
    message: "You do not have access to this organization.",
  });
});
