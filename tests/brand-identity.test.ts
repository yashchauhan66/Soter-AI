import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import Module, { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import sharp from "sharp";

const ROOT = process.cwd();
const asset = (name: string) => path.join(ROOT, "public", name);

// Compile the genuine production TSX with the framework's automatic JSX runtime.
// No production/source replacement and no mock image or React renderer.
function loadLogo(): React.ComponentType<{ size?: number; showWordmark?: boolean; wordmarkId?: string }> {
  const filename = path.join(ROOT, "components/layout/Logo.tsx");
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(ROOT, "node_modules")];
  mod.require = createRequire(filename);
  const result = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal((result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  (mod as unknown as { _compile(code: string, file: string): void })._compile(result.outputText, filename);
  return mod.exports.Logo;
}
const Logo = loadLogo();
const RASTERS = [
  { name: "logo-mark.png", size: 128 },
  { name: "logo-mark@2x.png", size: 256 },
  { name: "icon.png", size: 32 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-icon.png", size: 180, flatten: true },
] as const;

// This is a source-bound SVG contract, not a trademark or visual-approval claim.
test("SoterAI has an original Sentinel-S vector master rather than a stock circular shield", () => {
  const file = asset("brand/soterai-symbol.svg");
  assert.ok(existsSync(file), "The custom Sentinel-S vector master is missing");
  const svg = readFileSync(file, "utf8");
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /data-brand-symbol="sentinel-s"/);
  assert.match(svg, /<title[^>]*>SoterAI/);
  assert.match(svg, /#14110f/i);
  assert.match(svg, /#f96403/i);
  assert.doesNotMatch(svg, /<(?:script|foreignObject|image|circle|linearGradient|radialGradient)\b/i);
  assert.doesNotMatch(svg, /(?:href|onload|onclick)\s*=/i);
});

test("the existing live display name and decorative-image accessibility contract are preserved", () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { size: 30, wordmarkId: "identity-home" }));
  assert.equal(html.replace(/<[^>]*>/g, ""), "SoterAI");
  assert.match(html, /id="identity-home"/);
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /brand(?:%2F|\/)selected(?:%2F|\/)symbol\.png/);
  const compact = renderToStaticMarkup(React.createElement(Logo, { size: 24, showWordmark: false }));
  assert.equal(compact.replace(/<[^>]*>/g, ""), "");
});

test("the retained legacy raster set still matches its archived Sentinel-S master", async () => {
  const master = readFileSync(asset("brand/soterai-symbol.svg"));
  for (const item of RASTERS) {
    let pipeline = sharp(master).resize(item.size, item.size, {
      fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if ("flatten" in item) pipeline = pipeline.flatten({ background: "#14110f" });
    const expected = await pipeline.png({ compressionLevel: 9, palette: true, colours: 64, effort: 10 }).toBuffer();
    const actualPixels = await sharp(readFileSync(asset(item.name))).ensureAlpha().raw().toBuffer();
    const expectedPixels = await sharp(expected).ensureAlpha().raw().toBuffer();
    assert.equal(Buffer.compare(actualPixels, expectedPixels), 0, `${item.name} does not match the vector master`);
  }
});

test("favicon dimensions and the existing root asset addresses remain stable", async () => {
  for (const item of RASTERS) {
    assert.ok(existsSync(asset(item.name)), `${item.name} must retain its public address`);
    const metadata = await sharp(asset(item.name)).metadata();
    assert.equal(metadata.width, item.size);
    assert.equal(metadata.height, item.size);
    assert.equal(metadata.format, "png");
  }
});

test("the shared live lockup keeps one bespoke SoterAI name beside the selected hexagon", () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { wordmarkId: "identity-home" }));
  assert.match(html, /data-brand-lockup="sentinel-s"/);
  assert.match(html, /data-brand-geometry="selected-hexagon"/);
  assert.match(html, /<span\b[^>]*id="identity-home"[^>]*>SoterAI<\/span>/);
  assert.match(html, /class="[^"]*soter-wordmark[^"]*"/);
  assert.doesNotMatch(html, /soter-wordmark-ai|font-display|>AI<\/span>/);
});

test("downloadable monochrome and outlined wordmark SVGs are self-contained members of the same brand family", () => {
  for (const name of ["soterai-symbol-mono.svg", "soterai-wordmark.svg"]) {
    const file = asset("brand/" + name);
    assert.ok(existsSync(file), `${name} is missing from the brand kit`);
    const svg = readFileSync(file, "utf8");
    assert.match(svg, /data-brand-symbol="sentinel-s"/);
    assert.match(svg, /<title[^>]*>SoterAI/);
    assert.match(svg, /<path\b/);
    assert.doesNotMatch(svg, /<(?:text|script|foreignObject|image)\b/i);
    assert.doesNotMatch(svg, /(?:href|onload|onclick)\s*=/i);
  }
  assert.match(readFileSync(asset("brand/soterai-symbol-mono.svg"), "utf8"), /fill-rule="evenodd"/);
});
