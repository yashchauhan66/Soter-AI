import assert from "node:assert/strict";
import test from "node:test";
import { createStorageSafeScanResult } from "../../apps/extension/src/lib/privacy-preview";
import { scanPrompt } from "../../apps/extension/src/lib/scanner";
import { defaultState } from "../../apps/extension/src/lib/storage";

test("clean prompt storage state contains only hash, length, metadata and marker", async () => {
  const raw = "How do I implement error handling in React?";
  const result = scanPrompt(raw, "https://chatgpt.com/", defaultState);
  const stored = await createStorageSafeScanResult(result, raw);
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes(raw), false);
  assert.equal(stored.redactedText, "[CLEAN_PROMPT_NOT_STORED]");
  assert.equal(stored.length, raw.length);
  assert.match(stored.textHash ?? "", /^[a-f0-9]{64}$/);
});

test("private key and fake API key cannot enter stored scan state", async () => {
  const key = "synthetic_api_key_value";
  const raw = `API_KEY=${key}\n-----BEGIN PRIVATE KEY-----\nfake-private-material\n-----END PRIVATE KEY-----`;
  const result = scanPrompt(raw, "https://chatgpt.com/", defaultState);
  const stored = await createStorageSafeScanResult(result, raw);
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes(key), false);
  assert.equal(serialized.includes("fake-private-material"), false);
  assert.match(serialized, /REDACTED_(?:API_KEY|ENV_VAR)/);
});
