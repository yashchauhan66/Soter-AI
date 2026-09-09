import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("robots keeps render assets crawlable and private application routes blocked", () => {
  const robots = read("app/robots.ts");

  assert.doesNotMatch(robots, /["']\/_next\/["']/);
  assert.match(robots, /["']\/api\/["']/);
  assert.match(robots, /["']\/admin\/["']/);
  assert.match(robots, /["']\/dashboard\/["']/);
});

test("private and authentication surfaces emit noindex headers", () => {
  const config = read("next.config.mjs");

  assert.match(config, /X-Robots-Tag/);
  assert.match(config, /noindex, nofollow/);
  for (const route of ["/admin/:path*", "/dashboard/:path*", "/signin", "/signup"]) {
    assert.ok(config.includes(route), `missing noindex header rule for ${route}`);
  }
});

test("www host permanently redirects to the canonical apex host", () => {
  const config = read("next.config.mjs");

  assert.match(config, /value: "www\.soterai\.in"/);
  assert.match(config, /destination: "https:\/\/soterai\.in\/:path\*"/);
  assert.match(config, /permanent: true/);
});

test("sitemap includes high-value public tools and extension landing pages", () => {
  const sitemap = read("app/sitemap.ts");

  for (const route of [
    "/scanner",
    "/benchmark/methodology",
    "/extensions/browser",
    "/extensions/browser/chrome",
    "/extensions/browser/edge",
    "/extensions/ide",
    "/student-discount",
  ]) {
    assert.ok(sitemap.includes(`url: "${route}"`), `sitemap missing ${route}`);
  }
});

test("indexed case study has unique metadata and Article structured data", () => {
  const page = read("app/(public)/case-studies/prompt-injection-leaks-database/page.tsx");

  assert.match(page, /buildMetadata/);
  assert.match(page, /articleLd/);
  assert.match(page, /datePublished/);
});

test("llms discovery file does not advertise the private source repository", () => {
  const llms = read("public/llms.txt");

  assert.doesNotMatch(llms, /github\.com\/yashchauhan66\/Soter-AI/);
});

test("Search Console priority pages cover their demonstrated query clusters", () => {
  const platformHub = read("app/ai-platform-security/page.tsx");
  const mcp = read("app/mcp-security/page.tsx");

  for (const intent of [/windsurf security risks/i, /is windsurf safe/i, /secure windsurf ai usage/i]) {
    assert.match(platformHub, intent);
  }
  for (const intent of [/mcp permissions/i, /mcp access control/i, /mcp security scanner/i, /mcp protection/i]) {
    assert.match(mcp, intent);
  }
  assert.match(platformHub, /contentSections:|Windsurf security risks to review/);
  assert.match(mcp, /contentSections:/);
});

test("Search Console quick-win pages use query-aligned titles", () => {
  const promptInjection = read("app/prompt-injection-protection/page.tsx");
  const jailbreak = read("app/jailbreak-detection/page.tsx");
  const posts = read("lib/blog/posts.ts");

  // 85746062 deliberately shortened this SERP title to fit the 60-char budget
  // (the "| SoterAI" suffix is appended by the root layout); the on-page h1
  // keeps the full phrase, so the test asserts both.
  assert.match(promptInjection, /title: "Prompt Injection Protection: Direct & Indirect"/);
  assert.match(promptInjection, /h1: "Prompt injection protection for direct and indirect attacks"/);
  assert.match(jailbreak, /LLM Jailbreak Detection/);
  assert.match(posts, /How to Prevent Secret Leaks from AI Coding Tools/);
  assert.match(posts, /What Are LLM Guardrails\? Types, Examples and Architecture/);
  assert.match(posts, /What Is an AI Context Firewall\? Definition and Architecture/);
});

test("API hostname redirects indexed marketing routes to the canonical site", () => {
  const config = read("next.config.mjs");

  assert.match(config, /source: "\/integrations\/:path\*"/);
  assert.match(config, /value: "api\.soterai\.in"/);
  assert.match(config, /destination: "https:\/\/soterai\.in\/integrations\/:path\*"/);
});

test("windsurf route permanently redirects to the multi-platform hub", () => {
  const config = read("next.config.mjs");

  assert.match(config, /source: "\/windsurf-ai-security"/);
  assert.match(config, /destination: "\/ai-platform-security"/);
  assert.match(config, /permanent: true/);
  assert.ok(!existsSync("app/windsurf-ai-security"), "old windsurf route should not remain");
});

test("platform hub covers platforms, usefulness, gaps and real install links", () => {
  const hub = read("app/ai-platform-security/page.tsx");

  // Real, verified install targets (no invented store links).
  assert.match(hub, /VSCODE_MARKETPLACE_URL/);
  assert.match(hub, /OPEN_VSX_URL/);
  assert.match(hub, /n8n-nodes-soterai/);
  assert.match(hub, /--install-extension/);
  assert.match(hub, /Market gaps this fills/);
  // Platform coverage spans the surfaces the product actually secures.
  for (const surface of [/VS Code/, /Cursor/, /Windsurf/, /Chrome/, /n8n/]) {
    assert.match(hub, surface);
  }
  assert.match(hub, /Honest limitations/);
});
