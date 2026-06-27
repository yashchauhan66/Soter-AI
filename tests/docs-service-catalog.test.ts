import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
