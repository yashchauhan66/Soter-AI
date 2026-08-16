import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const catalogPath = resolve(root, "lib/docs/services.ts");

test("service catalog API references resolve to implemented route methods", () => {
  const source = readFileSync(catalogPath, "utf8");
  const references = Array.from(
    source.matchAll(/apiEndpoint:\s*"(GET|POST|PUT|PATCH|DELETE) (\/api\/[^"?]+)(?:\?[^" ]*)?"/g),
    (match) => ({ method: match[1], path: match[2] }),
  );

  assert.ok(references.length >= 30, "expected the documented service API inventory");
  assert.doesNotMatch(source, /apiEndpoint:\s*"(?:GET|POST|PUT|PATCH|DELETE) \/api\/v1\//);

  for (const reference of references) {
    const routePath = resolve(root, `app${reference.path}/route.ts`);
    const routeSource = readFileSync(routePath, "utf8");
    assert.match(
      routeSource,
      new RegExp(`export\\s+async\\s+function\\s+${reference.method}\\s*\\(`),
      `${reference.method} ${reference.path} is not implemented by ${routePath}`,
    );
  }
});

test("unverified legacy v1 snippets are not rendered in service documentation", () => {
  const page = readFileSync(resolve(root, "app/docs/services/[id]/page.tsx"), "utf8");
  assert.match(page, /const showLegacyIntegrationExample = false/);
  assert.match(page, /showLegacyIntegrationExample && service\.integrationCode/);
});

test("every service has a focused dashboard destination that resolves", async () => {
  const { SERVICES } = await import("../lib/docs/services");
  const { SERVICE_EXPERIENCE } = await import("../lib/docs/serviceExperience");

  assert.deepEqual(
    Object.keys(SERVICE_EXPERIENCE).sort(),
    SERVICES.map((service) => service.id).sort(),
    "every documented service must have exactly one dashboard destination",
  );

  for (const [serviceId, experience] of Object.entries(SERVICE_EXPERIENCE)) {
    const pagePath = resolve(root, `app${experience.dashboardHref}/page.tsx`);
    assert.ok(existsSync(pagePath), `${serviceId} points to missing dashboard page ${pagePath}`);
  }
});

test("service related-document links resolve to public pages or service guides", async () => {
  const { SERVICES } = await import("../lib/docs/services");

  for (const service of SERVICES) {
    for (const doc of service.relatedDocs ?? []) {
      if (doc.href.startsWith("/docs/services/")) {
        const relatedId = doc.href.slice("/docs/services/".length);
        assert.ok(SERVICES.some((candidate) => candidate.id === relatedId), `${service.id} links to unknown service ${doc.href}`);
        continue;
      }

      const publicPage = resolve(root, "app", doc.href.slice(1), "page.tsx");
      assert.ok(existsSync(publicPage), `${service.id} links to missing page ${publicPage}`);
      assert.notEqual(dirname(publicPage), resolve(root, "app"), "root-page links must be explicit");
    }
  }
});
