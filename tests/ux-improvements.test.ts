/**
 * UX Improvements Test Suite — SoterAI Guard v0.2.0
 *
 * Validates user-facing quality improvements.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function file(path: string): string {
  try {
    return readFileSync(join(ROOT, path), "utf8");
  } catch {
    return "";
  }
}

describe("UX — Loading Skeletons", () => {
  const routes = [
    "app/dashboard/loading.tsx",
    "app/dashboard/projects/loading.tsx",
    "app/dashboard/integrations/loading.tsx",
    "app/dashboard/audit/loading.tsx",
    "app/dashboard/api-keys/loading.tsx",
    "app/dashboard/projects/[id]/loading.tsx",
    "app/dashboard/billing/loading.tsx",
    "app/dashboard/enterprise/loading.tsx",
    "app/dashboard/settings/loading.tsx",
    "app/dashboard/credentials/loading.tsx",
    "app/dashboard/reports/loading.tsx",
    "app/dashboard/logs/loading.tsx",
    "app/dashboard/agent-control/loading.tsx",
    "app/dashboard/agent-firewall/loading.tsx",
    "app/dashboard/agent-passports/loading.tsx",
    "app/dashboard/onboarding/loading.tsx",
    "app/dashboard/usage-governance/loading.tsx",
    "app/dashboard/canary-network/loading.tsx",
    "app/dashboard/escrow/loading.tsx",
    "app/dashboard/paid-pilot-features/loading.tsx",
  ];

  routes.forEach((route) => {
    it(`${route} exists with skeleton animation`, () => {
      const src = file(route);
      assert.ok(src.length > 50, `${route} should exist`);
      const hasAnimation = src.includes("animate-pulse") || src.includes("animate-shimmer") || src.includes("Skeleton");
      assert.ok(hasAnimation, `${route} should use skeleton animation`);
    });
  });
});

describe("UX — Error Boundaries", () => {
  const routes = [
    "app/dashboard/error.tsx",
    "app/dashboard/api-keys/error.tsx",
    "app/dashboard/projects/error.tsx",
    "app/dashboard/projects/[id]/error.tsx",
    "app/dashboard/integrations/error.tsx",
    "app/dashboard/billing/error.tsx",
    "app/dashboard/enterprise/error.tsx",
    "app/dashboard/audit/error.tsx",
    "app/dashboard/settings/error.tsx",
    "app/dashboard/credentials/error.tsx",
    "app/dashboard/reports/error.tsx",
    "app/dashboard/logs/error.tsx",
    "app/dashboard/agent-control/error.tsx",
    "app/dashboard/agent-firewall/error.tsx",
    "app/dashboard/agent-passports/error.tsx",
    "app/dashboard/onboarding/error.tsx",
    "app/dashboard/usage-governance/error.tsx",
    "app/dashboard/canary-network/error.tsx",
    "app/dashboard/escrow/error.tsx",
    "app/dashboard/paid-pilot-features/error.tsx",
  ];

  routes.forEach((route) => {
    it(`${route} exists with user-friendly error display`, () => {
      const src = file(route);
      assert.ok(src.length > 100, `${route} should exist`);
      assert.ok(src.includes("Something went wrong") || src.includes("error"), `${route} should show error message`);
      assert.ok(src.includes("Try again") || src.includes("reset"), `${route} should have retry action`);
    });
  });
});

describe("UX — Copy Button Auto-Reset", () => {
  it("ApiKeyManager copy resets after timeout", () => {
    const src = file("components/dashboard/ApiKeyManager.tsx");
    assert.ok(src.includes("setTimeout"), "should have setTimeout");
    assert.ok(src.includes("setCopied(false)"), "should reset copied state");
  });

  it("WebhookManager copy resets after timeout", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("setTimeout"), "should have setTimeout");
    assert.ok(src.includes("setCopied(false)"), "should reset copied state");
  });
});

describe("UX — Success Message Auto-Dismiss", () => {
  it("WebhookManager success auto-clears", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("setSuccess"), "should set success");
    assert.ok(src.includes("setTimeout"), "should auto-dismiss");
  });

  it("ApiKeyManager success auto-clears", () => {
    const src = file("components/dashboard/ApiKeyManager.tsx");
    assert.ok(src.includes("setSuccess"), "should set success");
    assert.ok(src.includes("setTimeout"), "should auto-dismiss");
  });
});

describe("UX — Error Message Sanitization", () => {
  it("Dashboard error boundary has user-friendly messages", () => {
    const src = file("app/dashboard/error.tsx");
    assert.ok(src.includes("getDisplayMessage"), "should have getDisplayMessage");
    assert.ok(src.includes("not found"), "should handle not found");
    assert.ok(src.includes("permission"), "should handle permission errors");
    assert.ok(src.includes("sign in"), "should handle session errors");
  });
});

describe("UX — Delete Confirmations", () => {
  it("WebhookManager has confirm dialog on delete", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("confirm("), "should have confirm dialog");
    assert.ok(src.includes("Delete"), "should mention delete");
  });

  it("ApiKeyManager has confirm on deactivate", () => {
    const src = file("components/dashboard/ApiKeyManager.tsx");
    assert.ok(src.includes("confirm("), "should have confirm on deactivate");
  });

  it("WebhookManager has confirm on pause", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("confirm("), "should have confirm on pause");
  });
});

describe("UX — Confirmation Dialogs for Destructive Actions", () => {
  it("PolicyForm warns on mode change", () => {
    const src = file("components/dashboard/PolicyForm.tsx");
    assert.ok(src.includes("confirm("), "should warn on mode change");
  });

  it("Agent control has approval confirmation", () => {
    const src = file("app/dashboard/agent-control/page.tsx");
    assert.ok(src.includes("confirm(") || src.includes("ConfirmableForm"), "should have approval confirmation");
  });

  it("Agent firewall has approval confirmation", () => {
    const src = file("app/dashboard/agent-firewall/page.tsx");
    assert.ok(src.includes("confirm(") || src.includes("ConfirmableForm"), "should have approval confirmation");
  });

  it("ConfirmableForm component exists", () => {
    const src = file("components/dashboard/ConfirmableForm.tsx");
    assert.ok(src.length > 100, "ConfirmableForm should exist");
    assert.ok(src.includes("confirm("), "should use confirm dialog");
  });
});

describe("UX — Integration Wizard Code Copy", () => {
  it("IntegrationWizard uses CodeBlock component", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("CodeBlock"), "should use CodeBlock");
    assert.ok(src.includes('from "@/components/ui/CodeBlock"'), "should import CodeBlock");
  });

  it("IntegrationWizard has success/error conditional styling", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("text-emerald-") || src.includes("text-green-"), "should have success color");
    assert.ok(src.includes("text-red-"), "should have error color");
  });
});

describe("UX — Hero CTA", () => {
  it("Hero has 'Start Free' button", () => {
    const src = file("components/marketing/Hero.tsx");
    assert.ok(src.includes("Start Free"), "should have Start Free CTA");
    assert.ok(src.includes("/signup"), "should link to signup");
  });
});

describe("UX — Feature Status Labels", () => {
  it("Sidebar has Stable/Beta/Labs labels", () => {
    const src = file("components/dashboard/DashboardSidebar.tsx");
    assert.ok(src.includes("Stable"), "should have Stable label");
    assert.ok(src.includes("Beta"), "should have Beta label");
    assert.ok(src.includes("Labs"), "should have Labs label");
  });
});

describe("UX — Docs & Help Link", () => {
  it("Sidebar has Docs & Help link", () => {
    const src = file("components/dashboard/DashboardSidebar.tsx");
    assert.ok(src.includes("Docs & Help"), "should have Docs & Help");
    assert.ok(src.includes("/docs"), "should link to /docs");
  });
});

describe("UX — Pricing Comparison Table", () => {
  it("Pricing page has comparison table", () => {
    const src = file("app/pricing/page.tsx");
    assert.ok(src.includes("Feature"), "should have Feature column");
    assert.ok(src.includes("Starter"), "should have Starter plan");
    assert.ok(src.includes("Pro"), "should have Pro plan");
    assert.ok(src.includes("Enterprise"), "should have Enterprise plan");
  });
});

describe("UX — Projects Empty State", () => {
  it("Projects page has helpful empty state", () => {
    const src = file("app/dashboard/projects/page.tsx");
    assert.ok(src.includes("Create"), "should have Create CTA");
    assert.ok(src.includes("first project"), "should guide user");
  });
});

describe("UX — Dashboard Mobile CTA", () => {
  it("Hero cards are visible on mobile", () => {
    const src = file("app/dashboard/page.tsx");
    assert.ok(src.includes("sm:opacity-0"), "should be visible on mobile");
  });
});

describe("UX — Quickstart Doc", () => {
  it("No placeholder URLs", () => {
    const src = file("docs/quickstart-first-5-minutes.md");
    assert.ok(!src.includes("<repo-url>"), "should not have <repo-url> placeholder");
    assert.ok(!src.includes("<your-"), "should not have <your- placeholders");
  });
});

describe("UX — Sidebar Width", () => {
  it("Sidebar has responsive width", () => {
    const src = file("components/dashboard/DashboardShell.tsx");
    assert.ok(src.includes("208px"), "should have 208px width");
  });
});

describe("UX — Security Hardening Tests Exist", () => {
  it("Security hardening test file exists with timing attack coverage", () => {
    const src = file("tests/security-hardening.test.ts");
    assert.ok(src.length > 1000, "should have substantial content");
    assert.ok(src.includes("timingSafeEqual"), "should cover timing attacks");
  });
});

describe("UX — Accessibility Labels", () => {
  it("ApiKeyManager has label elements", () => {
    const src = file("components/dashboard/ApiKeyManager.tsx");
    assert.ok(src.includes("<label"), "should have label elements");
  });

  it("WebhookManager has label elements", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("<label"), "should have label elements");
    assert.ok(src.includes("<legend"), "should have fieldset legend");
  });
});

describe("UX — Improved Error Messages", () => {
  it("Agent firewall errors are descriptive", () => {
    const src = file("app/dashboard/agent-firewall/actions.ts");
    assert.ok(src.includes("refresh") || src.includes("Missing"), "errors should guide user");
  });

  it("Agent passports errors are descriptive", () => {
    const src = file("app/dashboard/agent-passports/actions.ts");
    assert.ok(src.includes("Missing") || src.includes("select"), "errors should guide user");
  });

  it("Canary network errors are descriptive", () => {
    const src = file("app/dashboard/canary-network/actions.ts");
    assert.ok(src.includes("Missing") || src.includes("select"), "errors should guide user");
  });

  it("Escrow errors are descriptive", () => {
    const src = file("app/dashboard/escrow/actions.ts");
    assert.ok(src.includes("Missing") || src.includes("refresh"), "errors should guide user");
  });
});

describe("UX — Empty States", () => {
  it("Enterprise page has helpful empty state", () => {
    const src = file("app/dashboard/enterprise/page.tsx");
    assert.ok(src.includes("No organization") || src.includes("No SSO"), "should have empty state");
  });

  it("Billing page has plan history empty state", () => {
    const src = file("app/dashboard/billing/page.tsx");
    assert.ok(src.includes("No plan changes") || src.includes("empty"), "should have empty state");
  });

  it("Settings page has copy buttons", () => {
    const src = file("app/dashboard/settings/page.tsx");
    assert.ok(src.includes("clipboard") || src.includes("copy") || src.includes("Copy"), "should have copy affordance");
  });
});

describe("UX — Dead Tour Link Fixed", () => {
  it("QuickActions tour link is not href='#'", () => {
    const src = file("components/dashboard/QuickActions.tsx");
    assert.ok(!src.includes('href="#"'), "should not have dead # link");
  });
});

describe("UX — Broken Links Fixed", () => {
  it("Dashboard guided setup link points to correct route", () => {
    const src = file("app/dashboard/page.tsx");
    assert.ok(src.includes("/dashboard/onboarding"), "should link to /dashboard/onboarding");
    assert.ok(!src.includes('href="/onboarding"'), "should not link to /onboarding");
  });

  it("Project cards are clickable links", () => {
    const src = file("app/dashboard/projects/page.tsx");
    assert.ok(src.includes("<Link") || src.includes("href="), "project cards should be links");
  });
});

describe("UX — CSS Classes Fixed", () => {
  it("Escrow page uses correct button classes", () => {
    const src = file("app/dashboard/escrow/page.tsx");
    assert.ok(src.includes("button-primary"), "should use button-primary");
    assert.ok(!src.includes("btn-primary"), "should not use btn-primary");
  });
});

describe("UX — Hardcoded State Fixed", () => {
  it("Usage governance shows actual policy state", () => {
    const src = file("app/dashboard/usage-governance/page.tsx");
    assert.ok(!src.includes('"Enabled"') || src.includes("hasEnabledPolicy"), "should use actual state");
  });
});

describe("UX — FeedbackButtons Fixed", () => {
  it("FeedbackButtons auto-clears Saved state", () => {
    const src = file("components/dashboard/FeedbackButtons.tsx");
    assert.ok(src.includes("setTimeout"), "should auto-clear");
  });

  it("FeedbackButtons has adequate touch target", () => {
    const src = file("components/dashboard/FeedbackButtons.tsx");
    assert.ok(src.includes("!px-3") || src.includes("py-2"), "should have adequate touch target");
  });
});

describe("UX — Focus Management", () => {
  it("Error boundary has role='alert'", () => {
    const src = file("app/dashboard/error.tsx");
    assert.ok(src.includes('role="alert"'), "should have role=alert");
  });

  it("ApiKeyManager has aria-live on messages", () => {
    const src = file("components/dashboard/ApiKeyManager.tsx");
    assert.ok(src.includes("aria-live"), "should have aria-live");
  });

  it("WebhookManager has aria-live on messages", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("aria-live"), "should have aria-live");
  });
});

describe("UX — Accessibility ARIA", () => {
  it("Sidebar nav has aria-label", () => {
    const src = file("components/dashboard/DashboardSidebar.tsx");
    assert.ok(src.includes('aria-label="Dashboard navigation"'), "should have nav aria-label");
  });

  it("Sidebar buttons have aria-expanded", () => {
    const src = file("components/dashboard/DashboardSidebar.tsx");
    assert.ok(src.includes("aria-expanded"), "should have aria-expanded");
  });

  it("LogsTable has role and aria-label", () => {
    const src = file("components/dashboard/LogsTable.tsx");
    assert.ok(src.includes('role="table"'), "should have role=table");
    assert.ok(src.includes("aria-label"), "should have aria-label");
  });

  it("LogsTable th has scope='col'", () => {
    const src = file("components/dashboard/LogsTable.tsx");
    assert.ok(src.includes('scope="col"'), "should have scope=col");
  });

  it("PlanGrid has aria-disabled", () => {
    const src = file("components/dashboard/PlanGrid.tsx");
    assert.ok(src.includes("aria-disabled"), "should have aria-disabled");
  });
});

describe("UX — Mobile Sidebar", () => {
  it("DashboardShell has Escape key handler", () => {
    const src = file("components/dashboard/DashboardShell.tsx");
    assert.ok(src.includes("Escape"), "should handle Escape key");
  });
});

describe("UX — Confirmations for Destructive Actions", () => {
  it("Passport revoke has confirmation", () => {
    const src = file("app/dashboard/agent-passports/page.tsx");
    assert.ok(src.includes("ConfirmableForm") || src.includes("confirm("), "should have confirmation");
  });

  it("Escrow approve/deny has confirmation", () => {
    const src = file("app/dashboard/escrow/page.tsx");
    assert.ok(src.includes("ConfirmableForm") || src.includes("confirm("), "should have confirmation");
  });

  it("Canary disable has confirmation", () => {
    const src = file("app/dashboard/canary-network/page.tsx");
    assert.ok(src.includes("ConfirmableForm") || src.includes("confirm("), "should have confirmation");
  });
});

describe("UX — Page Titles and Guidance", () => {
  it("Settings page has descriptive title", () => {
    const src = file("app/dashboard/settings/page.tsx");
    assert.ok(src.includes("Guard") || src.includes("Configuration") || src.includes("Defaults"), "should have descriptive title");
  });

  it("Billing page has organization guidance", () => {
    const src = file("app/dashboard/billing/page.tsx");
    assert.ok(src.includes("Settings") || src.includes("organization"), "should guide user");
  });

  it("Reports page has refresh guidance", () => {
    const src = file("app/dashboard/reports/page.tsx");
    assert.ok(src.includes("Refresh") || src.includes("refresh") || src.includes("few minutes"), "should guide user");
  });

  it("Onboarding has skip option", () => {
    const src = file("app/dashboard/onboarding/page.tsx");
    assert.ok(src.includes("Skip") || src.includes("skip"), "should have skip option");
  });

  it("Enterprise has SCIM empty state", () => {
    const src = file("app/dashboard/enterprise/page.tsx");
    assert.ok(src.includes("No SCIM") || src.includes("no SCIM") || src.includes("tokens.length"), "should have SCIM empty state");
  });
});

describe("UX — Color Contrast", () => {
  it("Status labels have adequate contrast", () => {
    const src = file("components/dashboard/DashboardSidebar.tsx");
    assert.ok(!src.includes("/70"), "should not use 70% opacity on status labels");
  });
});
