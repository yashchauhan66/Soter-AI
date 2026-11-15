import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const ROOT = process.cwd();
const nativeRequire = createRequire(path.join(ROOT, "package.json"));
const snapshot = process.env.SOTER_BRANDING_SNAPSHOT;
const consumed = new Map<string, string>();
const modules = new Map<string, Module>();

function source(rel: string): string {
  const frozen = snapshot ? path.join(snapshot, rel + ".source.txt") : undefined;
  const file = frozen && existsSync(frozen) ? frozen : path.join(ROOT, rel);
  const raw = readFileSync(file);
  consumed.set(rel, createHash("sha256").update(raw).digest("hex"));
  return raw.toString("utf8");
}

// Structural adapters only. Production Next.js image/card rendering is verified
// separately in the real built application; these are not pixel or network tests.
function ImageAdapter(props: Record<string, unknown>): React.ReactElement {
  const { priority: _priority, ...rest } = props;
  return React.createElement("img", rest);
}
class CardAdapter {
  constructor(readonly element: React.ReactElement, readonly options: unknown) {}
}

function load(rel: string): Record<string, unknown> {
  const cached = modules.get(rel);
  if (cached) return cached.exports as Record<string, unknown>;
  const filename = path.join(ROOT, rel);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(ROOT, "node_modules")];
  modules.set(rel, mod);
  mod.require = (id: string) => {
    if (id === "next/image") return { __esModule: true, default: ImageAdapter };
    if (id === "next/og") return { ImageResponse: CardAdapter };
    if (id.startsWith("@/")) {
      const base = id.slice(2);
      const target = [base + ".ts", base + ".tsx", base + "/index.ts"].find((p) => existsSync(path.join(ROOT, p)));
      assert.ok(target, `Missing local module ${id}`);
      return load(target);
    }
    return nativeRequire(id);
  };
  const output = ts.transpileModule(source(rel), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal((output.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  (mod as unknown as { _compile(code: string, file: string): void })._compile("const React = require('react');\n" + output.outputText, filename);
  return mod.exports as Record<string, unknown>;
}

function logo(props: { size?: number; showWordmark?: boolean; wordmarkId?: string; priority?: boolean } = {}): string {
  const component = load("components/layout/Logo.tsx").Logo as React.ComponentType<typeof props>;
  return renderToStaticMarkup(React.createElement(component, props));
}
const text = (html: string) => html.replace(/<[^>]*>/g, "");

test("the public wordmark reads SoterAI, not a domain address", () => {
  assert.equal(text(logo()), "SoterAI");
  assert.doesNotMatch(logo(), />\.in</);
});

test("the custom symbol has one continuous SoterAI label without an AI badge", () => {
  const html = logo({ size: 30, wordmarkId: "test-brand" });
  assert.match(html, /data-brand-geometry="selected-hexagon"/);
  assert.match(html, /class="[^"]*soter-wordmark/);
  assert.match(html, /id="test-brand"/);
  assert.equal(text(html), "SoterAI");
  assert.doesNotMatch(html, />AI<\/span>/);
  assert.match(html, /src="\/brand\/selected\/symbol\.png"/);
});

test("production renders the selected asset while preview overrides stay development-only", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SOTER_BRAND_PREVIEW: process.env.NEXT_PUBLIC_SOTER_BRAND_PREVIEW,
    NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA: process.env.NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA,
  };
  // Tests the data-image delivery contract; browser evidence separately pins the selected artwork.
  const image = 'data:image/png;base64,' + readFileSync(path.join(ROOT, 'public/logo-mark@2x.png')).toString('base64');
  try {
    Object.assign(process.env, { NODE_ENV: "development", NEXT_PUBLIC_SOTER_BRAND_PREVIEW: "option-2", NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA: image });
    const preview = logo({ size: 36, wordmarkId: "selected-hexagon-name" });
    assert.match(preview, /data-brand-geometry="selected-hexagon"/);
    assert.ok(preview.includes('src="' + image + '"'));
    assert.equal(text(preview), "SoterAI");
    assert.match(preview, /id="selected-hexagon-name"/);
    Object.assign(process.env, { NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA: "https://untrusted.invalid/image.png" });
    assert.match(logo(), /src="\/brand\/selected\/symbol\.png"/);
    Object.assign(process.env, { NODE_ENV: "production", NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA: image });
    assert.match(logo(), /src="\/brand\/selected\/symbol\.png"/);
    assert.doesNotMatch(logo(), /data:image\/png/);
    assert.match(logo(), /data-brand-geometry="selected-hexagon"/);
    assert.equal(createHash("sha256").update(readFileSync(path.join(ROOT, "public/brand/selected/symbol.png"))).digest("hex"), "bcbc6cd5335ae9ad147ff93d760b62d3e85ff951de66f819d1e60c590157b15c");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("compact mark-only usage retains its decorative image contract", () => {
  const html = logo({ size: 24, showWordmark: false, priority: true });
  assert.equal(text(html), "");
  assert.match(html, /width="24"/);
  assert.match(html, /height="24"/);
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
});

test("public SEO uses SoterAI while canonical domain and entity addresses stay unchanged", () => {
  const seo = load("lib/seo/schema.ts");
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";
  assert.equal(seo.SITE_NAME, "SoterAI");
  assert.equal(seo.SITE_URL, siteUrl);
  assert.equal(seo.ORGANIZATION_ID, siteUrl + "#organization");
  assert.equal(seo.WEBSITE_ID, siteUrl + "#website");
  const organization = seo.organizationNode as { name: string; url: string; email: string; alternateName: string; sameAs: string[] };
  assert.equal(organization.name, "SoterAI");
  assert.equal(organization.alternateName, "soterai.in");
  assert.equal(organization.url, siteUrl);
  assert.equal(organization.email, "support@soterai.in");
  assert.ok(organization.sameAs.includes("https://www.npmjs.com/package/@soterai/core"));
});

test("page metadata names SoterAI without duplicating it or rewriting canonical routes", () => {
  const build = load("lib/seo/metadata.ts").buildMetadata as (input: { title: string; description: string; path: string }) => {
    title: unknown; alternates: { canonical: string }; openGraph: { siteName: string; url: string };
  };
  const branded = build({ title: "SoterAI integration guide", description: "A scoped branding regression fixture.", path: "/docs" });
  assert.deepEqual(branded.title, { absolute: "SoterAI integration guide" });
  assert.equal(branded.alternates.canonical, "/docs");
  assert.equal(branded.openGraph.siteName, "SoterAI");
  assert.equal(branded.openGraph.url, (process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in") + "/docs");
});

test("share-card branding reads SoterAI while the honest qualifier and dimensions remain", () => {
  const render = load("lib/og/renderCard.tsx").renderOgCard as (card: { kicker: string; title: string }) => CardAdapter;
  const card = render({ kicker: "Branding fixture", title: "One guarded request" });
  const html = renderToStaticMarkup(card.element);
  assert.ok(text(html).includes("SoterAI"));
  assert.ok(text(html).includes("Numbers come with their limits"));
  assert.ok(!text(html).includes("soterai.in"));
  assert.deepEqual(card.options, { width: 1200, height: 630 });
});

test("the header's accessible home name is connected to the visible SoterAI wordmark", () => {
  const header = source("components/layout/SiteChrome.tsx");
  assert.ok(header.includes('aria-labelledby="site-header-wordmark site-header-home"'));
  assert.ok(header.includes('wordmarkId="site-header-wordmark"'));
  assert.ok(header.includes('id="site-header-home"'));
  // This canonical-address attribute remains for existing selector consumers.
  // aria-labelledby supplies the displayed brand name to assistive technology.
  assert.ok(header.includes('aria-label="soterai.in home"'));
});

test("homepage, footer and navigation use the display name without changing safety copy or email", () => {
  const home = source("app/page.tsx");
  assert.match(home, /title:\s*'[^']*\| SoterAI'/);
  assert.ok(home.includes("<HomeIntro />"));
  assert.ok(source("components/sa/HomeIntro.tsx").includes("Use sample data, not real secrets."));
  const footer = source("components/layout/SiteFooter.tsx");
  assert.ok(footer.includes("SoterAI lowers risk and misses things."));
  assert.ok(footer.includes('mailto:support@soterai.in'));
  assert.ok(footer.includes("not independently audited"));
  assert.ok(source("lib/navigation.ts").includes("Build with SoterAI"));
});

process.on("exit", () => console.log("SOTER_BRANDING_CONSUMED " + JSON.stringify(Object.fromEntries(consumed))));
