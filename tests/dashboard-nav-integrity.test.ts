import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Guards the user-friendliness fixes from the enterprise-GA pass:
// 1. Every /dashboard/* link in the sidebar resolves to a real page (no dead links
//    that dump the user into the error boundary / default 404).
// 2. The onboarding SDK install command names the real published package.
// 3. A branded not-found page exists (no unstyled default 404).

const ROOT = join(__dirname, "..");

test("no dead /dashboard links in the sidebar", () => {
  const sidebar = readFileSync(join(ROOT, "components/dashboard/DashboardSidebar.tsx"), "utf8");
  const hrefs = [...sidebar.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]);
  const dashboardHrefs = hrefs.filter((h) => h.startsWith("/dashboard"));
  assert.ok(dashboardHrefs.length > 10, "expected many dashboard links to check");

  const dead: string[] = [];
  for (const href of dashboardHrefs) {
    // strip query/hash
    const clean = href.split(/[?#]/)[0];
    const base = join(ROOT, "app", clean);
    if (!existsSync(join(base, "page.tsx")) && !existsSync(`${base}.tsx`)) {
      dead.push(href);
    }
  }
  assert.deepEqual(dead, [], `dead sidebar links (no page.tsx): ${dead.join(", ")}`);
});

test("onboarding SDK install names the real published package", () => {
  const onboarding = readFileSync(join(ROOT, "lib/onboarding.ts"), "utf8");
  assert.doesNotMatch(onboarding, /@cyberrakshak\/guard/, "stale/wrong package name must not appear");
  assert.match(onboarding, /@soterai\//, "must reference the real @soterai scope");
});

test("branded 404 page exists", () => {
  assert.ok(existsSync(join(ROOT, "app/not-found.tsx")), "app/not-found.tsx must exist for a branded 404");
});
