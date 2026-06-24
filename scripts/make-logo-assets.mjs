// Generates transparent, trimmed logo assets from public/SoterAILogo.png.
// - Overwrites SoterAILogo.png with a transparent + trimmed horizontal logo (header/footer use).
// - Generates square favicons (icon.png, icon-192, icon-512, apple-icon) from the shield mark.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public", "SoterAILogo.png");
const pub = (f) => path.join(root, "public", f);

// Knock out the near-white background -> transparent, with a soft edge.
async function toTransparent(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    let a;
    if (m >= 238) a = 0;
    else if (m <= 225) a = 255;
    else a = Math.round(((238 - m) / 13) * 255);
    data[i + 3] = a;
  }
  return sharp(data, { raw: { width, height, channels } }).png();
}

(async () => {
  // 1. Transparent + trimmed horizontal logo (overwrite source).
  const transparentBuf = await (await toTransparent(src)).toBuffer();
  await sharp(transparentBuf)
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
    .then((b) => sharp(b).toFile(pub("SoterAILogo.png")));
  const meta = await sharp(pub("SoterAILogo.png")).metadata();
  console.log(`SoterAILogo.png trimmed -> ${meta.width}x${meta.height}`);

  // 2. Shield mark for square icons: trim, then take the left square region (the shield).
  const trimmed = await sharp(transparentBuf).trim({ threshold: 1 }).toBuffer();
  const tMeta = await sharp(trimmed).metadata();
  const side = tMeta.height; // shield is roughly as wide as it is tall, anchored left
  const shield = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: Math.min(side, tMeta.width), height: tMeta.height })
    .trim({ threshold: 1 })
    .toBuffer();
  const sMeta = await sharp(shield).metadata();
  console.log(`shield mark -> ${sMeta.width}x${sMeta.height}`);

  // Square-pad the shield on the dark brand background so favicons read on light tabs too.
  const square = Math.max(sMeta.width, sMeta.height);
  const pad = Math.round(square * 0.12);
  async function makeIcon(size, file, bg) {
    const padded = await sharp(shield)
      .resize(square, square, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    let img = sharp(padded).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (bg) img = img.flatten({ background: bg });
    await img.png().toFile(pub(file));
    console.log(`${file} -> ${size}x${size}`);
  }

  const ink = { r: 11, g: 17, b: 23 }; // #0b1117
  await makeIcon(32, "icon.png", ink);
  await makeIcon(192, "icon-192.png", ink);
  await makeIcon(512, "icon-512.png", ink);
  await makeIcon(180, "apple-icon.png", ink);
})();
