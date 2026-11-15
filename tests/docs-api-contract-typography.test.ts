import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../tailwind.config";

// Real source-rendered page + actual Tailwind/theme/docs CSS, in an isolated
// browser. No application server, account, engine, or network access is used.
// The sole adapter is treating imported CSS as build input, then applying it.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencyRequire = createRequire(resolve(root, "package.json"));
const React = dependencyRequire("react") as typeof import("react");
const { renderToStaticMarkup } = dependencyRequire("react-dom/server") as typeof import("react-dom/server");
const ts = dependencyRequire("typescript") as typeof import("typescript");
const logicalPage = resolve(root, "app/docs/api-contract/page.tsx");
const sourcePage = resolve(process.env.DOCS_TYPOGRAPHY_PAGE_SOURCE ?? logicalPage);
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const pageHash = sha(readFileSync(sourcePage));
if (process.env.DOCS_TYPOGRAPHY_PAGE_SOURCE || process.env.DOCS_TYPOGRAPHY_PAGE_SHA256) {
  assert.match(process.env.DOCS_TYPOGRAPHY_PAGE_SHA256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(pageHash, process.env.DOCS_TYPOGRAPHY_PAGE_SHA256, "selected page bytes must match their authorized pin");
}
const consumed = new Map<string, string>();
const modules = new Map<string, { exports: Record<string, unknown> }>();
function loadSource(path: string): Record<string, unknown> {
  const logical = resolve(root, path);
  assert.ok(logical.startsWith(root + sep), "local imports must remain in the repository");
  const cached = modules.get(logical);
  if (cached) return cached.exports;
  const actual = logical === logicalPage ? sourcePage : logical;
  const bytes = readFileSync(actual);
  consumed.set(actual, sha(bytes));
  const module = { exports: {} as Record<string, unknown> };
  modules.set(logical, module);
  const compiled = ts.transpileModule(bytes.toString("utf8"), {
    fileName: logical,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, "page dependencies must compile");
  const requireLocal = (id: string): unknown => {
    if (id.endsWith(".css")) return {};
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? resolve(root, id.slice(2)) : resolve(dirname(logical), id);
      const candidates = extname(target) ? [target] : [target + ".ts", target + ".tsx", resolve(target, "index.ts")];
      const found = candidates.find((candidate) => existsSync(candidate));
      assert.ok(found, `missing local dependency: ${id}`);
      return loadSource(found);
    }
    return dependencyRequire(id);
  };
  // Fixed repository declarations (or explicitly hash-pinned baseline bytes),
  // never request, API, query, or user-supplied application data.
  const execute = runInThisContext(`(function(exports, require, module) {${compiled.outputText}\n})`, { filename: actual });
  execute(module.exports, requireLocal, module);
  return module.exports;
}

let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page;
const pageErrors: string[] = [];
const blockedRequests: string[] = [];
const observations: Array<Record<string, unknown>> = [];
let htmlHash = "";
let cssHash = "";
before(async () => {
  consumed.set(resolve(root, "tailwind.config.ts"), sha(readFileSync(resolve(root, "tailwind.config.ts"))));
  const Component = loadSource(logicalPage).default as React.ComponentType;
  const html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Isolated typography regression</title></head><body>"
    + renderToStaticMarkup(React.createElement("div", { className: "docs-workspace" }, React.createElement(Component)))
    + "</body></html>";
  htmlHash = sha(html);
  const cssSources = ["app/globals.css", "components/docs/docs.css", "components/ui/code-block.css"];
  const input = cssSources.map((relative) => {
    const path = resolve(root, relative);
    const bytes = readFileSync(path);
    consumed.set(path, sha(bytes));
    return bytes.toString("utf8");
  }).join("\n");
  const css = (await postcss([tailwindcss({ ...config, content: [{ raw: html, extension: "html" }] })])
    .process(input, { from: resolve(root, "app/globals.css") })).css;
  cssHash = sha(css);
  const { chromium } = dependencyRequire("@playwright/test") as typeof import("@playwright/test");
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => { blockedRequests.push(route.request().url()); return route.abort(); });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setContent(html);
  await page.addStyleTag({ content: css });
});

after(async () => {
  await context?.close();
  await browser?.close();
  assert.deepEqual(pageErrors, [], "real rendered components must not raise browser errors");
  assert.ok([...consumed].every(([path, pin]) => sha(readFileSync(path)) === pin), "consumed source must not drift");
  console.log("DOCS_TYPOGRAPHY_OBSERVATIONS " + JSON.stringify({
    source_page: sourcePage, source_sha256: pageHash,
    test_sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
    root, consumed: Object.fromEntries(consumed), html_sha256: htmlHash, css_sha256: cssHash,
    observations, blocked_requests: blockedRequests, browser_errors: pageErrors,
    fixture: "Actual React SSR and compiled project CSS; isolated computed-style control, not production/visual approval",
    browser_closed: browser ? !browser.isConnected() : true,
  }));
});

test("API-contract prose renders at 16px at every required desktop width", async () => {
  for (const width of [1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    const paragraphs = await page.locator(".docs-body p").evaluateAll((nodes) => nodes.map((node) => ({
      text: node.textContent?.trim(), font: getComputedStyle(node).fontSize, lineHeight: getComputedStyle(node).lineHeight,
    })));
    const prose = paragraphs.filter((row) => row.text !== "Webhook Headers");
    observations.push({ case: "prose", width, paragraphs });
    assert.equal(prose.length, 15, "exercise every original prose paragraph, not a convenient sample");
    assert.ok(prose.every((row) => row.text), "do not qualify empty replacement paragraphs");
    for (const row of prose) assert.equal(row.font, "16px", `${width}px: ${row.text?.slice(0, 90)}`);
  }
});

test("API-contract label, reference tables and pager keep compact typography", async () => {
  const labels = await page.locator(".docs-body p").evaluateAll((nodes) => nodes
    .filter((node) => node.textContent?.trim() === "Webhook Headers")
    .map((node) => getComputedStyle(node).fontSize));
  const tables = await page.locator(".docs-body table").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fontSize));
  const pager = await page.locator(".docs-body > div:last-child a").evaluateAll((nodes) => nodes.map((node) => ({
    href: node.getAttribute("href"), font: getComputedStyle(node).fontSize,
  })));
  observations.push({ case: "compact-controls", labels, tables, pager });
  assert.deepEqual(labels, ["14px"]);
  assert.deepEqual(tables, ["14px", "14px"]);
  assert.deepEqual(pager, [{ href: "/docs/quickstart", font: "14px" }, { href: "/docs", font: "14px" }]);
});
