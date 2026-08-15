// Rasterizes the shared SoterAI mark into the PNG sizes each marketplace wants.
//
// Make and Zapier both take a PNG, not an SVG, so the SVG alone does not reach
// the user — it has to be rendered. Doing that by hand in an image editor is how
// the three integrations drifted apart in the first place (Make and Zapier were
// shipping a generic blue shield-and-checkmark that is not the SoterAI logo at
// all). This script makes the shared SVG the single source and the PNGs a build
// artifact of it.
//
// Alpha is preserved end to end: resvg renders onto a transparent canvas and
// sharp writes RGBA. A flattened background is exactly the bug that makes
// public/icon-512.png unusable as a node icon, so it is worth being explicit.
//
//   node scripts/dev/render-integration-icons.mjs
//
// Re-run it after any edit to packages/integrations/shared/soterai-icon.svg.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = resolve(root, "packages/integrations/shared/soterai-icon.svg");

// Sizes are dictated by each marketplace, not chosen by us:
//   Make requires a 512x512 app icon; 256 and the unsuffixed file are kept
//   because app.json and the docs already reference those names.
//   Zapier requires a square RGBA PNG of at least 256x256.
const TARGETS = [
  { path: "packages/integrations/shared/soterai-icon.png", size: 512 },
  { path: "packages/integrations/make/soterai-icon-512.png", size: 512 },
  { path: "packages/integrations/make/soterai-icon-256.png", size: 256 },
  { path: "packages/integrations/make/soterai-icon.png", size: 256 },
  { path: "packages/integrations/zapier/soterai-zapier-icon-256-rgba.png", size: 256 },
];

const svg = readFileSync(source, "utf8");

for (const target of TARGETS) {
  // Render at the target size directly rather than downscaling one large
  // bitmap: the ring is a 2.6px stroke at 64px, and resampling it turns the
  // stroke grey at 256.
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: target.size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();

  // resvg already emits RGBA; running it through sharp with an explicit
  // `ensureAlpha` guarantees the channel survives even if resvg ever decides a
  // fully-opaque render can drop it. Zapier rejects a 3-channel PNG.
  const png = await sharp(rendered).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
  const { channels, hasAlpha, width, height } = await sharp(png).metadata();

  if (!hasAlpha || channels !== 4) {
    throw new Error(`${target.path} lost its alpha channel (channels=${channels}); refusing to write an opaque icon.`);
  }

  writeFileSync(resolve(root, target.path), png);
  console.log(`  ${target.path.padEnd(56)} ${width}x${height} RGBA ${(png.length / 1024).toFixed(1)} KB`);
}

console.log(`\nRendered ${TARGETS.length} icons from ${source}`);
