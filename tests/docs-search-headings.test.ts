import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDocsIndex, searchDocs, type DocsSearchDocument } from "../lib/docs/search";

const service: DocsSearchDocument = {
  href: "/docs/services/transaction-escrow",
  title: "Transaction Escrow",
  section: "Control",
  kind: "service",
  summary: "Review a held action before approval.",
  body: "Create a record before executing the action.",
  keywords: ["held-action"],
  headings: [
    { id: "setup", title: "Set up this service", text: "Create a Transaction Escrow record." },
    { id: "limitations", title: "Limitations to review", text: "No financial settlement is performed." },
  ],
};

test("heading titles alone make a document eligible for search", () => {
  const hit = searchDocs([service], "limitations")[0];
  assert.equal(hit?.href, `${service.href}#limitations`);
  assert.equal(hit?.heading, "Limitations to review");
});

test("section text alone makes a document eligible for search", () => {
  const hit = searchDocs([service], "financial settlement")[0];
  assert.equal(hit?.href, `${service.href}#limitations`);
  assert.match(hit?.excerpt ?? "", /financial settlement/);
});

test("document title plus section terms selects the requested heading", () => {
  assert.equal(searchDocs([service], "Transaction Escrow limitations")[0]?.href, `${service.href}#limitations`);
  assert.equal(searchDocs([service], "Transaction Escrow financial settlement")[0]?.href, `${service.href}#limitations`);
});

test("document aliases can supply context for heading title or text queries", () => {
  assert.equal(searchDocs([service], "held-action limitations")[0]?.href, `${service.href}#limitations`);
  assert.equal(searchDocs([service], "held-action financial settlement")[0]?.href, `${service.href}#limitations`);
});

test("heading context preserves query normalization", () => {
  const hit = searchDocs([service], "  ＴＲＡＮＳＡＣＴＩＯＮ   ＥＳＣＲＯＷ  limitations LIMITATIONS ")[0];
  assert.equal(hit?.href, `${service.href}#limitations`);
});

test("heading content does not admit a document missing a query term", () => {
  for (const query of ["Transaction Escrow nonexistent", "limitations nonexistent", "financial nonexistent"]) {
    assert.deepEqual(searchDocs([service], query), [], query);
  }
});

test("document-only queries do not select an unrelated heading", () => {
  const withoutSetup = { ...service, headings: service.headings.slice(1) };
  assert.equal(searchDocs([withoutSetup], "Transaction Escrow")[0]?.href, service.href);
  assert.equal(searchDocs([withoutSetup], "held-action")[0]?.href, service.href);
  assert.equal(searchDocs([service], "Transaction Escrow")[0]?.href, `${service.href}#setup`);
});

test("section selection does not borrow unrelated body or other section terms", () => {
  for (const query of ["approval limitations", "executing limitations", "record limitations"]) {
    assert.equal(searchDocs([service], query)[0]?.href, service.href, query);
  }
});

test("existing full-query heading matches keep priority over contextual fallbacks", () => {
  const page = { ...service, headings: [
    service.headings[1],
    { id: "details", title: "Details", text: "Transaction Escrow limitations are documented here." },
  ] };
  assert.equal(searchDocs([page], "Transaction Escrow limitations")[0]?.href, `${service.href}#details`);
});

test("heading hits retain exact-title ranking and stable document order", () => {
  const second = { ...service, href: "/docs/services/second" };
  const exact = { ...service, href: "/docs/limitations", title: "Limitations", headings: [] };
  assert.deepEqual(searchDocs([service, second, exact], "limitations").map((hit) => hit.href), [
    exact.href, `${service.href}#limitations`, `${second.href}#limitations`,
  ]);
});

test("heading hits respect existing caps and empty-query defaults", () => {
  const pages = Array.from({ length: 25 }, (_, index) => ({ ...service, href: `/docs/item-${index}` }));
  const quickstart = { ...service, href: "/docs/quickstart" };
  assert.equal(searchDocs(pages, "limitations").length, 8);
  assert.equal(searchDocs(pages, "limitations", 100).length, 20);
  assert.equal(searchDocs(pages, "limitations", 2.9).length, 2);
  assert.equal(searchDocs(pages, "limitations", Number.NaN).length, 8);
  assert.deepEqual(searchDocs(pages, "limitations", -1), []);
  assert.equal(searchDocs([...pages, quickstart], "")[0]?.href, quickstart.href);
  assert.equal(searchDocs([...pages, quickstart], "")[0]?.heading, undefined);
});

const corpus = parseDocsIndex(JSON.parse(readFileSync("public/docs-search-index.json", "utf8")));

test("published corpus resolves the reported service plus heading query", () => {
  assert.ok(corpus);
  assert.equal(searchDocs(corpus, "Transaction Escrow limitations")[0]?.href, `${service.href}#limitations`);
  assert.equal(searchDocs(corpus, "Transaction Escrow")[0]?.href, `${service.href}#setup`);
});

test("every published heading-title query resolves on its page in isolation", (context) => {
  assert.ok(corpus);
  const cases = corpus.flatMap((page) => page.headings.map((heading) => {
    const hit = searchDocs([page], heading.title)[0];
    const selected = page.headings.find((item) => hit?.href === `${page.href}#${item.id}`);
    const terms = heading.title.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
    const selectedText = `${selected?.title} ${selected?.text}`.normalize("NFKC").toLowerCase();
    // Multiple headings may contain the full query; retain existing stable ties.
    return { page: page.href, query: heading.title, actual: hit?.href,
      matches: Boolean(selected) && terms.every((term) => selectedText.includes(term)) };
  }));
  const failures = cases.filter((item) => !item.matches);
  const headings = corpus.reduce((count, page) => count + page.headings.length, 0);
  assert.ok(headings > 0);
  assert.equal(cases.length, headings);
  context.diagnostic(JSON.stringify({ pages: corpus.length, headings, queries: cases.length, failures: failures.length }));
  assert.deepEqual(failures, []);
});
