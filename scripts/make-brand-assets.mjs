/** Export the selected release symbol for favicons, app icons and the press kit. */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "public/brand/selected/symbol.png");
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output-dir" || !args[1])) {
  throw new Error("Usage: make-brand-assets.mjs [--output-dir <directory>]");
}
const outputDir = args.length ? path.resolve(args[1]) : path.join(root, "public/brand/selected");
const master = await readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(master).digest("hex");
if (sourceSha256 !== "bcbc6cd5335ae9ad147ff93d760b62d3e85ff951de66f819d1e60c590157b15c") {
  throw new Error("The selected release symbol changed; review the source before exporting it.");
}
const metadata = await sharp(master).metadata();
if (metadata.format !== "png" || metadata.width !== 223 || metadata.height !== 223) {
  throw new Error("The selected release symbol must be a 223x223 PNG");
}
const paper = { r: 251, g: 250, b: 247, alpha: 1 };
const exports = [
  { file: "logo-mark.png", size: 128 },
  { file: "logo-mark@2x.png", size: 256 },
  { file: "icon.png", size: 32 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512, maskable: true },
  { file: "apple-icon.png", size: 180, flatten: true },
];
const rendered = [];
for (const item of exports) {
  // Keep the complete symbol within the central safe area for adaptive app icons.
  const markSize = item.maskable ? Math.floor(item.size * 0.7) : item.size;
  let pipeline = sharp(master).resize(markSize, markSize, {
    fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (item.maskable) {
    const before = Math.floor((item.size - markSize) / 2);
    const after = item.size - markSize - before;
    pipeline = pipeline.extend({ top: before, left: before, bottom: after, right: after, background: paper });
  }
  if (item.flatten || item.maskable) pipeline = pipeline.flatten({ background: paper });
  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  rendered.push({ ...item, buffer });
}
await mkdir(outputDir, { recursive: true });
const records = [];
for (const item of rendered) {
  const file = path.join(outputDir, item.file);
  await writeFile(file, item.buffer);
  records.push({ file, size: item.size, bytes: item.buffer.length, sha256: createHash("sha256").update(item.buffer).digest("hex") });
}
console.log(JSON.stringify({ source: sourcePath, sourceSha256, outputDir, rasters: records }));
