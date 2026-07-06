import { describe, it } from "node:test";
import assert from "node:assert";
import {
    buildSafeContext,
    buildDebugPrompt,
    type ContextItem,
} from "../SafeContextBuilder";
import { DEFAULT_PROJECT_POLICY } from "../ProjectPolicy";
import { findSurvivingSecrets } from "../Redactor";

const CANARY_ENV = [
    "DATABASE_URL=postgresql://user:password@localhost:5432/prod",
    "OPENAI_API_KEY=sk-test-soter-canary-123456789012345678",
    "AWS_KEY=AKIAIOSFODNN7EXAMPLE",
].join("\n");

const ITEMS: ContextItem[] = [
    { path: ".env.production", kind: "active_file", content: CANARY_ENV },
    { path: "src/auth/session.ts", kind: "open_tab", content: "const SECRET=sk-test-soter-canary-123456789012345678;\nexport function login() {}" },
    { path: "src/components/Button.tsx", kind: "open_tab", content: "export const Button = () => null; // token=ghp_1234567890abcdefghijklmnopqrstuvwxyz" },
];

describe("buildSafeContext", () => {
    const safe = buildSafeContext(ITEMS, DEFAULT_PROJECT_POLICY);

    it("blocks protected files and excludes their content", () => {
        const envDecision = safe.decisions.find((d) => d.path === ".env.production")!;
        assert.strictEqual(envDecision.level, "protected");
        assert.strictEqual(envDecision.action, "block");
        assert.strictEqual(envDecision.included, false);
        assert.ok(!safe.safeText.includes("postgresql://user:password"));
    });

    it("summarizes sensitive files and requires approval, never raw secrets", () => {
        const authDecision = safe.decisions.find((d) => d.path === "src/auth/session.ts")!;
        assert.strictEqual(authDecision.level, "sensitive");
        assert.strictEqual(authDecision.action, "approval_required");
        assert.ok(!safe.safeText.includes("sk-test-soter-canary-123456789012345678"));
    });

    it("includes normal files with secrets redacted", () => {
        const btn = safe.decisions.find((d) => d.path === "src/components/Button.tsx")!;
        assert.strictEqual(btn.level, "normal");
        assert.strictEqual(btn.included, true);
        assert.strictEqual(btn.rawIncluded, false);
        assert.ok(!safe.safeText.includes("ghp_1234567890abcdefghijklmnopqrstuvwxyz"));
    });

    it("assembled safeText is free of every high-risk secret", () => {
        assert.strictEqual(findSurvivingSecrets(safe.safeText).length, 0);
    });

    it("summary counts add up", () => {
        assert.strictEqual(safe.summary.total, 3);
        assert.strictEqual(safe.summary.blocked, 1);
        assert.strictEqual(safe.summary.approvalRequired, 1);
        assert.ok(safe.summary.included >= 1);
    });
});

describe("safe prompt templates", () => {
    it("buildDebugPrompt wraps safe context and carries a security note, no secrets", () => {
        const prompt = buildDebugPrompt(ITEMS, DEFAULT_PROJECT_POLICY, "deployment fails");
        assert.match(prompt, /Security note/);
        assert.match(prompt, /deployment fails/);
        assert.strictEqual(findSurvivingSecrets(prompt).length, 0);
        assert.ok(!prompt.includes("AKIAIOSFODNN7EXAMPLE"));
    });
});
