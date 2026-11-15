import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

// Optional read-only replay against the frozen pre-change overlay. Dependencies
// still resolve from this isolated worktree; no original source is overwritten.
const ROOT = path.resolve(process.env.SOTER_BRAND_SOURCE_ROOT ?? process.cwd());
const consumed = new Map<string, string>();
function source(relative: string): Buffer {
  const filename = path.join(ROOT, relative);
  const bytes = readFileSync(filename);
  consumed.set(filename, createHash("sha256").update(bytes).digest("hex"));
  return bytes;
}

test("custom lettering is a real seven-glyph font with intentional pair spacing", () => {
  const load = createRequire(path.join(process.cwd(), "package.json"));
  const font = load("fontkit").create(source("public/brand/soterai-signature.woff"));
  const run = font.layout("SoterAI");
  assert.equal(font.familyName, "SoterAI Signature");
  assert.equal(font.postscriptName, "SoterAI-Signature-SemiBold");
  assert.deepEqual(run.glyphs.map((glyph: { name: string }) => glyph.name), [..."SoterAI"]);
  for (const glyph of run.glyphs) {
    assert.ok(glyph.id > 0);
    assert.ok(glyph.bbox.maxY > glyph.bbox.minY);
    assert.ok(glyph.bbox.maxX > glyph.bbox.minX);
  }
  assert.equal(run.positions.reduce((sum: number, pos: { xAdvance: number }) => sum + pos.xAdvance, 0), 3300);
});

test("the retained monochrome cube keeps the previous icon geometry", () => {
  const master = source("public/brand/soterai-symbol.svg");
  const mono = source("public/brand/soterai-symbol-mono.svg");
  assert.equal(createHash("sha256").update(master).digest("hex"), "6bf900b7c47b928fb49ebd3895a3db7a10133e1bee51b321328b355bd234a648");
  assert.equal(createHash("sha256").update(mono).digest("hex"), "4ec231c7790af7164abce3bf6d087008a2ac4dccd3f5c9f5c967801aed06145f");
});

test("the compact header uses its single visible name as the home label", () => {
  const header = source("components/layout/SiteChrome.tsx").toString();
  assert.match(header, /<Logo\s+size=\{36\}\s+priority\s+wordmarkId="site-header-wordmark"/);
  assert.match(header, /className="flex min-h-11 shrink-0 items-center rounded-lg"/, "The 36px symbol needs a 44px home-link target");
  assert.match(header, /aria-labelledby="site-header-wordmark site-header-home"/);
  assert.match(header, /<span id="site-header-home" className="sr-only">home<\/span>/);
});

test("the Apple icon retains its earlier cube artwork and ink surface", async () => {
  const { data, info } = await sharp(source("public/apple-icon.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 180);
  assert.equal(info.height, 180);
  assert.deepEqual([...data.subarray(0, 4)], [20, 17, 15, 255]);
});

process.on("exit", () => console.log("SOTER_CUSTOM_BRAND_CONSUMED " + JSON.stringify(Object.fromEntries(consumed))));
