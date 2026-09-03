/**
 * Generates every brand raster from the single source of truth,
 * `public/logo_circle_whiter.png` (1254x1254, white glyph on a #f96403 disc).
 *
 * ## Why this replaces `make-logo-assets.mjs`
 *
 * That script read `public/SoterAILogo.png`, a file that no longer exists, and
 * flattened every favicon onto `#0b1117` — a near-black square, which is what a
 * dark product wants and exactly wrong now: a black-backed tab icon on a white
 * site reads as a different brand.
 *
 * ## What it emits, and why each one exists
 *
 * - `logo-mark.png` (128px)  — the header/footer mark. The header was loading a
 *   448 KB `logo.png` to render at 114x40 CSS px; at DPR 2 that is 228x80 of
 *   actual pixels, so ~99% of the bytes were discarded by the browser after
 *   being downloaded, parsed, and decoded on the critical path.
 * - `logo-mark@2x.png` (256px) — retina, wired through `srcSet`.
 * - `icon.png` / `icon-192.png` / `icon-512.png` / `apple-icon.png` — favicons
 *   and the PWA install icon.
 *
 * ## The transparency decision
 *
 * The source has a near-white glyph on an opaque orange disc. The disc is kept:
 * knocking it out would leave a white shield that is invisible on a white page.
 * What *is* removed is the transparent bleed outside the circle, via `trim()`,
 * so the mark sits on its own bounding box and vertical rhythm in the header is
 * set by the circle rather than by whitespace baked into a PNG.
 *
 * Apple icons are the exception: iOS composites them onto white and applies its
 * own mask, so `apple-icon.png` is flattened onto the brand orange to fill the
 * rounded square instead of showing a circle inside a square.
 *
 * Usage: node scripts/make-brand-assets.mjs
 */
import sharp from "sharp";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (file) => path.join(root, "public", file);

const SOURCE = pub("logo_circle_whiter.png");
/** The disc colour, sampled from the source. Also `--brand-graphic` in globals.css. */
const BRAND = { r: 249, g: 100, b: 3 };

async function emit(buffer, size, file, { flattenTo } = {}) {
  let pipeline = sharp(buffer).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (flattenTo) pipeline = pipeline.flatten({ background: flattenTo });

  // The mark is a two-colour graphic (white glyph, orange disc) plus antialiased
  // edges, so an indexed PNG is far smaller than truecolour with no visible
  // difference. `colours: 64` leaves ~62 shades for the edge ramp and cuts
  // `icon-512.png` from 198 kB truecolour / 123 kB full-palette to 41 kB.
  await pipeline.png({ compressionLevel: 9, palette: true, colours: 64, effort: 10 }).toFile(pub(file));

  const { size: bytes } = await stat(pub(file));
  console.log(`${file.padEnd(20)} ${String(size).padStart(4)}px  ${(bytes / 1024).toFixed(1)} kB`);
}

const source = await sharp(SOURCE).metadata();
console.log(`source: logo_circle_whiter.png ${source.width}x${source.height}\n`);

// Trim the transparent margin so the disc defines the box.
const mark = await sharp(SOURCE).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();
const trimmed = await sharp(mark).metadata();
console.log(`trimmed to ${trimmed.width}x${trimmed.height}\n`);

await emit(mark, 128, "logo-mark.png");
await emit(mark, 256, "logo-mark@2x.png");
await emit(mark, 32, "icon.png");
await emit(mark, 192, "icon-192.png");
await emit(mark, 512, "icon-512.png");
// iOS masks this into a rounded square and offers no transparency.
await emit(mark, 180, "apple-icon.png", { flattenTo: BRAND });
