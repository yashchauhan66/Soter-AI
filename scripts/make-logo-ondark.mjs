// Builds a dark-background variant of the logo: recolors the dark, low-chroma
// navy parts (the "Soter" wordmark + shield outline) to light slate so they read
// on the dark header, while leaving the vibrant blue/cyan/gold gradients intact.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (f) => path.join(root, "public", f);

const LIGHT = [233, 238, 247]; // #e9eef7
const LUM_MAX = 120;   // only touch dark pixels
const CHROMA_MAX = 75; // only touch low-chroma (navy/gray/black), not vivid gradients

(async () => {
  const { data, info } = await sharp(pub("SoterAILogo.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum < LUM_MAX && chroma < CHROMA_MAX) {
      // Blend toward light, fully for the darkest pixels, softer near the threshold.
      const t = Math.min(1, (LUM_MAX - lum) / LUM_MAX + 0.45);
      data[i] = Math.round(r * (1 - t) + LIGHT[0] * t);
      data[i + 1] = Math.round(g * (1 - t) + LIGHT[1] * t);
      data[i + 2] = Math.round(b * (1 - t) + LIGHT[2] * t);
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(pub("SoterAILogo-onDark.png"));
  console.log(`SoterAILogo-onDark.png -> ${width}x${height}`);
})();
