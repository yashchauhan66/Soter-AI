import { describe, it } from "node:test";
import assert from "node:assert";
import {
    extractEnvSecrets,
    applyPlaceholders,
    restorePlaceholders,
    buildVaultMetadata,
    generateEnvExample,
    PLACEHOLDER_PREFIX,
} from "../Vault";
import { generateVaultKey, encryptVault, decryptVault } from "../VaultCrypto";
import { findSurvivingSecrets } from "../Redactor";

const ENV = [
    "# production secrets",
    "DATABASE_URL=postgresql://user:password@localhost:5432/prod",
    "OPENAI_API_KEY=sk-test-soter-canary-123456789012345678",
    "STRIPE_SECRET=sk_test_canarySoterFake1234567890",
    "PUBLIC_URL=https://example.com",
    "APP_NAME=demo",
].join("\n");

describe("Vault.extractEnvSecrets", () => {
    it("finds secret-bearing keys and skips non-secrets", () => {
        const found = extractEnvSecrets(ENV);
        const keys = found.map((c) => c.key).sort();
        assert.deepStrictEqual(keys, ["DATABASE_URL", "OPENAI_API_KEY", "STRIPE_SECRET"]);
        // PUBLIC_URL and APP_NAME are not vaulted.
        assert.ok(!keys.includes("PUBLIC_URL"));
        assert.ok(!keys.includes("APP_NAME"));
    });

    it("produces SOTERAI placeholders and correct offsets", () => {
        const found = extractEnvSecrets(ENV);
        for (const c of found) {
            assert.strictEqual(c.placeholder, `[${PLACEHOLDER_PREFIX}${c.key}]`);
            assert.strictEqual(ENV.slice(c.start, c.end), c.rawValue);
        }
    });
});

describe("Vault placeholder round-trip", () => {
    it("applyPlaceholders removes every raw secret", () => {
        const found = extractEnvSecrets(ENV);
        const masked = applyPlaceholders(ENV, found);
        assert.strictEqual(findSurvivingSecrets(masked).length, 0, "no secret may survive in the workspace file");
        for (const c of found) {
            assert.ok(masked.includes(c.placeholder), `placeholder for ${c.key} present`);
            assert.ok(!masked.includes(c.rawValue), `raw value for ${c.key} removed`);
        }
    });

    it("restorePlaceholders reverses the migration exactly", () => {
        const found = extractEnvSecrets(ENV);
        const masked = applyPlaceholders(ENV, found);
        const map: Record<string, string> = {};
        for (const c of found) map[c.placeholder] = c.rawValue;
        assert.strictEqual(restorePlaceholders(masked, map), ENV);
    });
});

describe("Vault metadata never stores raw values", () => {
    it("buildVaultMetadata carries a hash, not the secret", async () => {
        const found = extractEnvSecrets(ENV);
        for (const c of found) {
            const meta = await buildVaultMetadata(c, ".env.production");
            const serialized = JSON.stringify(meta);
            assert.ok(!serialized.includes(c.rawValue), `metadata for ${c.key} must not contain the raw value`);
            assert.ok(meta.hash && meta.hash.length >= 8, "metadata carries a hash");
            assert.strictEqual(meta.originalFile, ".env.production");
        }
    });
});

describe("generateEnvExample", () => {
    it("keeps keys, drops all secret values", () => {
        const example = generateEnvExample(ENV);
        assert.strictEqual(findSurvivingSecrets(example).length, 0);
        assert.match(example, /DATABASE_URL=<database_url>/);
        assert.match(example, /OPENAI_API_KEY=<api_key>/);
        assert.match(example, /APP_NAME=/);
        assert.ok(!example.includes("sk-test-soter-canary"));
    });
});

describe("VaultCrypto AES-256-GCM", () => {
    it("encrypt → decrypt round-trips and ciphertext hides the plaintext", async () => {
        const key = generateVaultKey();
        const plaintext = JSON.stringify({ secrets: [ENV] });
        const payload = await encryptVault(plaintext, key);
        assert.ok(!payload.includes("sk-test-soter-canary"), "ciphertext must not contain the raw secret");
        assert.ok(!payload.includes("postgresql://"), "ciphertext must not contain the raw db url");
        const decrypted = await decryptVault(payload, key);
        assert.strictEqual(decrypted, plaintext);
    });

    it("wrong key fails to decrypt", async () => {
        const key = generateVaultKey();
        const other = generateVaultKey();
        const payload = await encryptVault("hello", key);
        await assert.rejects(() => decryptVault(payload, other));
    });
});
