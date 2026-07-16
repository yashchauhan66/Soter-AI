import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function file(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("new-user dashboard has a start-here command center with next-best action", () => {
  const dashboard = file("app/dashboard/page.tsx");
  const center = file("components/dashboard/UserSuccessCommandCenter.tsx");

  assert.match(dashboard, /UserSuccessCommandCenter/);
  assert.match(center, /Start here/);
  assert.match(center, /Choose your path/);
  assert.match(center, /Recommended next step/);
  assert.match(center, /Workspace setup progress/);
  assert.match(center, /Guided checklist/);
  assert.match(center, /Get help/);
});

test("onboarding supports role-based paths and explicit next action", () => {
  const onboarding = file("app/dashboard/onboarding/page.tsx");
  const paths = file("lib/ux/activationPaths.ts");

  assert.match(onboarding, /Role-based setup paths/);
  assert.match(onboarding, /Next best action/);
  assert.match(onboarding, /Usually 2-5 minutes/);
  assert.match(onboarding, /aria-label="Onboarding completion"/);
  assert.match(paths, /Developer/);
  assert.match(paths, /Security lead/);
  assert.match(paths, /Support owner/);
  assert.match(paths, /Agency/);
});

test("integration wizard explains success criteria and common blockers", () => {
  const wizard = file("components/dashboard/IntegrationWizard.tsx");

  assert.match(wizard, /Time to value/);
  assert.match(wizard, /Success means/);
  assert.match(wizard, /Common blockers/);
  assert.match(wizard, /Putting the key in client components/);
  assert.match(wizard, /Calling the guard after the LLM/);
  assert.match(wizard, /Skipping HMAC verification/);
});

test("navigation gives beginners an obvious entry point and readable search hint", () => {
  const sidebar = file("components/dashboard/DashboardSidebar.tsx");
  const search = file("components/dashboard/FeatureSearchBar.tsx");

  assert.match(sidebar, /Start here/);
  assert.match(sidebar, /2 min/);
  assert.match(search, /Search features... \(Ctrl\+K\)/);
  assert.doesNotMatch(search, /⌘K/);
});

test("first-run copy avoids broken glyphs and keeps setup links clear", () => {
  const guide = file("components/dashboard/FirstRunGuide.tsx");

  assert.match(guide, /create a key -> send the first guarded request -> see it/);
  assert.match(guide, /Full setup checklist/);
  assert.match(guide, /Read the docs/);
  assert.match(guide, /Get help/);
  assert.doesNotMatch(guide, /â/);
});
