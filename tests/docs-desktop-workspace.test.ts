import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import test, { after } from "node:test";
import { runInThisContext } from "node:vm";
import type { ReactElement, ReactNode } from "react";

// Only dependency resolution can use the preserved tree. Every product source
// file is loaded from sourceRoot, recorded below, and is never copied or mocked.
const sourceRoot = resolve(process.env.DOCS_WORKSPACE_SOURCE ?? process.cwd());
const dependencyRoot = resolve(process.env.DOCS_WORKSPACE_DEPS ?? process.cwd());
const dependencyRequire = createRequire(resolve(dependencyRoot, "package.json"));
const React = dependencyRequire("react") as typeof import("react");
const { renderToStaticMarkup } = dependencyRequire("react-dom/server") as typeof import("react-dom/server");
const ts = dependencyRequire("typescript") as typeof import("typescript");
const modules = new Map<string, { exports: Record<string, unknown> }>();
const consumed = new Map<string, string>();

function loadSource(relativeFile: string): Record<string, unknown> {
  const file = resolve(sourceRoot, relativeFile);
  assert.ok(file.startsWith(sourceRoot + sep), `source escapes the selected tree: ${file}`);
  const cached = modules.get(file);
  if (cached) return cached.exports;
  const module = { exports: {} as Record<string, unknown> };
  modules.set(file, module);
  const source = readFileSync(file, "utf8");
  consumed.set(file, createHash("sha256").update(source).digest("hex"));
  const compiled = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, `invalid source: ${file}`);
  const localRequire = (id: string): unknown => {
    // CSS is a Next build concern; geometry is verified in the browser suite.
    if (id.endsWith(".css")) return {};
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? resolve(sourceRoot, id.slice(2)) : resolve(dirname(file), id);
      const candidates = extname(target) ? [target] : [target + ".ts", target + ".tsx", target + "/index.ts"];
      const found = candidates.find((candidate) => existsSync(candidate));
      assert.ok(found, `local dependency not found: ${id} from ${file}`);
      if (extname(found) === ".json") return JSON.parse(readFileSync(found, "utf8"));
      return loadSource(found);
    }
    return dependencyRequire(id);
  };
  const execute = runInThisContext(`(function(exports, require, module) {${compiled.outputText}\n})`, { filename: file });
  execute(module.exports, localRequire, module);
  return module.exports;
}

type Element = ReactElement<{ children?: ReactNode; className?: string; [key: string]: unknown }>;
function elements(node: ReactNode, ancestors: Element[] = []): Array<{ element: Element; ancestors: Element[] }> {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const element = child as Element;
    return [{ element, ancestors }, ...elements(element.props.children, [...ancestors, element])];
  });
}

function render(file: string, name = "default", props: Record<string, unknown> = {}): string {
  const component = loadSource(file)[name] as React.ComponentType<Record<string, unknown>>;
  return renderToStaticMarkup(React.createElement(component, props));
}

after(() => {
  console.log(JSON.stringify({
    sourceRoot,
    dependencyRoot,
    resolver: Object.fromEntries(["react", "react-dom/server", "typescript"].map((id) => [id, dependencyRequire.resolve(id)])),
    consumed: Object.fromEntries(consumed),
  }));
});

test("the responsive workspace mounts one search in the shared toolbar", () => {
  const Layout = loadSource("app/docs/layout.tsx").default as (props: { children: ReactNode }) => ReactNode;
  const Search = loadSource("components/docs/DocsSearch.tsx").DocsSearch;
  const tree = elements(Layout({ children: React.createElement("p", null, "Guide body") }));
  const searches = tree.filter(({ element }) => element.type === Search);
  assert.equal(searches.length, 1, "desktop and mobile must share one search/modal owner");
  assert.ok(searches[0].ancestors.some(({ props }) => props.className?.split(" ").includes("docs-toolbar")), "search belongs in the common toolbar");
  assert.ok(tree.some(({ element }) => element.props.className?.split(" ").includes("docs-workspace")), "docs styles must have their own workspace boundary");
  assert.ok(!tree.some(({ element }) => element.props.className?.split(" ").includes("container-page")), "the marketing container must not squeeze desktop docs");
});

test("guide shell keeps scope visible before code without a warning billboard", () => {
  const scope = loadSource("lib/docs/scope.ts").DOCS_SCOPE as Record<string, string[]>;
  const html = render("components/docs/DocsPageShell.tsx", "DocsPageShell", {
    path: "/docs/quickstart", children: React.createElement("pre", null, "EXAMPLE_BODY"),
  });
  assert.match(html, /class="docs-scope"/, "scope is an editorial section, not a large warning panel");
  assert.match(html, /<article[^>]*class="docs-article"/, "code and tables get the full reading lane");
  assert.match(html, /class="docs-page-grid"/, "the quiet outline has a separate track");
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  for (const note of scope["/docs/quickstart"]) {
    const escaped = renderToStaticMarkup(React.createElement("span", null, note)).replace(/^<span>|<\/span>$/g, "");
    assert.ok(html.includes(escaped), `preserve scope note: ${note}`);
  }
  assert.ok(html.indexOf('id="docs-scope"') < html.indexOf("EXAMPLE_BODY"), "scope must precede copied code");
  assert.match(html, /aria-label="Guide navigation"/);
  assert.match(html, /href="\/support"/);
});

test("service details keep their parent taxonomy entry current without prefix collisions", () => {
  const { PathnameContext } = dependencyRequire("next/dist/shared/lib/hooks-client-context.shared-runtime") as { PathnameContext: React.Context<string | null> };
  const Sidebar = loadSource("components/docs/DocsSidebar.tsx").DocsSidebar as React.ComponentType;
  const atPath = (path: string) => renderToStaticMarkup(React.createElement(PathnameContext.Provider, { value: path }, React.createElement(Sidebar)));
  const detail = atPath("/docs/services/prompt-injection");
  assert.match(detail, /<a[^>]*aria-current="location"[^>]*href="\/docs\/services"/, "a service detail must retain its place in the taxonomy");
  assert.equal((detail.match(/aria-current=/g) ?? []).length, 1);
  const exact = atPath("/docs/services");
  assert.match(exact, /<a[^>]*aria-current="page"[^>]*href="\/docs\/services"/);
  assert.doesNotMatch(atPath("/docs/services-unrelated"), /aria-current=/, "do not match a sibling with a shared prefix");
  const pages = loadSource("lib/docs/navigation.ts").DOCS_PAGES as Array<{ href: string }>;
  for (const page of pages) assert.ok(detail.includes(`href="${page.href}"`), `keep ${page.href} discoverable`);
  assert.doesNotMatch(detail, /class="[^"]*\btruncate\b/, "long technical labels must remain readable");
});

test("hub is a scoped reading surface with every guide and legacy anchor reachable", () => {
  const html = render("app/docs/page.tsx");
  assert.match(html, /class="docs-page-grid docs-hub"/, "the hub belongs to the same reading workspace as guides");
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /(?:in|about) (?:five|5) minutes|5-minute/i, "do not promise an unsupported integration time");
  for (const id of ["docs-paths", "docs-example", "docs-index", "docs-faq"]) {
    assert.ok(html.includes(`id="${id}"`), `keep the published #${id} target`);
    assert.ok(new RegExp(`<h2[^>]*id="${id}"[^>]*data-docs-heading`).test(html), `#${id} must join the live outline`);
  }
  const pages = loadSource("lib/docs/navigation.ts").DOCS_PAGES as Array<{ href: string }>;
  for (const page of pages.filter(({ href }) => href !== "/docs")) assert.ok(html.includes(`href="${page.href}"`), `keep ${page.href} in the guide index`);
  for (const href of ["/support", "/playground", "/docs/best-practices"]) assert.ok(html.includes(`href="${href}"`));
  assert.ok(html.indexOf("not a complete route") < html.indexOf("<pre"), "label the example boundary before a reader copies it");
});

function hubExample(): string {
  const Hub = loadSource("app/docs/page.tsx").default as () => ReactNode;
  const CodeBlock = loadSource("components/ui/CodeBlock.tsx").CodeBlock;
  const blocks = elements(Hub()).filter(({ element }) => element.type === CodeBlock);
  assert.equal(blocks.length, 1, "the hub should have one focused integration pattern");
  assert.equal(typeof blocks[0].element.props.children, "string");
  return blocks[0].element.props.children as string;
}

async function runHubExample(input: Record<string, unknown>, output: Record<string, unknown> | Error) {
  const BaseSoter = loadSource("packages/sdk/src/soter.ts").Soter as typeof import("../packages/sdk/src/soter").Soter;
  const calls: Array<{ url: string; body: unknown }> = [];
  const responses = [input, output];
  const defaults = { allowed: true, action: "ALLOW", riskScore: 0, riskTypes: [], reason: "Test fixture", findings: [] };
  class FixtureSoter extends BaseSoter {
    constructor() {
      super({ apiKey: "docs-test-fixture-not-a-key", baseUrl: "https://guard.fixture.invalid", retries: 0, maxRetries: 0,
        fetch: async (url, init) => {
          calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
          const response = responses.shift();
          if (response instanceof Error) throw response;
          return new Response(JSON.stringify({ ...defaults, ...response }), { status: 200, headers: { "content-type": "application/json" } });
        },
      });
    }
  }
  const code = hubExample().replace(/^import[^\n]*\n/gm, "");
  const compiled = ts.transpileModule(`(async function() {\n${code}\n})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, "the visible hub pattern must be valid TypeScript inside a server handler");
  const modelInputs: string[] = [];
  const execute = new Function("Soter", "userMessage", "callYourLLM", "process", `return ${compiled.outputText}`);
  const run = execute(FixtureSoter, "USER_RAW_INPUT", async (text: string) => { modelInputs.push(text); return "MODEL_RAW_SECRET"; }, { env: { SOTER_API_KEY: "docs-test-fixture-not-a-key" } });
  return { result: await run() as Record<string, unknown>, calls, modelInputs };
}

test("the hub pattern stops blocked, review, unknown and incomplete cleaned-text responses", async () => {
  const denied = [
    { allowed: false, action: "BLOCK" },
    { allowed: true, action: "BLOCK", safeText: "STILL_NOT_AUTHORIZED" },
    { allowed: true, action: "HUMAN_REVIEW" },
    { allowed: true, action: "FUTURE_ACTION" },
    { allowed: false, action: "ALLOW" },
    { allowed: true, action: "ALLOW_WITH_REDACTION" },
    { allowed: true, action: "REWRITE", safeText: "" },
  ];
  for (const decision of denied) {
    const output = await runHubExample({}, decision);
    assert.equal(output.result.blocked, true, `do not release output: ${JSON.stringify(decision)}`);
    assert.ok(!JSON.stringify(output.result).includes("MODEL_RAW_SECRET"), "blocked raw output must never be returned");
    const input = await runHubExample(decision, {});
    assert.equal(input.result.blocked, true);
    assert.deepEqual(input.modelInputs, [], "a denied input must not reach the model");
  }
  const redacted = await runHubExample({ action: "ALLOW_WITH_REDACTION", redactedText: "CLEAN_INPUT" }, { action: "REWRITE", safeText: "CLEAN_OUTPUT" });
  assert.deepEqual(redacted.modelInputs, ["CLEAN_INPUT"]);
  assert.equal(redacted.result.reply, "CLEAN_OUTPUT");
  assert.equal(redacted.result.blocked, false);
  assert.deepEqual(redacted.calls.map(({ url }) => new URL(url).pathname), ["/api/guard/input", "/api/guard/output"]);
  assert.deepEqual(redacted.calls.map(({ body }) => body), [{ message: "USER_RAW_INPUT", metadata: {} }, { aiResponse: "MODEL_RAW_SECRET" }]);
  await assert.rejects(() => runHubExample({}, new Error("Fixture network unavailable")), "transport errors must not release unchecked text");
});

// Browser-only interaction fixture: real React, DOM observers and owned source.
// The wrapper provides headings/navigation context, not a replacement component.
async function browserFixture(source: string, verify: (page: import("@playwright/test").Page) => Promise<void>, viewport = { width: 1440, height: 1000 }) {
  const esbuild = dependencyRequire("esbuild") as typeof import("esbuild");
  const { chromium } = dependencyRequire("@playwright/test") as typeof import("@playwright/test");
  const bundle = esbuild.buildSync({
    absWorkingDir: sourceRoot,
    stdin: { contents: source, resolveDir: sourceRoot, sourcefile: "workspace-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", metafile: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: { react: dirname(dependencyRequire.resolve("react/package.json")), "react-dom": dirname(dependencyRequire.resolve("react-dom/package.json")) },
    nodePaths: [resolve(dependencyRoot, "node_modules")],
    tsconfigRaw: { compilerOptions: { baseUrl: sourceRoot, paths: { "@/*": ["./*"] } } },
  });
  for (const input of Object.keys(bundle.metafile?.inputs ?? {})) {
    const file = resolve(sourceRoot, input);
    if (file.startsWith(sourceRoot + sep) && !file.includes(`${sep}node_modules${sep}`) && existsSync(file)) {
      consumed.set(file, createHash("sha256").update(readFileSync(file)).digest("hex"));
    }
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await verify(page);
    assert.deepEqual(errors, [], "owned components must not throw browser runtime errors");
  } catch (error) {
    console.log(JSON.stringify({ fixtureErrors: errors, fixtureRoot: await page.locator("#root").innerHTML() }));
    throw error;
  } finally { await context.close(); await browser.close(); }
}

test("empty states expose a real heading and a quiet decorative icon", () => {
  const html = render("components/docs/EmptyState.tsx", "EmptyState", { title: "No matching services", message: "Reset the search to see every control.", actionLabel: "Browse guides", actionHref: "/docs" });
  assert.match(html, /<h3[^>]*>No matching services<\/h3>/, "the empty state must remain navigable by heading");
  assert.match(html, /class="docs-empty-state"/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.match(html, /href="\/docs"/);
});

test("service directory filters by endpoint and returns focus after resetting empty results", { timeout: 45000 }, async () => {
  const services = loadSource("lib/docs/services.ts").SERVICES as Array<{ id: string; apiEndpoint?: string; title: string; description: string; longDescription: string }>;
  const sample = services.find((service) => service.apiEndpoint && !`${service.title} ${service.description} ${service.longDescription}`.toLowerCase().includes(service.apiEndpoint.split(" ").at(-1)!.toLowerCase()));
  if (!sample?.apiEndpoint) throw new Error("need a real catalog endpoint not already mentioned in its prose");
  const query = sample.apiEndpoint.split(" ").at(-1)!;
  await browserFixture(`
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { ServiceDirectory } from "./components/docs/ServiceDirectory";
    createRoot(document.getElementById("root")).render(<ServiceDirectory />);
  `, async (page) => {
    const search = page.getByRole("searchbox", { name: "Search security services" });
    await search.fill(query);
    const ids = await page.locator('a[href^="/docs/services/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.ok(ids.includes(`/docs/services/${sample.id}`), `endpoint ${query} should retrieve ${sample.id}, got ${ids}`);
    await search.fill("no-service-can-match-this-fixture");
    await page.getByText("No matching services", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Reset filters" }).click();
    assert.equal(await page.locator('a[href^="/docs/services/"]').count(), services.length, "reset must restore every real service");
    assert.equal(await search.evaluate((element) => element === document.activeElement), true, "reset must not leave keyboard focus on an unmounted button");
  });
});

test("mobile guide navigation traps focus and restores its trigger on Escape", { timeout: 45000 }, async () => {
  await browserFixture(`
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { DocsMobileNav } from "./components/docs/DocsMobileNav";
    createRoot(document.getElementById("root")).render(<><a id="outside" href="#outside">Outside navigation</a><DocsMobileNav /></>);
  `, async (page) => {
    const trigger = page.locator('button[aria-controls="docs-mobile-nav"]');
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Documentation navigation" });
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, "opening the menu must move focus inside it");
    await dialog.getByRole("button", { name: "Close navigation" }).focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, "reverse tab must stay inside the menu");
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
  }, { width: 390, height: 844 });
});

test("outline refreshes labels when navigation reuses the same heading ids", { timeout: 45000 }, async () => {
  await browserFixture(`
    import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { DocsToc } from "./components/docs/DocsToc";
    import { DocsHeading } from "./components/docs/DocsHeading";
    function Fixture() {
      const [next, setNext] = useState(false);
      return <><button id="switch-guide" onClick={() => setNext(true)}>Next guide</button>
        <article data-docs-article><DocsHeading id="setup">{next ? "Python setup" : "JavaScript setup"}</DocsHeading>
        <DocsHeading id="verify">Verify the result</DocsHeading></article><DocsToc /></>;
    }
    createRoot(document.getElementById("root")).render(<Fixture />);
  `, async (page) => {
    const outline = page.locator('nav[aria-labelledby="docs-toc-label"]');
    await outline.getByRole("link", { name: "JavaScript setup", exact: true }).waitFor();
    await page.locator("#switch-guide").click();
    await page.getByRole("heading", { name: "Python setup" }).waitFor();
    await page.waitForTimeout(100);
    const labels = await outline.getByRole("link").allTextContents();
    assert.ok(labels.includes("Python setup"), `stale outline after heading replacement: ${JSON.stringify(labels)}`);
    assert.ok(!labels.includes("JavaScript setup"));
  });
});

test("section anchors keep explicit legacy ids and accept keyboard navigation focus", () => {
  const html = render("components/docs/DocsHeading.tsx", "DocsHeading", { id: "legacy-install", children: "Install & configure", level: 3 });
  assert.match(html, /<h3[^>]*tabindex="-1"/, "a deep-linked heading must be a programmatic focus target");
  assert.match(html, /id="legacy-install"/);
  assert.match(html, /href="#legacy-install"/);
  assert.match(html, /data-docs-label="Install &amp; configure"/);
  assert.match(html, /aria-label="Link to this section: Install &amp; configure"/);
});

test("back to top respects the reader's reduced-motion preference", { timeout: 45000 }, async () => {
  await browserFixture(`
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { DocsToc } from "./components/docs/DocsToc";
    import { DocsHeading } from "./components/docs/DocsHeading";
    createRoot(document.getElementById("root")).render(<>
      <style>{'nav[aria-labelledby="docs-toc-label"] { position:fixed; top:20px; right:20px; }'}</style>
      <article data-docs-article style={{height:3000}}><DocsHeading>Setup</DocsHeading>
        <div style={{height:2000}} /><DocsHeading>Verify</DocsHeading></article><DocsToc /></>);
  `, async (page) => {
    await page.getByRole("heading", { name: "Setup" }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.getByRole("button", { name: "Back to top" }).waitFor();
    await page.evaluate(`(() => {
      const original = window.scrollTo.bind(window);
      window.scrollTo = (options) => {
        window.__docsScrollBehavior = options.behavior;
        original(options);
      };
    })()`);
    await page.getByRole("button", { name: "Back to top" }).click();
    const behavior = await page.evaluate(() => (window as Window & { __docsScrollBehavior?: string }).__docsScrollBehavior);
    assert.equal(behavior, "auto", "reduced motion must not request a smooth animation");
  });
});
