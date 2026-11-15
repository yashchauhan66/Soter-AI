import assert from "node:assert/strict";
import test from "node:test";
import { extractDocsText } from "../scripts/docs/search-source";

test("index extraction finds JSX text, code examples, tables and real heading targets", () => {
  const value = extractDocsText(`
    import { Thing } from "private-module";
    const example = \`const safeText = result.safeText;\`;
    const rows = [["429", "Read Retry-After when present"]];
    export default function Page() { return <section className="secret-layout-utility">
      <DocsHeading id="errors">Errors &amp; retries</DocsHeading>
      <p>Never forward denied output.</p><CodeBlock>{example}</CodeBlock>
    </section>; }
  `);
  assert.match(value.body, /safeText/);
  assert.match(value.body, /Retry-After/);
  assert.doesNotMatch(value.body, /private-module|secret-layout-utility/);
  assert.equal(value.headings[0]?.id, "errors");
  assert.equal(value.headings[0]?.title, "Errors & retries");
});

test("derived heading slugs reuse the same function as rendered headings", () => {
  const value = extractDocsText(`<section><DocsHeading>What you'll build</DocsHeading><p>One guarded call.</p></section>`);
  assert.equal(value.headings[0]?.id, "what-youll-build");
  assert.match(value.headings[0]?.text ?? "", /One guarded call/);
});

test("raw headings without IDs never create invented deep links", () => {
  const value = extractDocsText(`<><h2>Not linkable</h2><h2 id="real-target">Linkable</h2></>`);
  assert.equal(value.headings.length, 1);
  assert.equal(value.headings[0]?.id, "real-target");
});
