/**
 * Export SoterAI marketplace icon SVGs to PNG at multiple sizes.
 *
 * Usage:
 *   npx resvg-cli public/marketplace/soterai-icon.svg -w 256 -h 256 -o public/marketplace/soterai-icon-256.png
 *
 * Or if resvg-js is available:
 *   node scripts/export-marketplace-icons.mjs
 *
 * Requires: npm install --save-dev @resvg/resvg-js
 * If @resvg/resvg-js is not installed, follow the manual instructions below.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "marketplace", "soterai-icon.svg");
const outDir = join(root, "public", "marketplace");

const sizes = [
  { name: "soterai-icon-128.png", width: 128 },
  { name: "soterai-icon-256.png", width: 256 },
  { name: "soterai-icon-512.png", width: 512 },
];

async function main() {
  if (!existsSync(svgPath)) {
    console.error(`SVG not found at ${svgPath}`);
    process.exit(1);
  }

  let Resvg;
  try {
    const mod = await import("@resvg/resvg-js");
    Resvg = mod.Resvg;
  } catch {
    console.log("@resvg/resvg-js not installed.");
    console.log("");
    console.log("To install:  npm install --save-dev @resvg/resvg-js");
    console.log("Then re-run: node scripts/export-marketplace-icons.mjs");
    console.log("");
    console.log("Or use an online SVG-to-PNG converter:");
    console.log(`  1. Open ${svgPath}`);
    console.log("  2. Export at 128x128, 256x256, and 512x512");
    console.log(`  3. Save to ${outDir}/soterai-icon-{size}.png`);
    process.exit(0);
  }

  const svg = readFileSync(svgPath, "utf-8");

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const { name, width } of sizes) {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    const rendered = resvg.render();
    const pngBuffer = rendered.asPng();
    const outPath = join(outDir, name);
    writeFileSync(outPath, pngBuffer);
    console.log(`Exported ${name} (${width}x${width})`);
  }

  console.log("Done. PNG icons saved to public/marketplace/");
}

main().catch(console.error);
