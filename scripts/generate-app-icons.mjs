/**
 * Generate the app/PWA PNG icons referenced by app/layout.tsx and app/manifest.ts
 * from the single source-of-truth brand SVG (public/marketplace/soterai-icon.svg).
 *
 * Keeps public/icon-192.png, public/icon-512.png, public/icon.png and
 * public/apple-icon.png in sync so the web manifest and <link rel="icon">
 * references never point at a missing file.
 *
 * By default only missing icons are written (existing hand-tuned PNGs such as
 * icon-512.png are left untouched). Pass --force to regenerate every icon.
 *
 * Usage:
 *   node scripts/generate-app-icons.mjs
 *   node scripts/generate-app-icons.mjs --force
 *
 * Requires: @resvg/resvg-js (already a devDependency).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "marketplace", "soterai-icon.svg");

const targets = [
  { name: "icon.png", width: 32 },
  { name: "icon-192.png", width: 192 },
  { name: "icon-512.png", width: 512 },
  { name: "apple-icon.png", width: 180 },
];

async function main() {
  const force = process.argv.includes("--force");
  const { Resvg } = await import("@resvg/resvg-js");
  const svg = readFileSync(svgPath, "utf-8");

  for (const { name, width } of targets) {
    const outPath = join(root, "public", name);
    if (!force && existsSync(outPath)) {
      console.log(`Skipped public/${name} (already exists; use --force to overwrite)`);
      continue;
    }
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    writeFileSync(outPath, resvg.render().asPng());
    console.log(`Generated public/${name} (${width}x${width})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
