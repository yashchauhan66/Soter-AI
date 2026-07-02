import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map<string, unknown>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      async get(keys: string[]) { return Object.fromEntries(keys.map((key) => [key, storage.get(key)])); },
      async set(items: Record<string, unknown>) { for (const [k, v] of Object.entries(items)) v === undefined ? storage.delete(k) : storage.set(k, v); },
    },
  },
  runtime: { sendMessage() {} },
};

import { matchSourceApp, type SourceAppConfig } from "../../apps/extension/src/lib/source-apps";
import { createLineageContext, saveLineageContext, getFreshLineageContext, clearLineageContext, redactUrl, LINEAGE_CONTEXT_TTL_MS } from "../../apps/extension/src/lib/lineage-context";

const apps: SourceAppConfig[] = [
  { id: "1", name: "GitHub", domains: ["github.com"], category: "source_code", enabled: true, sensitivity: "high" },
  { id: "2", name: "Google Docs", domains: ["docs.google.com"], category: "document", enabled: true, sensitivity: "high" },
  { id: "3", name: "Disabled CRM", domains: ["crm.internal"], category: "crm", enabled: false, sensitivity: "critical" },
];

test("configured source domain matches a source app", () => {
  const match = matchSourceApp("https://github.com/acme/secret-repo", apps);
  assert.equal(match?.name, "GitHub");
  assert.equal(match?.category, "source_code");
});

test("subdomain of configured source app matches", () => {
  assert.equal(matchSourceApp("https://gist.github.com/x", apps)?.name, "GitHub");
});

test("unrelated site is ignored (no monitoring)", () => {
  assert.equal(matchSourceApp("https://news.ycombinator.com/", apps), undefined);
  assert.equal(matchSourceApp("https://chatgpt.com/", apps), undefined);
});

test("disabled source app does not match", () => {
  assert.equal(matchSourceApp("https://crm.internal/leads", apps), undefined);
});

test("lineage context stores hashes, never raw copied text", async () => {
  const secret = "Customer Acme Corp renewal INR 42 lakh, contact priya@example.com";
  const ctx = await createLineageContext(apps[0], secret, "https://github.com/acme/deal?token=abc", "Deal notes");
  const serialized = JSON.stringify(ctx);
  // The full raw selection is never persisted verbatim, and detected PII is redacted from the preview.
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("priya@example.com"), false);
  assert.equal(serialized.includes("token=abc"), false);
  assert.match(ctx.selectedTextHash, /^[a-f0-9]{64}$/);
});

test("source URL is hashed/redacted and query string dropped", async () => {
  const ctx = await createLineageContext(apps[0], "some selected text here", "https://github.com/acme/deal?token=SECRET", "t");
  assert.match(ctx.sourceUrlHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(ctx).includes("SECRET"), false);
  assert.equal(redactUrl("https://github.com/acme/deal?token=SECRET&x=1"), "https://github.com/acme/deal");
});

test("fresh lineage context is retrievable, then expires after TTL", async () => {
  const now = 1_000_000;
  const ctx = await createLineageContext(apps[1], "quarterly figures spreadsheet content", "https://docs.google.com/d/1", "Q3", now);
  await saveLineageContext(ctx);
  assert.ok(await getFreshLineageContext(now + 60_000)); // within TTL
  const expired = await getFreshLineageContext(now + LINEAGE_CONTEXT_TTL_MS + 1);
  assert.equal(expired, null); // expired context is cleared
  assert.equal(await getFreshLineageContext(now + 60_000), null); // and removed from storage
});

test("clearing lineage context removes it", async () => {
  const ctx = await createLineageContext(apps[0], "text to clear from storage now", "https://github.com/x", "t");
  await saveLineageContext(ctx);
  await clearLineageContext();
  assert.equal(await getFreshLineageContext(), null);
});

test("locally scanned data types are summarised into the context", async () => {
  const ctx = await createLineageContext(apps[0], "aws key AKIAIOSFODNN7EXAMPLE and email a@b.com", "https://github.com/x", "t");
  assert.ok(Array.isArray(ctx.detectedDataTypes));
});
