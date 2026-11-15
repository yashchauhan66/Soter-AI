import assert from "node:assert/strict";
import test from "node:test";
import { parseDocsIndex, searchDocs, type DocsSearchDocument } from "../lib/docs/search";

const pages: DocsSearchDocument[] = [
  { href: "/docs/quickstart", title: "Quickstart", section: "Get started", kind: "guide", summary: "Inspect your first request.", body: "Server-side SDK setup.", keywords: ["setup"], headings: [] },
  { href: "/docs/api-contract", title: "API reference", section: "SDKs & API", kind: "guide", summary: "Guard request and response fields.", body: "Read Retry-After when present on rate-limit responses. ALLOW_WITH_REDACTION needs returned safeText.", keywords: ["http"], headings: [{ id: "error-codes", title: "Error Codes", text: "Read Retry-After when present on a 429 response." }] },
  { href: "/docs/services/transaction-escrow", title: "Transaction Escrow", section: "Control", kind: "service", summary: "Review a held action before approval.", body: "POST /api/escrow/create requires the documented authorization. No financial settlement is performed.", keywords: [], headings: [] },
];

test("search finds service guides as first-class results", () => {
  assert.equal(searchDocs(pages, "transaction escrow")[0]?.href, "/docs/services/transaction-escrow");
  assert.equal(searchDocs(pages, "/api/escrow/create")[0]?.kind, "service");
});

test("full-text search returns a real section target and contextual excerpt", () => {
  const hit = searchDocs(pages, "retry-after")[0];
  assert.equal(hit?.href, "/docs/api-contract#error-codes");
  assert.match(hit?.excerpt ?? "", /Retry-After/);
});

test("search combines query terms and normalizes case and spacing", () => {
  assert.equal(searchDocs(pages, "  TRANSACTION   escrow  ")[0]?.title, "Transaction Escrow");
  assert.equal(searchDocs(pages, "returned safeText")[0]?.title, "API reference");
  assert.deepEqual(searchDocs(pages, "transaction retry-after"), []);
  assert.deepEqual(searchDocs(pages, "unfindable-term"), []);
});

test("empty search offers an honest useful starting point and respects limits", () => {
  assert.equal(searchDocs(pages, "")[0]?.href, "/docs/quickstart");
  assert.equal(searchDocs(pages, "", 2).length, 2);
  assert.deepEqual(searchDocs(pages, "", 0), []);
});

test("index validation accepts only a bounded same-site docs corpus", () => {
  assert.equal(parseDocsIndex({version: 1, pages})?.length, 3);
  for (const href of ["javascript:alert(1)", "//evil.invalid/docs", "/docs/../dashboard", "/docs?q=private", "https://evil.invalid/docs"]) {
    assert.equal(parseDocsIndex({version:1,pages:[{...pages[0],href}]}), null, href);
  }
  assert.equal(parseDocsIndex({version: 1, pages: [pages[0],pages[0]]}), null);
  assert.equal(parseDocsIndex({version: 99, pages}), null);
  assert.equal(parseDocsIndex({version: 1, pages: [{...pages[0],body:null}]}), null);
  assert.equal(parseDocsIndex({version: 1, pages: [{...pages[0],headings:[{id:'bad target',title:'Title',text:'text'}]}]}), null);
});
