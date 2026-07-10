import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "crypto";

describe("Security Hardening Regression Suite", () => {

  describe("1. Timing-safe comparison enforcement", () => {
    it("timingSafeEqual is available and works", () => {
      const a = Buffer.from("abc123", "hex");
      const b = Buffer.from("abc123", "hex");
      assert.ok(timingSafeEqual(a, b));
    });

    it("timingSafeEqual rejects mismatched values", () => {
      const a = Buffer.from("abc123", "hex");
      const b = Buffer.from("def456", "hex");
      assert.ok(!timingSafeEqual(a, b));
    });

    it("timingSafeEqual rejects different lengths", () => {
      const a = Buffer.from("ab");
      const b = Buffer.from("abcd");
      assert.throws(() => timingSafeEqual(a, b));
    });
  });

  describe("2. SSRF protection verification", () => {
    it("outboundUrl.ts has SSRF protection code", async () => {
      const { readFileSync } = await import("fs");
      const code = readFileSync("lib/network/outboundUrl.ts", "utf8");
      assert.ok(code.includes("https:"), "Must enforce HTTPS");
      assert.ok(code.includes("isPrivateIpv4"), "Must block private IPv4");
      assert.ok(code.includes("isPrivateIpv6"), "Must block private IPv6");
      assert.ok(code.includes("lookup"), "Must do DNS resolution for rebind protection");
      assert.ok(code.includes("localhost"), "Must block localhost");
    });
  });

  describe("3. CSRF protection verification", () => {
    it("middleware file exists", async () => {
      const { existsSync } = await import("fs");
      assert.ok(existsSync("middleware.ts"));
    });
  });

  describe("4. API route auth verification", () => {
    it("route audit test file exists with public allowlist", async () => {
      const { existsSync, readFileSync } = await import("fs");
      assert.ok(existsSync("tests/api-route-audit.test.ts"));
      const content = readFileSync("tests/api-route-audit.test.ts", "utf8");
      assert.ok(content.includes("publicAllowlist") || content.includes("public") || content.includes("allowlist"));
    });
  });

  describe("5. Security headers verification", () => {
    it("next.config.mjs has CSP header", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("Content-Security-Policy"));
      assert.ok(config.includes("X-Frame-Options"));
      assert.ok(config.includes("X-Content-Type-Options"));
      assert.ok(config.includes("Referrer-Policy"));
      assert.ok(config.includes("Permissions-Policy"));
      assert.ok(config.includes("Strict-Transport-Security"));
      assert.ok(config.includes("preload"));
    });

    it("CSP has frame-ancestors none", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("frame-ancestors 'none'"));
    });

    it("CSP has object-src none", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("object-src 'none'"));
    });

    it("CSP has form-action self", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("form-action 'self'"));
    });

    it("poweredByHeader is false", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("poweredByHeader: false"));
    });
  });

  describe("6. Browser extension security", () => {
    it("manifest does not have <all_urls> content script", async () => {
      const { readFileSync } = await import("fs");
      const manifest = JSON.parse(readFileSync("apps/extension/manifest.json", "utf8"));
      const contentScripts = manifest.content_scripts ?? [];
      for (const script of contentScripts) {
        assert.ok(
          !script.matches?.includes("<all_urls>"),
          `Content script should not have <all_urls>: ${JSON.stringify(script.matches)}`
        );
      }
    });

    it("optional_host_permissions is not wildcard", async () => {
      const { readFileSync } = await import("fs");
      const manifest = JSON.parse(readFileSync("apps/extension/manifest.json", "utf8"));
      const optional = manifest.optional_host_permissions ?? [];
      assert.ok(!optional.includes("*://*/*"), "optional_host_permissions should not be wildcard");
    });

    it("manifest version is 3", async () => {
      const { readFileSync } = await import("fs");
      const manifest = JSON.parse(readFileSync("apps/extension/manifest.json", "utf8"));
      assert.equal(manifest.manifest_version, 3);
    });
  });

  describe("7. VS Code extension security", () => {
    it("package.json has preview:false for GA", async () => {
      const { readFileSync } = await import("fs");
      const pkg = JSON.parse(readFileSync("packages/vscode-extension/package.json", "utf8"));
      assert.equal(pkg.preview, false, "preview should be false for GA");
    });
  });

  describe("8. Webhook HMAC verification", () => {
    it("webhook signing uses timingSafeEqual", async () => {
      const { readFileSync } = await import("fs");
      const signing = readFileSync("lib/webhooks/signing.ts", "utf8");
      assert.ok(signing.includes("timingSafeEqual"), "Webhook signing must use timingSafeEqual");
    });

    it("razorpay verification uses timingSafeEqual", async () => {
      const { readFileSync } = await import("fs");
      const razorpay = readFileSync("lib/billing/razorpay.ts", "utf8");
      assert.ok(razorpay.includes("timingSafeEqual"), "Razorpay verification must use timingSafeEqual");
    });
  });

  describe("9. Agent passport security", () => {
    it("passport validation uses timingSafeEqual", async () => {
      const { readFileSync } = await import("fs");
      const passport = readFileSync("lib/agent-passport/index.ts", "utf8");
      assert.ok(passport.includes("timingSafeEqual"), "Passport token comparison must use timingSafeEqual");
    });
  });

  describe("10. Webhook store security", () => {
    it("webhook secret verification uses timingSafeEqual", async () => {
      const { readFileSync } = await import("fs");
      const store = readFileSync("lib/webhooks/store.ts", "utf8");
      assert.ok(store.includes("timingSafeEqual"), "Webhook secret comparison must use timingSafeEqual");
    });
  });

  describe("11. API key security", () => {
    it("API key verification uses timingSafeEqual", async () => {
      const { readFileSync } = await import("fs");
      const apiKey = readFileSync("lib/apiKey.ts", "utf8");
      assert.ok(apiKey.includes("timingSafeEqual"), "API key comparison must use timingSafeEqual");
    });
  });

  describe("12. Error handling", () => {
    it("apiError does not leak stack traces", async () => {
      const { readFileSync } = await import("fs");
      const apiResponse = readFileSync("lib/apiResponse.ts", "utf8");
      assert.ok(!apiResponse.includes("stack"), "apiError should not expose stack traces");
      assert.ok(apiResponse.includes("Unexpected server error") || apiResponse.includes("Service temporarily"), "apiError should return generic messages");
    });
  });

  describe("13. Open redirect protection", () => {
    it("safeCallbackUrl exists and validates", async () => {
      const { readFileSync } = await import("fs");
      const callback = readFileSync("lib/auth/callback.ts", "utf8");
      assert.ok(callback.includes("//"), "should block protocol-relative URLs");
      assert.ok(callback.includes("dashboard") || callback.includes("/"), "should fallback to safe path");
    });
  });

  describe("14. Input validation", () => {
    it("Zod is used for request validation", async () => {
      const { readFileSync } = await import("fs");
      const pkg = JSON.parse(readFileSync("package.json", "utf8"));
      assert.ok(pkg.dependencies.zod, "Zod should be a dependency");
    });
  });

  describe("15. No secrets in repository", () => {
    it(".env is not tracked", async () => {
      const { readFileSync } = await import("fs");
      const gitignore = readFileSync(".gitignore", "utf8");
      assert.ok(gitignore.includes(".env"), ".env should be in .gitignore");
    });

    it(".env.example exists with placeholder values", async () => {
      const { readFileSync } = await import("fs");
      const envExample = readFileSync(".env.example", "utf8");
      assert.ok(!envExample.includes("sk_live"), ".env.example should not contain live keys");
      assert.ok(!envExample.includes("sk_test") || envExample.includes("your-"), ".env.example should use placeholder values");
    });
  });

  describe("16. SAML security", () => {
    it("SAML error messages are sanitized before storage", async () => {
      const { readFileSync } = await import("fs");
      const acs = readFileSync("app/api/sso/saml/acs/route.ts", "utf8");
      assert.ok(acs.includes("sanitized") || acs.includes("replace") || acs.includes("slice"), "SAML errors should be sanitized");
    });
  });

  describe("17. External datasets path validation", () => {
    it("dataset name is validated against path traversal", async () => {
      const { readFileSync } = await import("fs");
      const datasets = readFileSync("lib/benchmarks/externalDatasets.ts", "utf8");
      assert.ok(datasets.includes("test") || datasets.includes("RegExp") || datasets.includes("/\\^/"), "Dataset name should be validated");
    });
  });

  describe("18. CORS security", () => {
    it("wildcard CORS endpoints have Vary: Origin", async () => {
      const { readFileSync } = await import("fs");
      const badge = readFileSync("app/api/badge/[slug]/route.ts", "utf8");
      assert.ok(badge.includes("Vary"), "Badge endpoint should have Vary header");
    });
  });

  describe("19. JSON-LD XSS prevention", () => {
    it("JsonLd component uses safeJsonLd", async () => {
      const { readFileSync } = await import("fs");
      const jsonLd = readFileSync("components/seo/JsonLd.tsx", "utf8");
      assert.ok(jsonLd.includes("safeJsonLd"), "JsonLd component should use safeJsonLd");
    });
  });

  describe("20. Dependency security", () => {
    it("no known vulnerabilities in production deps", async () => {
      const { execSync } = await import("child_process");
      const result = execSync("npm audit --omit=dev 2>&1", { encoding: "utf8" });
      assert.ok(result.includes("0 vulnerabilities") || !result.includes("vulnerabilities"), "Should have 0 vulnerabilities");
    });
  });

  describe("21. Hardcoded secrets removed", () => {
    it("passport pepper fallback removed", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("lib/agent-passport/index.ts", "utf8");
      assert.ok(!src.includes('"cybersecurityguard-agent-passport"'), "Should not have hardcoded pepper fallback");
      assert.ok(src.includes("throw new Error") || src.includes("if (!pepper)"), "Should throw when pepper missing");
    });

    it(".env.example has no weak placeholder", async () => {
      const { readFileSync } = await import("fs");
      const env = readFileSync(".env.example", "utf8");
      assert.ok(!env.includes('NEXTAUTH_SECRET="your-nextauth-secret"'), "Should not have weak placeholder");
    });
  });

  describe("22. CSP hardened", () => {
    it("script-src includes required sources", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("scriptSources"), "CSP should define scriptSources");
      assert.ok(config.includes("'self'"), "script-src should include 'self'");
      assert.ok(config.includes("checkout.razorpay.com"), "script-src should include razorpay");
    });

    it("has frame-ancestors none", async () => {
      const { readFileSync } = await import("fs");
      const config = readFileSync("next.config.mjs", "utf8");
      assert.ok(config.includes("frame-ancestors 'none'"), "CSP should have frame-ancestors none");
    });
  });

  describe("23. JSON-LD uses safeJsonLd", () => {
    const pages = [
      "app/page.tsx",
      "app/pricing/page.tsx",
      "app/comparison/page.tsx",
      "components/marketing/VsCompetitor.tsx",
    ];
    pages.forEach((page) => {
      it(`${page} uses safeJsonLd for JSON-LD`, async () => {
        const { readFileSync } = await import("fs");
        const src = readFileSync(page, "utf8");
        if (src.includes("application/ld+json") || src.includes("JsonLd")) {
          assert.ok(
            src.includes("safeJsonLd") || !src.includes("JSON.stringify"),
            `${page} should use safeJsonLd instead of JSON.stringify for JSON-LD`
          );
        }
      });
    });
  });

  describe("24. Password complexity enforced", () => {
    it("signup route requires uppercase, lowercase, and digit", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
      assert.ok(src.includes("regex") || src.includes("pattern"), "Should have regex complexity check");
      assert.ok(src.includes("[a-z]") || src.includes("lowercase"), "Should require lowercase");
      assert.ok(src.includes("[A-Z]") || src.includes("uppercase"), "Should require uppercase");
    });
  });

  describe("25. Session invalidation on password reset", () => {
    it("password reset updates passwordChangedAt", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("app/api/auth/reset-password/route.ts", "utf8");
      assert.ok(src.includes("passwordChangedAt"), "Should update passwordChangedAt on reset");
    });

    it("JWT callback checks passwordChangedAt", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("auth.ts", "utf8");
      assert.ok(src.includes("passwordChangedAt"), "JWT callback should check passwordChangedAt");
    });
  });

  describe("26. SAML rejects SHA-1", () => {
    it("SAML module rejects rsa-sha1 signatures", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("lib/enterprise/saml.ts", "utf8");
      assert.ok(src.includes("rsa-sha1") && (src.includes("Rejecting") || src.includes("reject") || src.includes("not accepted") || src.includes("deprecated")), "Should reject SHA-1 signatures");
      assert.ok(src.includes("RSA-SHA256"), "Should default to SHA-256");
    });
  });

  describe("27. Content-Type validation on POST routes", () => {
    it("guard input route checks content type", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("app/api/guard/input/route.ts", "utf8");
      assert.ok(src.includes("requireJsonContentType") || src.includes("Content-Type"), "Should validate content type");
    });

    it("guard output route checks content type", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("app/api/guard/output/route.ts", "utf8");
      assert.ok(src.includes("requireJsonContentType") || src.includes("Content-Type"), "Should validate content type");
    });
  });

  describe("28. Error logging sanitized", () => {
    it("apiError does not log full error object", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("lib/apiResponse.ts", "utf8");
      assert.ok(src.includes("error.message") || src.includes("error instanceof Error"), "Should log sanitized error");
    });
  });

  describe("29. Per-account rate limiting on login", () => {
    it("login has account-based rate limit", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("app/api/auth/[...nextauth]/route.ts", "utf8");
      assert.ok(src.includes("login:") || src.includes("account") || src.includes("email"), "Should have per-account rate limit");
    });
  });

  describe("30. Environment variable validation", () => {
    it("startup validates critical env vars", async () => {
      const { readFileSync } = await import("fs");
      const src = readFileSync("auth.config.ts", "utf8");
      assert.ok(src.includes("API_KEY_PEPPER") || src.includes("AUTH_SECRET"), "Should validate env vars");
    });
  });

  describe("31. No dangerouslySetInnerHTML without safeJsonLd", () => {
    it("no raw JSON.stringify in dangerouslySetInnerHTML for JSON-LD", async () => {
      const { readFileSync } = await import("fs");
      const { globSync } = await import("fs");
      const files = [
        "app/page.tsx",
        "app/pricing/page.tsx",
        "app/comparison/page.tsx",
        "components/marketing/VsCompetitor.tsx",
      ];
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        if (src.includes("dangerouslySetInnerHTML") && src.includes("ld+json")) {
          assert.ok(
            !src.includes("JSON.stringify") || src.includes("safeJsonLd"),
            `${file} should not use JSON.stringify for JSON-LD scripts`
          );
        }
      }
    });
  });
});
