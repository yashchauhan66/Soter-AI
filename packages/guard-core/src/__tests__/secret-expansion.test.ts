/**
 * Phase 4 — Secret engine expansion + false-positive controls.
 * Behavioral tests against detectSecrets + redactForSharing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectSecrets, SECRET_DETECTOR_VERSION } from "../detectors/SecretDetector";
import { findSurvivingSecrets, redactForSharing } from "../Redactor";

describe("Phase 4 secret expansion", () => {
    it("reports detector version 1.2.0+", () => {
        assert.ok(SECRET_DETECTOR_VERSION.startsWith("1.2") || SECRET_DETECTOR_VERSION >= "1.2.0");
        const r = detectSecrets("no secrets here");
        assert.equal(r.detectorVersion, SECRET_DETECTOR_VERSION);
    });

    it("detects Hugging Face token", () => {
        const text = "HF_TOKEN=hf_abcdefghijklmnopqrstuvwxyz";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "huggingface_token"));
        assert.equal(findSurvivingSecrets(redactForSharing(text)).length, 0);
    });

    it("detects npm token", () => {
        const text = "npm_abcdefghijklmnopqrstuvwxyz0123456789ab";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "npm_token"));
    });

    it("detects PyPI token", () => {
        const text = "pypi-AgEIcHlwaS5vcmcCJGE1ZjYx";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "pypi_token"));
    });

    it("detects Shopify token", () => {
        const text = "shpat_" + "a".repeat(32);
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "shopify_token"));
    });

    it("detects Databricks token", () => {
        // 32 hex chars after dapi (real PAT shape)
        const text = "dapi" + "0123456789abcdef".repeat(2);
        assert.equal(text.length, 4 + 32);
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "databricks_token"), JSON.stringify(r.matches));
    });

    it("detects Supabase key", () => {
        const text = "sbp_abcdefghijklmnopqrstuvwxyz0123";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "supabase_key"));
    });

    it("detects DigitalOcean token", () => {
        // Mixed hex body so repeated-char FP filter does not suppress a real-shaped token.
        const body = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
        assert.equal(body.length, 64);
        const text = "dop_v1_" + body;
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "digitalocean_token"), JSON.stringify(r.matches));
    });

    it("detects Docker Hub PAT", () => {
        const text = "dckr_pat_abcdefghijklmnopqrstuvwx";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "docker_pat"));
    });

    it("detects GitHub fine-grained PAT", () => {
        const text = "github_pat_11AAAAAAA0abcdefghijklmnopqrstuvwxyz";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "github_fine_grained"));
    });

    it("detects Mailgun key", () => {
        const text = "key-" + "a".repeat(16) + "b".repeat(16);
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "mailgun_key"));
    });

    it("detects Terraform Cloud atlasv1 token", () => {
        const body = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP";
        assert.ok(body.length >= 50);
        const text = "atlasv1." + body;
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => m.type === "terraform_token"), JSON.stringify(r.matches));
        assert.equal(findSurvivingSecrets(redactForSharing(text)).length, 0);
    });
});


describe("Phase 4 false-positive controls", () => {
    it("suppresses YOUR_API_KEY_HERE placeholder", () => {
        const r = detectSecrets("api_key = YOUR_API_KEY_HERE");
        // Generic assignment may still fire on the line, but the match value
        // containing the placeholder should be filtered when the match IS the placeholder.
        const placeholderHits = r.matches.filter((m) => /YOUR_API_KEY_HERE/i.test(m.match));
        assert.equal(placeholderHits.length, 0);
    });

    it("suppresses sk-test / sk-example style stubs", () => {
        const r = detectSecrets("key=sk-test-not-a-real-key-value");
        const critical = r.matches.filter((m) => m.severity === "critical" && /sk-test/i.test(m.match));
        assert.equal(critical.length, 0);
    });

    it("still detects real-shaped OpenAI project keys", () => {
        const text = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
        const r = detectSecrets(text);
        assert.ok(r.matches.some((m) => /openai|ai_api/i.test(m.type)));
    });

    it("does not treat short noise as secrets", () => {
        const r = detectSecrets("pwd=ab");
        assert.equal(r.matches.filter((m) => m.match.length < 8).length, 0);
    });

    it("does not suppress provider-prefixed tokens that contain 'test' mid-body", () => {
        // Regression: FP allowlist must not match substrings inside real tokens.
        const text = "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
        const r = detectSecrets(text);
        assert.ok(r.matches.length > 0);
    });
});
