import { describe, it } from "node:test";
import assert from "node:assert";
import {
    DEFAULT_PROJECT_POLICY,
    parseProjectPolicy,
    globToRegExp,
    classifyPath,
    isProtectedPath,
    isSensitivePath,
} from "../ProjectPolicy";

describe("globToRegExp", () => {
    it("matches basename patterns anywhere in the tree", () => {
        assert.ok(globToRegExp("*.pem").test("certs/server.pem"));
        assert.ok(globToRegExp(".env").test("config/.env"));
        assert.ok(globToRegExp(".env").test(".env"));
        assert.ok(!globToRegExp("*.pem").test("server.key"));
    });

    it("supports ** across segments and anchors when a slash is present", () => {
        assert.ok(globToRegExp("src/auth/**").test("src/auth/login.ts"));
        assert.ok(globToRegExp("src/auth/**").test("src/auth/deep/nested/file.ts"));
        assert.ok(!globToRegExp("src/auth/**").test("src/payments/pay.ts"));
        assert.ok(globToRegExp("**/*.key").test("a/b/c/id_rsa.key"));
    });

    it("matches an exact rooted path", () => {
        assert.ok(globToRegExp("prisma/schema.prisma").test("prisma/schema.prisma"));
        assert.ok(!globToRegExp("prisma/schema.prisma").test("prisma/other.prisma"));
    });

    it("normalizes backslashes", () => {
        assert.ok(globToRegExp("src/auth/**").test("src\\auth\\login.ts".replace(/\\/g, "/")));
    });
});

describe("classifyPath", () => {
    const policy = DEFAULT_PROJECT_POLICY;

    it("classifies .env and keys as protected → block", () => {
        for (const p of [".env", ".env.production", "config/.env", "certs/server.pem", "deploy/id_rsa"]) {
            const c = classifyPath(p, policy);
            assert.strictEqual(c.level, "protected", `${p} should be protected`);
            assert.strictEqual(c.action, "block");
        }
    });

    it("classifies sensitive paths → approval_required", () => {
        const c = classifyPath("src/auth/session.ts", policy);
        assert.strictEqual(c.level, "sensitive");
        assert.strictEqual(c.action, "approval_required");
    });

    it("protected wins over sensitive when both match", () => {
        const custom = parseProjectPolicy({
            protectedFiles: ["src/auth/secret.ts"],
            sensitivePaths: ["src/auth/**"],
        });
        const c = classifyPath("src/auth/secret.ts", custom);
        assert.strictEqual(c.level, "protected");
    });

    it("normal files fall through to defaultAction", () => {
        const c = classifyPath("src/components/Button.tsx", policy);
        assert.strictEqual(c.level, "normal");
        assert.strictEqual(c.action, policy.aiContext.defaultAction);
    });

    it("isProtectedPath / isSensitivePath helpers agree with classifyPath", () => {
        assert.ok(isProtectedPath(".env", policy));
        assert.ok(isSensitivePath("infra/main.tf", policy));
        assert.ok(!isProtectedPath("README.md", policy));
    });
});

describe("parseProjectPolicy", () => {
    it("fills defaults for empty/garbage input without throwing", () => {
        assert.deepStrictEqual(parseProjectPolicy(undefined), DEFAULT_PROJECT_POLICY);
        assert.deepStrictEqual(parseProjectPolicy("not an object"), DEFAULT_PROJECT_POLICY);
        assert.deepStrictEqual(parseProjectPolicy({}), DEFAULT_PROJECT_POLICY);
    });

    it("keeps valid overrides and rejects invalid enums/actions", () => {
        const p = parseProjectPolicy({
            mode: "strict",
            aiContext: { defaultAction: "block", protectedFileAction: "not-a-real-action", allowSessionMinutes: 15 },
            cloud: { enabled: true, sendRawContent: true },
        });
        assert.strictEqual(p.mode, "strict");
        assert.strictEqual(p.aiContext.defaultAction, "block");
        assert.strictEqual(p.aiContext.protectedFileAction, DEFAULT_PROJECT_POLICY.aiContext.protectedFileAction);
        assert.strictEqual(p.aiContext.allowSessionMinutes, 15);
        assert.strictEqual(p.cloud.enabled, true);
    });

    it("defaults sendRawContent to false unless explicitly true", () => {
        assert.strictEqual(parseProjectPolicy({ cloud: {} }).cloud.sendRawContent, false);
        assert.strictEqual(parseProjectPolicy({ cloud: { sendRawContent: "yes" } }).cloud.sendRawContent, false);
    });
});
