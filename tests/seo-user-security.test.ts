import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("AI user security pillar targets the intended query without absolute claims", () => {
  const page = read("app/ai-user-security/page.tsx");

  assert.match(page, /AI User Security/);
  assert.match(page, /employee use of ChatGPT/i);
  assert.match(page, /shadow AI/i);
  assert.match(page, /limitations:/);
  assert.doesNotMatch(page, /100% secure|guaranteed protection|fully compliant/i);
});

test("AI user security pillar is discoverable from crawl and authority surfaces", () => {
  const sitemap = read("app/sitemap.ts");
  const homepage = read("app/page.tsx");
  const homepageSolutions = read("components/marketing/TwoProducts.tsx");
  // Footer links moved out of SiteChrome into a dedicated server component and
  // now read from the shared navigation tree, so both files are checked: the
  // footer for rendering, and lib/navigation.ts for the link data itself.
  const footer = read("components/layout/SiteFooter.tsx");
  const navigation = read("lib/navigation.ts");
  const llms = read("public/llms.txt");

  for (const source of [sitemap, homepage, homepageSolutions, navigation, llms]) {
    assert.match(source, /\/ai-user-security/);
  }

  // The footer must render the navigation groups rather than hard-coding links.
  assert.match(footer, /FOOTER_NAV/);
});

test("public homepage solution cards do not send prospects into private dashboards", () => {
  const homepageSolutions = read("components/marketing/TwoProducts.tsx");

  assert.doesNotMatch(homepageSolutions, /href: "\/dashboard\//);
  assert.match(homepageSolutions, /href: "\/ai-agent-security"/);
});

test("site-wide structured data uses verifiable organization entities", () => {
  const schema = read("lib/seo/schema.ts");

  assert.doesNotMatch(schema, /"@type": "LocalBusiness"/);
  assert.doesNotMatch(schema, /"@type": "SearchAction"/);
  assert.match(schema, /"@graph": \[organizationNode, websiteNode\]/);
});