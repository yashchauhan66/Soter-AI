import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import test, { after } from "node:test";
import { runInThisContext } from "node:vm";
import type { ServiceDoc } from "../lib/docs/services";
import type { ServiceExperience } from "../lib/docs/serviceExperience";

const sourceRoot = resolve(process.env.DOCS_SERVICES_SOURCE ?? process.cwd());
const dependencyRoot = resolve(process.env.DOCS_SERVICES_DEPS ?? process.cwd());
const dependencyRequire = createRequire(resolve(dependencyRoot, "package.json"));
const React = dependencyRequire("react") as typeof import("react");
const { renderToStaticMarkup } = dependencyRequire("react-dom/server") as typeof import("react-dom/server");
const ts = dependencyRequire("typescript") as typeof import("typescript");
const cache = new Map<string, { exports: Record<string, unknown> }>();
const consumed = new Map<string, string>();

function loadSource(relative: string): Record<string, unknown> {
  const file = resolve(sourceRoot, relative);
  assert.ok(file.startsWith(sourceRoot + sep), "fixture source must stay inside the selected tree");
  const cached = cache.get(file);
  if (cached) return cached.exports;
  const module = { exports: {} as Record<string, unknown> };
  cache.set(file, module);
  const bytes = readFileSync(file);
  consumed.set(file, createHash("sha256").update(bytes).digest("hex"));
  const compiled = ts.transpileModule(bytes.toString("utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, `invalid source ${relative}`);
  const localRequire = (id: string): unknown => {
    // CSS/layout is checked in the real production-browser crawl, not this SSR fixture.
    if (id.endsWith(".css")) return {};
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? resolve(sourceRoot, id.slice(2)) : resolve(dirname(file), id);
      const candidates = extname(target) ? [target] : [target + ".ts", target + ".tsx", target + "/index.ts"];
      const found = candidates.find(existsSync);
      assert.ok(found, `missing local source ${id}`);
      if (extname(found) === ".json") return JSON.parse(readFileSync(found, "utf8"));
      return loadSource(found);
    }
    return dependencyRequire(id);
  };
  const execute = runInThisContext(`(function(exports, require, module) {${compiled.outputText}\n})`, { filename: file });
  execute(module.exports, localRequire, module);
  return module.exports;
}

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

test("all 33 real service pages render their specific setup, verification, auth and limits", async () => {
  const services = loadSource("lib/docs/services.ts").SERVICES as ServiceDoc[];
  const experiences = loadSource("lib/docs/serviceExperience.ts").SERVICE_EXPERIENCE as Record<string, ServiceExperience>;
  const Page = loadSource("app/docs/services/[id]/page.tsx").default as (props: { params: Promise<{ id: string }> }) => Promise<React.ReactNode>;
  assert.equal(services.length, 33);
  for (const service of services) {
    const experience = experiences[service.id];
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: service.id }) }));
    assert.match(html, /data-docs-article/, `${service.id}: must use the documentation reading lane`);
    assert.match(html, /data-docs-heading/, `${service.id}: outline must use real headings`);
    assert.ok(html.includes(escape(experience.authentication.label)), `${service.id}: authentication must be visible`);
    for (const field of ["setup", "validation"] as const) {
      assert.ok(experience[field]?.length, `${service.id}: missing ${field}`);
      for (const step of experience[field]) assert.ok(html.includes(escape(step.body)), `${service.id}: ${field} step is not visible`);
    }
    for (const limitation of experience.limitations) assert.ok(html.includes(escape(limitation)), `${service.id}: limitation is not visible`);
    for (const anchor of ["setup", "why", "how-it-works", "features", "integration", "related"]) {
      if (anchor === "related" && !service.relatedDocs?.length) continue;
      assert.ok(html.includes(`id="${anchor}"`), `${service.id}: lost legacy anchor ${anchor}`);
    }
    assert.doesNotMatch(html, /Done when:[\s\S]*event is visible in logs/, `${service.id}: generic log persistence promise must be removed`);
  }
});

test("the service directory uses the shared reading hierarchy and describes source review honestly", () => {
  const Page = loadSource("app/docs/services/page.tsx").default as React.ComponentType;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /class="docs-title"/);
  assert.match(html, /authentication[\s\S]*limitations/i);
  assert.doesNotMatch(html, /configure it, integrate it, and verify the result/);
});

after(() => console.log(JSON.stringify({ sourceRoot, dependencyRoot, consumed: Object.fromEntries(consumed), boundary: "real repository component SSR; CSS and hydrated interactions require the production-browser crawl" })));
