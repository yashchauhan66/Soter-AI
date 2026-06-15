import { expect, test } from "@playwright/test";

test("public and protected API routes enforce validation and authentication", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({ status: "ok", database: "reachable" });

  const safe = await request.post("/api/guard/analyze", {
    data: { text: "Summarize this support policy.", direction: "INPUT" },
  });
  expect(safe.status()).toBe(200);
  const safeResult = await safe.json() as Record<string, unknown>;
  expect(safeResult.action).toBe("ALLOW");
  expect(safeResult).not.toHaveProperty("originalText");

  const invalid = await request.post("/api/guard/analyze", { data: { text: "" } });
  expect(invalid.status()).toBe(400);

  const noKey = await request.post("/api/guard/input", { data: { message: "hello" } });
  expect(noKey.status()).toBe(401);

  const projects = await request.get("/api/projects");
  expect(projects.status()).toBe(401);

  const admin = await request.post("/api/admin/actions", { data: { action: "noop" } });
  expect(admin.status()).toBe(401);
});
