import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

/**
 * Dashboard UI consistency invariants.
 *
 * The console is 84 pages built over many phases, which is exactly the situation
 * where visual consistency erodes silently. These tests encode the shared
 * primitives so the next page added cannot reintroduce a bespoke header, a raw
 * enum badge, or a hand-rolled colour triplet.
 */

const root = process.cwd();
const DASHBOARD_DIR = join(root, "app", "dashboard");

function dashboardPages(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        out.push({ file: relative(root, full), source: readFileSync(full, "utf8") });
      }
    }
  };

  walk(DASHBOARD_DIR);
  return out;
}

test("no dashboard page hand-rolls its own page header", () => {
  for (const page of dashboardPages()) {
    // The old duplicated pattern: an eyebrow paragraph immediately followed by an
    // h1. `PageHeader` and `FeatureGuide` own this now.
    const handRolled = /<p className="eyebrow">[\s\S]{0,200}?<h1\b/.test(page.source);
    assert.ok(
      !handRolled,
      `${page.file} renders its own eyebrow + h1. Use <PageHeader> or <FeatureGuide> so heading size and spacing stay consistent.`,
    );
  }
});

test("every dashboard page has exactly one h1", () => {
  for (const page of dashboardPages()) {
    const inlineCount = (page.source.match(/<h1\b/g) ?? []).length;
    const usesShell = /\bPageHeader\b|\bFeatureGuide\b|\bOnboardingExperience\b/.test(page.source);

    if (usesShell) {
      assert.equal(
        inlineCount,
        0,
        `${page.file} uses a header component and also renders its own <h1> — that is two page titles.`,
      );
    } else {
      assert.ok(inlineCount <= 1, `${page.file} renders ${inlineCount} <h1> elements; a page has one title.`);
    }
  }
});

test("status values render through the shared vocabulary", async () => {
  const { getStatusMeta } = await import("../lib/dashboard/status");

  // Raw enum names must never reach an operator.
  for (const value of ["ALLOW_WITH_REDACTION", "PROMPT_INJECTION_DETECTED", "COMPETITIVE_INTEL_EXTRACTION"]) {
    const { label } = getStatusMeta(value);
    assert.notEqual(label, value, `${value} is shown to users verbatim`);
    assert.doesNotMatch(label, /_/, `${label} still contains an underscore`);
    assert.doesNotMatch(label, /^[A-Z]{2,}$/, `${label} is still screaming case`);
  }

  // An unmapped value must degrade to title case, not leak the enum.
  assert.equal(getStatusMeta("SOME_NEW_STATE").label, "Some New State");
});

test("status intents map to the shared badge classes", async () => {
  const { getStatusClass } = await import("../lib/dashboard/status");
  const allowed = new Set(["badge-success", "badge-info", "badge-warning", "badge-danger", "badge-neutral"]);

  for (const value of ["ALLOW", "REDACT", "PENDING", "BLOCK", "DRAFT", "TOTALLY_UNKNOWN"]) {
    assert.ok(allowed.has(getStatusClass(value)), `${value} resolves to a non-standard badge class`);
  }
});

test("shared dashboard primitives exist and are wired to the design system", () => {
  const shell = readFileSync(join(root, "components", "dashboard", "DashboardShell.tsx"), "utf8");
  const dialog = readFileSync(join(root, "components", "ui", "Dialog.tsx"), "utf8");
  const header = readFileSync(join(root, "components", "dashboard", "PageHeader.tsx"), "utf8");
  const badge = readFileSync(join(root, "components", "dashboard", "MetricCard.tsx"), "utf8");
  const table = readFileSync(join(root, "components", "dashboard", "TableWrapper.tsx"), "utf8");

  // The sidebar must stay reachable on long pages.
  assert.match(shell, /sticky/, "the dashboard sidebar should be sticky");

  // The mobile drawer must be a real modal dialog, not a translated panel.
  //
  // This used to grep DashboardShell.tsx for the literal strings `role="dialog"`
  // and `aria-modal="true"`, which is what the hand-rolled ~40-line drawer wrote
  // by hand. That drawer was deliberately replaced by the shared Radix-backed
  // Dialog, which emits both attributes at runtime along with the focus trap,
  // Escape handling and scroll lock the hand-rolled version got wrong — so the
  // old assertion started failing precisely because the accessibility got
  // better. Assert the guarantee where it now lives: the shell renders the shared
  // Dialog, and the shared Dialog is the Radix primitive.
  assert.match(shell, /<Dialog\b/, "the mobile drawer should render the shared Dialog");
  assert.match(shell, /from "@\/components\/ui\/Dialog"/, "the drawer must use the shared Dialog primitive");
  assert.match(dialog, /@radix-ui\/react-dialog/, "the shared Dialog must be the Radix modal primitive");
  assert.match(dialog, /DialogPrimitive\.Root/, "Dialog must re-export the Radix root, not a hand-rolled overlay");

  assert.match(header, /className="eyebrow"/, "PageHeader should use the shared eyebrow class");
  assert.match(header, /heading-3/, "PageHeader should use the shared heading scale");

  // Badges must not reintroduce ad-hoc colour triplets.
  assert.doesNotMatch(badge, /bg-(red|yellow|blue)-400\/10/, "MetricCard should use semantic badge classes");
  assert.match(badge, /getStatusClass/, "StatusBadge should resolve classes from lib/dashboard/status");

  // Wide tables must be keyboard-scrollable.
  assert.match(table, /tabIndex=\{0\}/, "TableWrapper scroll region must be keyboard focusable");
  assert.match(table, /role="region"/, "TableWrapper should announce its scroll region");
});
