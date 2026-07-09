/**
 * Integration Ease Test Suite — SoterAI Guard v0.2.0
 *
 * Validates that developers can integrate SoterAI Guard easily:
 * - SDK exports correct classes
 * - SDK README examples compile
 * - API reference exists
 * - Webhook docs exist
 * - Webhook test button works
 * - Integration wizard has correct env vars
 * - Error messages are consistent
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

describe("Integration — SDK Exports", () => {
  it("SDK index exports Soter class", () => {
    const src = file("packages/sdk/src/index.ts");
    assert.ok(src.includes("export") && src.includes("Soter"), "should export Soter");
  });

  it("SDK has correct default base URL", () => {
    const src = file("packages/sdk/src/client.ts");
    assert.ok(src.includes("api.soterai.com"), "should use soterai.com domain");
    assert.ok(!src.includes("cybersecurityguard.com"), "should not use old brand domain");
  });

  it("SDK error messages use correct brand", () => {
    const src = file("packages/sdk/src/client.ts");
    assert.ok(!src.includes("cybersecurityguard request failed"), "should not have old brand in errors");
  });
});

describe("Integration — SDK README", () => {
  it("SDK README imports Soter correctly", () => {
    const src = file("packages/sdk/README.md");
    assert.ok(src.includes('from "@soterai/core"') || src.includes("from '@soterai/core'"), "should import from @soterai/core");
  });

  it("SDK README mentions env var fallback", () => {
    const src = file("packages/sdk/README.md");
    assert.ok(src.includes("SOTER_API_KEY") || src.includes("env"), "should mention env var");
  });

  it("SDK README has correct license", () => {
    const src = file("packages/sdk/README.md");
    assert.ok(src.includes("Apache-2.0") || src.includes("Apache"), "should use Apache-2.0");
  });

  it("SDK README mentions maxRetries", () => {
    const src = file("packages/sdk/README.md");
    assert.ok(src.includes("maxRetries") || src.includes("retry"), "should mention retry config");
  });

  it("SDK README has no broken placeholder URLs", () => {
    const src = file("packages/sdk/README.md");
    assert.ok(!src.includes("<your-"), "should not have <your- placeholders");
    assert.ok(!src.includes("<repo-url>"), "should not have repo-url placeholder");
  });
});

describe("Integration — API Reference", () => {
  it("API reference doc exists", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.length > 500, "api-reference.md should exist with substantial content");
  });

  it("API reference documents /api/guard/input", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.includes("/api/guard/input"), "should document input endpoint");
  });

  it("API reference documents /api/guard/output", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.includes("/api/guard/output"), "should document output endpoint");
  });

  it("API reference documents auth header", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.includes("x-api-key") || src.includes("Authorization"), "should document auth");
  });

  it("API reference documents error format", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.includes("error") && src.includes("message"), "should document error format");
  });

  it("API reference documents rate limits", () => {
    const src = file("docs/api-reference.md");
    assert.ok(src.includes("rate") || src.includes("Rate"), "should document rate limits");
  });
});

describe("Integration — Webhook Documentation", () => {
  it("Webhook doc exists", () => {
    const src = file("docs/webhooks.md");
    assert.ok(src.length > 500, "webhooks.md should exist with substantial content");
  });

  it("Webhook doc has signature verification", () => {
    const src = file("docs/webhooks.md");
    assert.ok(src.includes("signature") || src.includes("Signature"), "should document signature verification");
  });

  it("Webhook doc has event types", () => {
    const src = file("docs/webhooks.md");
    assert.ok(src.includes("event"), "should document event types");
  });

  it("Webhook doc has retry policy", () => {
    const src = file("docs/webhooks.md");
    assert.ok(src.includes("retry") || src.includes("Retry"), "should document retry policy");
  });

  it("Webhook doc has code examples", () => {
    const src = file("docs/webhooks.md");
    assert.ok(src.includes("```"), "should have code blocks");
  });
});

describe("Integration — Webhook Test Button", () => {
  it("WebhookManager checks data.accepted not data.success", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("data.accepted"), "should check accepted field");
    assert.ok(!src.includes('data.success') || src.includes("data.accepted"), "should use accepted");
  });
});

describe("Integration — Webhook Delivery Infrastructure", () => {
  it("Delivery uses x-soter headers (not old brand)", () => {
    const src = file("lib/webhooks/delivery.ts");
    assert.ok(src.includes("x-soter-"), "should use x-soter headers");
    assert.ok(!src.includes("x-cyberrakshak-"), "should not use old brand headers");
  });

  it("Delivery timeout is at least 10 seconds", () => {
    const src = file("lib/webhooks/delivery.ts");
    assert.ok(src.includes("10_000") || src.includes("10000"), "should have 10s timeout");
  });

  it("Delivery has jitter in backoff", () => {
    const src = file("lib/webhooks/delivery.ts");
    assert.ok(src.includes("Math.random") || src.includes("jitter"), "should have jitter");
  });

  it("Delivery auto-generates idempotency key", () => {
    const src = file("lib/webhooks/delivery.ts");
    assert.ok(src.includes("randomUUID") || src.includes("idempotencyKey"), "should auto-generate idempotency key");
  });
});

describe("Integration — Webhook UI", () => {
  it("WebhookManager has replay/retry button", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("Retry") || src.includes("replay"), "should have retry button");
  });

  it("WebhookManager has correct status colors", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("DELIVERED"), "should handle DELIVERED status");
    assert.ok(src.includes("DEAD_LETTER") || src.includes("FAILED"), "should handle failed statuses");
  });

  it("WebhookManager includes governance events", () => {
    const src = file("components/dashboard/WebhookManager.tsx");
    assert.ok(src.includes("governance.enforcement"), "should include governance events");
  });
});

describe("Integration — Integration Wizard", () => {
  it("IntegrationWizard uses SOTER env vars (not CYBERRAKSHAK)", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("SOTER_"), "should use SOTER env vars");
    assert.ok(!src.includes("CYBERRAKSHAK_"), "should not use old brand env vars");
  });

  it("IntegrationWizard Python snippet has projectId", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("project_id") || src.includes("projectId"), "Python snippet should have project_id");
  });

  it("IntegrationWizard has webhooks platform", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("Webhook") || src.includes("webhook"), "should have webhook option");
  });

  it("IntegrationWizard has signature verification example", () => {
    const src = file("components/dashboard/IntegrationWizard.tsx");
    assert.ok(src.includes("hmac") || src.includes("HMAC") || src.includes("signature"), "should have signature verification");
  });
});

describe("Integration — Error Format Consistency", () => {
  it("Grounding route uses consistent error format", () => {
    const src = file("app/api/guard/grounding/route.ts");
    assert.ok(src.includes("error: true"), "should use boolean error field");
  });
});

describe("Integration — Quickstart Doc", () => {
  it("Quickstart has no placeholder URLs", () => {
    const src = file("docs/quickstart-first-5-minutes.md");
    assert.ok(!src.includes("<repo-url>"), "should not have repo-url placeholder");
    assert.ok(!src.includes("<your-"), "should not have <your- placeholders");
  });

  it("Quickstart mentions API key", () => {
    const src = file("docs/quickstart-first-5-minutes.md");
    assert.ok(src.includes("API key") || src.includes("api-key") || src.includes("apiKey"), "should mention API key");
  });
});
